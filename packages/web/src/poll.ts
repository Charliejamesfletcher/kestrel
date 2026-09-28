import type { ReportResponse } from '@kestrel/shared';

// queued/fetching: every 2s. Ready but refreshing: every 5s for ~3 min.
// Anything else is final.

export const POLL_WAITING_MS = 2_000;
export const POLL_REFRESHING_MS = 5_000;
export const REFRESH_GIVE_UP_MS = 3 * 60_000;
export const WAITING_GIVE_UP_MS = 15 * 60_000;

/** ms until the next poll, or null to stop */
export function nextPollDelay(response: ReportResponse, elapsedMs: number): number | null {
  switch (response.status) {
    case 'queued':
    case 'fetching':
      return elapsedMs < WAITING_GIVE_UP_MS ? POLL_WAITING_MS : null;
    case 'ready':
      return response.refreshing && elapsedMs < REFRESH_GIVE_UP_MS ? POLL_REFRESHING_MS : null;
    default:
      return null;
  }
}

export function retryAfterMs(header: string | null, fallbackMs = 10_000): number {
  if (!header) return fallbackMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.max(seconds * 1000, 1000), 120_000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 1000), 120_000);
  return fallbackMs;
}
