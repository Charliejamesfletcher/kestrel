import { afterAll, describe, expect, it } from 'vitest';
import { createPool, isDatabaseUp, migrate } from './index.js';

const url = process.env.DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('migrations', () => {
  const pool = createPool(url ?? '');
  afterAll(() => pool.end());

  it('connects', async () => {
    expect(await isDatabaseUp(pool)).toBe(true);
  });

  it('applies cleanly and is safe to re-run', async () => {
    await migrate(pool);
    const second = await migrate(pool);
    expect(second).toEqual([]);
    const { rows } = await pool.query<{ n: string }>(
      "SELECT count(*) AS n FROM information_schema.tables WHERE table_name IN ('users','players','games','reports','fetch_queue')"
    );
    expect(Number(rows[0]?.n)).toBe(5);
  });
});
