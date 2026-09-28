import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp, chooseScope } from './app.js';

const workingDb = { query: async () => ({ rows: [] }) } as never;
const brokenDb = {
  query: async () => {
    throw new Error('connection refused');
  }
} as never;

describe('GET /health', () => {
  it('reports ok when the database answers', async () => {
    const app = buildApp({ db: workingDb, version: 'test', webDist: null });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', database: true, version: 'test' });
    expect((await app.inject({ method: 'GET', url: '/api/health' })).json()).toEqual(res.json());
  });

  it('returns 503 when the database is down', async () => {
    const app = buildApp({ db: brokenDb, version: 'test', webDist: null });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json().database).toBe(false);
  });
});

describe('chooseScope', () => {
  const scopes = [
    { scope: 'all' as const, games: 50 },
    { scope: 'bullet' as const, games: 30 },
    { scope: 'blitz' as const, games: 20 }
  ];
  it('uses the asked-for scope only when there is a report for it', () => {
    expect(chooseScope('blitz', scopes)).toBe('blitz');
    expect(chooseScope('all', scopes)).toBe('all');
    expect(chooseScope('rapid', scopes)).toBe('bullet');
    expect(chooseScope(undefined, scopes)).toBe('bullet');
    expect(chooseScope(undefined, [{ scope: 'all', games: 0 }])).toBe('all');
  });
});

describe('serving the web app', () => {
  const dist = mkdtempSync(join(tmpdir(), 'kestrel-web-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Kestrel</title>');
  writeFileSync(join(dist, 'assets', 'app.js'), 'console.log(1)');
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  const app = buildApp({ db: workingDb, version: 'test', webDist: dist });

  it('serves the site and its files', async () => {
    const home = await app.inject({ method: 'GET', url: '/' });
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain('<title>Kestrel</title>');
    const js = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(js.statusCode).toBe(200);
    expect(js.headers['content-type']).toMatch(/javascript/);
  });

  it('sends index.html for app pages so the web app can route them', async () => {
    for (const url of ['/chesscom/hikaru', '/lichess/DrNykterstein?scope=blitz']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.body).toContain('<title>Kestrel</title>');
    }
  });

  it('keeps unknown API paths as JSON 404s', async () => {
    for (const url of ['/api/nope', '/api/report/chesscom']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: 'not found' });
    }
    expect((await app.inject({ method: 'POST', url: '/chesscom/hikaru' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/health' })).json()).toMatchObject({ status: 'ok' });
  });

  it('serves no site when there is no build', async () => {
    const apiOnly = buildApp({ db: workingDb, version: 'test', webDist: join(dist, 'missing') });
    const res = await apiOnly.inject({ method: 'GET', url: '/chesscom/hikaru' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not found' });
  });
});
