import { Chess } from 'chess.js';

// This needs a real board (chess.js, ~2 ms/game), so the worker computes it
// once on save and the report engine just reads games.material_at_30.

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const PLY_AT_30 = 60;

const NOT_A_MOVE = /^(\d+\.+|1-0|0-1|1\/2-1\/2|\*)$/;

/** Material balance in pawns after move 30, from `colour`'s side. */
export function materialAt30(movetext: string, colour: 'white' | 'black'): number | null {
  const plies = movetext.split(/\s+/).filter((t) => t !== '' && !NOT_A_MOVE.test(t));
  if (plies.length < PLY_AT_30) return null;

  const board = new Chess();
  try {
    for (let i = 0; i < PLY_AT_30; i++) board.move(plies[i]!);
  } catch {
    return null;
  }

  let balance = 0;
  for (const ch of board.fen().split(' ')[0]!) {
    const value = VALUES[ch.toLowerCase()];
    if (value === undefined) continue;
    balance += ch === ch.toUpperCase() ? value : -value;
  }
  // + 0 avoids returning -0
  return (colour === 'white' ? balance : -balance) + 0;
}
