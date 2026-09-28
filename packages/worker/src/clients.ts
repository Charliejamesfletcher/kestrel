import type { ChessComGame, LichessGame } from '@kestrel/shared';

// One request per call, no retries. Pacing and retries live in the queue.

export class RateLimitedError extends Error {
  constructor(
    readonly site: string,
    readonly retryAfterMs: number
  ) {
    super(`${site} rate limit (429), retry in ${Math.round(retryAfterMs / 1000)}s`);
  }
}

export class NotFoundError extends Error {}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string
  ) {
    super(`HTTP ${status} from ${url}`);
  }
}

export interface HttpDeps {
  userAgent: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

// Lichess asks for a full minute after a 429
const MIN_RATE_LIMIT_WAIT_MS = 60_000;

export function retryAfterMs(header: string | null, now = Date.now()): number {
  let ms = NaN;
  if (header && /^\d+$/.test(header.trim())) ms = Number(header) * 1000;
  else if (header) ms = Date.parse(header) - now;
  return Number.isFinite(ms) ? Math.max(ms, MIN_RATE_LIMIT_WAIT_MS) : MIN_RATE_LIMIT_WAIT_MS;
}

async function get(site: string, deps: HttpDeps, url: string, headers: Record<string, string> = {}) {
  const res = await (deps.fetch ?? fetch)(url, {
    headers: { 'User-Agent': deps.userAgent, ...headers },
    signal: AbortSignal.timeout(deps.timeoutMs ?? 120_000)
  });
  if (res.status === 429) throw new RateLimitedError(site, retryAfterMs(res.headers.get('retry-after')));
  if (res.status === 404) throw new NotFoundError(`${site}: ${url} not found`);
  if (res.status !== 304 && !res.ok) throw new HttpError(res.status, url);
  return res;
}

export type MonthResult =
  | { notModified: true }
  | { notModified: false; games: ChessComGame[]; etag: string | null };

export interface ChessComClient {
  getArchives(username: string): Promise<string[]>;
  getMonth(username: string, month: string, etag?: string | null): Promise<MonthResult>;
}

const CHESSCOM = 'https://api.chess.com/pub/player';

export function createChessComClient(deps: HttpDeps): ChessComClient {
  return {
    async getArchives(username) {
      const res = await get('Chess.com', deps, `${CHESSCOM}/${encodeURIComponent(username)}/games/archives`);
      const body = (await res.json()) as { archives?: string[] };
      return (body.archives ?? [])
        .map((url) => url.match(/(\d{4})\/(\d{2})$/)?.slice(1, 3).join('/'))
        .filter((m): m is string => !!m)
        .sort();
    },

    async getMonth(username, month, etag) {
      const url = `${CHESSCOM}/${encodeURIComponent(username)}/games/${month}`;
      const res = await get('Chess.com', deps, url, etag ? { 'If-None-Match': etag } : {});
      if (res.status === 304) return { notModified: true };
      const body = (await res.json()) as { games?: ChessComGame[] };
      return { notModified: false, games: body.games ?? [], etag: res.headers.get('etag') };
    }
  };
}

export interface LichessClient {
  getGames(username: string, opts: { max: number; since?: Date }): Promise<LichessGame[]>;
}

export function createLichessClient(deps: HttpDeps): LichessClient {
  return {
    async getGames(username, { max, since }) {
      const params = new URLSearchParams({
        max: String(max),
        moves: 'true',
        clocks: 'true',
        opening: 'true',
        accuracy: 'true',
        lastFen: 'true',
        finished: 'true'
      });
      if (since) params.set('since', String(since.getTime()));
      const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`;
      const res = await get('Lichess', deps, url, { Accept: 'application/x-ndjson' });
      const text = await res.text();
      return text
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as LichessGame);
    }
  };
}
