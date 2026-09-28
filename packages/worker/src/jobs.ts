import {
  claimNext,
  complete,
  countGamesSince,
  forgetPlayer,
  getArchiveFetch,
  getPlayerId,
  isRemoved,
  knownGameIds,
  latestGameAt,
  markFetched,
  markNotFound,
  pauseFetching,
  postpone,
  rebuildReports,
  retryLater,
  saveArchiveFetch,
  saveGames,
  upsertPlayer,
  type Job,
  type Queryable
} from '@kestrel/db';
import { materialAt30, parseChessComGame, parseLichessGame, type GameRow } from '@kestrel/shared';
import { NotFoundError, RateLimitedError, type ChessComClient, type LichessClient } from './clients.js';

export const TARGET_GAMES = 300;
export const CHESSCOM_MAX_MONTHS = 12;

const ARCHIVE_SETTLE_MS = 24 * 3600_000;
const LICHESS_OVERLAP_MS = 24 * 3600_000;

export const LICHESS_DAILY_OVERLAP_MS = 60 * 24 * 3600_000;

class RemovedMidJob extends Error {}

async function stopIfRemoved(db: Queryable, platform: 'chesscom' | 'lichess', username: string): Promise<void> {
  if (await isRemoved(db, platform, username)) throw new RemovedMidJob();
}

export interface JobDeps {
  db: Queryable;
  chesscom: ChessComClient;
  lichess: LichessClient;
  log: (message: string) => void;
  now?: () => number;
}

export type JobOutcome =
  | { status: 'fetched'; playerId: string; newGames: number; requests: number }
  | { status: 'not_found' }
  | { status: 'removed' };

const monthStart = (month: string) => {
  const [y, m] = month.split('/').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
};
const monthEnd = (month: string) => {
  const [y, m] = month.split('/').map(Number);
  return new Date(Date.UTC(y!, m!, 1));
};


async function newRowsWithMaterial(db: Queryable, playerId: string, rows: GameRow[]): Promise<GameRow[]> {
  const known = await knownGameIds(db, playerId, rows.map((r) => r.gameId));
  return rows
    .filter((r) => !known.has(r.gameId))
    .map((r) => ({ ...r, materialAt30: r.moves >= 30 ? materialAt30(r.movetext, r.colour) : null }));
}

export async function processJob(deps: JobDeps, job: Job): Promise<JobOutcome> {
  const { db } = deps;
  if (await isRemoved(db, job.platform, job.username)) {
    await forgetPlayer(db, job.platform, job.username);
    return { status: 'removed' };
  }
  try {
    return job.platform === 'chesscom' ? await fetchChessCom(deps, job.username) : await fetchLichess(deps, job.username);
  } catch (err) {
    if (err instanceof NotFoundError) return { status: 'not_found' };
    if (err instanceof RemovedMidJob) {
      await forgetPlayer(db, job.platform, job.username);
      return { status: 'removed' };
    }
    throw err;
  }
}


async function fetchChessCom({ db, chesscom }: JobDeps, username: string): Promise<JobOutcome> {
  const months = await chesscom.getArchives(username);
  let requests = 1;
  const playerId = await upsertPlayer(db, 'chesscom', username);
  let newGames = 0;

  for (const month of months.slice(-CHESSCOM_MAX_MONTHS).reverse()) {
    const last = await getArchiveFetch(db, playerId, month);
    const settled = last && last.fetchedAt.getTime() >= monthEnd(month).getTime() + ARCHIVE_SETTLE_MS;
    if (!settled) {
      await stopIfRemoved(db, 'chesscom', username);
      const res = await chesscom.getMonth(username, month, last?.etag);
      requests++;
      if (res.notModified) {
        await saveArchiveFetch(db, playerId, month, last?.etag ?? null);
      } else {
        const rows = res.games.map((g) => parseChessComGame(g, username)).filter((r): r is GameRow => r !== null);
        await stopIfRemoved(db, 'chesscom', username);
        newGames += await saveGames(db, playerId, await newRowsWithMaterial(db, playerId, rows));
        // Only after the games are safely stored
        await saveArchiveFetch(db, playerId, month, res.etag);
      }
    }
    if ((await countGamesSince(db, playerId, monthStart(month))) >= TARGET_GAMES) break;
  }

  await markFetched(db, playerId);
  return { status: 'fetched', playerId, newGames, requests };
}

async function hasDailyGames(db: Queryable, playerId: string): Promise<boolean> {
  const { rowCount } = await db.query("SELECT 1 FROM games WHERE player_id = $1 AND time_class = 'daily' LIMIT 1", [
    playerId
  ]);
  return (rowCount ?? 0) > 0;
}

async function fetchLichess({ db, lichess }: JobDeps, username: string): Promise<JobOutcome> {
  const known = await getPlayerId(db, 'lichess', username);
  const latest = known ? await latestGameAt(db, known) : null;
  const overlap = known && (await hasDailyGames(db, known)) ? LICHESS_DAILY_OVERLAP_MS : LICHESS_OVERLAP_MS;
  const since = latest ? new Date(latest.getTime() - overlap) : undefined;

  const games = await lichess.getGames(username, { max: TARGET_GAMES, since });
  const rows = games.map((g) => parseLichessGame(g, username)).filter((r): r is GameRow => r !== null);
  await stopIfRemoved(db, 'lichess', username);
  const playerId = known ?? (await upsertPlayer(db, 'lichess', username));
  const newGames = await saveGames(db, playerId, await newRowsWithMaterial(db, playerId, rows));
  await markFetched(db, playerId);
  return { status: 'fetched', playerId, newGames, requests: 1 };
}


export function createTick(deps: JobDeps): () => Promise<boolean> {
  const { db, log, now = Date.now } = deps;
  let pausedUntil = 0;

  return async function tick() {
    if (now() < pausedUntil) return false;
    const job = await claimNext(db);
    if (!job) return false;
    const who = `${job.platform}/${job.username}`;

    try {
      const outcome = await processJob(deps, job);
      if (outcome.status === 'fetched' && (await isRemoved(db, job.platform, job.username))) {
        // Removal arrived after the last check: delete what was just stored
        await forgetPlayer(db, job.platform, job.username);
        await complete(db, job.id);
        log(`${who}: removal requested, data deleted`);
      } else if (outcome.status === 'fetched') {
        const scopes = await rebuildReports(db, outcome.playerId, job.platform, job.username, new Date(now()));
        await complete(db, job.id);
        const built = scopes.map((s) => `${s.scope} ${s.games}`).join(', ');
        log(`${who}: ${outcome.newGames} new games from ${outcome.requests} requests; reports: ${built}`);
      } else if (outcome.status === 'not_found') {
        await markNotFound(db, job.id);
        log(`${who}: no such player`);
      } else {
        await complete(db, job.id);
        log(`${who}: removal requested, data deleted`);
      }
    } catch (err) {
      if (err instanceof RateLimitedError) {
        pausedUntil = now() + err.retryAfterMs;
        await pauseFetching(db, new Date(pausedUntil), err.site);
        await postpone(db, job.id, new Date(pausedUntil));
        log(`${err.site} said too many requests: pausing all fetching for ${Math.round(err.retryAfterMs / 1000)}s`);
      } else {
        const message = err instanceof Error ? err.message : String(err);
        const result = await retryLater(db, job, message);
        log(`${who}: try ${job.attempts} failed (${message}), ${result === 'gave_up' ? 'giving up' : 'will retry'}`);
      }
    }
    return true;
  };
}
