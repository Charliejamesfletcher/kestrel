import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { materialAt30 } from '../material.js';
import type { GameRow, Platform } from '../types.js';
import {
  buildReport,
  MAX_REPORT_GAMES,
  REPORT_SCOPES,
  type MoveStat,
  type OpeningStat,
  type Report,
  type ReportScope,
  type Section,
  type Tally
} from './index.js';

// Invariants that should hold for any real player's report

const NOW = new Date('2026-09-26T12:00:00Z');
const fixtures = join(import.meta.dirname, '..', '..', 'fixtures');

function load(file: string): GameRow[] {
  const raw: (Omit<GameRow, 'endedAt'> & { endedAt: string })[] = JSON.parse(readFileSync(join(fixtures, file), 'utf8'));
  // the worker normally fills this in
  return raw.map((g) => ({ ...g, endedAt: new Date(g.endedAt), materialAt30: materialAt30(g.movetext, g.colour) }));
}

const players: { name: string; platform: Platform; games: GameRow[] }[] = [
  { name: 'hikaru', platform: 'chesscom', games: load('games-chesscom-hikaru.json') },
  { name: 'drnykterstein', platform: 'lichess', games: load('games-lichess-drnykterstein.json') }
];

const BANNED = /\b(aggressive|passive|weak|strong|bad|poor|good|great|terrible|tilt|coward|brilliant)\b/i;

function build(games: readonly GameRow[], platform: Platform, username: string, scope: ReportScope): Report {
  return buildReport(games, { platform, username, scope, now: NOW });
}

function checkTally(t: Tally): void {
  expect(t.wins + t.draws + t.losses).toBe(t.games);
  if (t.games === 0) expect(t.score).toBeNull();
  else expect(t.score).toBeCloseTo((t.wins + t.draws / 2) / t.games, 10);
}

function checkShares(list: readonly (MoveStat | OpeningStat)[]): void {
  let sum = 0;
  for (const item of list) {
    expect(item.share).toBeGreaterThan(0);
    expect(item.share).toBeLessThanOrEqual(1);
    checkTally(item.tally);
    sum += item.share;
  }
  expect(sum).toBeLessThanOrEqual(1.0001);
}

function checkSection(s: Section<unknown> | null): void {
  if (!s) return;
  if (s.enough) expect(s.games).toBeGreaterThanOrEqual(10);
  else expect(s.games).toBeLessThan(s.needed);
}

function inUnit(x: number | null): void {
  if (x !== null) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1);
  }
}

for (const { name, platform, games } of players) {
  const scopes = REPORT_SCOPES.filter((s) => s === 'all' || games.some((g) => g.timeClass === s));

  describe(`real games: ${name}`, () => {
    it.each(scopes)('scope %s: tallies add up, shares stay in range, sections are honest', (scope) => {
      const r = build(games, platform, name, scope);
      const inScope = scope === 'all' ? games.length : games.filter((g) => g.timeClass === scope).length;
      expect(r.gamesUsed).toBe(Math.min(inScope, MAX_REPORT_GAMES));
      expect(r.rated).toBeLessThanOrEqual(r.gamesUsed);
      expect(r.timeControls.reduce((n, t) => n + t.games, 0)).toBeLessThanOrEqual(r.gamesUsed);

      for (const t of [r.overall, r.asWhite, r.asBlack]) checkTally(t);
      expect(r.overall.games).toBe(r.gamesUsed);
      expect(r.asWhite.games + r.asBlack.games).toBe(r.gamesUsed);

      const sections = [r.form, r.rating, r.opponents, r.openings.white, r.openings.black, r.clock, r.material, r.length, r.endings, r.castling, r.schedule];
      for (const s of sections) checkSection(s);
      expect(r.rating === null).toBe(scope === 'all');
      expect(r.clock === null).toBe(scope === 'daily');

      if (r.form.enough) checkTally(r.form.data.recent);
      if (r.opponents.enough) {
        const o = r.opponents.data;
        for (const t of [o.higher, o.similar, o.lower]) checkTally(t);
        expect(o.higher.games + o.similar.games + o.lower.games).toBe(r.opponents.games);
      }
      if (r.openings.white.enough) {
        checkShares(r.openings.white.data.firstMoves);
        checkShares(r.openings.white.data.openings);
        expect(r.openings.white.data.openings.length).toBeLessThanOrEqual(6);
        for (const o of r.openings.white.data.openings) expect(o.line.split(' ').length).toBeLessThanOrEqual(10);
      }
      if (r.openings.black.enough) {
        checkShares(r.openings.black.data.vsE4);
        checkShares(r.openings.black.data.vsD4);
        checkShares(r.openings.black.data.openings);
      }
      if (r.clock?.enough) {
        const c = r.clock.data;
        for (const x of [c.leftAt20, c.leftAt30, c.under10PctAt30, c.lossesOnTimeShare, c.winsOnTimeShare]) inUnit(x);
        expect(c.lossesOnTime).toBeLessThanOrEqual(r.overall.losses);
      }
      if (r.material.enough) {
        const m = r.material.data;
        for (const t of [m.ahead, m.level, m.behind]) checkTally(t);
        expect(m.ahead.games + m.level.games + m.behind.games).toBe(m.reached);
      }
      if (r.length.enough) {
        checkTally(r.length.data.short);
        checkTally(r.length.data.long);
      }
      if (r.endings.enough) {
        const count = (o: object): number => Object.values(o).reduce((a: number, b) => a + (b as number), 0);
        const e = r.endings.data;
        expect([count(e.wins), count(e.draws), count(e.losses)]).toEqual([r.overall.wins, r.overall.draws, r.overall.losses]);
      }
      if (r.castling.enough) {
        const c = r.castling.data;
        expect(c.kingside + c.queenside + c.none).toBe(r.castling.games);
      }
      if (r.schedule.enough) {
        expect(r.schedule.data.byHourUtc.reduce((a, b) => a + b, 0)).toBe(r.gamesUsed);
        expect(r.schedule.data.byWeekdayUtc.reduce((a, b) => a + b, 0)).toBe(r.gamesUsed);
      }
      if (r.rating?.enough) {
        const h = r.rating.data.history;
        expect(h.length).toBeLessThanOrEqual(90);
        expect([...h].map((p) => p.date).sort()).toEqual(h.map((p) => p.date));
      }

      for (const f of r.style) {
        expect(f.text).not.toMatch(BANNED);
        expect(f.text).toMatch(/\d/);
        expect(f.games).toBeGreaterThan(0);
      }
      expect(new Set(r.style.map((f) => f.id)).size).toBe(r.style.length);
      if (r.plan) {
        expect(r.plan.text).not.toMatch(BANNED);
        expect(r.plan.text.length).toBeLessThanOrEqual(220);
        expect(r.plan.basis.length).toBeGreaterThan(0);
      } else {
        expect(r.gamesUsed).toBeLessThan(10);
      }

      // JSON round trip (reports are cached as JSON) and determinism
      expect(JSON.parse(JSON.stringify(r))).toEqual(r);
      expect(build([...games].reverse(), platform, name, scope)).toEqual(r);
    });
  });
}

describe('real games: spot checks', () => {
  const hikaru = players[0]!.games;

  it("Hikaru's top first move as White is one he really plays", () => {
    const r = build(hikaru, 'chesscom', 'hikaru', 'blitz');
    const top = r.openings.white.enough ? r.openings.white.data.firstMoves[0] : undefined;
    expect(top).toBeDefined();
    const whiteBlitz = hikaru
      .filter((g) => g.timeClass === 'blitz')
      .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
      .slice(0, MAX_REPORT_GAMES)
      .filter((g) => g.colour === 'white');
    const played = whiteBlitz.filter((g) => g.movetext.split(' ')[0] === top!.move).length;
    expect(played).toBe(top!.tally.games);
    expect(top!.share).toBeCloseTo(played / r.openings.white.games, 10);
  });

  it('builds 250 games in under 50 ms', () => {
    let best = Infinity;
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      build(hikaru, 'chesscom', 'hikaru', 'all');
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(50);
  });
});
