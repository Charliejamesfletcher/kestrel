import type { Db } from './index.js';

const FETCH_LOCK = 727002;

/**
 * Postgres advisory lock so only one process ever talks to Chess.com/Lichess,
 * even if a second worker gets started by accident. The lock is tied to the
 * connection, so if it drops we call onLost and let the worker restart.
 */
export async function acquireFetchLock(
  pool: Db,
  { wait, onLost = (err) => console.error(`[db] fetch lock connection lost: ${err.message}`) }: {
    wait: boolean;
    onLost?: (err: Error) => void;
  }
): Promise<(() => Promise<void>) | null> {
  const client = await pool.connect();
  client.on('error', onLost);
  try {
    if (wait) {
      await client.query('SELECT pg_advisory_lock($1)', [FETCH_LOCK]);
    } else {
      const { rows } = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [FETCH_LOCK]);
      if (!rows[0]?.ok) {
        client.off('error', onLost);
        client.release();
        return null;
      }
    }
  } catch (err) {
    client.off('error', onLost);
    client.release();
    throw err;
  }
  return async () => {
    await client.query('SELECT pg_advisory_unlock($1)', [FETCH_LOCK]).catch(() => {});
    client.off('error', onLost);
    client.release();
  };
}
