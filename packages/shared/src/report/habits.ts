import type { EndReason, GameRow } from '../types.js';
import type { CastlingData, EndingsData, LengthData, ScheduleData, Section } from './types.js';
import { section, splitPlies, tally } from './tally.js';
import { endedMs } from './select.js';

export const SHORT_GAME_MOVES = 25;
export const LONG_GAME_MOVES = 60;
export const CASTLING_MIN_MOVES = 10;

const END_REASONS: readonly EndReason[] = [
  'checkmate',
  'resign',
  'timeout',
  'abandoned',
  'draw_agreed',
  'repetition',
  'stalemate',
  'insufficient',
  'fifty_moves',
  'timeout_vs_insufficient',
  'other'
];

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function lengthSection(games: readonly GameRow[]): Section<LengthData> {
  return section(games.length, () => {
    const moves = games.map((g) => g.moves).sort((a, b) => a - b);
    const total = moves.reduce((sum, m) => sum + m, 0);
    return {
      averageMoves: Math.round((total / moves.length) * 10) / 10,
      medianMoves: median(moves),
      short: tally(games.filter((g) => g.moves <= SHORT_GAME_MOVES)),
      long: tally(games.filter((g) => g.moves >= LONG_GAME_MOVES))
    };
  });
}

export function endingsSection(games: readonly GameRow[]): Section<EndingsData> {
  return section(games.length, () => {
    const count = (score: number): Partial<Record<EndReason, number>> => {
      const out: Partial<Record<EndReason, number>> = {};
      for (const reason of END_REASONS) {
        const n = games.filter((g) => g.score === score && g.resultDetail === reason).length;
        if (n > 0) out[reason] = n;
      }
      return out;
    };
    return { wins: count(1), draws: count(0.5), losses: count(0) };
  });
}

export function ownPlies(g: GameRow): string[] {
  const start = g.colour === 'white' ? 0 : 1;
  return splitPlies(g.movetext).filter((_, i) => i % 2 === start);
}

export function castledSide(own: readonly string[]): 'kingside' | 'queenside' | null {
  for (const ply of own) {
    const move = ply.replace(/[+#!?]+$/, '').replace(/0/g, 'O');
    if (move === 'O-O-O') return 'queenside';
    if (move === 'O-O') return 'kingside';
  }
  return null;
}

export function castlingSection(games: readonly GameRow[]): Section<CastlingData> {
  let kingside = 0;
  let queenside = 0;
  let none = 0;
  for (const g of games) {
    const own = ownPlies(g);
    if (own.length < CASTLING_MIN_MOVES) continue;
    const side = castledSide(own);
    if (side === 'kingside') kingside++;
    else if (side === 'queenside') queenside++;
    else none++;
  }
  return section(kingside + queenside + none, () => ({ kingside, queenside, none }));
}

export function scheduleSection(games: readonly GameRow[]): Section<ScheduleData> {
  return section(games.length, () => {
    const byHourUtc = new Array<number>(24).fill(0);
    const byWeekdayUtc = new Array<number>(7).fill(0);
    for (const g of games) {
      const d = new Date(endedMs(g));
      byHourUtc[d.getUTCHours()]!++;
      // Monday = 0
      byWeekdayUtc[(d.getUTCDay() + 6) % 7]!++;
    }
    return { byHourUtc, byWeekdayUtc };
  });
}
