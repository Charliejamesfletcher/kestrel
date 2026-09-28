import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GameRow } from '../types.js';
import { openingFamily } from './index.js';

const fixtures = join(import.meta.dirname, '..', '..', 'fixtures');
const load = (file: string): GameRow[] => JSON.parse(readFileSync(join(fixtures, file), 'utf8'));

describe('openingFamily', () => {
  it.each([
    // Chess.com: no punctuation, cut after the first keyword
    ['Sicilian Defense Kan Modern Variation', 'Sicilian Defense'],
    ['Sicilian Defense Smith Morra Gambit Declined Push Variation', 'Sicilian Defense'],
    ['Nimzowitsch Larsen Attack Classical Variation', 'Nimzowitsch Larsen Attack'],
    ['Modern Defense with 1 e4', 'Modern Defense'],
    ['Indian Game Knights Variation East Indian Defense', 'Indian Game'],
    ['Queens Gambit Declined Catalan Opening', 'Queens Gambit Declined'],
    ['Queens Gambit Accepted Classical Main Line Furman Variation', 'Queens Gambit Accepted'],
    ['Queens Pawn Opening Chigorin Variation', 'Queens Pawn Opening'],
    ['Ruy Lopez Opening Morphy Defense Anderssen Variation', 'Ruy Lopez Opening'],
    ['Caro Kann Defense Two Knights Attack', 'Caro Kann Defense'],
    ['Alapin Sicilian Defense Barmen Defense', 'Alapin Sicilian Defense'],
    ['Kings Indian Attack Double Fianchetto Pachman System', 'Kings Indian Attack'],
    ['Benko Gambit Half Accepted Zaitsev Nescafe Frappe Attack', 'Benko Gambit'],
    ['Grob Opening Grob Gambit Fritz Gambit', 'Grob Opening'],
    ['Trompowsky Attack', 'Trompowsky Attack'],
    ['London System', 'London System'],
    ['Italian Game Two Knights Modern Bishops Opening', 'Italian Game'],
    ['Petrovs Defense Classical Damiano Variation Kholmov Gambit', 'Petrovs Defense'],
    // Lichess: the family comes before a colon or comma
    ['Nimzo-Larsen Attack: Classical Variation', 'Nimzo-Larsen Attack'],
    ["King's Indian Attack, with e6", "King's Indian Attack"],
    ['Rapport-Jobava System, with e6', 'Rapport-Jobava System'],
    ['Vienna Gambit, with Max Lange Defense', 'Vienna Gambit'],
    ["Queen's Gambit Declined: Ragozin Defense", "Queen's Gambit Declined"],
    ["Queen's Pawn Game: Accelerated London System, Steinitz Countergambit", "Queen's Pawn Game"],
    ['Scandinavian Defense: Portuguese Gambit, Elbow Variation', 'Scandinavian Defense'],
    ['Caro-Kann Defense: Advance Variation, Botvinnik-Carls Defense', 'Caro-Kann Defense'],
    ['Pterodactyl Defense: Western, Rhamphorhynchus', 'Pterodactyl Defense'],
    ["Queen's Indian Accelerated", "Queen's Indian Accelerated"],
    ['Lasker Simul Special', 'Lasker Simul Special'],
    ['English Defence', 'English Defence']
  ])('%s -> %s', (name, family) => {
    expect(openingFamily(name, 'A00')).toBe(family);
  });

  it('falls back to the ECO code, then "Other", when the name is missing or a placeholder', () => {
    expect(openingFamily(null, 'B01')).toBe('B01');
    expect(openingFamily('Undefined', 'C20')).toBe('C20');
    expect(openingFamily('  ', null)).toBe('Other');
    expect(openingFamily(null, null)).toBe('Other');
  });

  it('gives every real opening name a short, non-empty family that starts the name', () => {
    for (const file of ['games-chesscom-hikaru.json', 'games-lichess-drnykterstein.json']) {
      for (const g of load(file)) {
        const family = openingFamily(g.openingName, g.eco);
        expect(family.length).toBeGreaterThan(0);
        if (g.openingName && g.openingName !== 'Undefined') expect(g.openingName.startsWith(family)).toBe(true);
        expect(family.split(' ').length).toBeLessThanOrEqual(5);
      }
    }
  });

  it('groups the real Chess.com names into sensible families', () => {
    const families = new Set(load('games-chesscom-hikaru.json').map((g) => openingFamily(g.openingName, g.eco)));
    for (const f of ['Sicilian Defense', 'French Defense', 'Modern Defense', 'Nimzowitsch Larsen Attack', 'Queens Gambit Declined']) {
      expect(families).toContain(f);
    }
    // Variation words never leak into a family
    for (const f of families) expect(f).not.toMatch(/Variation|Line$/);
  });
});
