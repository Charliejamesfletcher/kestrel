import type { Report, ReportScope } from './report/types.js';
import type { Platform } from './types.js';

/**
 * POST /api/scout                             -> ReportResponse (queues a fetch if stale)
 * GET  /api/report/:platform/:username?scope= -> ReportResponse (read only)
 */
export interface ScoutRequest {
  platform: Platform;
  username: string;
  /** Defaults to the time class they play most */
  scope?: ReportScope;
}

/** Games stored per scope, so the web app can offer tabs that have data */
export interface ScopeSummary {
  scope: ReportScope;
  games: number;
}

export type ReportResponse =
  | {
      status: 'ready';
      report: Report;
      scopes: ScopeSummary[];
      /** A newer fetch is queued or running */
      refreshing: boolean;
          lastFetchedAt: string | null;
    }
  /** Waiting in the fetch queue; 1 = next up */
  | { status: 'queued'; position: number }
  | { status: 'fetching' }
  | { status: 'not_found' }
  /** Player asked to be removed */
  | { status: 'removed' }
  | { status: 'failed'; retryable: boolean }
  /** Never requested (GET only) */
  | { status: 'unknown' }
  | { status: 'invalid' };

export function profileUrl(platform: Platform, username: string): string {
  return platform === 'chesscom'
    ? `https://www.chess.com/member/${encodeURIComponent(username)}`
    : `https://lichess.org/@/${encodeURIComponent(username)}`;
}
