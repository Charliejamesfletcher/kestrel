import { describe, expect, it } from 'vitest';
import type { Report, ReportResponse } from '@kestrel/shared';
import { parseRoute, reportPath } from './route.js';
import { nextPollDelay, POLL_REFRESHING_MS, POLL_WAITING_MS, REFRESH_GIVE_UP_MS, retryAfterMs } from './poll.js';

describe('parseRoute', () => {
  it('reads the home page', () => {
    expect(parseRoute('/', '')).toEqual({ page: 'home' });
  });

  it('reads a report page, with and without a scope', () => {
    expect(parseRoute('/chesscom/Hikaru', '')).toEqual({
      page: 'report',
      platform: 'chesscom',
      username: 'hikaru',
      scope: null
    });
    expect(parseRoute('/lichess/drnykterstein/', '?scope=blitz')).toEqual({
      page: 'report',
      platform: 'lichess',
      username: 'drnykterstein',
      scope: 'blitz'
    });
  });

  it('ignores an unknown scope instead of failing', () => {
    const route = parseRoute('/chesscom/hikaru', '?scope=hyperbullet');
    expect(route).toMatchObject({ page: 'report', scope: null });
  });

  it('rejects bad usernames and unknown pages', () => {
    expect(parseRoute('/chesscom/a', '')).toEqual({ page: 'invalid', reason: 'username' });
    expect(parseRoute('/chesscom/bad%20name', '')).toEqual({ page: 'invalid', reason: 'username' });
    expect(parseRoute('/fide/hikaru', '')).toEqual({ page: 'not_found' });
    expect(parseRoute('/chesscom', '')).toEqual({ page: 'not_found' });
    expect(parseRoute('/chesscom/hikaru/games', '')).toEqual({ page: 'not_found' });
  });

  it('builds report paths that parse back', () => {
    expect(reportPath('chesscom', 'hikaru')).toBe('/chesscom/hikaru');
    expect(reportPath('lichess', 'x_y', 'rapid')).toBe('/lichess/x_y?scope=rapid');
    const [path, search] = reportPath('lichess', 'x_y', 'rapid').split('?');
    expect(parseRoute(path!, `?${search}`)).toMatchObject({ username: 'x_y', scope: 'rapid' });
  });
});

describe('nextPollDelay', () => {
  const ready = (refreshing: boolean): ReportResponse => ({
    status: 'ready',
    report: {} as Report,
    scopes: [],
    refreshing,
    lastFetchedAt: null
  });

  it('polls every 2 s while waiting', () => {
    expect(nextPollDelay({ status: 'queued', position: 3 }, 0)).toBe(POLL_WAITING_MS);
    expect(nextPollDelay({ status: 'fetching' }, 60_000)).toBe(POLL_WAITING_MS);
  });

  it('polls every 5 s during a background refresh, then gives up', () => {
    expect(nextPollDelay(ready(true), 10_000)).toBe(POLL_REFRESHING_MS);
    expect(nextPollDelay(ready(true), REFRESH_GIVE_UP_MS + 1)).toBeNull();
    expect(nextPollDelay(ready(false), 0)).toBeNull();
  });

  it('stops on final answers', () => {
    for (const status of ['not_found', 'removed', 'invalid', 'unknown'] as const) {
      expect(nextPollDelay({ status }, 0)).toBeNull();
    }
    expect(nextPollDelay({ status: 'failed', retryable: true }, 0)).toBeNull();
  });
});

describe('retryAfterMs', () => {
  it('reads seconds from Retry-After, within sensible limits', () => {
    expect(retryAfterMs('5')).toBe(5000);
    expect(retryAfterMs('0')).toBe(1000);
    expect(retryAfterMs('9999')).toBe(120_000);
    expect(retryAfterMs(null)).toBe(10_000);
    expect(retryAfterMs('soon')).toBe(10_000);
  });
});
