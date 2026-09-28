import { acquireFetchLock, createPool, releaseAllLocks } from '@kestrel/db';
import { assertRealContactEmail, buildUserAgent, loadConfig, loadDotEnv } from '@kestrel/shared';
import { createChessComClient, createLichessClient } from './clients.js';
import { createTick } from './jobs.js';
import { runLoop } from './loop.js';

loadDotEnv();
const config = loadConfig();
assertRealContactEmail(config.CONTACT_EMAIL);
const db = createPool(config.DATABASE_URL);
const userAgent = buildUserAgent(config.APP_NAME, config.APP_VERSION, config.CONTACT_EMAIL);
const controller = new AbortController();
const log = (message: string) => console.log(`[worker] ${message}`);

const stop = (signal: string) => {
  log(`${signal} received, finishing current job then stopping`);
  controller.abort();
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

let release = await acquireFetchLock(db, { wait: false });
if (!release) {
  log('another process is fetching; waiting for it to stop');
  release = await acquireFetchLock(db, { wait: true });
}

// Anything still locked was left by a worker that died mid-job
const unlocked = await releaseAllLocks(db);
if (unlocked > 0) log(`picked up ${unlocked} job${unlocked === 1 ? '' : 's'} left by a stopped worker`);

log(`started as "${userAgent}"`);

const http = { userAgent };
await runLoop(
  createTick({ db, chesscom: createChessComClient(http), lichess: createLichessClient(http), log }),
  {
    idleMs: 2_000,
    signal: controller.signal,
    onError: (err) => console.error('[worker] tick failed', err)
  }
);

await release!();
await db.end();
log('stopped');
