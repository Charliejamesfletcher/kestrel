import { normaliseUsername, type GameRow, type Platform } from '@kestrel/shared';
import type { Queryable } from './index.js';

export async function isRemoved(db: Queryable, platform: Platform, username: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'SELECT 1 FROM removal_requests WHERE platform = $1 AND username = lower(btrim($2))',
    [platform, username]
  );
  return (rowCount ?? 0) > 0;
}

/** Cascades to games, reports and ETags. */
export async function forgetPlayer(db: Queryable, platform: Platform, username: string): Promise<boolean> {
  const { rowCount } = await db.query('DELETE FROM players WHERE platform = $1 AND username = lower(btrim($2))', [
    platform,
    username
  ]);
  return (rowCount ?? 0) > 0;
}

// Catches removal rows added by hand without going through requestRemoval
export async function forgetRemovedPlayers(db: Queryable): Promise<number> {
  const { rowCount } = await db.query(
    `DELETE FROM players p USING removal_requests r WHERE p.platform = r.platform AND p.username = r.username`
  );
  return rowCount ?? 0;
}

export type RemovalResult = 'invalid' | { deletedData: boolean };

// Single statement so it's atomic. The worker re-checks too, in case a fetch
// was already in flight.
export async function requestRemoval(db: Queryable, platform: Platform, rawUsername: string): Promise<RemovalResult> {
  const username = normaliseUsername(rawUsername);
  if (!username) return 'invalid';
  const { rows } = await db.query<{ deleted: number }>(
    `WITH request AS (
       INSERT INTO removal_requests (platform, username) VALUES ($1, $2) ON CONFLICT DO NOTHING
     ), job AS (
       DELETE FROM fetch_queue WHERE platform = $1 AND username = $2
     ), player AS (
       DELETE FROM players WHERE platform = $1 AND username = $2 RETURNING id
     )
     SELECT count(*)::int AS deleted FROM player`,
    [platform, username]
  );
  return { deletedData: (rows[0]?.deleted ?? 0) > 0 };
}

export async function getPlayerId(db: Queryable, platform: Platform, username: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM players WHERE platform = $1 AND username = $2',
    [platform, username]
  );
  return rows[0]?.id ?? null;
}

export async function upsertPlayer(db: Queryable, platform: Platform, username: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO players (platform, username) VALUES ($1, $2)
     ON CONFLICT (platform, username) DO UPDATE SET username = EXCLUDED.username
     RETURNING id`,
    [platform, username]
  );
  return rows[0]!.id;
}

export async function markFetched(db: Queryable, playerId: string): Promise<void> {
  await db.query('UPDATE players SET last_fetched_at = now() WHERE id = $1', [playerId]);
}

const GAME_COLUMNS = [
  'player_id', 'game_id', 'colour', 'score', 'result_detail', 'time_class', 'time_control', 'rated',
  'ended_at', 'eco', 'opening_name', 'opening_line', 'movetext', 'moves', 'clock_at_20', 'clock_at_30',
  'material_at_30', 'final_fen', 'accuracy', 'player_rating', 'opponent_rating', 'clock_start'
] as const;

// Postgres caps a query at 65,535 params
const BATCH = 1000;

/** Returns how many were new. */
export async function saveGames(db: Queryable, playerId: string, games: readonly GameRow[]): Promise<number> {
  let inserted = 0;
  for (let start = 0; start < games.length; start += BATCH) {
    const batch = games.slice(start, start + BATCH);
    const values: unknown[] = [];
    const tuples = batch.map((g) => {
      const row = [
        playerId, g.gameId, g.colour, g.score, g.resultDetail, g.timeClass, g.timeControl, g.rated,
        g.endedAt, g.eco, g.openingName, g.openingLine, g.movetext, g.moves, g.clockAt20, g.clockAt30,
        g.materialAt30, g.finalFen, g.accuracy, g.playerRating, g.opponentRating, g.clockStart ?? null
      ];
      const placeholders = row.map((v) => {
        values.push(v);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const { rowCount } = await db.query(
      `INSERT INTO games (${GAME_COLUMNS.join(', ')}) VALUES ${tuples.join(', ')}
       ON CONFLICT (player_id, game_id) DO NOTHING`,
      values
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}

export async function knownGameIds(db: Queryable, playerId: string, gameIds: readonly string[]): Promise<Set<string>> {
  if (gameIds.length === 0) return new Set();
  const { rows } = await db.query<{ game_id: string }>(
    'SELECT game_id FROM games WHERE player_id = $1 AND game_id = ANY($2::text[])',
    [playerId, gameIds]
  );
  return new Set(rows.map((r) => r.game_id));
}

export async function latestGameAt(db: Queryable, playerId: string): Promise<Date | null> {
  const { rows } = await db.query<{ at: Date | null }>(
    'SELECT max(ended_at) AS at FROM games WHERE player_id = $1',
    [playerId]
  );
  return rows[0]?.at ?? null;
}

export async function countGamesSince(db: Queryable, playerId: string, since: Date): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM games WHERE player_id = $1 AND ended_at >= $2',
    [playerId, since]
  );
  return rows[0]?.n ?? 0;
}

export interface ArchiveFetch {
  etag: string | null;
  fetchedAt: Date;
}

export async function getArchiveFetch(db: Queryable, playerId: string, archive: string): Promise<ArchiveFetch | null> {
  const { rows } = await db.query<{ etag: string | null; fetched_at: Date }>(
    'SELECT etag, fetched_at FROM archive_etags WHERE player_id = $1 AND archive = $2',
    [playerId, archive]
  );
  const row = rows[0];
  return row ? { etag: row.etag, fetchedAt: row.fetched_at } : null;
}

export async function saveArchiveFetch(
  db: Queryable,
  playerId: string,
  archive: string,
  etag: string | null
): Promise<void> {
  await db.query(
    `INSERT INTO archive_etags (player_id, archive, etag, fetched_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (player_id, archive) DO UPDATE SET etag = EXCLUDED.etag, fetched_at = now()`,
    [playerId, archive, etag]
  );
}
