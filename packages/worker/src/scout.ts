// npm run scout -- chesscom hikaru
// npm run scout -- lichess DrNykterstein --background
import { createPool, enqueue, PRIORITY_BACKGROUND, PRIORITY_WAITING } from '@kestrel/db';
import { loadDotEnv, PLATFORMS, type Platform } from '@kestrel/shared';

loadDotEnv();
const [platform, username] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const background = process.argv.includes('--background');

if (!PLATFORMS.includes(platform as Platform) || !username) {
  console.error('Usage: npm run scout -- <chesscom|lichess> <username> [--background]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const db = createPool(process.env.DATABASE_URL);
try {
  const result = await enqueue(db, platform as Platform, username, background ? PRIORITY_BACKGROUND : PRIORITY_WAITING);
  const messages = {
    queued: `Queued ${platform}/${username}. Watch it with: docker compose logs -f worker`,
    removed: `${username} asked to be removed from Kestrel; not queued.`,
    invalid: `"${username}" isn't a valid username.`
  };
  console.log(messages[result]);
  if (result !== 'queued') process.exitCode = 1;
} finally {
  await db.end();
}
