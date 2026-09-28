import { clockAfterMove, lineFields, pgnHeader, readMovetext } from './pgn.js';
import type { EndReason, GameRow, TimeClass } from './types.js';
import { baseSeconds } from './report/clock.js';

export interface ChessComGame {
  url: string;
  uuid?: string;
  pgn?: string;
  time_control: string;
  time_class: string;
  end_time: number;
  rated: boolean;
  rules: string;
  initial_setup?: string;
  fen?: string;
  accuracies?: { white?: number; black?: number };
  white: { username: string; rating?: number; result: string };
  black: { username: string; rating?: number; result: string };
}

const STANDARD_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const TIME_CLASSES = new Set<string>(['bullet', 'blitz', 'rapid', 'daily']);

const DRAWS = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

// Result codes from the side that didn't win
const REASONS: Record<string, EndReason> = {
  checkmated: 'checkmate',
  resigned: 'resign',
  timeout: 'timeout',
  abandoned: 'abandoned',
  agreed: 'draw_agreed',
  repetition: 'repetition',
  stalemate: 'stalemate',
  insufficient: 'insufficient',
  '50move': 'fifty_moves',
  timevsinsufficient: 'timeout_vs_insufficient'
};

/** Returns null for variants, custom starts, empty games, or games they didn't play. */
export function parseChessComGame(raw: ChessComGame, username: string): GameRow | null {
  if (raw.rules !== 'chess' || !raw.pgn || !TIME_CLASSES.has(raw.time_class)) return null;
  if (raw.initial_setup && raw.initial_setup !== STANDARD_START) return null;

  const name = username.toLowerCase();
  const colour =
    raw.white.username.toLowerCase() === name ? 'white' : raw.black.username.toLowerCase() === name ? 'black' : null;
  if (!colour) return null;
  const me = raw[colour];
  const them = raw[colour === 'white' ? 'black' : 'white'];

  const { sans, clocks } = readMovetext(raw.pgn);
  if (sans.length === 0) return null;

  const score = me.result === 'win' ? 1 : DRAWS.has(me.result) ? 0.5 : 0;
  // The loser's code says how it ended ("resigned"); the winner's is just "win"
  const code = score === 1 ? them.result : me.result;
  const timeClass = raw.time_class as TimeClass;
  const timed = timeClass !== 'daily';
  const timeControl = /^\d+$/.test(raw.time_control) ? `${raw.time_control}+0` : raw.time_control;

  return {
    gameId: raw.uuid ?? raw.url,
    colour,
    score,
    resultDetail: REASONS[code] ?? 'other',
    timeClass,
    timeControl,
    rated: raw.rated,
    endedAt: new Date(raw.end_time * 1000),
    eco: pgnHeader(raw.pgn, 'ECO'),
    openingName: openingNameFromUrl(pgnHeader(raw.pgn, 'ECOUrl')),
    ...lineFields(sans),
    clockAt20: timed ? clockAfterMove(clocks, colour, 20) : null,
    clockAt30: timed ? clockAfterMove(clocks, colour, 30) : null,
    clockStart: timed ? baseSeconds(timeControl) : null,
    materialAt30: null,
    finalFen: raw.fen ?? null,
    accuracy: raw.accuracies?.[colour] ?? null,
    playerRating: me.rating ?? null,
    opponentRating: them.rating ?? null
  };
}

/** ".../openings/Sicilian-Defense-Najdorf-Variation" -> "Sicilian Defense Najdorf Variation" */
export function openingNameFromUrl(url: string | null): string | null {
  const slug = url?.match(/\/openings\/([^/?#]+)/)?.[1];
  if (!slug) return null;
  // Slugs sometimes run on into moves ("...-Defense-3...Nf6"), so cut at the first move number
  return decodeURIComponent(slug)
    .split(/(?:-|\.{3})\d+\./)[0]!
    .replace(/-/g, ' ')
    .trim();
}
