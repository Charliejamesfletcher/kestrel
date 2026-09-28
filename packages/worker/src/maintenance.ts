import { forgetPlayer, isRemoved, rebuildReports, type Queryable } from '@kestrel/db';
import { materialAt30, type Platform } from '@kestrel/shared';

export const BACKFILL_BATCH = 500;

// Pages by (player_id, game_id) rather than WHERE material_at_30 IS NULL,
// since unreplayable games stay NULL and would loop forever.
export async function backfillMaterial(db: Queryable, batch = BACKFILL_BATCH): Promise<number> {
  let filled = 0;
  let after = { playerId: '0', gameId: '' };
  for (;;) {
    const { rows } = await db.query<{ player_id: string; game_id: string; movetext: string | null; colour: 'white' | 'black' }>(
      `SELECT player_id, game_id, movetext, colour FROM games
       WHERE material_at_30 IS NULL AND moves >= 30 AND (player_id, game_id) > ($1::bigint, $2)
       ORDER BY player_id, game_id
       LIMIT $3`,
      [after.playerId, after.gameId, batch]
    );
    if (rows.length === 0) return filled;
    const last = rows.at(-1)!;
    after = { playerId: last.player_id, gameId: last.game_id };

    const updates = rows
      .map((r) => ({ ...r, material: r.movetext ? materialAt30(r.movetext, r.colour) : null }))
      .filter((r) => r.material !== null);
    if (updates.length > 0) {
      await db.query(
        `UPDATE games g SET material_at_30 = v.material
         FROM unnest($1::bigint[], $2::text[], $3::smallint[]) AS v(player_id, game_id, material)
         WHERE g.player_id = v.player_id AND g.game_id = v.game_id`,
        [updates.map((u) => u.player_id), updates.map((u) => u.game_id), updates.map((u) => u.material)]
      );
      filled += updates.length;
    }
    if (rows.length < batch) return filled;
  }
}

/** Removed players get deleted instead of rebuilt. */
export async function rebuildAllReports(
  db: Queryable,
  now: Date,
  log: (message: string) => void = () => {}
): Promise<number> {
  const { rows } = await db.query<{ id: string; platform: Platform; username: string }>(
    'SELECT id, platform, username FROM players ORDER BY id'
  );
  let rebuilt = 0;
  for (const p of rows) {
    if (await isRemoved(db, p.platform, p.username)) {
      await forgetPlayer(db, p.platform, p.username);
      log(`${p.platform}/${p.username}: removal requested, data deleted`);
      continue;
    }
    const scopes = await rebuildReports(db, p.id, p.platform, p.username, now);
    log(`${p.platform}/${p.username}: ${scopes.map((s) => `${s.scope} ${s.games}`).join(', ')}`);
    rebuilt++;
  }
  return rebuilt;
}
