import type { GameRow } from '../types.js';
import type { Section, Tally } from './types.js';

export const MIN_SECTION_GAMES = 10;

export function makeTally(wins: number, draws: number, losses: number): Tally {
  const games = wins + draws + losses;
  return { games, wins, draws, losses, score: games > 0 ? (wins + draws / 2) / games : null };
}

export function tally(games: readonly GameRow[]): Tally {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const g of games) {
    if (g.score === 1) wins++;
    else if (g.score === 0.5) draws++;
    else losses++;
  }
  return makeTally(wins, draws, losses);
}

export function section<T>(games: number, build: () => T, needed = MIN_SECTION_GAMES): Section<T> {
  return games >= needed ? { enough: true, games, data: build() } : { enough: false, games, needed };
}

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function groupBy<T>(items: readonly T[], key: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

// Ties break alphabetically so output never depends on input order
export function biggestFirst<T>(groups: Map<string, T[]>): [string, T[]][] {
  return [...groups].sort((a, b) => b[1].length - a[1].length || compareText(a[0], b[0]));
}

// Not localeCompare: needs to be stable across machines
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function splitPlies(line: string): string[] {
  return line.split(' ').filter((t) => t !== '');
}

export function pct(share: number): number {
  return Math.round(share * 100);
}
