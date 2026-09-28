import type { GameRow, Platform } from '../types.js';
import type { FormData, OpponentsData, RatingData, Section } from './types.js';
import { groupBy, section, tally } from './tally.js';
import { endedMs } from './select.js';

// Everything here expects games newest first.

export const FORM_GAMES = 10;
export const RECENT_GAMES = 20;
export const MAX_HISTORY_POINTS = 90;
export const SIMILAR_RATING = 50;

function letter(g: GameRow): 'W' | 'D' | 'L' {
  return g.score === 1 ? 'W' : g.score === 0.5 ? 'D' : 'L';
}

export function formSection(newestFirst: readonly GameRow[]): Section<FormData> {
  return section(newestFirst.length, () => {
    const first = letter(newestFirst[0]!);
    let length = 0;
    while (length < newestFirst.length && letter(newestFirst[length]!) === first) length++;
    return {
      last10: newestFirst.slice(0, FORM_GAMES).map(letter),
      recent: tally(newestFirst.slice(0, RECENT_GAMES)),
      streak: { result: first, length }
    };
  });
}

function utcDay(g: GameRow): string {
  return new Date(endedMs(g)).toISOString().slice(0, 10);
}

// Lichess speed boundaries on initial + 40 * increment
const LICHESS_POOLS: [maxSeconds: number, label: string][] = [
  [30, 'UltraBullet'],
  [180, 'Bullet'],
  [480, 'Blitz'],
  [1500, 'Rapid']
];

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ratingPool(g: GameRow, platform: Platform): string {
  if (platform === 'chesscom') return capitalise(g.timeClass);
  if (g.timeControl.startsWith('1/')) return 'Correspondence';
  const m = /^(\d+)\+(\d+)$/.exec(g.timeControl);
  if (!m) return capitalise(g.timeClass);
  const estimate = Number(m[1]) + 40 * Number(m[2]);
  return LICHESS_POOLS.find(([max]) => estimate < max)?.[1] ?? 'Classical';
}

// Only charts the most played pool, since two ratings can't share an axis
export function ratingSection(newestFirst: readonly GameRow[], platform: Platform): Section<RatingData> {
  const withRating = newestFirst.filter((g) => g.playerRating !== null);
  // strict > so ties go to the most recent pool
  let pool = '';
  let rated: GameRow[] = [];
  for (const [name, list] of groupBy(withRating, (g) => ratingPool(g, platform))) {
    if (list.length > rated.length) [pool, rated] = [name, list];
  }
  return section(rated.length, () => {
    const ratings = rated.map((g) => g.playerRating!);
    const byDay = new Map<string, number>();
    for (let i = rated.length - 1; i >= 0; i--) byDay.set(utcDay(rated[i]!), ratings[i]!);
    return {
      pool,
      leftOut: withRating.length - rated.length,
      current: ratings[0]!,
      change: ratings[0]! - ratings[ratings.length - 1]!,
      peak: Math.max(...ratings),
      low: Math.min(...ratings),
      history: [...byDay].slice(-MAX_HISTORY_POINTS).map(([date, rating]) => ({ date, rating }))
    };
  });
}

export function opponentsSection(games: readonly GameRow[]): Section<OpponentsData> {
  const known = games.filter((g) => g.playerRating !== null && g.opponentRating !== null);
  const diff = (g: GameRow): number => g.opponentRating! - g.playerRating!;
  return section(known.length, () => ({
    higher: tally(known.filter((g) => diff(g) >= SIMILAR_RATING)),
    similar: tally(known.filter((g) => Math.abs(diff(g)) < SIMILAR_RATING)),
    lower: tally(known.filter((g) => diff(g) <= -SIMILAR_RATING))
  }));
}
