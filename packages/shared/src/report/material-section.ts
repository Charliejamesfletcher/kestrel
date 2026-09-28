import type { GameRow } from '../types.js';
import type { MaterialData, Section } from './types.js';
import { section, tally } from './tally.js';

// One pawn is often noise; two is a real edge
export const MATERIAL_EDGE = 2;

export function materialSection(games: readonly GameRow[]): Section<MaterialData> {
  const reached = games.filter((g) => g.materialAt30 !== null);
  return section(reached.length, () => ({
    reached: reached.length,
    ahead: tally(reached.filter((g) => g.materialAt30! >= MATERIAL_EDGE)),
    level: tally(reached.filter((g) => Math.abs(g.materialAt30!) < MATERIAL_EDGE)),
    behind: tally(reached.filter((g) => g.materialAt30! <= -MATERIAL_EDGE))
  }));
}
