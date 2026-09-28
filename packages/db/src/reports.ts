import {
  buildReport,
  REPORT_SCOPES,
  TIME_CLASSES,
  type GameRow,
  type Platform,
  type Report,
  type ReportScope,
  type ScopeSummary
} from '@kestrel/shared';
import type { Queryable } from './index.js';

export interface PlayerInfo {
  id: string;
  lastFetchedAt: Date | null;
}

export async function getPlayer(db: Queryable, platform: Platform, username: string): Promise<PlayerInfo | null> {
  const { rows } = await db.query<{ id: string; last_fetched_at: Date | null }>(
    'SELECT id, last_fetched_at FROM players WHERE platform = $1 AND username = $2',
    [platform, username]
  );
  const row = rows[0];
  return row ? { id: row.id, lastFetchedAt: row.last_fetched_at } : null;
}

interface GameRecord {
  game_id: string;
  colour: 'white' | 'black';
  score: number;
  result_detail: GameRow['resultDetail'];
  time_class: GameRow['timeClass'];
  time_control: string | null;
  rated: boolean;
  ended_at: Date;
  eco: string | null;
  opening_name: string | null;
  opening_line: string;
  movetext: string | null;
  moves: number;
  clock_at_20: number | null;
  clock_at_30: number | null;
  material_at_30: number | null;
  final_fen: string | null;
  accuracy: number | null;
  player_rating: number | null;
  opponent_rating: number | null;
  clock_start: number | null;
}

function toGameRow(r: GameRecord): GameRow {
  return {
    gameId: r.game_id,
    colour: r.colour,
    score: r.score as GameRow['score'],
    resultDetail: r.result_detail,
    timeClass: r.time_class,
    // nullable in SQL (added in 0002) but always set by the worker
    timeControl: r.time_control ?? '',
    rated: r.rated,
    endedAt: r.ended_at,
    eco: r.eco,
    openingName: r.opening_name,
    openingLine: r.opening_line,
    movetext: r.movetext ?? '',
    moves: r.moves,
    clockAt20: r.clock_at_20,
    clockAt30: r.clock_at_30,
    materialAt30: r.material_at_30,
    finalFen: r.final_fen,
    accuracy: r.accuracy,
    playerRating: r.player_rating,
    opponentRating: r.opponent_rating,
    clockStart: r.clock_start
  };
}

export async function listGames(db: Queryable, playerId: string): Promise<GameRow[]> {
  const { rows } = await db.query<GameRecord>(
    `SELECT game_id, colour, score, result_detail, time_class, time_control, rated, ended_at, eco,
            opening_name, opening_line, movetext, moves, clock_at_20, clock_at_30, material_at_30,
            final_fen, accuracy, player_rating, opponent_rating, clock_start
     FROM games WHERE player_id = $1
     ORDER BY ended_at DESC, game_id`,
    [playerId]
  );
  return rows.map(toGameRow);
}

function sortSummaries(list: ScopeSummary[]): ScopeSummary[] {
  const rank = (s: ReportScope) => (s === 'all' ? -1 : REPORT_SCOPES.indexOf(s));
  return [...list].sort((a, b) =>
    a.scope === 'all' || b.scope === 'all' ? rank(a.scope) - rank(b.scope) : b.games - a.games || rank(a.scope) - rank(b.scope)
  );
}

// Always writes 'all' (even with zero games) plus one per time class played,
// and drops reports for time classes that no longer have games.
export async function rebuildReports(
  db: Queryable,
  playerId: string,
  platform: Platform,
  username: string,
  now: Date
): Promise<ScopeSummary[]> {
  const games = await listGames(db, playerId);
  const scopes: { scope: ReportScope; games: GameRow[] }[] = [{ scope: 'all', games }];
  for (const tc of TIME_CLASSES) {
    const inClass = games.filter((g) => g.timeClass === tc);
    if (inClass.length > 0) scopes.push({ scope: tc, games: inClass });
  }

  for (const { scope, games: used } of scopes) {
    const report = buildReport(used, { platform, username, scope, now });
    await db.query(
      `INSERT INTO reports (player_id, time_class, built_at, games_used, report_json)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id, time_class) DO UPDATE SET
         built_at = EXCLUDED.built_at, games_used = EXCLUDED.games_used, report_json = EXCLUDED.report_json`,
      [playerId, scope, now, report.gamesUsed, JSON.stringify(report)]
    );
  }
  await db.query('DELETE FROM reports WHERE player_id = $1 AND NOT (time_class = ANY($2::text[]))', [
    playerId,
    scopes.map((s) => s.scope)
  ]);
  return sortSummaries(scopes.map((s) => ({ scope: s.scope, games: s.games.length })));
}

/** May be from an older REPORT_VERSION. */
export async function getReport(db: Queryable, playerId: string, scope: ReportScope): Promise<Report | null> {
  const { rows } = await db.query<{ report_json: Report }>(
    'SELECT report_json FROM reports WHERE player_id = $1 AND time_class = $2',
    [playerId, scope]
  );
  return rows[0]?.report_json ?? null;
}

export async function scopeSummaries(db: Queryable, playerId: string): Promise<ScopeSummary[]> {
  const { rows } = await db.query<{ time_class: ReportScope; games_used: number }>(
    'SELECT time_class, games_used FROM reports WHERE player_id = $1',
    [playerId]
  );
  return sortSummaries(rows.map((r) => ({ scope: r.time_class, games: r.games_used })));
}
