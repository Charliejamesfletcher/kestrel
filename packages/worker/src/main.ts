import { createPool, isDatabaseUp } from '@kestrel/db';
import { buildUserAgent, loadConfig } from '@kestrel/shared';
import { runLoop } from './loop.js';

const config = loadConfig();
const db = createPool(config.DATABASE_URL);
const userAgent = buildUserAgent(config.APP_NAME, config.APP_VERSION, config.CONTACT_EMAIL);
const controller = new AbortController();

const stop = (signal: string) => {
  console.log(`[worker] ${signal} received, finishing current job then stopping`);
  controller.abort();
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

console.log(`[worker] started as "${userAgent}"`);

// Phase 2 replaces this tick with: claim the next fetch_queue job -> fetch -> store.
await runLoop(
  async () => {
    const up = await isDatabaseUp(db);
    if (!up) console.warn('[worker] database unreachable, retrying');
    return false; // nothing to do yet
  },
  {
    idleMs: 5_000,
    signal: controller.signal,
    onError: (err) => console.error('[worker] tick failed', err)
  }
);

await db.end();
console.log('[worker] stopped');
