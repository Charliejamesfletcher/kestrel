import { describe, expect, it } from 'vitest';
import {
  createChessComClient,
  createLichessClient,
  HttpError,
  NotFoundError,
  RateLimitedError,
  retryAfterMs
} from './clients.js';

const UA = 'kestrel/0.1.0 (contact: me@kestrel.test)';

function fakeFetch(...replies: Response[]) {
  const calls: { url: string; headers: Headers }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: new Headers(init?.headers) });
    const reply = replies.shift();
    if (!reply) throw new Error(`unexpected request to ${url}`);
    return reply;
  }) as typeof fetch;
  return { fn, calls };
}

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

describe('Chess.com client', () => {
  it('sends our User-Agent and lists archives oldest first', async () => {
    const fake = fakeFetch(
      json({
        archives: [
          'https://api.chess.com/pub/player/hikaru/games/2026/09',
          'https://api.chess.com/pub/player/hikaru/games/2025/12'
        ]
      })
    );
    const client = createChessComClient({ userAgent: UA, fetch: fake.fn });
    expect(await client.getArchives('hikaru')).toEqual(['2025/12', '2026/09']);
    expect(fake.calls[0]!.url).toBe('https://api.chess.com/pub/player/hikaru/games/archives');
    expect(fake.calls[0]!.headers.get('user-agent')).toBe(UA);
  });

  it('sends the ETag and understands 304 Not Modified', async () => {
    const fake = fakeFetch(json({ games: [{ url: 'x' }] }, { etag: '"v1"' }), new Response(null, { status: 304 }));
    const client = createChessComClient({ userAgent: UA, fetch: fake.fn });

    const first = await client.getMonth('hikaru', '2026/09');
    expect(first).toEqual({ notModified: false, games: [{ url: 'x' }], etag: '"v1"' });
    expect(fake.calls[0]!.headers.has('if-none-match')).toBe(false);

    expect(await client.getMonth('hikaru', '2026/09', '"v1"')).toEqual({ notModified: true });
    expect(fake.calls[1]!.headers.get('if-none-match')).toBe('"v1"');
    expect(fake.calls[1]!.headers.get('user-agent')).toBe(UA);
  });

  it('turns 429, 404 and 5xx into distinct errors', async () => {
    const fake = fakeFetch(
      new Response(null, { status: 429, headers: { 'retry-after': '90' } }),
      new Response(null, { status: 404 }),
      new Response(null, { status: 503 })
    );
    const client = createChessComClient({ userAgent: UA, fetch: fake.fn });
    const limited = await client.getArchives('a').catch((e) => e);
    expect(limited).toBeInstanceOf(RateLimitedError);
    expect(limited.retryAfterMs).toBe(90_000);
    await expect(client.getArchives('b')).rejects.toBeInstanceOf(NotFoundError);
    await expect(client.getArchives('c')).rejects.toBeInstanceOf(HttpError);
  });
});

describe('Lichess client', () => {
  it('asks for NDJSON with moves, clocks and openings, and reads each line', async () => {
    const fake = fakeFetch(new Response('{"id":"a"}\n{"id":"b"}\n\n', { status: 200 }));
    const client = createLichessClient({ userAgent: UA, fetch: fake.fn });
    const since = new Date('2026-09-01T00:00:00Z');

    const games = await client.getGames('DrNykterstein', { max: 300, since });
    expect(games.map((g) => g.id)).toEqual(['a', 'b']);

    const { url, headers } = fake.calls[0]!;
    const params = new URL(url).searchParams;
    expect(new URL(url).pathname).toBe('/api/games/user/DrNykterstein');
    expect(params.get('max')).toBe('300');
    expect(params.get('since')).toBe(String(since.getTime()));
    for (const p of ['moves', 'clocks', 'opening', 'lastFen']) expect(params.get(p)).toBe('true');
    expect(headers.get('accept')).toBe('application/x-ndjson');
    expect(headers.get('user-agent')).toBe(UA);
  });
});

describe('retryAfterMs', () => {
  it('reads seconds or a date, never less than a minute', () => {
    expect(retryAfterMs('120')).toBe(120_000);
    expect(retryAfterMs('5')).toBe(60_000);
    expect(retryAfterMs(null)).toBe(60_000);
    const now = Date.parse('2026-09-26T10:00:00Z');
    expect(retryAfterMs('Sat, 26 Sep 2026 10:05:00 GMT', now)).toBe(300_000);
  });
});
