import { BOARD_MOVES, BOARD_NOTES, BOARD_SAN } from './data.js';

// Hero board state per tick. 10-tick loop: moves on 1-6, hold, fade on 9, reset.

export const LOOP_LENGTH = 10;
export const FINAL_PLY = BOARD_MOVES.length;
const FADE_PLY = LOOP_LENGTH - 1;
const FILES = 'abcdefgh';
const BACK_RANK = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'] as const;

export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

export interface BoardPiece {
  /** starting square, doubles as a stable React key */
  id: string;
  type: PieceType;
  white: boolean;
  square: string;
  left: number;
  top: number;
  visible: boolean;
}

export interface BoardState {
  pieces: BoardPiece[];
  lastMove: readonly [string, string] | null;
  moveList: string[];
  note: string;
  pct: number;
  resetting: boolean;
}

function startingPieces(): Map<string, { type: PieceType; white: boolean }> {
  const start = new Map<string, { type: PieceType; white: boolean }>();
  for (let f = 0; f < 8; f++) {
    const file = FILES[f]!;
    const back = BACK_RANK[f]!;
    start.set(`${file}1`, { type: back, white: true });
    start.set(`${file}2`, { type: 'p', white: true });
    start.set(`${file}7`, { type: 'p', white: false });
    start.set(`${file}8`, { type: back, white: false });
  }
  return start;
}

export function squarePosition(square: string): { left: number; top: number } {
  const file = FILES.indexOf(square[0] ?? 'a');
  const rank = Number(square[1] ?? '1');
  return { left: file * 12.5, top: (8 - rank) * 12.5 };
}

export function boardAt(ply: number): BoardState {
  const played = Math.min(Math.max(ply, 0), FINAL_PLY);
  const fading = ply === FADE_PLY;

  const start = startingPieces();
  const occupant = new Map<string, string>([...start.keys()].map((sq) => [sq, sq]));
  const squareOf = new Map<string, string>([...start.keys()].map((sq) => [sq, sq]));
  for (const [from, to] of BOARD_MOVES.slice(0, played)) {
    const id = occupant.get(from);
    if (!id) continue;
    occupant.delete(from);
    occupant.set(to, id);
    squareOf.set(id, to);
  }

  const pieces = [...start.entries()].map(([id, p]) => {
    const square = squareOf.get(id) ?? id;
    return { id, type: p.type, white: p.white, square, ...squarePosition(square), visible: !fading };
  });
  const note = BOARD_NOTES[played] ?? BOARD_NOTES[0]!;

  return {
    pieces,
    lastMove: played > 0 && !fading ? BOARD_MOVES[played - 1]! : null,
    moveList: BOARD_SAN.slice(0, played),
    note: note.text,
    pct: note.pct,
    resetting: ply === 0
  };
}

export function boardSquares(): { name: string; dark: boolean; file: string; rank: number }[] {
  const squares: { name: string; dark: boolean; file: string; rank: number }[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    for (let f = 0; f < 8; f++) {
      const file = FILES[f]!;
      squares.push({ name: `${file}${rank}`, dark: (f + rank) % 2 === 1, file, rank });
    }
  }
  return squares;
}
