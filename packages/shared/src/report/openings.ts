import type { GameRow } from '../types.js';
import type {
  BlackOpenings,
  MoveStat,
  OpeningStat,
  OpeningVariation,
  Section,
  WhiteOpenings
} from './types.js';
import { biggestFirst, compareText, groupBy, section, splitPlies, tally } from './tally.js';

export const MIN_FAMILY_GAMES = 3;
export const MAX_FAMILIES = 6;
export const MAX_VARIATIONS = 3;
export const MIN_MOVE_GAMES = 2;
export const MAX_MOVES = 5;
export const MIN_FACED = 5;
export const LINE_PLIES = 10;

const FAMILY_KEYWORDS = new Set(['Defense', 'Defence', 'Opening', 'Game', 'Attack', 'Gambit', 'System', 'Countergambit']);
const FAMILY_FOLLOWERS = new Set(['Declined', 'Accepted', 'Refused']);
const UNKNOWN_NAMES = new Set(['', 'undefined', 'unknown', '?']);

/**
 * "Sicilian Defense Najdorf Variation" -> "Sicilian Defense".
 * Lichess separates the family with ":" or ","; Chess.com doesn't, so we cut
 * after the first keyword (keeping a trailing "Declined"/"Accepted").
 */
export function openingFamily(name: string | null, eco: string | null): string {
  const clean = name?.trim() ?? '';
  if (UNKNOWN_NAMES.has(clean.toLowerCase())) return eco?.trim() || 'Other';

  const head = clean.split(/[:,]/)[0]!.trim();
  const words = head.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    if (FAMILY_KEYWORDS.has(words[i]!)) {
      const end = FAMILY_FOLLOWERS.has(words[i + 1] ?? '') ? i + 2 : i + 1;
      return words.slice(0, end).join(' ');
    }
  }
  return head;
}

function plyAt(g: GameRow, index: number): string | null {
  return splitPlies(g.openingLine)[index] ?? null;
}

export function moveStats(games: readonly GameRow[], pick: (g: GameRow) => string | null): MoveStat[] {
  return biggestFirst(groupBy(games, pick))
    .filter(([, gs]) => gs.length >= MIN_MOVE_GAMES)
    .slice(0, MAX_MOVES)
    .map(([move, gs]) => ({ move, share: gs.length / games.length, tally: tally(gs) }));
}

export function repliesTo(blackGames: readonly GameRow[], first: string): MoveStat[] {
  const faced = blackGames.filter((g) => plyAt(g, 0) === first && plyAt(g, 1) !== null);
  if (faced.length < MIN_FACED) return [];
  return moveStats(faced, (g) => plyAt(g, 1));
}

// Follow the most common move at each ply while at least half the games still agree
export function commonLine(games: readonly GameRow[]): string {
  const need = Math.max(2, Math.ceil(games.length / 2));
  let group = games.map((g) => splitPlies(g.openingLine));
  const line: string[] = [];
  for (let ply = 0; ply < LINE_PLIES; ply++) {
    const counts = new Map<string, number>();
    for (const plies of group) {
      const move = plies[ply];
      if (move !== undefined) counts.set(move, (counts.get(move) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [move, n] of counts) {
      if (n > bestCount || (n === bestCount && best !== null && compareText(move, best) < 0)) {
        best = move;
        bestCount = n;
      }
    }
    if (best === null || (line.length > 0 && bestCount < need)) break;
    line.push(best);
    group = group.filter((plies) => plies[ply] === best);
  }
  return line.join(' ');
}

function mostCommonEco(games: readonly GameRow[]): string | null {
  return biggestFirst(groupBy(games, (g) => g.eco))[0]?.[0] ?? null;
}

function variations(games: readonly GameRow[]): OpeningVariation[] {
  const knownName = (g: GameRow): string | null =>
    UNKNOWN_NAMES.has((g.openingName ?? '').trim().toLowerCase()) ? null : g.openingName;
  return biggestFirst(groupBy(games, knownName))
    .slice(0, MAX_VARIATIONS)
    .map(([name, gs]) => ({ name, eco: mostCommonEco(gs), tally: tally(gs) }));
}

export function openingStats(games: readonly GameRow[]): OpeningStat[] {
  return biggestFirst(groupBy(games, (g) => openingFamily(g.openingName, g.eco)))
    .filter(([, gs]) => gs.length >= MIN_FAMILY_GAMES)
    .slice(0, MAX_FAMILIES)
    .map(([family, gs]) => ({
      family,
      share: gs.length / games.length,
      tally: tally(gs),
      line: commonLine(gs),
      variations: variations(gs)
    }));
}

export function whiteOpenings(whiteGames: readonly GameRow[]): Section<WhiteOpenings> {
  return section(whiteGames.length, () => ({
    firstMoves: moveStats(whiteGames, (g) => plyAt(g, 0)),
    openings: openingStats(whiteGames)
  }));
}

export function blackOpenings(blackGames: readonly GameRow[]): Section<BlackOpenings> {
  return section(blackGames.length, () => ({
    vsE4: repliesTo(blackGames, 'e4'),
    vsD4: repliesTo(blackGames, 'd4'),
    openings: openingStats(blackGames)
  }));
}

export function facedCount(blackGames: readonly GameRow[], first: string): number {
  return blackGames.filter((g) => plyAt(g, 0) === first && plyAt(g, 1) !== null).length;
}
