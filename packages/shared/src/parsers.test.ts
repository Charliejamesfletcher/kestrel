import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  openingNameFromUrl,
  parseChessComGame,
  parseLichessGame,
  readMovetext,
  type ChessComGame,
  type LichessGame
} from './index.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');
// Real public games: Hikaru's Titled Tuesday blitz (8, 15 and 22 Sept 2026) and DrNykterstein on Lichess
const chesscom: ChessComGame[] = JSON.parse(readFileSync(join(fixtures, 'chesscom-hikaru-2026-09.json'), 'utf8')).games;
const lichess: LichessGame[] = readFileSync(join(fixtures, 'lichess-drnykterstein.ndjson'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));

describe('readMovetext', () => {
  it('reads moves and the clock after each one', () => {
    const { sans, clocks } = readMovetext(
      '[Event "x"]\n[ECO "B20"]\n\n1. e4 {[%clk 0:02:59.9]} 1... c5 {[%clk 0:02:58]} 2. Nf3 1-0'
    );
    expect(sans).toEqual(['e4', 'c5', 'Nf3']);
    expect(clocks).toEqual([179.9, 178, null]);
  });

  it('copes with compact numbering, NAGs, variations and promotions', () => {
    const { sans } = readMovetext('1.e4 e5 $1 2.Nf3 (2.Bc4 Nf6) Nc6 3.exd8=Q+ *');
    expect(sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'exd8=Q+']);
  });
});

describe('parseChessComGame', () => {
  const rows = chesscom.map((g) => parseChessComGame(g, 'hikaru'));

  it('parses every real game', () => {
    expect(rows.filter((r) => r === null)).toHaveLength(0);
  });

  it('reads a win as Black from the player’s side', () => {
    // michobr - Hikaru, Alapin Sicilian, 0-1 by resignation
    const row = rows[0]!;
    expect(row).toMatchObject({
      gameId: 'f78fcfe7-ab95-11f1-8ffd-6cfe54652c60',
      colour: 'black',
      score: 1,
      resultDetail: 'resign',
      timeClass: 'blitz',
      rated: true,
      eco: 'B22',
      openingName: 'Alapin Sicilian Defense',
      moves: 36,
      accuracy: 93.44,
      playerRating: 3370,
      opponentRating: 2709,
      finalFen: '1k5r/1p3R1p/p2b2p1/3Kp3/3r4/P6P/6P1/8 w - - 2 37'
    });
    expect(row.openingLine.split(' ')).toHaveLength(20);
    expect(row.openingLine.startsWith('e4 c5 c3 Qa5 Na3 e6 d4 cxd4 Nc4 Qc7')).toBe(true);
    expect(row.movetext.split(' ')).toHaveLength(72);
    expect(row.endedAt.toISOString()).toBe('2026-09-08T15:07:53.000Z');
    // Black's 20th move is ply index 39 of the PGN, the 30th is 59
    expect(row.clockAt20).toBe(143.9);
    expect(row.clockAt30).toBe(127.9);
  });

  it('normalises "300" style time controls to "300+0"', () => {
    expect(rows[0]!.timeControl).toBe('300+0');
  });

  it('reads wins as White, checkmates and wins on time', () => {
    expect(rows[1]).toMatchObject({ colour: 'white', score: 1, resultDetail: 'resign', eco: 'A01' });
    expect(rows[3]).toMatchObject({ colour: 'white', score: 1, resultDetail: 'checkmate', moves: 119 });
    expect(rows[8]).toMatchObject({ colour: 'white', score: 1, resultDetail: 'timeout' });
  });

  it('reads losses', () => {
    // platy3 - Hikaru, Hikaru resigned
    expect(rows[14]).toMatchObject({ colour: 'black', score: 0, resultDetail: 'resign', opponentRating: 3118 });
    // Made-up: game 2 of the file, but Hikaru (White) lost on time
    const flagged = { ...chesscom[1]!, white: { ...chesscom[1]!.white, result: 'timeout' }, black: { ...chesscom[1]!.black, result: 'win' } };
    expect(parseChessComGame(flagged, 'hikaru')).toMatchObject({ colour: 'white', score: 0, resultDetail: 'timeout' });
  });

  it('reads every kind of draw', () => {
    expect(rows[6]).toMatchObject({ score: 0.5, resultDetail: 'insufficient' });
    expect(rows[7]).toMatchObject({ score: 0.5, resultDetail: 'repetition' });
    expect(rows[10]).toMatchObject({ score: 0.5, resultDetail: 'timeout_vs_insufficient' });
    expect(rows[15]).toMatchObject({ score: 0.5, resultDetail: 'draw_agreed' });
  });

  it('skips variants and custom start positions', () => {
    expect(parseChessComGame({ ...chesscom[0]!, rules: 'chess960' }, 'hikaru')).toBeNull();
    expect(parseChessComGame({ ...chesscom[0]!, initial_setup: '8/8/8/8/8/8/8/K6k w - - 0 1' }, 'hikaru')).toBeNull();
  });

  it('starts every clock at the time control base (Chess.com has no berserk)', () => {
    expect(rows[0]).toMatchObject({ timeControl: '300+0', clockStart: 300 });
  });

  it('leaves clocks empty for daily games', () => {
    const daily = { ...chesscom[0]!, time_class: 'daily', time_control: '1/86400' };
    expect(parseChessComGame(daily, 'hikaru')).toMatchObject({
      timeClass: 'daily',
      timeControl: '1/86400',
      clockAt20: null,
      clockAt30: null,
      clockStart: null,
      score: 1
    });
  });

  it('matches the username case-insensitively and ignores other people’s games', () => {
    expect(parseChessComGame(chesscom[0]!, 'HIKARU')?.colour).toBe('black');
    expect(parseChessComGame(chesscom[0]!, 'someone_else')).toBeNull();
  });
});

describe('openingNameFromUrl', () => {
  it('turns the ECOUrl slug into a name and drops trailing moves', () => {
    expect(openingNameFromUrl('https://www.chess.com/openings/Ruy-Lopez-Opening-Berlin-Defense-4.O-O')).toBe(
      'Ruy Lopez Opening Berlin Defense'
    );
    expect(
      openingNameFromUrl('https://www.chess.com/openings/Indian-Game-Knights-Variation-East-Indian-Defense...4.Bb2-O-O')
    ).toBe('Indian Game Knights Variation East Indian Defense');
    expect(openingNameFromUrl('https://www.chess.com/openings/Modern-Defense-with-1-e4...3.Nf3-c6')).toBe(
      'Modern Defense with 1 e4'
    );
    expect(openingNameFromUrl(null)).toBeNull();
  });
});

describe('parseLichessGame', () => {
  const rows = lichess.map((g) => parseLichessGame(g, 'DrNykterstein'));

  it('parses every real game', () => {
    expect(rows.filter((r) => r === null)).toHaveLength(0);
  });

  it('reads a win as Black, with clocks in seconds', () => {
    // respects_55 - DrNykterstein, Alekhine, Black won by resignation
    const row = rows[0]!;
    expect(row).toMatchObject({
      gameId: 'kAdOQKeh',
      colour: 'black',
      score: 1,
      resultDetail: 'resign',
      timeClass: 'blitz',
      timeControl: '180+0',
      rated: true,
      eco: 'B02',
      openingName: 'Alekhine Defense: Sämisch Attack',
      moves: 68,
      accuracy: 93,
      playerRating: 3145,
      opponentRating: 2644,
      finalFen: '5r2/8/8/8/8/4K2k/6p1/3R4 w - - 0 1'
    });
    expect(row.endedAt.toISOString()).toBe('2026-04-08T19:45:13.708Z');
    // Black's 20th move is ply index 39 in the centisecond clocks array
    expect(row.clockAt20).toBe(149.15);
    expect(row.clockAt30).toBe(135.31);
    expect(row.openingLine.startsWith('e4 Nf6 e5 Nd5 Nc3 Nxc3 dxc3 d6')).toBe(true);
  });

  it('keeps the clock they really started with, halved by an arena berserk', () => {
    // xKWdG1d1 is 180+0, but the clocks start at 9003 cs: both players berserked
    expect(rows[1]).toMatchObject({ gameId: 'xKWdG1d1', timeControl: '180+0', clockStart: 90.03, clockAt20: 54.99 });
    // An ordinary game starts at the full time control (Lichess adds 3 cs)
    expect(rows[0]!.clockStart).toBe(180.03);
  });

  it('reads checkmates, wins as White and bullet', () => {
    expect(rows[2]).toMatchObject({ colour: 'black', score: 1, resultDetail: 'checkmate', timeClass: 'bullet', timeControl: '60+0' });
    expect(rows[1]).toMatchObject({ colour: 'white', score: 1, resultDetail: 'resign', eco: 'E61' });
  });

  it('reads a loss on time as White', () => {
    expect(rows[7]).toMatchObject({ colour: 'white', score: 0, resultDetail: 'timeout', clockAt20: 46.03, clockAt30: 30.67 });
  });

  it('reads draws, including a flag against bare material', () => {
    expect(rows[15]).toMatchObject({ score: 0.5, resultDetail: 'draw_agreed' });
    expect(rows[35]).toMatchObject({ score: 0.5, resultDetail: 'timeout_vs_insufficient' });
    // Made-up: the loss on time above, but the opponent couldn't have mated
    expect(parseLichessGame({ ...lichess[7]!, winner: undefined }, 'drnykterstein')).toMatchObject({
      score: 0.5,
      resultDetail: 'timeout_vs_insufficient'
    });
  });

  it('has no clock reading when the game ended before that move', () => {
    expect(rows[21]).toMatchObject({ moves: 15, clockAt20: null, clockAt30: null });
  });

  it('skips variants and aborted games', () => {
    expect(parseLichessGame({ ...lichess[0]!, variant: 'chess960' }, 'drnykterstein')).toBeNull();
    expect(parseLichessGame({ ...lichess[0]!, status: 'aborted' }, 'drnykterstein')).toBeNull();
  });

  it('folds classical into rapid, and correspondence into daily with no clocks', () => {
    const classical = { ...lichess[0]!, speed: 'classical', clock: { initial: 1800, increment: 0 } };
    expect(parseLichessGame(classical, 'drnykterstein')).toMatchObject({ timeClass: 'rapid', timeControl: '1800+0' });
    const { clock: _clock, clocks: _clocks, ...noClock } = lichess[0]!;
    const corr = { ...noClock, speed: 'correspondence', daysPerTurn: 3 };
    expect(parseLichessGame(corr, 'drnykterstein')).toMatchObject({
      timeClass: 'daily',
      timeControl: '1/259200',
      clockAt20: null,
      clockAt30: null,
      clockStart: null
    });
  });

  it('matches the username case-insensitively and ignores other people’s games', () => {
    expect(parseLichessGame(lichess[0]!, 'DRNYKTERSTEIN')?.colour).toBe('black');
    expect(parseLichessGame(lichess[0]!, 'someone_else')).toBeNull();
  });
});

// Real archives saved with `npm run fixture` are checked here automatically
const realFixtures = readdirSync(fixtures).filter((f) => /^chesscom-.*\.json$/.test(f));
describe.skipIf(realFixtures.length === 0)('real Chess.com fixtures', () => {
  it.each(realFixtures)('%s parses fully and quickly', (file) => {
    const { username, games } = JSON.parse(readFileSync(join(fixtures, file), 'utf8')) as {
      username: string;
      games: ChessComGame[];
    };
    const start = performance.now();
    const rows = games.map((g) => parseChessComGame(g, username));
    const ms = performance.now() - start;
    const parsed = rows.filter((r) => r !== null);
    expect(parsed.length).toBeGreaterThan(0);
    for (const r of parsed) {
      expect(r.movetext.split(' ').length).toBeGreaterThan(0);
      if (r.timeClass !== 'daily' && r.moves >= 20) expect(r.clockAt20).not.toBeNull();
    }
    expect(ms / games.length).toBeLessThan(1); // well under 1 ms per game
  });
});
