import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REPORT_VERSION, type GameRow } from '@kestrel/shared';
import {
  claimNext,
  createPool,
  enqueue,
  getJob,
  getPlayer,
  getReport,
  listGames,
  markNotFound,
  migrate,
  PRIORITY_WAITING,
  rebuildReports,
  retryLater,
  saveGames,
  scopeSummaries,
  upsertPlayer
} from './index.js';

const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

const game: GameRow = {
  gameId: 'g1',
  colour: 'black',
  score: 0.5,
  resultDetail: 'repetition',
  timeClass: 'blitz',
  timeControl: '300+0',
  rated: true,
  endedAt: new Date('2026-09-08T16:33:49Z'),
  eco: 'C84',
  openingName: 'Ruy Lopez Opening Morphy Defense Closed Martinez Variation',
  openingLine: 'e4 e5 Nf3 Nc6 Bb5 a6',
  movetext: 'e4 e5 Nf3 Nc6 Bb5 a6',
  moves: 3,
  clockAt20: 229.2,
  clockAt30: 124.4,
  clockStart: 300,
  materialAt30: -2,
  finalFen: '8/8/8/8/8/8/8/K6k w - - 0 1',
  accuracy: 82.68,
  playerRating: 3382,
  opponentRating: 3357
};

const many = (n: number, timeClass: GameRow['timeClass']) =>
  Array.from({ length: n }, (_, i) => ({
    ...game,
    gameId: `${timeClass}-${i}`,
    timeClass,
    endedAt: new Date(game.endedAt.getTime() + i * 60_000)
  }));

maybe('reports storage', () => {
  const pool = createPool(url ?? '');
  const now = new Date('2026-09-26T12:00:00Z');
  beforeAll(() => migrate(pool));
  beforeEach(() => pool.query('TRUNCATE players, fetch_queue, removal_requests, fetch_pause CASCADE'));
  afterAll(() => pool.end());

  it('reads games back exactly as they were stored, newest first', async () => {
    const id = await upsertPlayer(pool, 'chesscom', 'reader');
    const nulls: GameRow = {
      ...game,
      gameId: 'g2',
      score: 1,
      endedAt: new Date('2026-09-09T10:00:00Z'),
      eco: null,
      openingName: null,
      clockAt20: null,
      clockAt30: null,
      clockStart: null,
      materialAt30: null,
      finalFen: null,
      accuracy: null,
      playerRating: null,
      opponentRating: null
    };
    await saveGames(pool, id, [game, nulls]);
    expect(await listGames(pool, id)).toEqual([nulls, game]);
  });

  it('builds "all" plus one report per time class, and drops classes with no games left', async () => {
    const id = await upsertPlayer(pool, 'lichess', 'builder');
    await saveGames(pool, id, [...many(3, 'blitz'), ...many(5, 'bullet')]);

    const scopes = await rebuildReports(pool, id, 'lichess', 'builder', now);
    expect(scopes).toEqual([
      { scope: 'all', games: 8 },
      { scope: 'bullet', games: 5 },
      { scope: 'blitz', games: 3 }
    ]);
    expect(await scopeSummaries(pool, id)).toEqual(scopes);
    const bullet = await getReport(pool, id, 'bullet');
    expect(bullet).toMatchObject({
      version: REPORT_VERSION,
      platform: 'lichess',
      username: 'builder',
      scope: 'bullet',
      gamesUsed: 5,
      builtAt: now.toISOString()
    });
    expect(await getReport(pool, id, 'rapid')).toBeNull();

    await pool.query("DELETE FROM games WHERE time_class = 'blitz'");
    expect(await rebuildReports(pool, id, 'lichess', 'builder', now)).toEqual([
      { scope: 'all', games: 5 },
      { scope: 'bullet', games: 5 }
    ]);
    expect(await getReport(pool, id, 'blitz')).toBeNull();
  });

  it('always keeps an "all" report, even with no games', async () => {
    const id = await upsertPlayer(pool, 'chesscom', 'no_games');
    expect(await rebuildReports(pool, id, 'chesscom', 'no_games', now)).toEqual([{ scope: 'all', games: 0 }]);
    expect(await getReport(pool, id, 'all')).toMatchObject({ gamesUsed: 0, scope: 'all' });
  });

  it('finds players and when they were last fetched', async () => {
    expect(await getPlayer(pool, 'chesscom', 'ghost')).toBeNull();
    const id = await upsertPlayer(pool, 'chesscom', 'ghost');
    expect(await getPlayer(pool, 'chesscom', 'ghost')).toEqual({ id, lastFetchedAt: null });
  });

  it('tells queued, fetching, not found and failed jobs apart', async () => {
    expect(await getJob(pool, 'chesscom', 'nobody')).toBeNull();

    await enqueue(pool, 'chesscom', 'first');
    await enqueue(pool, 'chesscom', 'second');
    await enqueue(pool, 'lichess', 'third');
    expect(await getJob(pool, 'chesscom', 'first')).toEqual({ state: 'queued', position: 1 });
    expect(await getJob(pool, 'lichess', 'third')).toEqual({ state: 'queued', position: 3 });

    // A waiting user jumps the background jobs
    await enqueue(pool, 'lichess', 'third', PRIORITY_WAITING);
    expect(await getJob(pool, 'lichess', 'third')).toEqual({ state: 'queued', position: 1 });
    expect(await getJob(pool, 'chesscom', 'second')).toEqual({ state: 'queued', position: 3 });

    // Claimed: fetching, and no longer ahead of anyone
    const job = await claimNext(pool);
    expect(job?.username).toBe('third');
    expect(await getJob(pool, 'lichess', 'third')).toEqual({ state: 'fetching' });
    expect(await getJob(pool, 'chesscom', 'second')).toEqual({ state: 'queued', position: 2 });

    // A lock older than 10 minutes is a crashed worker's: queued again, and first
    await pool.query("UPDATE fetch_queue SET locked_at = now() - interval '11 minutes' WHERE id = $1", [job!.id]);
    expect(await getJob(pool, 'lichess', 'third')).toEqual({ state: 'queued', position: 1 });

    // Jobs waiting out a back-off aren't ahead of anyone
    const first = (await claimNext(pool))!;
    expect(first.username).toBe('third');
    await retryLater(pool, first, 'HTTP 503');
    expect(await getJob(pool, 'chesscom', 'first')).toEqual({ state: 'queued', position: 1 });

    await pool.query("UPDATE fetch_queue SET failed_at = now() WHERE username = 'third'");
    expect(await getJob(pool, 'lichess', 'third')).toMatchObject({ state: 'failed', error: 'HTTP 503' });
  });

  it('keeps not-found jobs, marked, until someone asks again', async () => {
    await enqueue(pool, 'chesscom', 'typo_name');
    const job = await claimNext(pool);
    await markNotFound(pool, job!.id);
    const state = await getJob(pool, 'chesscom', 'typo_name');
    expect(state).toMatchObject({ state: 'not_found' });
    expect(state?.state === 'not_found' && state.failedAt).toBeInstanceOf(Date);
    const row = (await pool.query('SELECT * FROM fetch_queue')).rows[0];
    expect(row).toMatchObject({ last_error: 'not_found', locked_at: null });
    expect(await claimNext(pool)).toBeNull();

    await enqueue(pool, 'chesscom', 'typo_name', PRIORITY_WAITING);
    expect(await getJob(pool, 'chesscom', 'typo_name')).toEqual({ state: 'queued', position: 1 });
  });
});
