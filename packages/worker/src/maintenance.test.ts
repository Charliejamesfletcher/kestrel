import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPool, getReport, migrate, saveGames, scopeSummaries, upsertPlayer } from '@kestrel/db';
import { materialAt30, parseChessComGame, REPORT_VERSION, type ChessComGame, type GameRow } from '@kestrel/shared';
import { backfillMaterial, rebuildAllReports } from './maintenance.js';

const fixtures = join(import.meta.dirname, '..', '..', 'shared', 'fixtures');
const rows = (
  JSON.parse(readFileSync(join(fixtures, 'chesscom-hikaru-2026-09.json'), 'utf8')).games as ChessComGame[]
)
  .map((g) => parseChessComGame(g, 'hikaru'))
  .filter((r): r is GameRow => r !== null);

const expectedMaterial = (movetext: string, colour: 'white' | 'black') => {
  const m = materialAt30(movetext, colour);
  return m === null ? null : m + 0;
};

const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('backfill', () => {
  const pool = createPool(url ?? '');
  beforeAll(() => migrate(pool));
  beforeEach(() => pool.query('TRUNCATE players, fetch_queue, removal_requests, fetch_pause CASCADE'));
  afterAll(() => pool.end());

  it('fills material at move 30 for every game long enough, in batches, and stops', async () => {
    const id = await upsertPlayer(pool, 'chesscom', 'hikaru');
    await saveGames(pool, id, rows); // parsers leave materialAt30 empty
    const long = rows.filter((r) => r.moves >= 30);
    const expected = long.filter((r) => materialAt30(r.movetext, r.colour) !== null).length;

    // A batch of 7 forces several pages, including a short last one
    expect(await backfillMaterial(pool, 7)).toBe(expected);
    const { rows: stored } = await pool.query('SELECT game_id, movetext, colour, material_at_30 FROM games');
    for (const g of stored) expect(g.material_at_30).toBe(expectedMaterial(g.movetext, g.colour));
    // Nothing left to do (games that can't be replayed stay empty, and aren't retried forever)
    expect(await backfillMaterial(pool, 7)).toBe(0);
  });

  it('rebuilds every player, and deletes players who asked to be removed', async () => {
    const keep = await upsertPlayer(pool, 'chesscom', 'hikaru');
    await saveGames(pool, keep, rows);
    const gone = await upsertPlayer(pool, 'lichess', 'private_person');
    await saveGames(pool, gone, rows.slice(0, 3));
    await pool.query("INSERT INTO removal_requests (platform, username) VALUES ('lichess', 'private_person')");

    const logs: string[] = [];
    expect(await rebuildAllReports(pool, new Date('2026-09-26T12:00:00Z'), (m) => logs.push(m))).toBe(1);
    expect(await scopeSummaries(pool, keep)).toEqual([
      { scope: 'all', games: 33 },
      { scope: 'blitz', games: 33 }
    ]);
    expect(await getReport(pool, keep, 'all')).toMatchObject({ version: REPORT_VERSION, gamesUsed: 33 });
    expect((await pool.query('SELECT 1 FROM players WHERE id = $1', [gone])).rowCount).toBe(0);
    expect(logs).toEqual(['chesscom/hikaru: all 33, blitz 33', 'lichess/private_person: removal requested, data deleted']);
  });
});
