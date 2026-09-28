import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  claimNext,
  createPool,
  enqueue,
  markNotFound,
  migrate,
  rebuildReports,
  retryLater,
  saveGames,
  upsertPlayer
} from '@kestrel/db';
import {
  parseChessComGame,
  parseLichessGame,
  REPORT_VERSION,
  type ChessComGame,
  type GameRow,
  type LichessGame,
  type Platform
} from '@kestrel/shared';
import { buildApp, FRESH_MS, NOT_FOUND_RETRY_MS } from './app.js';

// Real public games: 33 blitz for Hikaru; 38 bullet + 2 blitz for DrNykterstein
const fixtures = join(import.meta.dirname, '..', '..', 'shared', 'fixtures');
const hikaruGames = (JSON.parse(readFileSync(join(fixtures, 'chesscom-hikaru-2026-09.json'), 'utf8')).games as ChessComGame[])
  .map((g) => parseChessComGame(g, 'hikaru'))
  .filter((r): r is GameRow => r !== null);
const magnusGames = readFileSync(join(fixtures, 'lichess-drnykterstein.ndjson'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => parseLichessGame(JSON.parse(line) as LichessGame, 'drnykterstein'))
  .filter((r): r is GameRow => r !== null);

const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('report API', () => {
  const pool = createPool(url ?? '');
  let clock = new Date();
  const app = buildApp({ db: pool, version: 'test', now: () => clock, webDist: null, rateLimit: { max: 1000, windowMs: 60_000 } });

  beforeAll(() => migrate(pool));
  beforeEach(async () => {
    clock = new Date();
    await pool.query('TRUNCATE players, fetch_queue, removal_requests, fetch_pause CASCADE');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  const scout = async (body: unknown) => {
    const res = await app.inject({ method: 'POST', url: '/api/scout', payload: body as object });
    return { code: res.statusCode, body: res.json() };
  };
  const report = async (path: string) => {
    const res = await app.inject({ method: 'GET', url: `/api/report/${path}` });
    return { code: res.statusCode, body: res.json() };
  };
  const jobs = async () => (await pool.query('SELECT username, priority, failed_at FROM fetch_queue ORDER BY id')).rows;

  async function stored(platform: Platform, username: string, games: GameRow[], ageMs: number) {
    const id = await upsertPlayer(pool, platform, username);
    await saveGames(pool, id, games);
    await rebuildReports(pool, id, platform, username, clock);
    await pool.query('UPDATE players SET last_fetched_at = $2 WHERE id = $1', [id, new Date(clock.getTime() - ageMs)]);
    return id;
  }

  it('rejects bad input with 400 invalid', async () => {
    expect(await scout({ platform: 'chess24', username: 'hikaru' })).toEqual({ code: 400, body: { status: 'invalid' } });
    expect(await scout({ platform: 'chesscom', username: '../etc' })).toEqual({ code: 400, body: { status: 'invalid' } });
    expect(await scout({ platform: 'chesscom', username: 'hikaru', scope: 'classical' })).toEqual({
      code: 400,
      body: { status: 'invalid' }
    });
    expect(await scout({})).toEqual({ code: 400, body: { status: 'invalid' } });
    const broken = await app.inject({
      method: 'POST',
      url: '/api/scout',
      headers: { 'content-type': 'application/json' },
      payload: '{"platform":'
    });
    expect(broken.statusCode).toBe(400);
    expect(broken.json()).toEqual({ status: 'invalid' });
    expect(await report('chess24/hikaru')).toEqual({ code: 400, body: { status: 'invalid' } });
    expect(await report('chesscom/a')).toEqual({ code: 400, body: { status: 'invalid' } });
    expect(await report('chesscom/hikaru?scope=nope')).toEqual({ code: 400, body: { status: 'invalid' } });
    expect(await jobs()).toEqual([]);
  });

  it('says "unknown" for players never asked about, and GET never queues', async () => {
    expect(await report('chesscom/hikaru')).toEqual({ code: 200, body: { status: 'unknown' } });
    expect(await jobs()).toEqual([]);
  });

  it('queues a new player first in line, and reports the queue position', async () => {
    await enqueue(pool, 'lichess', 'background_one'); // background jobs wait behind users
    expect((await scout({ platform: 'chesscom', username: 'Hikaru' })).body).toEqual({ status: 'queued', position: 1 });
    expect((await scout({ platform: 'lichess', username: 'drnykterstein' })).body).toEqual({ status: 'queued', position: 2 });
    expect((await report('lichess/DrNykterstein')).body).toEqual({ status: 'queued', position: 2 });
    expect(await jobs()).toMatchObject([
      { username: 'background_one', priority: 0 },
      { username: 'hikaru', priority: 10 },
      { username: 'drnykterstein', priority: 10 }
    ]);

    await claimNext(pool); // the worker takes Hikaru
    expect((await report('chesscom/hikaru')).body).toEqual({ status: 'fetching' });
    expect((await scout({ platform: 'chesscom', username: 'hikaru' })).body).toEqual({ status: 'fetching' });
    expect((await report('lichess/drnykterstein')).body).toEqual({ status: 'queued', position: 1 });
  });

  it('answers straight from a fresh report without queueing anything', async () => {
    await stored('chesscom', 'hikaru', hikaruGames, 3600_000);
    const { code, body } = await scout({ platform: 'chesscom', username: 'HIKARU' });
    expect(code).toBe(200);
    expect(body).toMatchObject({
      status: 'ready',
      refreshing: false,
      lastFetchedAt: new Date(clock.getTime() - 3600_000).toISOString(),
      scopes: [
        { scope: 'all', games: 33 },
        { scope: 'blitz', games: 33 }
      ],
      report: { version: REPORT_VERSION, platform: 'chesscom', username: 'hikaru', scope: 'blitz', gamesUsed: 33 }
    });
    expect(await jobs()).toEqual([]);
  });

  it('shows a stale report at once and queues a refresh', async () => {
    await stored('chesscom', 'hikaru', hikaruGames, FRESH_MS + 60_000);
    const { body } = await scout({ platform: 'chesscom', username: 'hikaru' });
    expect(body).toMatchObject({ status: 'ready', refreshing: true, report: { gamesUsed: 33 } });
    expect(await jobs()).toMatchObject([{ username: 'hikaru', priority: 10 }]);

    // GET shows the same report and that a refresh is on its way
    expect((await report('chesscom/hikaru')).body).toMatchObject({ status: 'ready', refreshing: true });
    await claimNext(pool);
    expect((await report('chesscom/hikaru')).body).toMatchObject({ status: 'ready', refreshing: true });
    await pool.query('DELETE FROM fetch_queue');
    expect((await report('chesscom/hikaru')).body).toMatchObject({ status: 'ready', refreshing: false });
  });

  it('picks the most played time class unless another scope is asked for', async () => {
    await stored('lichess', 'drnykterstein', magnusGames, 60_000);
    const get = async (q: string) => (await report(`lichess/drnykterstein${q}`)).body;

    const def = await get('');
    expect(def.report.scope).toBe('bullet');
    expect(def.scopes).toEqual([
      { scope: 'all', games: 40 },
      { scope: 'bullet', games: 38 },
      { scope: 'blitz', games: 2 }
    ]);
    expect((await get('?scope=blitz')).report).toMatchObject({ scope: 'blitz', gamesUsed: 2 });
    expect((await get('?scope=all')).report).toMatchObject({ scope: 'all', gamesUsed: 40 });
    // No rapid games: falls back to the default rather than inventing a report
    expect((await get('?scope=rapid')).report).toMatchObject({ scope: 'bullet', gamesUsed: 38 });
    expect((await scout({ platform: 'lichess', username: 'drnykterstein', scope: 'blitz' })).body.report.scope).toBe('blitz');
  });

  it('shows the honest empty report for a player with no games', async () => {
    await stored('chesscom', 'brand_new', [], 60_000);
    const { body } = await report('chesscom/brand_new?scope=blitz');
    expect(body).toMatchObject({ status: 'ready', scopes: [{ scope: 'all', games: 0 }], report: { scope: 'all', gamesUsed: 0 } });
  });

  it('rebuilds reports from an older engine on read, without fetching again', async () => {
    const id = await stored('chesscom', 'hikaru', hikaruGames, 60_000);
    await pool.query(
      `UPDATE reports SET report_json = jsonb_set(report_json, '{version}', '0'), games_used = 1 WHERE player_id = $1`,
      [id]
    );
    const { body } = await report('chesscom/hikaru');
    expect(body).toMatchObject({ status: 'ready', report: { version: REPORT_VERSION, gamesUsed: 33 } });
    const { rows } = await pool.query("SELECT games_used, report_json->'version' AS v FROM reports WHERE player_id = $1", [id]);
    expect(rows).toEqual(expect.arrayContaining([{ games_used: 33, v: REPORT_VERSION }]));
    expect(rows.every((r) => r.v === REPORT_VERSION)).toBe(true);
    expect(await jobs()).toEqual([]);
  });

  it('builds reports on read for games fetched before reports existed', async () => {
    const id = await upsertPlayer(pool, 'chesscom', 'hikaru');
    await saveGames(pool, id, hikaruGames);
    await pool.query('UPDATE players SET last_fetched_at = now() WHERE id = $1', [id]);
    expect((await report('chesscom/hikaru')).body).toMatchObject({ status: 'ready', report: { gamesUsed: 33 } });
  });

  it('remembers "no such player" for 10 minutes, then asks the site again', async () => {
    await enqueue(pool, 'chesscom', 'typo_name');
    await markNotFound(pool, (await claimNext(pool))!.id);

    expect((await report('chesscom/typo_name')).body).toEqual({ status: 'not_found' });
    expect((await scout({ platform: 'chesscom', username: 'typo_name' })).body).toEqual({ status: 'not_found' });
    expect((await jobs())[0].failed_at).not.toBeNull(); // not queued again

    clock = new Date(clock.getTime() + NOT_FOUND_RETRY_MS + 60_000);
    expect((await scout({ platform: 'chesscom', username: 'typo_name' })).body).toEqual({ status: 'queued', position: 1 });
    expect((await jobs())[0]).toMatchObject({ failed_at: null, priority: 10 });
  });

  it('reports failed fetches as retryable, and asking again restarts them', async () => {
    await enqueue(pool, 'lichess', 'flaky');
    await pool.query('UPDATE fetch_queue SET attempts = 4');
    await retryLater(pool, (await claimNext(pool))!, 'HTTP 503');
    expect((await report('lichess/flaky')).body).toEqual({ status: 'failed', retryable: true });
    expect((await scout({ platform: 'lichess', username: 'flaky' })).body).toEqual({ status: 'queued', position: 1 });
  });

  it('never shows or queues players who asked to be removed, even with data stored', async () => {
    await stored('chesscom', 'hikaru', hikaruGames, FRESH_MS * 2);
    await enqueue(pool, 'chesscom', 'hikaru');
    await pool.query("INSERT INTO removal_requests (platform, username) VALUES ('chesscom', 'hikaru')");
    await pool.query('DELETE FROM fetch_queue');

    for (const res of [
      await scout({ platform: 'chesscom', username: 'Hikaru' }),
      await scout({ platform: 'chesscom', username: 'hikaru', scope: 'blitz' }),
      await report('chesscom/hikaru'),
      await report('chesscom/HIKARU?scope=all')
    ]) {
      expect(res).toEqual({ code: 200, body: { status: 'removed' } });
    }
    expect(await jobs()).toEqual([]);
    // ...and anything stored about them is deleted the first time they're asked about
    expect((await pool.query("SELECT 1 FROM players WHERE username = 'hikaru'")).rowCount).toBe(0);
  });
});

maybe('scout rate limit', () => {
  const pool = createPool(url ?? '');
  afterAll(() => pool.end());

  it('allows a burst per IP per minute, then says slow down', async () => {
    let clock = new Date('2026-09-26T12:00:00Z');
    const app = buildApp({ db: pool, version: 'test', now: () => clock, webDist: null, rateLimit: { max: 3, windowMs: 60_000 } });
    const post = (ip: string) =>
      app.inject({ method: 'POST', url: '/api/scout', remoteAddress: ip, payload: { platform: 'x', username: 'y' } });

    for (let i = 0; i < 3; i++) expect((await post('1.1.1.1')).statusCode).toBe(400);
    const limited = await post('1.1.1.1');
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({ error: 'slow down' });
    expect(limited.headers['retry-after']).toBe('60');
    expect((await post('2.2.2.2')).statusCode).toBe(400); // other people aren't affected
    // GET is never limited: the web app polls it
    expect((await app.inject({ method: 'GET', url: '/api/report/chesscom/hikaru', remoteAddress: '1.1.1.1' })).statusCode).toBe(200);

    await app.close();
  });

  it('behind a trusted proxy, limits each visitor by their real address', async () => {
    const app = buildApp({ db: pool, version: 'test', webDist: null, trustProxy: true, rateLimit: { max: 1, windowMs: 60_000 } });
    const post = (visitor: string) =>
      app.inject({
        method: 'POST',
        url: '/api/scout',
        remoteAddress: '10.0.0.1', // the proxy
        headers: { 'cf-connecting-ip': visitor },
        payload: { platform: 'x', username: 'y' }
      });
    expect((await post('3.3.3.3')).statusCode).toBe(400);
    expect((await post('4.4.4.4')).statusCode).toBe(400); // a different visitor, same proxy
    expect((await post('3.3.3.3')).statusCode).toBe(429);
    await app.close();
  });

  it('ignores proxy headers unless told to trust them', async () => {
    let clock = new Date('2026-09-26T12:00:00Z');
    const app = buildApp({ db: pool, version: 'test', now: () => clock, webDist: null, rateLimit: { max: 1, windowMs: 60_000 } });
    const post = (visitor: string) =>
      app.inject({ method: 'POST', url: '/api/scout', remoteAddress: '5.5.5.5', headers: { 'cf-connecting-ip': visitor }, payload: {} });
    expect((await post('6.6.6.6')).statusCode).toBe(400);
    expect((await post('7.7.7.7')).statusCode).toBe(429); // a faked header doesn't buy a new allowance
    clock = new Date(clock.getTime() + 60_000);
    await app.close();
  });

  it('keeps the old limit test shape', async () => {
    let clock = new Date('2026-09-26T12:00:00Z');
    const app = buildApp({ db: pool, version: 'test', now: () => clock, webDist: null, rateLimit: { max: 3, windowMs: 60_000 } });
    const post = (ip: string) =>
      app.inject({ method: 'POST', url: '/api/scout', remoteAddress: ip, payload: { platform: 'x', username: 'y' } });
    for (let i = 0; i < 3; i++) await post('1.1.1.1');
    clock = new Date(clock.getTime() + 60_000);
    expect((await post('1.1.1.1')).statusCode).toBe(400);
    await app.close();
  });
});
