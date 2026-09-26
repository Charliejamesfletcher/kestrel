import { createPool } from '@kestrel/db';
import { loadConfig } from '@kestrel/shared';
import { buildApp } from './app.js';

const config = loadConfig();
const db = createPool(config.DATABASE_URL);
const app = buildApp({ db, version: config.APP_VERSION, logger: true });

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  await db.end();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: config.PORT, host: '0.0.0.0' });
