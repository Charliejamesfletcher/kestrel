export type Platform = 'chesscom' | 'lichess';

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export const PLATFORMS: readonly Platform[] = ['chesscom', 'lichess'] as const;

export const TIME_CLASSES: readonly TimeClass[] = ['bullet', 'blitz', 'rapid', 'daily'] as const;

/** Usernames on both sites: letters, digits, underscores and hyphens, 2-30 chars. */
export function normaliseUsername(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{2,30}$/.test(name) ? name : null;
}

/** How a game ended, the same words for both sites. */
export type EndReason =
  | 'checkmate'
  | 'resign'
  | 'timeout'
  | 'abandoned'
  | 'draw_agreed'
  | 'repetition'
  | 'stalemate'
  | 'insufficient'
  | 'fifty_moves'
  | 'timeout_vs_insufficient'
  | 'other';

/** One finished game from the scouted player's side, as stored in `games`. */
export interface GameRow {
  gameId: string;
  colour: 'white' | 'black';
  /** 1 win, 0.5 draw, 0 loss, for the scouted player */
  score: 0 | 0.5 | 1;
  resultDetail: EndReason;
  timeClass: TimeClass;
  /** "180+2" (seconds + increment), or "1/259200" for correspondence */
  timeControl: string;
  rated: boolean;
  endedAt: Date;
  eco: string | null;
  openingName: string | null;
  /** First 20 plies in SAN, space-separated */
  openingLine: string;
  /** Every move in SAN, space-separated */
  movetext: string;
  /** Full moves played */
  moves: number;
  /** Player's remaining clock in seconds after their 20th / 30th move */
  clockAt20: number | null;
  clockAt30: number | null;
  /**
   * Starting clock in seconds. Usually the base time, but a Lichess berserk
   * halves it. Undefined on rows stored before migration 0004.
   */
  clockStart?: number | null;
  materialAt30: number | null;
  finalFen: string | null;
  accuracy: number | null;
  playerRating: number | null;
  opponentRating: number | null;
}
