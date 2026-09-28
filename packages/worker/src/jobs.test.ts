import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPool, enqueue, getReport, migrate, PRIORITY_WAITING, scopeSummaries } from '@kestrel/db';
import { materialAt30, REPORT_VERSION, type ChessComGame, type LichessGame } from '@kestrel/shared';
import { createChessComClient, createLichessClient } from './clients.js';
import { CHESSCOM_MAX_MONTHS, createTick, TARGET_GAMES, LICHESS_DAILY_OVERLAP_MS, type JobDeps } from './jobs.js';

const fixtures = join(import.meta.dirname, '..', '..', 'shared', 'fixtures');
// Real public games: 33 of Hikaru's Titled Tuesday blitz games, and 40 of DrNykterstein's Lichess games
const month: ChessComGame[] = JSON.parse(readFileSync(join(fixtures, 'chesscom-hikaru-2026-09.json'), 'utf8')).games;
const lichessGames: LichessGame[] = readFileSync(join(fixtures, 'lichess-drnykterstein.ndjson'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
// Plus two games that must be skipped: a Chess960 game and an aborted one
const lichessExport = [
  ...lichessGames,
  { ...lichessGames[0]!, id: 'variant1', variant: 'chess960' },
  { ...lichessGames[1]!, id: 'aborted1', status: 'aborted' }
]
  .map((g) => JSON.stringify(g))
  .join('\n');
const monthWithVariant = [...month, { ...month[0]!, uuid: 'chess960-game', rules: 'chess960' }];

const ym = (d: Date) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const now = new Date();
const CURRENT = ym(now);
const PREVIOUS = ym(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
const monthStartSec = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;

const copies = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => ({
    ...month[i % 4]!,
    uuid: `${tag}-${i}`,
    end_time: Math.max(Math.floor(Date.now() / 1000) - i * 30, monthStartSec)
  }));

type Route = (req: { url: URL; headers: Headers }) => Response;

function fakeSites(routes: Record<string, Route>, fallback?: Route) {
  const calls: { url: URL; headers: Headers }[] = [];
  const fetch = (async (input: string, init?: RequestInit) => {
    const req = { url: new URL(input), headers: new Headers(init?.headers) };
    calls.push(req);
    const route = routes[req.url.pathname];
    return route ? route(req) : fallback ? fallback(req) : new Response(null, { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, calls, paths: () => calls.map((c) => c.url.pathname) };
}

const json = (body: unknown, etag?: string) =>
  new Response(JSON.stringify(body), { status: 200, headers: etag ? { etag } : {} });

const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('worker jobs', () => {
  const pool = createPool(url ?? '');
  beforeAll(() => migrate(pool));
  beforeEach(() => pool.query('TRUNCATE players, fetch_queue, removal_requests, fetch_pause CASCADE'));
  afterAll(() => pool.end());

  const logs: string[] = [];
  const deps = (sites: ReturnType<typeof fakeSites>, extra: Partial<JobDeps> = {}): JobDeps => {
    const http = { userAgent: 'kestrel/test (contact: me@kestrel.test)', fetch: sites.fetch };
    return {
      db: pool,
      chesscom: createChessComClient(http),
      lichess: createLichessClient(http),
      log: (m) => logs.push(m),
      ...extra
    };
  };
  const games = async (username: string) =>
    (
      await pool.query(
        'SELECT g.* FROM games g JOIN players p ON p.id = g.player_id WHERE p.username = $1 ORDER BY ended_at',
        [username]
      )
    ).rows;

  const chesscomBase = `/pub/player/hikaru/games`;
  const archives: Route = () =>
    json({ archives: [PREVIOUS, CURRENT].map((m) => `https://api.chess.com${chesscomBase}/${m}`) });

  it('fetches Chess.com months, then only re-checks the current one with its ETag', async () => {
    const sites = fakeSites({
      [`${chesscomBase}/archives`]: archives,
      [`${chesscomBase}/${PREVIOUS}`]: () => json({ games: monthWithVariant }, '"prev-1"'),
      [`${chesscomBase}/${CURRENT}`]: ({ headers }) =>
        headers.get('if-none-match') === '"cur-1"'
          ? new Response(null, { status: 304 })
          : json({ games: copies(2, 'cur') }, '"cur-1"')
    });
    const tick = createTick(deps(sites));

    await enqueue(pool, 'chesscom', 'Hikaru', PRIORITY_WAITING);
    expect(await tick()).toBe(true);
    expect(sites.paths()).toEqual([`${chesscomBase}/archives`, `${chesscomBase}/${CURRENT}`, `${chesscomBase}/${PREVIOUS}`]);
    // All 33 real games (the Chess960 copy is skipped) + 2 this month
    const stored = await games('hikaru');
    expect(stored).toHaveLength(35);
    // The oldest: Hikaru won with Black against the Alapin, 8 Sept 2026
    expect(stored[0]).toMatchObject({
      game_id: 'f78fcfe7-ab95-11f1-8ffd-6cfe54652c60',
      colour: 'black',
      score: 1,
      result_detail: 'resign',
      eco: 'B22',
      opening_name: 'Alapin Sicilian Defense',
      time_control: '300+0',
      player_rating: 3370,
      opponent_rating: 2709,
      clock_at_20: 143.9,
      clock_at_30: 127.9
    });
    expect(stored[0].movetext.split(' ')).toHaveLength(72);
    // Material at move 30 comes from replaying the moves, before saving
    const material = materialAt30(stored[0].movetext, 'black');
    expect(stored[0].material_at_30).toBe(material === null ? null : material + 0); // Postgres has no -0
    expect(await tick()).toBe(false); // queue empty

    // Reports were built before the job finished: 'all' and blitz
    const playerId = (await pool.query("SELECT id FROM players WHERE username = 'hikaru'")).rows[0].id;
    expect(await scopeSummaries(pool, playerId)).toEqual([
      { scope: 'all', games: 35 },
      { scope: 'blitz', games: 35 }
    ]);
    expect(await getReport(pool, playerId, 'blitz')).toMatchObject({
      version: REPORT_VERSION,
      platform: 'chesscom',
      username: 'hikaru',
      scope: 'blitz',
      gamesUsed: 35
    });
    expect(logs.at(-1)).toMatch(/hikaru: 35 new games from 3 requests; reports: all 35, blitz 35/);

    // Refresh: last month is finished and was fetched after it ended, so it's
    // never asked for again; this month is re-checked and comes back 304
    await pool.query('UPDATE archive_etags SET fetched_at = $1 WHERE archive = $2', [
      new Date((monthStartSec + 2 * 86400) * 1000),
      PREVIOUS
    ]);
    sites.calls.length = 0;
    await enqueue(pool, 'chesscom', 'hikaru');
    await tick();
    expect(sites.paths()).toEqual([`${chesscomBase}/archives`, `${chesscomBase}/${CURRENT}`]);
    expect(sites.calls[1]!.headers.get('if-none-match')).toBe('"cur-1"');
    expect(await games('hikaru')).toHaveLength(35);
  });

  it('re-checks a month once more if it was still running when last fetched', async () => {
    const sites = fakeSites({
      [`${chesscomBase}/archives`]: archives,
      [`${chesscomBase}/${PREVIOUS}`]: () => json({ games: month }, '"prev-1"'),
      [`${chesscomBase}/${CURRENT}`]: () => json({ games: [] }, '"cur-1"')
    });
    const tick = createTick(deps(sites));
    await enqueue(pool, 'chesscom', 'hikaru');
    await tick();
    // Pretend last month was downloaded while it was still being played
    await pool.query('UPDATE archive_etags SET fetched_at = $1 WHERE archive = $2', [
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 20)),
      PREVIOUS
    ]);
    sites.calls.length = 0;
    await enqueue(pool, 'chesscom', 'hikaru');
    await tick();
    expect(sites.paths()).toContain(`${chesscomBase}/${PREVIOUS}`);
    expect(sites.calls.at(-1)!.headers.get('if-none-match')).toBe('"prev-1"');
  });

  it('stops going back once it has enough games, and never looks back more than a year', async () => {
    const many = fakeSites({
      [`${chesscomBase}/archives`]: archives,
      [`${chesscomBase}/${CURRENT}`]: () => json({ games: copies(TARGET_GAMES, 'many') })
    });
    await enqueue(pool, 'chesscom', 'hikaru');
    await createTick(deps(many))();
    expect(many.paths()).toEqual([`${chesscomBase}/archives`, `${chesscomBase}/${CURRENT}`]);

    await pool.query('TRUNCATE players CASCADE');
    const twoYears = Array.from({ length: 24 }, (_, i) => `${2023 + Math.floor(i / 12)}/${String((i % 12) + 1).padStart(2, '0')}`);
    const sparse = fakeSites(
      { [`${chesscomBase}/archives`]: () => json({ archives: twoYears.map((m) => `https://api.chess.com${chesscomBase}/${m}`) }) },
      () => json({ games: [] })
    );
    await enqueue(pool, 'chesscom', 'hikaru');
    await createTick(deps(sparse))();
    const monthsAsked = sparse.paths().slice(1);
    expect(monthsAsked).toHaveLength(CHESSCOM_MAX_MONTHS);
    expect(monthsAsked[0]).toBe(`${chesscomBase}/2024/12`);
    expect(monthsAsked.at(-1)).toBe(`${chesscomBase}/2024/01`);
  });

  it('fetches Lichess, then refreshes with since=', async () => {
    const sites = fakeSites({ '/api/games/user/drnykterstein': () => new Response(lichessExport) });
    const tick = createTick(deps(sites));

    await enqueue(pool, 'lichess', 'DrNykterstein');
    await tick();
    const first = sites.calls[0]!.url.searchParams;
    expect(first.get('max')).toBe(String(TARGET_GAMES));
    expect(first.has('since')).toBe(false);
    // 42 in the export: the Chess960 and aborted games are skipped
    const stored = await games('drnykterstein');
    expect(stored).toHaveLength(40);
    // The newest: a win with Black against the Alekhine, 8 April 2026
    expect(stored.at(-1)).toMatchObject({
      game_id: 'kAdOQKeh',
      colour: 'black',
      score: 1,
      result_detail: 'resign',
      time_class: 'blitz',
      time_control: '180+0',
      eco: 'B02',
      player_rating: 3145
    });
    const playerId = stored[0].player_id;
    expect(await scopeSummaries(pool, playerId)).toEqual([
      { scope: 'all', games: 40 },
      { scope: 'bullet', games: 38 },
      { scope: 'blitz', games: 2 }
    ]);

    await enqueue(pool, 'lichess', 'drnykterstein');
    await tick();
    const latest = Math.max(...stored.map((g) => g.ended_at.getTime()));
    expect(latest).toBe(Date.parse('2026-04-08T19:45:13.708Z'));
    expect(Number(sites.calls[1]!.url.searchParams.get('since'))).toBe(latest - 24 * 3600_000);
    expect(await games('drnykterstein')).toHaveLength(40); // nothing duplicated
  });

  it('honours removal requests without fetching, and deletes stored data', async () => {
    const sites = fakeSites({ '/api/games/user/drnykterstein': () => new Response(lichessExport) });
    const tick = createTick(deps(sites));
    await enqueue(pool, 'lichess', 'drnykterstein');
    await tick();
    expect(await games('drnykterstein')).toHaveLength(40);

    // They were queued again, then asked to be removed before the job ran
    await enqueue(pool, 'lichess', 'drnykterstein');
    await pool.query("INSERT INTO removal_requests (platform, username) VALUES ('lichess', 'drnykterstein')");
    sites.calls.length = 0;
    await tick();
    expect(sites.calls).toHaveLength(0);
    expect(await games('drnykterstein')).toHaveLength(0);
    expect((await pool.query('SELECT 1 FROM players')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM reports')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM fetch_queue')).rowCount).toBe(0);
  });

  it('marks a player who does not exist as not found, without retrying', async () => {
    const sites = fakeSites({});
    await enqueue(pool, 'chesscom', 'nobody_here');
    const tick = createTick(deps(sites));
    await tick();
    expect(sites.calls).toHaveLength(1);
    // The job stays, marked, so the API can say "not found" without queueing again
    const job = (await pool.query('SELECT * FROM fetch_queue')).rows[0];
    expect(job).toMatchObject({ username: 'nobody_here', last_error: 'not_found', locked_at: null });
    expect(job.failed_at).not.toBeNull();
    expect((await pool.query('SELECT 1 FROM players')).rowCount).toBe(0);
    expect(await tick()).toBe(false); // never retried on its own
    expect(logs.at(-1)).toBe('chesscom/nobody_here: no such player');
  });

  it('retries the job when building reports fails, so no fetch is lost', async () => {
    const sites = fakeSites({ '/api/games/user/drnykterstein': () => new Response(lichessExport) });
    // A database that works except for writing reports
    const failingDb = {
      query: ((text: string, values?: unknown[]) =>
        typeof text === 'string' && text.startsWith('INSERT INTO reports')
          ? Promise.reject(new Error('report store down'))
          : pool.query(text, values)) as typeof pool.query
    };
    await enqueue(pool, 'lichess', 'drnykterstein');
    await createTick(deps(sites, { db: failingDb }))();
    const job = (await pool.query('SELECT * FROM fetch_queue')).rows[0];
    expect(job).toMatchObject({ attempts: 1, locked_at: null, failed_at: null, last_error: 'report store down' });
    expect(await games('drnykterstein')).toHaveLength(40); // the games themselves are kept
  });

  it('pauses the whole queue on a 429, without using up a try', async () => {
    let clock = Date.now();
    const sites = fakeSites({
      [`${chesscomBase}/archives`]: () => new Response(null, { status: 429, headers: { 'retry-after': '120' } }),
      '/api/games/user/other': () => new Response('')
    });
    const tick = createTick(deps(sites, { now: () => clock }));

    await enqueue(pool, 'chesscom', 'hikaru', PRIORITY_WAITING);
    await enqueue(pool, 'lichess', 'other');
    expect(await tick()).toBe(true);
    const job = (await pool.query("SELECT * FROM fetch_queue WHERE username = 'hikaru'")).rows[0];
    expect(job.attempts).toBe(0);
    expect(job.not_before.getTime()).toBeGreaterThanOrEqual(clock + 119_000);

    // Paused: even the Lichess job waits
    expect(await tick()).toBe(false);
    expect(sites.calls).toHaveLength(1);

    // Two minutes pass: the worker's clock moves on, and the database's saved pause runs out
    clock += 121_000;
    await pool.query("UPDATE fetch_pause SET paused_until = now() - interval '1 second'");
    expect(await tick()).toBe(true);
    expect(sites.paths().at(-1)).toBe('/api/games/user/other');
  });

  it('keeps a 429 pause across a worker restart', async () => {
    const sites = fakeSites({
      [`${chesscomBase}/archives`]: () => new Response(null, { status: 429, headers: { 'retry-after': '120' } }),
      '/api/games/user/other': () => new Response('')
    });
    await enqueue(pool, 'chesscom', 'hikaru');
    await enqueue(pool, 'lichess', 'other');
    await createTick(deps(sites))();
    // A brand-new worker (fresh memory) still waits: the pause lives in the database
    expect(await createTick(deps(sites))()).toBe(false);
    expect(sites.calls).toHaveLength(1);
  });

  it('stops and deletes everything if a removal arrives mid-fetch', async () => {
    const sites = fakeSites({
      [`${chesscomBase}/archives`]: () => {
        // The removal lands while the archive list is being downloaded
        void pool.query("INSERT INTO removal_requests (platform, username) VALUES ('chesscom', 'hikaru')");
        return archives({} as never);
      },
      [`${chesscomBase}/${PREVIOUS}`]: () => json({ games: month }),
      [`${chesscomBase}/${CURRENT}`]: () => json({ games: copies(2, 'cur') })
    });
    await enqueue(pool, 'chesscom', 'hikaru');
    await createTick(deps(sites))();
    expect(sites.paths()).toEqual([`${chesscomBase}/archives`]); // no month was requested
    expect((await pool.query('SELECT 1 FROM players')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM fetch_queue')).rowCount).toBe(0);
  });

  it('looks back 60 days on Lichess for players who play correspondence', async () => {
    const sites = fakeSites({ '/api/games/user/drnykterstein': () => new Response(lichessExport) });
    const tick = createTick(deps(sites));
    await enqueue(pool, 'lichess', 'drnykterstein');
    await tick();
    await pool.query("UPDATE games SET time_class = 'daily' WHERE game_id = (SELECT min(game_id) FROM games)");
    await enqueue(pool, 'lichess', 'drnykterstein');
    await tick();
    const latest = Date.parse('2026-04-08T19:45:13.708Z');
    expect(Number(sites.calls[1]!.url.searchParams.get('since'))).toBe(latest - LICHESS_DAILY_OVERLAP_MS);
  });

  it('retries failures with back-off and records the error', async () => {
    const sites = fakeSites({ [`${chesscomBase}/archives`]: () => new Response(null, { status: 502 }) });
    await enqueue(pool, 'chesscom', 'hikaru');
    await createTick(deps(sites))();
    const job = (await pool.query('SELECT * FROM fetch_queue')).rows[0];
    expect(job).toMatchObject({ attempts: 1, locked_at: null, failed_at: null });
    expect(job.last_error).toMatch(/HTTP 502/);
    expect(job.not_before.getTime()).toBeGreaterThan(Date.now() + 20_000);
  });
});
