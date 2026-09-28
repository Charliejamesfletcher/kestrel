// npm run remove -- chesscom someone
// Records a removal request and deletes everything stored for that player.
import { createPool, requestRemoval } from '@kestrel/db';
import { loadDotEnv, PLATFORMS, type Platform } from '@kestrel/shared';

loadDotEnv();
const [platform, username] = process.argv.slice(2);

if (!PLATFORMS.includes(platform as Platform) || !username) {
  console.error('Usage: npm run remove -- <chesscom|lichess> <username>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const db = createPool(process.env.DATABASE_URL);
try {
  const result = await requestRemoval(db, platform as Platform, username);
  if (result === 'invalid') {
    console.error(`"${username}" isn't a valid username.`);
    process.exitCode = 1;
  } else {
    console.log(
      `Removed ${platform}/${username.toLowerCase()}: they will never be fetched or shown.` +
        (result.deletedData ? ' Their stored games and reports were deleted.' : ' Nothing was stored about them.')
    );
  }
} finally {
  await db.end();
}
