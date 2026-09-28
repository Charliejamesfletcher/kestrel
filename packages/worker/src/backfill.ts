// npm run backfill
// Fills missing material_at_30 and rebuilds all reports. DB only, so it's safe
// to run alongside the worker.
import { createPool } from '@kestrel/db';
import { loadDotEnv } from '@kestrel/shared';
import { backfillMaterial, rebuildAllReports } from './maintenance.js';

loadDotEnv();
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const db = createPool(process.env.DATABASE_URL);
try {
  const started = Date.now();
  const filled = await backfillMaterial(db);
  console.log(`Material at move 30 filled for ${filled} games.`);
  const players = await rebuildAllReports(db, new Date(), (m) => console.log(`  ${m}`));
  console.log(`Rebuilt reports for ${players} players in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await db.end();
}
