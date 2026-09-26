import Fastify, { type FastifyInstance } from 'fastify';
import { isDatabaseUp, type Db } from '@kestrel/db';

export interface AppDeps {
  db: Pick<Db, 'query'>;
  version: string;
  logger?: boolean;
}

/**
 * Builds the API without starting it, so tests can call routes directly.
 * Routes for reports, watchlists and removal requests arrive in Phase 4.
 */
export function buildApp({ db, version, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  app.get('/health', async (_req, reply) => {
    const database = await isDatabaseUp(db);
    reply.code(database ? 200 : 503);
    return { status: database ? 'ok' : 'degraded', database, version };
  });

  return app;
}
