import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLichessGame, type LichessGame } from '../lichess.js';
import type { GameRow, Platform } from '../types.js';
import { buildReport, MAX_REPORT_GAMES, MIN_SECTION_GAMES, type Report, type ReportScope, type Section } from './index.js';
import { commonLine } from './openings.js';
import { ratingPool } from './results.js';


const NOW = new Date('2026-09-26T12:00:00Z');
const LATEST = Date.parse('2026-09-20T18:00:00Z');

let nextId = 0;
function makeGame(overrides: Partial<GameRow> = {}): GameRow {
  nextId++;
  return {
    gameId: `g${String(nextId).padStart(4, '0')}`,
    colour: 'white',
    score: 1,
    resultDetail: 'resign',
    timeClass: 'blitz',
    timeControl: '180+0',
    rated: true,
    endedAt: new Date(LATEST - nextId * 60_000),
    eco: null,
    openingName: null,
    openingLine: 'e4 e5 Nf3 Nc6',
    movetext: 'e4 e5 Nf3 Nc6',
    moves: 40,
    clockAt20: null,
    clockAt30: null,
    materialAt30: null,
    finalFen: null,
    accuracy: null,
    playerRating: null,
    opponentRating: null,
    ...overrides
  };
}

function games(n: number, each: (i: number) => Partial<GameRow> = () => ({})): GameRow[] {
  return Array.from({ length: n }, (_, i) => makeGame({ endedAt: new Date(LATEST - i * 3_600_000), ...each(i) }));
}

function build(gs: readonly GameRow[], scope: ReportScope = 'blitz', platform: Platform = 'chesscom'): Report {
  return buildReport(gs, { platform, username: 'test', scope, now: NOW });
}

function data<T>(s: Section<T> | null): T {
  if (!s || !s.enough) throw new Error(`section not enough: ${JSON.stringify(s)}`);
  return s.data;
}

describe('game selection', () => {
  it('filters by scope, keeps the newest 250 and reports period and time controls', () => {
    const gs = [
      ...games(300, (i) => ({ timeControl: i % 3 === 0 ? '300+0' : '180+0', rated: i % 2 === 0 })),
      ...games(5, () => ({ timeClass: 'bullet', timeControl: '60+0' }))
    ];
    const r = build(gs);
    expect(r.gamesUsed).toBe(MAX_REPORT_GAMES);
    expect(r.rated).toBe(125);
    expect(r.period).toEqual({ from: new Date(LATEST - 249 * 3_600_000).toISOString(), to: new Date(LATEST).toISOString() });
    expect(r.timeControls).toEqual([
      { timeControl: '180+0', games: 166 },
      { timeControl: '300+0', games: 84 }
    ]);
    expect(r.builtAt).toBe(NOW.toISOString());

    expect(build(gs, 'bullet').gamesUsed).toBe(5);
    expect(build(gs, 'all').gamesUsed).toBe(250);
  });

  it('gives the same report whatever order the games arrive in', () => {
    const gs = games(30, (i) => ({ score: i % 3 === 0 ? 0 : 1, colour: i % 2 ? 'white' : 'black' }));
    expect(build([...gs].reverse())).toEqual(build(gs));
  });

  it('says "not enough" below 10 games and builds sections from 10', () => {
    const nine = build(games(9));
    expect(nine.form).toEqual({ enough: false, games: 9, needed: MIN_SECTION_GAMES });
    expect(nine.plan).toBeNull();
    expect(build(games(10)).form.enough).toBe(true);

    const empty = build([]);
    expect(empty.gamesUsed).toBe(0);
    expect(empty.period).toBeNull();
    expect(empty.overall).toEqual({ games: 0, wins: 0, draws: 0, losses: 0, score: null });
    expect(empty.style).toEqual([]);
  });
});

describe('tallies and form', () => {
  it('counts results by colour and the current streak', () => {
    // Newest first: W W W D L, then 15 more alternating W/L
    const results: GameRow['score'][] = [1, 1, 1, 0.5, 0, ...Array.from({ length: 15 }, (_, i) => (i % 2 ? 0 : 1) as 0 | 1)];
    const r = build(games(20, (i) => ({ score: results[i]!, colour: i < 10 ? 'white' : 'black' })));
    expect(r.overall).toEqual({ games: 20, wins: 11, draws: 1, losses: 8, score: 11.5 / 20 });
    expect(r.asWhite).toEqual({ games: 10, wins: 6, draws: 1, losses: 3, score: 6.5 / 10 });
    expect(r.asBlack.games).toBe(10);
    const form = data(r.form);
    expect(form.last10).toEqual(['W', 'W', 'W', 'D', 'L', 'W', 'L', 'W', 'L', 'W']);
    expect(form.recent.games).toBe(20);
    expect(form.streak).toEqual({ result: 'W', length: 3 });
  });
});

describe('rating', () => {
  it('tracks current, change, peak, low and one point per day', () => {
    // 12 games, two per day, newest first; ratings fall by 10 per game going back in time
    const gs = games(12, (i) => ({
      endedAt: new Date(Date.parse('2026-09-20T20:00:00Z') - Math.floor(i / 2) * 86_400_000 - (i % 2) * 3_600_000),
      playerRating: 2000 - i * 10 + (i === 5 ? 500 : 0)
    }));
    const rating = data(build(gs).rating);
    expect(rating.pool).toBe('Blitz');
    expect(rating.leftOut).toBe(0);
    expect(rating.current).toBe(2000);
    expect(rating.change).toBe(2000 - 1890);
    expect(rating.peak).toBe(2450);
    expect(rating.low).toBe(1890);
    expect(rating.history).toHaveLength(6);
    expect(rating.history[0]).toEqual({ date: '2026-09-15', rating: 1900 });
    expect(rating.history[5]).toEqual({ date: '2026-09-20', rating: 2000 });
  });

  it('keeps only the latest 90 days and is null for scope all', () => {
    const gs = games(120, (i) => ({ endedAt: new Date(LATEST - i * 86_400_000), playerRating: 1500 + i }));
    const history = data(build(gs).rating).history;
    expect(history).toHaveLength(90);
    expect(history[89]!.rating).toBe(1500);
    expect(history[0]!.rating).toBe(1589);
    expect(build(gs, 'all').rating).toBeNull();
  });

  it('works out the Lichess rating pool from the time control', () => {
    const pool = (timeControl: string, platform: Platform = 'lichess') => ratingPool(makeGame({ timeControl }), platform);
    // Estimated length = initial + 40 x increment
    expect(['15+0', '15+1', '60+0', '120+1', '180+0', '180+2', '600+0', '900+10', '1800+0', '1/86400'].map((tc) => pool(tc))).toEqual([
      'UltraBullet', 'Bullet', 'Bullet', 'Bullet', 'Blitz', 'Blitz', 'Rapid', 'Rapid', 'Classical', 'Correspondence'
    ]);
    // Chess.com has one rating per time class, whatever the time control
    expect(pool('15+0', 'chesscom')).toBe('Blitz');
  });

  it('charts one Lichess rating pool only: UltraBullet stays out of a bullet chart', () => {
    // Like penguingim1: 1+0 games rated ~3150 and a few 15+0 (UltraBullet) games rated ~2800
    const gs = games(17, (i) => ({
      timeClass: 'bullet',
      timeControl: i >= 3 && i < 8 ? '15+0' : '60+0',
      playerRating: i >= 3 && i < 8 ? 2800 : 3150 + i
    }));
    const rating = data(build(gs, 'bullet', 'lichess').rating);
    expect(rating.pool).toBe('Bullet');
    expect(rating.leftOut).toBe(5);
    expect(build(gs, 'bullet', 'lichess').rating?.games).toBe(12);
    expect(rating.low).toBe(3150);
    expect(rating.peak).toBe(3166);
    expect(rating.change).toBe(3150 - 3166);
    // On Chess.com the same games are one pool (time class bullet)
    expect(data(build(gs, 'bullet', 'chesscom').rating)).toMatchObject({ pool: 'Bullet', leftOut: 0, low: 2800 });
  });
});

describe('opponents', () => {
  it('splits by rating gap at 50 points and skips unknown ratings', () => {
    const gaps = [50, 120, -50, -200, 49, -49, 0, 10, 60, 70];
    const gs = [
      ...games(10, (i) => ({ playerRating: 2000, opponentRating: 2000 + gaps[i]!, score: i < 5 ? 1 : 0 })),
      makeGame({ playerRating: 2000, opponentRating: null })
    ];
    const r = data(build(gs).opponents);
    expect(r.higher).toMatchObject({ games: 4, wins: 2, losses: 2 });
    expect(r.similar).toMatchObject({ games: 4, wins: 1, losses: 3 });
    expect(r.lower).toMatchObject({ games: 2, wins: 2 });
  });
});

describe('openings', () => {
  it('lists first moves played twice or more and families of three or more', () => {
    const lines = [
      ...Array(6).fill('e4 c5 Nf3 d6 d4 cxd4'),
      ...Array(3).fill('e4 c5 Nc3 Nc6'),
      'd4 d5 c4 e6',
      'd4 Nf6 c4 g6',
      'c4 e5'
    ];
    const names = [...Array(9).fill('Sicilian Defense Open'), 'Queens Gambit Declined', 'Indian Game', 'English Opening']
    const gs = games(12, (i) => ({ openingLine: lines[i]!, movetext: lines[i]!, openingName: names[i]!, eco: i < 9 ? 'B50' : 'D30', score: i === 0 ? 0 : 1 }));
    const white = data(build(gs).openings.white);
    expect(white.firstMoves).toEqual([
      { move: 'e4', share: 9 / 12, tally: { games: 9, wins: 8, draws: 0, losses: 1, score: 8 / 9 } },
      { move: 'd4', share: 2 / 12, tally: { games: 2, wins: 2, draws: 0, losses: 0, score: 1 } }
    ]);
    expect(white.openings).toHaveLength(1);
    expect(white.openings[0]).toMatchObject({ family: 'Sicilian Defense', share: 9 / 12, line: 'e4 c5 Nf3 d6 d4 cxd4' });
    expect(white.openings[0]!.variations).toEqual([
      { name: 'Sicilian Defense Open', eco: 'B50', tally: { games: 9, wins: 8, draws: 0, losses: 1, score: 8 / 9 } }
    ]);
  });

  it('follows the majority line and stops when most games leave it', () => {
    const mk = (line: string): GameRow => makeGame({ openingLine: line });
    expect(commonLine([mk('e4 c5 Nf3 d6'), mk('e4 c5 Nf3 e6'), mk('e4 c5 Nc3 Nc6'), mk('e4 c5 Nf3 d6')])).toBe('e4 c5 Nf3 d6');
    expect(commonLine([mk('b3 e5'), mk('b3 d5'), mk('b3 Nf6')])).toBe('b3');
    // Never more than 10 plies
    const long = 'Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8';
    expect(commonLine([mk(long), mk(long)]).split(' ')).toHaveLength(10);
  });

  it('shows replies to 1.e4 only after facing it five times', () => {
    const four = games(12, (i) => ({ colour: 'black', openingLine: i < 4 ? 'e4 c5' : 'd4 Nf6', score: 0.5 }));
    const black = data(build(four).openings.black);
    expect(black.vsE4).toEqual([]);
    expect(black.vsD4).toEqual([{ move: 'Nf6', share: 1, tally: { games: 8, wins: 0, draws: 8, losses: 0, score: 0.5 } }]);

    const replies = ['c5', 'c5', 'c5', 'e5', 'e5', 'd5'];
    const six = games(12, (i) => ({ colour: 'black', openingLine: i < 6 ? `e4 ${replies[i]}` : 'c4 e5' }));
    const vsE4 = data(build(six).openings.black).vsE4;
    // d5 was played once: below the two-game minimum, but still counted in the base
    expect(vsE4.map((m) => [m.move, m.share])).toEqual([
      ['c5', 3 / 6],
      ['e5', 2 / 6]
    ]);
  });
});

describe('clock', () => {
  it('averages the share of starting time left and counts time losses', () => {
    const gs = games(12, (i) => ({
      timeControl: i < 6 ? '180+0' : '60+1',
      clockAt20: i < 6 ? 90 : 30, // 50% in both
      clockAt30: i < 10 ? (i < 6 ? 9 : 3) : null, // 5% in all ten readings
      score: i < 4 ? 0 : 1,
      resultDetail: i < 2 || i === 11 ? 'timeout' : 'resign'
    }));
    const clock = data(build(gs).clock);
    expect(clock.leftAt20).toBeCloseTo(0.5);
    expect(clock.leftAt30).toBeCloseTo(0.05);
    expect(clock.readingsAt30).toBe(10);
    expect(clock.under10PctAt30).toBe(1);
    expect(clock.lossesOnTime).toBe(2);
    expect(clock.lossesOnTimeShare).toBe(0.5);
    expect(clock.winsOnTime).toBe(1);
    expect(clock.winsOnTimeShare).toBe(1 / 8);
  });

  it('caps a clock above the starting time at 1, skips daily games, and is null for scope daily', () => {
    const gs = [
      ...games(10, () => ({ timeControl: '180+2', clockAt20: 200, clockAt30: 190 })),
      ...games(5, () => ({ timeClass: 'daily', timeControl: '1/86400', clockAt20: 5 }))
    ];
    const all = build(gs, 'all');
    expect(all.clock?.games).toBe(10);
    expect(data(all.clock).leftAt20).toBe(1);
    expect(build(gs, 'daily').clock).toBeNull();
  });

  it('measures a berserked Lichess game against the clock they really started with', () => {
    // Real game xKWdG1d1: 180+0, berserked, so the clock started at 90.03 s; 54.99 s left after move 20
    const raw: LichessGame[] = readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'lichess-drnykterstein.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const real = parseLichessGame(raw.find((g) => g.id === 'xKWdG1d1')!, 'drnykterstein')!;
    const gs = Array.from({ length: 10 }, (_, i) => ({ ...real, gameId: `b${i}`, endedAt: new Date(LATEST - i * 60_000) }));
    const clock = data(build(gs, 'blitz', 'lichess').clock);
    expect(clock.leftAt20).toBeCloseTo(54.99 / 90.03, 10); // 61%, not the 31% that 54.99 / 180 gives
  });

  it('leaves Lichess games with no known starting clock out of clock shares, but still counts time losses', () => {
    // Rows stored before clockStart existed: the start might have been halved by a berserk
    const old = games(10, (i) => ({ clockAt20: 60, clockAt30: 30, score: i < 4 ? 0 : 1, resultDetail: i < 2 ? 'timeout' : 'resign' }));
    const lichess = build(old, 'blitz', 'lichess');
    expect(lichess.clock?.games).toBe(10);
    expect(data(lichess.clock)).toMatchObject({ leftAt20: null, leftAt30: null, readingsAt30: 0, lossesOnTime: 2, lossesOnTimeShare: 0.5 });
    // Chess.com has no berserk, so the time control is a safe fallback there
    expect(data(build(old).clock).leftAt20).toBeCloseTo(60 / 180);
    // With clockStart stored, Lichess games count again
    const stored = old.map((g) => ({ ...g, clockStart: 90 }));
    expect(data(build(stored, 'blitz', 'lichess').clock).leftAt20).toBeCloseTo(60 / 90);
  });
});

describe('material at move 30', () => {
  it('splits at two pawns either way and needs 10 games that reached move 30', () => {
    const balance = [2, 5, -2, -9, 1, -1, 0, 0, 3, -3, null, null];
    const gs = games(12, (i) => ({ materialAt30: balance[i]!, score: i % 2 === 0 ? 1 : 0.5 }));
    const m = build(gs).material;
    expect(m.games).toBe(10);
    const d = data(m);
    expect(d.reached).toBe(10);
    expect(d.ahead).toMatchObject({ games: 3, wins: 2, draws: 1 });
    expect(d.behind).toMatchObject({ games: 3, wins: 1, draws: 2 });
    expect(d.level).toMatchObject({ games: 4 });

    const few = build(games(12, (i) => ({ materialAt30: i < 9 ? 0 : null }))).material;
    expect(few).toEqual({ enough: false, games: 9, needed: 10 });
  });
});

describe('length, endings, castling, schedule', () => {
  it('measures game length', () => {
    const moves = [10, 25, 26, 40, 59, 60, 61, 30, 30, 34];
    const d = data(build(games(10, (i) => ({ moves: moves[i]!, score: i < 5 ? 1 : 0 }))).length);
    expect(d.averageMoves).toBe(37.5);
    expect(d.medianMoves).toBe(32);
    expect(d.short).toMatchObject({ games: 2, wins: 2 });
    expect(d.long).toMatchObject({ games: 2, losses: 2 });
  });

  it('counts how games end, by result', () => {
    const reasons: GameRow['resultDetail'][] = ['resign', 'resign', 'checkmate', 'timeout', 'repetition', 'draw_agreed', 'resign', 'checkmate', 'timeout', 'resign'];
    const scores: GameRow['score'][] = [1, 1, 1, 1, 0.5, 0.5, 0, 0, 0, 0];
    const d = data(build(games(10, (i) => ({ resultDetail: reasons[i]!, score: scores[i]! }))).endings);
    expect(d).toEqual({
      wins: { checkmate: 1, resign: 2, timeout: 1 },
      draws: { draw_agreed: 1, repetition: 1 },
      losses: { checkmate: 1, resign: 2, timeout: 1 }
    });
  });

  it('reads castling from their own moves only, in games of 10+ moves', () => {
    const shuffle = (n: number): string[] => Array.from({ length: n }, (_, i) => (i % 2 ? 'Ng1' : 'Nf3'));
    // As Black: O-O-O on their 5th move; White castles kingside (must not count)
    const blackLong = ['e4', 'd5', 'O-O', 'Qd6', 'a3', 'Bd7', 'a4', 'Nc6', 'a5', 'O-O-O+', ...shuffle(12)];
    const whiteShort = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O#', ...shuffle(14)];
    const noCastle = shuffle(22);
    const tooShort = ['e4', 'e5', 'O-O-O'];
    const gs = games(13, (i) =>
      i < 5
        ? { colour: 'black', movetext: blackLong.join(' ') }
        : i < 10
          ? { colour: 'white', movetext: whiteShort.join(' ') }
          : i < 12
            ? { colour: 'white', movetext: noCastle.join(' ') }
            : { colour: 'white', movetext: tooShort.join(' ') }
    );
    const c = build(gs).castling;
    expect(c.games).toBe(12);
    expect(data(c)).toEqual({ kingside: 5, queenside: 5, none: 2 });
  });

  it('counts games by UTC hour and weekday (0 = Monday)', () => {
    // 2026-09-21 is a Monday
    const gs = games(10, (i) => ({ endedAt: new Date(`2026-09-${21 + (i % 7)}T${i < 5 ? '23' : '00'}:30:00Z`) }));
    const d = data(build(gs).schedule);
    expect(d.byHourUtc[23]).toBe(5);
    expect(d.byHourUtc[0]).toBe(5);
    expect(d.byHourUtc.reduce((a, b) => a + b, 0)).toBe(10);
    expect(d.byWeekdayUtc).toEqual([2, 2, 2, 1, 1, 1, 1]);
  });
});

describe('style facts', () => {
  it('states measured facts with the number and base, most distinctive first', () => {
    const gs = games(40, (i) => ({
      colour: i < 20 ? 'white' : 'black',
      openingLine: i < 20 ? (i < 18 ? 'e4 e5' : 'd4 d5') : 'e4 c5',
      movetext: i < 20 ? 'e4 e5' : 'e4 c5',
      score: i % 4 === 0 ? 0 : 1,
      resultDetail: 'resign'
    }));
    const r = build(gs);
    const byId = Object.fromEntries(r.style.map((f) => [f.id, f]));
    expect(byId['first-move-e4']).toEqual({ id: 'first-move-e4', text: 'Plays 1.e4 in 90% of games as White (20 games)', value: 0.9, games: 20 });
    expect(byId['reply-e4-c5']).toEqual({ id: 'reply-e4-c5', text: 'Answers 1.e4 with 1...c5 in 100% of games (20 games)', value: 1, games: 20 });
    expect(byId['resigns-losses']?.text).toBe('Resigns in 100% of their losses (10 losses)');
    // A 100% reply is further past its threshold than a 90% first move
    expect(r.style.findIndex((f) => f.id === 'reply-e4-c5')).toBeLessThan(r.style.findIndex((f) => f.id === 'first-move-e4'));
  });

  it('names the most common opening family as a count, never as one they "play"', () => {
    // The site names these Black games after White's 1.b3: he faced it, he didn't choose it
    const gs = games(20, () => ({ colour: 'black', openingName: 'Nimzo-Larsen Attack: Modern Variation', openingLine: 'b3 e5' }));
    const fact = build(gs).style.find((f) => f.id === 'top-opening-black');
    expect(fact?.text).toBe('Most common opening in their games as Black: Nimzo-Larsen Attack (100% of 20 games)');
    for (const f of build(gs).style) expect(f.text).not.toMatch(/^Plays the /);
  });

  it('mentions castling queenside and time losses only past their thresholds', () => {
    const qs = ['e4', 'd5', 'Nc3', 'Qd6', 'd4', 'Bd7', 'Be3', 'Nc6', 'Qd2', 'O-O-O', 'O-O-O', ...Array(12).fill('a3')];
    const gs = games(20, (i) => ({
      movetext: i < 5 ? qs.join(' ') : Array(24).fill('Nf3').join(' '),
      score: i < 10 ? 0 : 1,
      resultDetail: i < 3 ? 'timeout' : 'resign'
    }));
    const ids = build(gs).style.map((f) => f.id);
    expect(ids).toContain('castles-queenside'); // 5 of 20 = 25% >= 20%
    expect(ids).toContain('flag-losses'); // 3 of 10 losses = 30% >= 20%
    const text = build(gs).style.find((f) => f.id === 'castles-queenside')?.text;
    expect(text).toBe('Castles queenside in 25% of games (20 games)');
  });
});

describe('game plan', () => {
  it('names the opening and the time-trouble edge', () => {
    const gs = games(20, (i) => ({
      openingLine: 'e4 e5',
      clockAt30: 10, // 10 / 180 = 6% left
      score: i < 10 ? 0 : 1
    }));
    const plan = build(gs).plan!;
    expect(plan.text).toBe(
      'As White they open 1.e4. They average 6% of their clock left at move 30, so keep it complicated and make them use their clock.'
    );
    expect(plan.basis).toEqual(['first-move-e4', 'clock']);
  });

  it('picks the conversion edge when they drop points two pawns up', () => {
    const gs = games(20, (i) => ({ colour: 'black', openingLine: 'c4 e5', materialAt30: 3, score: i < 12 ? 0.5 : 1, clockAt30: 150 }));
    const plan = build(gs).plan!;
    expect(plan.text).toBe("They score only 70% when two pawns up at move 30, so don't give up when behind.");
    expect(plan.basis).toEqual(['material']);
  });

  it('picks long games when they score clearly worse in them', () => {
    const gs = games(40, (i) => ({ moves: i < 12 ? 70 : 30, score: i < 12 ? (i < 6 ? 0 : 1) : 1, openingLine: i % 2 ? 'e4 e5' : 'd4 d5' }));
    const plan = build(gs).plan!;
    expect(plan.text).toBe('As White they vary their first move. They score 50% in games of 60+ moves (85% overall), so aim for long games.');
    expect(plan.basis).toEqual(['openings.white', 'length']);
  });

  it('says honestly when no edge crosses its threshold, and skips replies seen in under 8 games', () => {
    const gs = games(24, (i) => ({
      colour: i % 2 ? 'black' : 'white',
      openingLine: i % 2 ? (i % 4 === 1 ? 'e4 c5' : 'd4 Nf6') : 'e4 e5'
    }));
    const plan = build(gs).plan!;
    // They faced 1.e4 and 1.d4 six times each: too few to call either reply a habit
    expect(plan.text).toBe('No clear weakness found in 24 games. As White they open 1.e4. Play solid chess.');
    expect(plan.basis).toEqual(['first-move-e4']);
  });

  /** 16 White games of 1.e4, then Black games with these lines */
  function withReplies(black: string[]): GameRow[] {
    const lines = [...Array<string>(16).fill('e4 e5'), ...black];
    return games(lines.length, (i) => ({ colour: i < 16 ? 'white' : 'black', openingLine: lines[i]! }));
  }
  const times = (n: number, line: string): string[] => Array<string>(n).fill(line);

  it('hedges Black replies by how often they play them, like the White first move', () => {
    // vs 1.e4: c5 5 of 8 (63%, "usually"); vs 1.d4: Nf6 4 of 10 (40%, "most often"), d5 and e6 3 each
    const gs = withReplies([...times(5, 'e4 c5'), ...times(3, 'e4 e5'), ...times(4, 'd4 Nf6'), ...times(3, 'd4 d5'), ...times(3, 'd4 e6')]);
    const plan = build(gs).plan!;
    expect(plan.text).toBe(
      'No clear weakness found in 34 games. As White they open 1.e4; as Black they usually meet 1.e4 with 1...c5 and most often meet 1.d4 with 1...Nf6. Play solid chess.'
    );
    // c5 at 63% over 8 games is also a style fact; Nf6 at 40% is not
    expect(plan.basis).toEqual(['first-move-e4', 'reply-e4-c5', 'openings.black']);
  });

  it('says a shared qualifier once, and names no reply that is not clearly ahead', () => {
    const same = withReplies([...times(5, 'e4 c5'), ...times(3, 'e4 e5'), ...times(6, 'd4 Nf6'), ...times(4, 'd4 d5')]);
    expect(build(same).plan!.text).toContain('as Black they usually meet 1.e4 with 1...c5 and 1.d4 with 1...Nf6.');
    // 1...Nf6 and 1...d5 four times each: a tie names neither
    const tie = withReplies([...times(8, 'e4 c5'), ...times(4, 'd4 Nf6'), ...times(4, 'd4 d5')]);
    expect(build(tie).plan!.text).toContain('as Black they meet 1.e4 with 1...c5.');
  });

  it('never runs past 220 characters, dropping opening detail first', () => {
    const long = 'Nxd4xe5xf6xg7xh8'.repeat(4);
    const gs = games(24, (i) => ({
      colour: i % 2 ? 'black' : 'white',
      openingLine: i % 2 ? (i % 4 === 1 ? `e4 ${long}` : `d4 ${long}`) : `${long} e5`,
      clockAt30: 5
    }));
    const plan = build(gs).plan!;
    expect(plan.text.length).toBeLessThanOrEqual(220);
    expect(plan.text).toContain('make them use their clock');
  });
});
