import type { GameRow } from '../types.js';
import type { ReportScope } from './types.js';
import { compareText } from './tally.js';

export const MAX_REPORT_GAMES = 250;

// Rows read back from JSON have an ISO string instead of a Date
export function endedMs(g: GameRow): number {
  const t = g.endedAt as Date | string;
  return typeof t === 'string' ? Date.parse(t) : t.getTime();
}

export function newestFirst(a: GameRow, b: GameRow): number {
  return endedMs(b) - endedMs(a) || compareText(a.gameId, b.gameId);
}

export function selectGames(games: readonly GameRow[], scope: ReportScope): GameRow[] {
  const inScope = scope === 'all' ? [...games] : games.filter((g) => g.timeClass === scope);
  return inScope.sort(newestFirst).slice(0, MAX_REPORT_GAMES);
}
