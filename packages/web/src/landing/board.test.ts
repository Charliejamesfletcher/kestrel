import { describe, expect, it } from 'vitest';
import { boardAt, boardSquares, FINAL_PLY, LOOP_LENGTH, squarePosition } from './board.js';
import { plans } from './data.js';

describe('landing board loop', () => {
  it('starts from the normal starting position with nothing highlighted', () => {
    const b = boardAt(0);
    expect(b.pieces).toHaveLength(32);
    expect(b.lastMove).toBeNull();
    expect(b.moveList).toEqual([]);
    expect(b.pieces.every((p) => p.visible && p.square === p.id)).toBe(true);
    expect(b.resetting).toBe(true);
  });

  it('plays 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 and stops there', () => {
    const b = boardAt(FINAL_PLY);
    const on = (sq: string) => b.pieces.find((p) => p.square === sq);
    expect(on('e4')).toMatchObject({ id: 'e2', type: 'p', white: true });
    expect(on('f3')).toMatchObject({ id: 'g1', type: 'n', white: true });
    expect(on('c4')).toMatchObject({ id: 'f1', type: 'b', white: true });
    expect(on('c5')).toMatchObject({ id: 'f8', type: 'b', white: false });
    expect(b.lastMove).toEqual(['f8', 'c5']);
    expect(b.moveList).toEqual(['1. e4', 'e5', '2. Nf3', 'Nc6', '3. Bc4', 'Bc5']);
    expect(b.note).toBe('Italian Game reached. They score just 41% here');
    // The rest ticks hold the final position
    expect(boardAt(8).moveList).toHaveLength(6);
  });

  it('fades out on the last tick of the loop without a highlight', () => {
    const b = boardAt(LOOP_LENGTH - 1);
    expect(b.pieces.every((p) => !p.visible)).toBe(true);
    expect(b.lastMove).toBeNull();
  });

  it('places squares with a1 bottom-left and a1 dark', () => {
    expect(squarePosition('a8')).toEqual({ left: 0, top: 0 });
    expect(squarePosition('h1')).toEqual({ left: 87.5, top: 87.5 });
    const squares = boardSquares();
    expect(squares).toHaveLength(64);
    expect(squares.find((s) => s.name === 'a1')?.dark).toBe(true);
    expect(squares.find((s) => s.name === 'h1')?.dark).toBe(false);
  });
});

describe('landing pricing', () => {
  it('uses the agreed prices', () => {
    const [free, proMonthly, clubMonthly] = plans(false);
    expect(free?.price).toBe('£0');
    expect(proMonthly).toMatchObject({ price: '£4.99', was: null, per: '/month' });
    expect(clubMonthly).toMatchObject({ price: '£19', was: null });
    const [, proYearly, clubYearly] = plans(true);
    expect(proYearly).toMatchObject({ price: '£4.16', was: '£4.99', per: '/month, billed £49.90 a year' });
    // No invented yearly Club price
    expect(clubYearly).toMatchObject({ price: '£19', was: null, fine: 'Yearly billing coming soon' });
  });
});
