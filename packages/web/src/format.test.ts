import { describe, expect, it } from 'vitest';
import type { Tally } from '@kestrel/shared';
import {
  busiestHours,
  dateRange,
  endReasonLabel,
  endReasonRows,
  firstMoveLabel,
  fromGames,
  localHourShift,
  normaliseUsername,
  numberMoves,
  pct,
  profileUrl,
  readSearchInput,
  relativeTime,
  scopeLabel,
  scoreText,
  shiftHours,
  signed,
  streakText,
  timeControlLabel,
  variationLabel,
  wdl,
  wdlLong
} from './format.js';

const tally = (wins: number, draws: number, losses: number): Tally => {
  const games = wins + draws + losses;
  return { games, wins, draws, losses, score: games ? (wins + draws / 2) / games : null };
};

describe('percentages and scores', () => {
  it('rounds shares to whole percentages', () => {
    expect(pct(0.416)).toBe('42%');
    expect(pct(1)).toBe('100%');
    expect(pct(0)).toBe('0%');
    expect(pct(null)).toBe('–');
    expect(pct(Number.NaN)).toBe('–');
  });

  it('shows the score with W/D/L', () => {
    const t = tally(12, 3, 5); // 13.5 / 20
    expect(scoreText(t)).toBe('68%');
    expect(wdl(t)).toBe('12W 3D 5L');
    expect(wdlLong(t)).toBe('12 wins, 3 draws, 5 losses');
    expect(wdlLong(tally(1, 1, 1))).toBe('1 win, 1 draw, 1 loss');
    expect(scoreText(tally(0, 0, 0))).toBe('–');
  });

  it('always says how many games', () => {
    expect(fromGames(212)).toBe('from 212 games');
    expect(fromGames(1)).toBe('from 1 game');
    expect(fromGames(1234)).toBe('from 1,234 games');
  });

  it('signs rating changes', () => {
    expect(signed(23)).toBe('+23');
    expect(signed(-12)).toBe('−12');
    expect(signed(0)).toBe('±0');
  });
});

describe('end reasons', () => {
  it('has a human label for every reason', () => {
    expect(endReasonLabel('resign')).toBe('Resignation');
    expect(endReasonLabel('timeout')).toBe('Time');
    expect(endReasonLabel('fifty_moves')).toBe('50-move rule');
    expect(endReasonLabel('timeout_vs_insufficient')).toBe('Time vs insufficient material');
  });

  it('sorts counts biggest first and skips zeros', () => {
    const rows = endReasonRows({ resign: 6, checkmate: 3, timeout: 1, stalemate: 0 });
    expect(rows.map((r) => r.reason)).toEqual(['resign', 'checkmate', 'timeout']);
    expect(rows[0]!.share).toBeCloseTo(0.6);
    expect(endReasonRows({})).toEqual([]);
  });
});

describe('time zones', () => {
  it('turns getTimezoneOffset into hours east of UTC', () => {
    expect(localHourShift(0)).toEqual({ hours: 0, rounded: false });
    expect(localHourShift(-60)).toEqual({ hours: 1, rounded: false }); // London summer
    expect(localHourShift(300)).toEqual({ hours: -5, rounded: false }); // New York winter
    expect(localHourShift(-330)).toEqual({ hours: 6, rounded: true }); // India +5:30
    expect(localHourShift(-345)).toEqual({ hours: 6, rounded: true }); // Nepal +5:45
  });

  it('moves UTC hour buckets into local time, wrapping at midnight', () => {
    const utc = new Array<number>(24).fill(0);
    utc[23] = 5;
    utc[0] = 2;
    const plusOne = shiftHours(utc, 1);
    expect(plusOne[0]).toBe(5);
    expect(plusOne[1]).toBe(2);
    const minusFive = shiftHours(utc, -5);
    expect(minusFive[18]).toBe(5);
    expect(minusFive[19]).toBe(2);
    expect(minusFive.reduce((a, b) => a + b, 0)).toBe(7);
  });

  it('finds the busiest block of hours, even across midnight', () => {
    const hours = new Array<number>(24).fill(1);
    hours[23] = 10;
    hours[0] = 10;
    hours[1] = 10;
    const peak = busiestHours(hours)!;
    expect(peak.start).toBe(23);
    expect(peak.end).toBe(2);
    expect(busiestHours(new Array<number>(24).fill(0))).toBeNull();
  });
});

describe('dates', () => {
  it('formats a date range', () => {
    expect(dateRange('2026-03-03T10:00:00Z', '2026-09-26T08:00:00Z')).toBe('3 Mar – 26 Sep 2026');
    expect(dateRange('2025-11-12T10:00:00Z', '2026-09-26T08:00:00Z')).toBe('12 Nov 2025 – 26 Sep 2026');
    expect(dateRange('2026-09-26T01:00:00Z', '2026-09-26T08:00:00Z')).toBe('26 Sep 2026');
    expect(dateRange('nonsense', '2026-09-26T08:00:00Z')).toBe('');
  });

  it('says how long ago', () => {
    const now = new Date('2026-09-26T12:00:00Z');
    expect(relativeTime('2026-09-26T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-09-26T11:55:00Z', now)).toBe('5 minutes ago');
    expect(relativeTime('2026-09-26T11:00:00Z', now)).toBe('1 hour ago');
    expect(relativeTime('2026-09-24T12:00:00Z', now)).toBe('2 days ago');
    expect(relativeTime('2026-01-01T12:00:00Z', now)).toBe('on 1 Jan 2026');
  });
});

describe('chess words', () => {
  it('numbers a line of moves', () => {
    expect(numberMoves('e4 c5 Nf3 d6 d4')).toBe('1.e4 c5 2.Nf3 d6 3.d4');
    expect(numberMoves('')).toBe('');
  });

  it('labels first moves by colour', () => {
    expect(firstMoveLabel('e4', 'white')).toBe('1.e4');
    expect(firstMoveLabel('c5', 'black')).toBe('1…c5');
  });

  it('drops the family name from variations', () => {
    expect(variationLabel('Sicilian Defense Najdorf Variation', 'Sicilian Defense')).toBe('Najdorf Variation');
    expect(variationLabel('Sicilian Defense', 'Sicilian Defense')).toBe('Main line');
    expect(variationLabel('Italian Game', 'Sicilian Defense')).toBe('Italian Game');
  });

  it('writes time controls the way players say them', () => {
    expect(timeControlLabel('180+0')).toBe('3+0');
    expect(timeControlLabel('180')).toBe('3+0');
    expect(timeControlLabel('600+5')).toBe('10+5');
    expect(timeControlLabel('90+30')).toBe('1.5+30');
    expect(timeControlLabel('30+0')).toBe('30s+0');
    expect(timeControlLabel('1/259200')).toBe('3 days/move');
    expect(timeControlLabel('weird')).toBe('weird');
  });

  it('describes streaks', () => {
    expect(streakText({ result: 'W', length: 3 })).toBe('3 wins in a row');
    expect(streakText({ result: 'L', length: 1 })).toBe('1 loss');
    expect(streakText({ result: 'D', length: 2 })).toBe('2 draws in a row');
  });

  it('labels scopes', () => {
    expect(scopeLabel('all')).toBe('All');
    expect(scopeLabel('blitz')).toBe('Blitz');
  });
});

describe('usernames and profiles', () => {
  it('normalises usernames like the server does', () => {
    expect(normaliseUsername('  Hikaru ')).toBe('hikaru');
    expect(normaliseUsername('a')).toBeNull();
    expect(normaliseUsername('bad name')).toBeNull();
    expect(normaliseUsername('DrNykterstein')).toBe('drnykterstein');
  });

  it('reads usernames, @names and pasted profile links, taking the site from the link', () => {
    expect(readSearchInput(' Hikaru ')).toEqual({ platform: null, username: 'hikaru' });
    expect(readSearchInput('@DrNykterstein')).toEqual({ platform: null, username: 'drnykterstein' });
    expect(readSearchInput('https://www.chess.com/member/Hikaru')).toEqual({ platform: 'chesscom', username: 'hikaru' });
    expect(readSearchInput('chess.com/member/hikaru/')).toEqual({ platform: 'chesscom', username: 'hikaru' });
    expect(readSearchInput('https://lichess.org/@/DrNykterstein?tab=games')).toEqual({
      platform: 'lichess',
      username: 'drnykterstein'
    });
    // Links that aren't profiles: don't guess from the last path segment
    expect(readSearchInput('https://www.chess.com/game/live/123456789')).toEqual({ platform: 'chesscom', username: null });
    expect(readSearchInput('https://lichess.org/abcd1234')).toEqual({ platform: 'lichess', username: null });
    expect(readSearchInput('https://example.com/member/hikaru')).toEqual({ platform: null, username: null });
  });

  it('links to the public profile', () => {
    expect(profileUrl('chesscom', 'hikaru')).toBe('https://www.chess.com/member/hikaru');
    expect(profileUrl('lichess', 'drnykterstein')).toBe('https://lichess.org/@/drnykterstein');
  });
});
