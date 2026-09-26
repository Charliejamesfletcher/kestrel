import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const workingDb = { query: async () => ({ rows: [] }) } as never;
const brokenDb = {
  query: async () => {
    throw new Error('connection refused');
  }
} as never;

describe('GET /health', () => {
  it('reports ok when the database answers', async () => {
    const app = buildApp({ db: workingDb, version: 'test' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', database: true, version: 'test' });
  });

  it('returns 503 when the database is down', async () => {
    const app = buildApp({ db: brokenDb, version: 'test' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json().database).toBe(false);
  });
});
