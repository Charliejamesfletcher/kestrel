// npm run fixture -- chesscom hikaru 2026/09 --match "Titled Tuesday" --limit 50
// npm run fixture -- lichess DrNykterstein --limit 30
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { acquireFetchLock, createPool, isRemoved } from '@kestrel/db';
import { assertRealContactEmail, buildUserAgent, loadConfig, loadDotEnv, normaliseUsername } from '@kestrel/shared';
import { createChessComClient, createLichessClient } from './clients.js';

loadDotEnv();
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const match = flag('match')?.toLowerCase();
const limit = Number(flag('limit') ?? 50);
const [platform, rawName, month] = args;
const username = normaliseUsername(rawName ?? '');

if (!username || !(platform === 'lichess' || (platform === 'chesscom' && /^\d{4}\/\d{2}$/.test(month ?? '')))) {
  console.error('Usage: npm run fixture -- chesscom <username> <YYYY/MM> [--match "Titled Tuesday"] [--limit 50]');
  console.error('       npm run fixture -- lichess <username> [--limit 30]');
  process.exit(1);
}

const config = loadConfig();
assertRealContactEmail(config.CONTACT_EMAIL);
const http = { userAgent: buildUserAgent(config.APP_NAME, config.APP_VERSION, config.CONTACT_EMAIL) };
const db = createPool(config.DATABASE_URL);
const release = await acquireFetchLock(db, { wait: false });
const dir = join(import.meta.dirname, '..', '..', 'shared', 'fixtures');

try {
  if (!release) throw new Error('The worker is fetching right now. Stop it first: docker compose stop worker');
  if (await isRemoved(db, platform, username)) throw new Error(`${username} asked to be removed; not fetching.`);

  if (platform === 'chesscom') {
    const res = await createChessComClient(http).getMonth(username, month!);
    if (res.notModified) throw new Error('Unexpected 304');
    const games = res.games
      // tournament slugs use hyphens
      .filter((g) => {
        const where = `${g.pgn ?? ''} ${(g as { tournament?: string }).tournament ?? ''}`;
        return !match || where.toLowerCase().replace(/-/g, ' ').includes(match.replace(/-/g, ' '));
      })
      .slice(0, limit);
    if (!games.length) throw new Error('No games matched; try without --match');
    const file = join(dir, `chesscom-${username}-${month!.replace('/', '-')}.json`);
    writeFileSync(file, JSON.stringify({ username, month, games }, null, 2) + '\n');
    console.log(`Saved ${games.length} games to ${file}`);
  } else {
    const games = await createLichessClient(http).getGames(username, { max: limit });
    const file = join(dir, `lichess-${username}.ndjson`);
    writeFileSync(file, games.map((g) => JSON.stringify(g)).join('\n') + '\n');
    console.log(`Saved ${games.length} games to ${file}`);
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await release?.();
  await db.end();
}
