import { createPool } from '@kestrel/db';
import { loadConfig, loadDotEnv } from '@kestrel/shared';
import { buildApp, defaultWebDist } from './app.js';

loadDotEnv();
const config = loadConfig();
const db = createPool(config.DATABASE_URL);
const app = buildApp({
  db,
  version: config.APP_VERSION,
  logger: true,
  now: () => new Date(),
  webDist: defaultWebDist(),
  trustProxy: process.env.TRUST_PROXY === 'true'
});

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PORT, host: '0.0.0.0' });
