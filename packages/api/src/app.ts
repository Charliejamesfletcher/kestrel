import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from 'fastify';
import fastifyStatic from '@fastify/static';
import {
  enqueue,
  forgetPlayer,
  getJob,
  getPlayer,
  getReport,
  isDatabaseUp,
  isRemoved,
  PRIORITY_WAITING,
  rebuildReports,
  scopeSummaries,
  type Db,
  type JobState,
  type PlayerInfo
} from '@kestrel/db';
import {
  normaliseUsername,
  PLATFORMS,
  REPORT_SCOPES,
  REPORT_VERSION,
  type Platform,
  type ReportResponse,
  type ReportScope,
  type ScopeSummary
} from '@kestrel/shared';

export const FRESH_MS = 6 * 3600_000;
export const NOT_FOUND_RETRY_MS = 10 * 60_000;
export const SCOUT_LIMIT = { max: 20, windowMs: 60_000 };

export interface AppDeps {
  db: Pick<Db, 'query'>;
  version: string;
  logger?: boolean;
  now?: () => Date;
  /** undefined = serve it if built, null = API only */
  webDist?: string | null;
  rateLimit?: { max: number; windowMs: number };
  /**
   * Read the client IP from CF-Connecting-IP / X-Forwarded-For. Off by default,
   * otherwise anyone could spoof their address past the rate limit.
   */
  trustProxy?: boolean;
}

export function defaultWebDist(): string {
  return join(import.meta.dirname, '..', '..', 'web', 'dist');
}

const hasSite = (dir: string) => existsSync(dir) && statSync(dir).isDirectory() && existsSync(join(dir, 'index.html'));

function readInput(platform: unknown, username: unknown, scope: unknown) {
  if (!PLATFORMS.includes(platform as Platform) || typeof username !== 'string') return null;
  const name = normaliseUsername(username);
  if (!name) return null;
  if (scope !== undefined && !REPORT_SCOPES.includes(scope as ReportScope)) return null;
  return { platform: platform as Platform, username: name, scope: scope as ReportScope | undefined };
}

// Summaries come sorted by games played, so [0] after 'all' is their main time class
export function chooseScope(requested: ReportScope | undefined, summaries: readonly ScopeSummary[]): ReportScope {
  if (requested && summaries.some((s) => s.scope === requested)) return requested;
  return summaries.find((s) => s.scope !== 'all')?.scope ?? 'all';
}

const isActive = (job: JobState | null) => job?.state === 'queued' || job?.state === 'fetching';

function jobResponse(job: JobState | null): ReportResponse {
  switch (job?.state) {
    case 'queued':
      return { status: 'queued', position: job.position };
    case 'fetching':
      return { status: 'fetching' };
    case 'not_found':
      return { status: 'not_found' };
    case 'failed':
      return { status: 'failed', retryable: true };
    default:
      return { status: 'unknown' };
  }
}

// In-memory fixed window. Fine while there's a single API process.
function createRateLimiter({ max, windowMs }: { max: number; windowMs: number }, now: () => Date) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const t = now().getTime();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= max;
  };
}

export function buildApp({
  db,
  version,
  logger = false,
  now = () => new Date(),
  webDist,
  rateLimit = SCOUT_LIMIT,
  trustProxy = false
}: AppDeps): FastifyInstance {
  const app = Fastify({ logger, trustProxy });
  const clientIp = (req: { ip: string; headers: Record<string, string | string[] | undefined> }) => {
    const cf = req.headers['cf-connecting-ip'];
    return trustProxy && typeof cf === 'string' && cf ? cf : req.ip;
  };
  const removed = async (platform: Platform, username: string) => {
    if (!(await isRemoved(db, platform, username))) return false;
    await forgetPlayer(db, platform, username);
    return true;
  };
  const allowScout = createRateLimiter(rateLimit, now);

  const health = async (_req: unknown, reply: FastifyReply) => {
    const database = await isDatabaseUp(db);
    reply.code(database ? 200 : 503);
    return { status: database ? 'ok' : 'degraded', database, version };
  };
  app.get('/health', health);
  app.get('/api/health', health);

  // Rebuilds stale reports from stored games, so an engine upgrade never needs a refetch
  async function readyResponse(
    player: PlayerInfo,
    scopes: ScopeSummary[],
    platform: Platform,
    username: string,
    requested: ReportScope | undefined,
    refreshing: boolean
  ): Promise<ReportResponse | null> {
    if (scopes.length === 0 && !player.lastFetchedAt) return null;
    let scope = chooseScope(requested, scopes);
    let report = scopes.length ? await getReport(db, player.id, scope) : null;
    if (!report || report.version < REPORT_VERSION) {
      scopes = await rebuildReports(db, player.id, platform, username, now());
      scope = chooseScope(requested, scopes);
      report = await getReport(db, player.id, scope);
      if (!report) return null;
    }
    return {
      status: 'ready',
      report,
      scopes,
      refreshing,
      lastFetchedAt: player.lastFetchedAt?.toISOString() ?? null
    };
  }

  async function lookUp(platform: Platform, username: string) {
    const player = await getPlayer(db, platform, username);
    const scopes = player ? await scopeSummaries(db, player.id) : [];
    return { player, scopes, hasData: !!player && (scopes.length > 0 || !!player.lastFetchedAt) };
  }

  app.post('/api/scout', async (req, reply): Promise<ReportResponse | { error: string }> => {
    if (!allowScout(clientIp(req))) {
      reply.code(429).header('retry-after', Math.ceil(rateLimit.windowMs / 1000));
      return { error: 'slow down' };
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const input = readInput(body.platform, body.username, body.scope);
    if (!input) {
      reply.code(400);
      return { status: 'invalid' };
    }
    const { platform, username, scope } = input;
    if (await removed(platform, username)) return { status: 'removed' };

    const { player, scopes, hasData } = await lookUp(platform, username);
    let job = await getJob(db, platform, username);
    const recentlyNotFound =
      job?.state === 'not_found' && now().getTime() - job.failedAt.getTime() < NOT_FOUND_RETRY_MS;

    if (player && hasData) {
      const fresh = !!player.lastFetchedAt && now().getTime() - player.lastFetchedAt.getTime() < FRESH_MS;
      if (!fresh && !recentlyNotFound) {
        // serve what we have, refresh in the background
        await enqueue(db, platform, username, PRIORITY_WAITING);
        job = await getJob(db, platform, username);
      }
      const ready = await readyResponse(player, scopes, platform, username, scope, isActive(job));
      if (ready) return ready;
    }

    if (recentlyNotFound) return { status: 'not_found' };
    await enqueue(db, platform, username, PRIORITY_WAITING);
    const after = await getJob(db, platform, username);
    // worker finished between our checks; next poll picks it up
    return after ? jobResponse(after) : { status: 'queued', position: 1 };
  });

  app.get<{ Params: { platform: string; username: string }; Querystring: { scope?: string } }>(
    '/api/report/:platform/:username',
    async (req, reply): Promise<ReportResponse> => {
      const input = readInput(req.params.platform, req.params.username, req.query.scope || undefined);
      if (!input) {
        reply.code(400);
        return { status: 'invalid' };
      }
      const { platform, username, scope } = input;
      if (await removed(platform, username)) return { status: 'removed' };

      const job = await getJob(db, platform, username);
      const { player, scopes, hasData } = await lookUp(platform, username);
      if (player && hasData) {
        const ready = await readyResponse(player, scopes, platform, username, scope, isActive(job));
        if (ready) return ready;
      }
      return jobResponse(job);
    }
  );

  const wanted = webDist === undefined ? defaultWebDist() : webDist;
  const site = wanted && hasSite(wanted) ? wanted : null;
  if (site) {
    app.register(fastifyStatic, { root: site, wildcard: true });
  }

  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0]!;
    const isApi = path === '/api' || path.startsWith('/api/') || path === '/health';
    if (site && req.method === 'GET' && !isApi) {
      // SPA fallback
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ status: 'invalid' });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal error' });
  });

  return app;
}
