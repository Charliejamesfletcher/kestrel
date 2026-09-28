import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { materialAt30 } from './material.js';
import type { GameRow } from './types.js';

// 3.Qxg4 wins a knight, then both sides shuffle to ply 60
function knightUpLine(plies = 60): string {
  const moves = ['e4', 'Nh6', 'd4', 'Ng4', 'Qxg4'];
  const shuffle = ['Nc6', 'Nf3', 'Nb8', 'Ng1'];
  for (let i = 0; moves.length < plies; i++) moves.push(shuffle[i % 4]!);
  return moves.join(' ');
}

describe('materialAt30', () => {
  it('counts a knight up as +3 for White and -3 for Black', () => {
    expect(materialAt30(knightUpLine(), 'white')).toBe(3);
    expect(materialAt30(knightUpLine(), 'black')).toBe(-3);
  });

  it('ignores moves after ply 60', () => {
    // Plies 61+ would be illegal (a second Qxg4), but they are never replayed
    expect(materialAt30(`${knightUpLine()} Qxg4 Qxg4`, 'white')).toBe(3);
  });

  it('is 0 when nothing has been captured', () => {
    const moves: string[] = [];
    const shuffle = ['Nf3', 'Nf6', 'Ng1', 'Ng8'];
    for (let i = 0; i < 60; i++) moves.push(shuffle[i % 4]!);
    expect(materialAt30(moves.join(' '), 'white')).toBe(0);
  });

  it('returns null for a game that ended before move 30', () => {
    expect(materialAt30(knightUpLine(59), 'white')).toBeNull();
    expect(materialAt30('', 'black')).toBeNull();
  });

  it('returns null for moves it cannot replay', () => {
    expect(materialAt30(Array(60).fill('e4').join(' '), 'white')).toBeNull();
    expect(materialAt30(Array(60).fill('Zz9').join(' '), 'white')).toBeNull();
  });

  it('skips move numbers if a PGN fragment sneaks in', () => {
    const numbered = knightUpLine()
      .split(' ')
      .map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m))
      .join(' ');
    expect(materialAt30(numbered, 'white')).toBe(3);
  });

  it('gives a whole number for every real fixture game long enough', () => {
    const games: GameRow[] = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'fixtures', 'games-chesscom-hikaru.json'), 'utf8')
    );
    let replayed = 0;
    for (const g of games.slice(0, 80)) {
      const value = materialAt30(g.movetext, g.colour);
      const plies = g.movetext.split(' ').filter(Boolean).length;
      if (plies < 60) {
        expect(value).toBeNull();
        continue;
      }
      expect(Number.isInteger(value)).toBe(true);
      expect(Math.abs(value!)).toBeLessThanOrEqual(39);
      replayed++;
    }
    expect(replayed).toBeGreaterThan(30);
  });
});
