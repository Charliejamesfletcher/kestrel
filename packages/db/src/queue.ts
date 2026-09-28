import { normaliseUsername, type Platform } from '@kestrel/shared';
import type { Queryable } from './index.js';
import { isRemoved } from './storage.js';

export const PRIORITY_WAITING = 10;
export const PRIORITY_BACKGROUND = 0;

export const MAX_ATTEMPTS = 5;

const STALE_LOCK = '10 minutes';

export const NOT_FOUND_ERROR = 'not_found';

export interface Job {
  id: string;
  platform: Platform;
  username: string;
  priority: number;
  attempts: number;
}

export type EnqueueResult = 'queued' | 'removed' | 'invalid';


export async function enqueue(
  db: Queryable,
  platform: Platform,
  rawUsername: string,
  priority: number = PRIORITY_BACKGROUND
): Promise<EnqueueResult> {
  const username = normaliseUsername(rawUsername);
  if (!username) return 'invalid';
  if (await isRemoved(db, platform, username)) return 'removed';

  await db.query(
    `INSERT INTO fetch_queue (platform, username, priority)
     VALUES ($1, $2, $3)
     ON CONFLICT (platform, username) DO UPDATE SET
       priority   = GREATEST(fetch_queue.priority, EXCLUDED.priority),
       attempts   = CASE WHEN fetch_queue.failed_at IS NULL THEN fetch_queue.attempts ELSE 0 END,
       not_before = CASE WHEN fetch_queue.failed_at IS NULL THEN fetch_queue.not_before ELSE now() END,
       failed_at  = NULL`,
    [platform, username, priority]
  );
  return 'queued';
}

export const INTERRUPTED_ERROR = 'the worker stopped part-way through every try';

export async function claimNext(db: Queryable): Promise<Job | null> {
  await db.query(
    `UPDATE fetch_queue SET failed_at = now(), locked_at = NULL, last_error = $1
     WHERE failed_at IS NULL
       AND attempts >= $2
       AND (locked_at IS NULL OR locked_at < now() - interval '${STALE_LOCK}')`,
    [INTERRUPTED_ERROR, MAX_ATTEMPTS]
  );
  const { rows } = await db.query<Job>(
    `UPDATE fetch_queue SET locked_at = now(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM fetch_queue
       WHERE failed_at IS NULL
         AND not_before <= now()
         AND (locked_at IS NULL OR locked_at < now() - interval '${STALE_LOCK}')
         AND NOT EXISTS (SELECT 1 FROM fetch_pause WHERE paused_until > now())
       ORDER BY priority DESC, not_before, id
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, platform, username, priority, attempts`
  );
  return rows[0] ?? null;
}


export async function releaseAllLocks(db: Queryable): Promise<number> {
  const { rowCount } = await db.query('UPDATE fetch_queue SET locked_at = NULL WHERE locked_at IS NOT NULL');
  return rowCount ?? 0;
}


export async function pauseFetching(db: Queryable, until: Date, site: string): Promise<void> {
  await db.query(
    `INSERT INTO fetch_pause (id, paused_until, site) VALUES (true, $1, $2)
     ON CONFLICT (id) DO UPDATE SET
       site         = CASE WHEN EXCLUDED.paused_until > fetch_pause.paused_until THEN EXCLUDED.site ELSE fetch_pause.site END,
       paused_until = GREATEST(fetch_pause.paused_until, EXCLUDED.paused_until)`,
    [until, site]
  );
}

export async function fetchPausedUntil(db: Queryable): Promise<{ until: Date; site: string } | null> {
  const { rows } = await db.query<{ paused_until: Date; site: string }>(
    'SELECT paused_until, site FROM fetch_pause WHERE paused_until > now()'
  );
  const row = rows[0];
  return row ? { until: row.paused_until, site: row.site } : null;
}

export async function complete(db: Queryable, jobId: string): Promise<void> {
  await db.query('DELETE FROM fetch_queue WHERE id = $1', [jobId]);
}

export function retryDelayMs(attempts: number): number {
  return 30_000 * 4 ** Math.max(0, attempts - 1);
}


export async function retryLater(db: Queryable, job: Job, error: string): Promise<'retrying' | 'gave_up'> {
  const gaveUp = job.attempts >= MAX_ATTEMPTS;
  await db.query(
    `UPDATE fetch_queue SET
       locked_at  = NULL,
       last_error = $2,
       failed_at  = CASE WHEN $3::boolean THEN now() END,
       not_before = now() + $4 * interval '1 millisecond'
     WHERE id = $1`,
    [job.id, error.slice(0, 500), gaveUp, retryDelayMs(job.attempts)]
  );
  return gaveUp ? 'gave_up' : 'retrying';
}

export async function postpone(db: Queryable, jobId: string, until: Date): Promise<void> {
  await db.query(
    `UPDATE fetch_queue SET locked_at = NULL, not_before = $2, attempts = GREATEST(attempts - 1, 0)
     WHERE id = $1`,
    [jobId, until]
  );
}


export async function markNotFound(db: Queryable, jobId: string): Promise<void> {
  await db.query(
    'UPDATE fetch_queue SET failed_at = now(), last_error = $2, locked_at = NULL WHERE id = $1',
    [jobId, NOT_FOUND_ERROR]
  );
}

export type JobState =
  | { state: 'queued'; position: number }
  | { state: 'fetching' }
  | { state: 'not_found'; failedAt: Date }
  | { state: 'failed'; failedAt: Date; error: string | null };


export async function getJob(db: Queryable, platform: Platform, username: string): Promise<JobState | null> {
  const { rows } = await db.query<{
    failed_at: Date | null;
    last_error: string | null;
    fetching: boolean;
    ahead: number;
  }>(
    `SELECT q.failed_at, q.last_error,
       (q.locked_at IS NOT NULL AND q.locked_at >= now() - interval '${STALE_LOCK}') AS fetching,
       (SELECT count(*)::int FROM fetch_queue o
         WHERE o.failed_at IS NULL
           AND o.not_before <= now()
           AND (o.locked_at IS NULL OR o.locked_at < now() - interval '${STALE_LOCK}')
           AND (o.priority > q.priority
                OR (o.priority = q.priority AND (o.not_before, o.id) < (q.not_before, q.id)))
       ) AS ahead
     FROM fetch_queue q
     WHERE q.platform = $1 AND q.username = $2`,
    [platform, username]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.failed_at) {
    return row.last_error === NOT_FOUND_ERROR
      ? { state: 'not_found', failedAt: row.failed_at }
      : { state: 'failed', failedAt: row.failed_at, error: row.last_error };
  }
  if (row.fetching) return { state: 'fetching' };
  return { state: 'queued', position: row.ahead + 1 };
}
