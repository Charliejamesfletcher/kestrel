import { describe, expect, it } from 'vitest';
import './lib.js';

type Lib = {
  profileFromUrl(url: string): { platform: string; username: string } | null;
  isGameUrl(url: string): boolean;
  isLocked(urls: (string | undefined)[]): boolean;
  kestrelBase(saved?: string): string;
  reportUrl(base: string | undefined, platform: string, username: string): string;
  readSearchInput(input: string, platform: string): { platform: string; username: string } | null;
};
const lib = (globalThis as unknown as { KestrelLib: Lib }).KestrelLib;

describe('profile pages', () => {
  it('finds the player on Chess.com and Lichess profiles', () => {
    expect(lib.profileFromUrl('https://www.chess.com/member/Hikaru')).toEqual({ platform: 'chesscom', username: 'hikaru' });
    expect(lib.profileFromUrl('https://www.chess.com/member/hikaru/games?x=1')).toEqual({
      platform: 'chesscom',
      username: 'hikaru'
    });
    expect(lib.profileFromUrl('https://lichess.org/@/DrNykterstein/all')).toEqual({
      platform: 'lichess',
      username: 'drnykterstein'
    });
  });

  it('ignores everything else', () => {
    expect(lib.profileFromUrl('https://www.chess.com/game/live/123')).toBeNull();
    expect(lib.profileFromUrl('https://lichess.org/AbCd1234')).toBeNull();
    expect(lib.profileFromUrl('https://example.com/member/hikaru')).toBeNull();
    expect(lib.profileFromUrl('not a url')).toBeNull();
  });
});

describe('fair-play lock: game pages', () => {
  it.each([
    'https://www.chess.com/game/live/123456789',
    'https://www.chess.com/game/daily/987654',
    'https://www.chess.com/game/123456',
    'https://www.chess.com/play/online',
    'https://www.chess.com/play/online/new',
    'https://www.chess.com/play',
    'https://www.chess.com/live#g=123456',
    'https://www.chess.com/variants/fog-of-war/game/1',
    'https://lichess.org/AbCd1234',
    'https://lichess.org/AbCd1234efgh',
    'https://lichess.org/AbCd1234/black',
    'https://lichess.org/tv',
    'https://lichess.org/tournament/abcd1234',
    'https://lichess.org/swiss/xyz',
    'https://lichess.org/setup/hook',
    'https://lichess.org/#hook',
    'https://lichess.org/#friend'
  ])('%s is a game page', (url) => {
    expect(lib.isGameUrl(url)).toBe(true);
  });

  it.each([
    'https://www.chess.com/member/hikaru',
    'https://www.chess.com/home',
    'https://www.chess.com/news',
    'https://lichess.org/@/drnykterstein',
    'https://lichess.org/',
    'https://lichess.org/analysis',
    'https://lichess.org/training',
    'https://lichess.org/tournament',
    'https://example.com/game/live/1'
  ])('%s is not a game page', (url) => {
    expect(lib.isGameUrl(url)).toBe(false);
  });

  it('locks while any tab is on a game page', () => {
    expect(lib.isLocked(['https://www.chess.com/member/hikaru', undefined])).toBe(false);
    expect(lib.isLocked(['https://www.chess.com/member/hikaru', 'https://lichess.org/AbCd1234'])).toBe(true);
  });
});

describe('report links', () => {
  it('uses the saved Kestrel address, falling back to localhost', () => {
    expect(lib.reportUrl(undefined, 'chesscom', 'hikaru')).toBe('http://localhost:3000/chesscom/hikaru');
    expect(lib.reportUrl('https://kestrel.chess/some/path', 'lichess', 'drnykterstein')).toBe(
      'https://kestrel.chess/lichess/drnykterstein'
    );
    expect(lib.kestrelBase('javascript:alert(1)')).toBe('http://localhost:3000');
  });

  it('reads names, @names and pasted profile links', () => {
    expect(lib.readSearchInput(' Hikaru ', 'chesscom')).toEqual({ platform: 'chesscom', username: 'hikaru' });
    expect(lib.readSearchInput('@DrNykterstein', 'lichess')).toEqual({ platform: 'lichess', username: 'drnykterstein' });
    expect(lib.readSearchInput('https://lichess.org/@/DrNykterstein', 'chesscom')).toEqual({
      platform: 'lichess',
      username: 'drnykterstein'
    });
    expect(lib.readSearchInput('bad name!', 'chesscom')).toBeNull();
  });
});
