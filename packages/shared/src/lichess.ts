import { clockAfterMove, lineFields } from './pgn.js';
import type { EndReason, GameRow, TimeClass } from './types.js';

interface LichessPlayer {
  user?: { id: string; name: string };
  rating?: number;
  accuracy?: number;
  analysis?: { accuracy?: number };
}

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  lastMoveAt: number;
  status: string;
  winner?: 'white' | 'black';
  players: { white: LichessPlayer; black: LichessPlayer };
  opening?: { eco?: string; name?: string };
  moves?: string;
  /** centiseconds */
  clocks?: number[];
  clock?: { initial: number; increment: number };
  daysPerTurn?: number;
  lastFen?: string;
}

// Fold Lichess speeds into Chess.com's four. The rating pool is recovered
// from timeControl later since UltraBullet/Classical rate separately.
const SPEEDS: Record<string, TimeClass> = {
  ultraBullet: 'bullet',
  bullet: 'bullet',
  blitz: 'blitz',
  rapid: 'rapid',
  classical: 'rapid',
  correspondence: 'daily'
};

// Lichess "timeout" means the opponent left and the win was claimed
const REASONS: Record<string, EndReason> = {
  mate: 'checkmate',
  resign: 'resign',
  outoftime: 'timeout',
  timeout: 'abandoned',
  stalemate: 'stalemate',
  draw: 'draw_agreed',
  insufficientMaterialClaim: 'insufficient'
};

const SKIP = new Set(['created', 'started', 'aborted', 'noStart']);

export function parseLichessGame(raw: LichessGame, username: string): GameRow | null {
  if (raw.variant !== 'standard' || SKIP.has(raw.status)) return null;
  const timeClass = SPEEDS[raw.speed];
  if (!timeClass) return null;

  const name = username.toLowerCase();
  const colour =
    raw.players.white.user?.id === name ? 'white' : raw.players.black.user?.id === name ? 'black' : null;
  if (!colour) return null;
  const me = raw.players[colour];
  const them = raw.players[colour === 'white' ? 'black' : 'white'];

  const sans = raw.moves ? raw.moves.split(' ') : [];
  if (sans.length === 0) return null;
  const clocks = (raw.clocks ?? []).map((cs) => cs / 100);

  const score = raw.winner === colour ? 1 : raw.winner ? 0 : 0.5;
  const drawnOnTime = raw.status === 'outoftime' && !raw.winner;

  return {
    gameId: raw.id,
    colour,
    score,
    resultDetail: drawnOnTime ? 'timeout_vs_insufficient' : (REASONS[raw.status] ?? 'other'),
    timeClass,
    timeControl: raw.clock
      ? `${raw.clock.initial}+${raw.clock.increment}`
      : `1/${(raw.daysPerTurn ?? 1) * 86400}`,
    rated: raw.rated,
    endedAt: new Date(raw.lastMoveAt),
    eco: raw.opening?.eco ?? null,
    openingName: raw.opening?.name ?? null,
    ...lineFields(sans),
    clockAt20: clockAfterMove(clocks, colour, 20),
    clockAt30: clockAfterMove(clocks, colour, 30),
    // first reading, so berserk is accounted for
    clockStart: clocks[colour === 'white' ? 0 : 1] ?? null,
    materialAt30: null,
    finalFen: raw.lastFen ?? null,
    accuracy: me.analysis?.accuracy ?? me.accuracy ?? null,
    playerRating: me.rating ?? null,
    opponentRating: them.rating ?? null
  };
}
