import type { Platform, ReportResponse, ReportScope, ScoutRequest } from '@kestrel/shared';
import { retryAfterMs } from './poll.js';

// Player states come back as 200 + status. HTTP errors are mapped to a
// separate `kind` so the page can explain them.

export type ApiResult =
  | { kind: 'ok'; data: ReportResponse }
  | { kind: 'invalid' }
  | { kind: 'slow_down'; retryInMs: number }
  | { kind: 'network' }
  | { kind: 'server' };

async function call(input: string, init: RequestInit): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, headers: { Accept: 'application/json', ...init.headers } });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { kind: 'network' };
  }
  if (res.status === 400) return { kind: 'invalid' };
  if (res.status === 429) return { kind: 'slow_down', retryInMs: retryAfterMs(res.headers.get('Retry-After')) };
  if (!res.ok) return { kind: 'server' };
  try {
    const data = (await res.json()) as ReportResponse;
    return data && typeof data.status === 'string' ? { kind: 'ok', data } : { kind: 'server' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { kind: 'server' };
  }
}

export function scout(req: ScoutRequest, signal?: AbortSignal): Promise<ApiResult> {
  return call('/api/scout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal
  });
}

export function getReport(
  platform: Platform,
  username: string,
  scope: ReportScope | null,
  signal?: AbortSignal
): Promise<ApiResult> {
  const path = `/api/report/${platform}/${encodeURIComponent(username)}`;
  return call(scope ? `${path}?scope=${scope}` : path, { method: 'GET', signal });
}
