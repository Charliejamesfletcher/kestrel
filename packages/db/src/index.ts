import pg from 'pg';

export type Db = pg.Pool;

export type Queryable = Pick<Db, 'query'>;

// Without an 'error' listener, a Postgres restart would crash the process
// when idle connections get cut.
export function createPool(
  databaseUrl: string,
  onError: (err: Error) => void = (err) => console.error(`[db] idle connection lost: ${err.message}`)
): Db {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  pool.on('error', onError);
  return pool;
}

export async function isDatabaseUp(db: Queryable): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { migrate } from './migrate.js';
export * from './queue.js';
export * from './storage.js';
export * from './reports.js';
export * from './fetchLock.js';
