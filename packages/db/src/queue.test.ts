import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GameRow } from '@kestrel/shared';
import {
  acquireFetchLock,
  claimNext,
  complete,
  createPool,
  enqueue,
  getArchiveFetch,
  MAX_ATTEMPTS,
  migrate,
  postpone,
  PRIORITY_WAITING,
  retryDelayMs,
  retryLater,
  saveArchiveFetch,
  saveGames,
  upsertPlayer
} from './index.js';

const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('fetch queue and storage', () => {
  const pool = createPool(url ?? '');
  beforeAll(() => migrate(pool));
  beforeEach(() => pool.query('TRUNCATE players, fetch_queue, removal_requests, fetch_pause CASCADE'));
  afterAll(() => pool.end());

  const jobRow = async (username: string) =>
    (await pool.query('SELECT * FROM fetch_queue WHERE username = $1', [username])).rows[0];

  it('serves waiting users before background jobs, oldest first', async () => {
    await enqueue(pool, 'chesscom', 'background1');
    await enqueue(pool, 'lichess', 'background2');
    await enqueue(pool, 'chesscom', 'Waiting_User', PRIORITY_WAITING);

    expect((await claimNext(pool))?.username).toBe('waiting_user');
    expect((await claimNext(pool))?.username).toBe('background1');
    expect((await claimNext(pool))?.username).toBe('background2');
    expect(await claimNext(pool)).toBeNull();
  });

  it('keeps one job per player and only ever raises its priority', async () => {
    await enqueue(pool, 'chesscom', 'someone', PRIORITY_WAITING);
    await enqueue(pool, 'chesscom', 'someone');
    const { rows } = await pool.query('SELECT priority FROM fetch_queue');
    expect(rows).toEqual([{ priority: PRIORITY_WAITING }]);
  });

  it('never queues players who asked to be removed, or invalid names', async () => {
    await pool.query("INSERT INTO removal_requests (platform, username) VALUES ('chesscom', 'private_person')");
    expect(await enqueue(pool, 'chesscom', 'Private_Person')).toBe('removed');
    expect(await enqueue(pool, 'chesscom', '../etc')).toBe('invalid');
    expect(await claimNext(pool)).toBeNull();
  });

  it('removes finished jobs', async () => {
    await enqueue(pool, 'lichess', 'done_soon');
    const job = await claimNext(pool);
    await complete(pool, job!.id);
    expect(await jobRow('done_soon')).toBeUndefined();
  });

  it('backs off after a failure, then gives up after 5 tries', async () => {
    await enqueue(pool, 'chesscom', 'flaky');
    const job = await claimNext(pool);
    expect(job?.attempts).toBe(1);
    expect(await retryLater(pool, job!, 'HTTP 503')).toBe('retrying');

    let row = await jobRow('flaky');
    expect(row.last_error).toBe('HTTP 503');
    expect(row.not_before.getTime()).toBeGreaterThan(Date.now() + retryDelayMs(1) - 5_000);
    expect(await claimNext(pool)).toBeNull(); // not due yet

    await pool.query(`UPDATE fetch_queue SET attempts = ${MAX_ATTEMPTS - 1}, not_before = now()`);
    const last = await claimNext(pool);
    expect(await retryLater(pool, last!, 'HTTP 503 again')).toBe('gave_up');
    row = await jobRow('flaky');
    expect(row.failed_at).not.toBeNull();
    await pool.query('UPDATE fetch_queue SET not_before = now()');
    expect(await claimNext(pool)).toBeNull(); // given up for good

    // ...until someone asks for the player again
    await enqueue(pool, 'chesscom', 'flaky', PRIORITY_WAITING);
    expect(await claimNext(pool)).toMatchObject({ username: 'flaky', attempts: 1 });
  });

  it('postpones without using up a try', async () => {
    await enqueue(pool, 'chesscom', 'paused');
    const job = await claimNext(pool);
    await postpone(pool, job!.id, new Date(Date.now() + 60_000));
    const row = await jobRow('paused');
    expect(row.attempts).toBe(0);
    expect(row.locked_at).toBeNull();
    expect(await claimNext(pool)).toBeNull();
  });

  it('takes over a job left locked by a crashed worker', async () => {
    await enqueue(pool, 'chesscom', 'orphan');
    await claimNext(pool);
    expect(await claimNext(pool)).toBeNull(); // still locked
    await pool.query("UPDATE fetch_queue SET locked_at = now() - interval '11 minutes'");
    expect(await claimNext(pool)).toMatchObject({ username: 'orphan', attempts: 2 });
  });

  it('stores each game once', async () => {
    const id = await upsertPlayer(pool, 'lichess', 'storer');
    expect(await upsertPlayer(pool, 'lichess', 'storer')).toBe(id);
    const game: GameRow = {
      gameId: 'abc',
      colour: 'white',
      score: 1,
      resultDetail: 'checkmate',
      timeClass: 'blitz',
      timeControl: '180+0',
      rated: true,
      endedAt: new Date('2026-09-01T12:00:00Z'),
      eco: 'C23',
      openingName: "Bishop's Opening",
      openingLine: 'e4 e5 Bc4',
      movetext: 'e4 e5 Bc4',
      moves: 2,
      clockAt20: null,
      clockAt30: null,
      materialAt30: null,
      finalFen: null,
      accuracy: null,
      playerRating: 1500,
      opponentRating: 1480
    };
    expect(await saveGames(pool, id, [game, { ...game, gameId: 'def' }])).toBe(2);
    expect(await saveGames(pool, id, [game])).toBe(0);
  });

  it('remembers ETags per monthly archive', async () => {
    const id = await upsertPlayer(pool, 'chesscom', 'etagged');
    expect(await getArchiveFetch(pool, id, '2026/09')).toBeNull();
    await saveArchiveFetch(pool, id, '2026/09', '"v1"');
    expect(await getArchiveFetch(pool, id, '2026/09')).toMatchObject({ etag: '"v1"' });
  });

  it('lets only one process hold the fetch lock', async () => {
    const release = await acquireFetchLock(pool, { wait: false });
    expect(release).not.toBeNull();
    expect(await acquireFetchLock(pool, { wait: false })).toBeNull();
    await release!();
    const again = await acquireFetchLock(pool, { wait: false });
    expect(again).not.toBeNull();
    await again!();
  });
});
