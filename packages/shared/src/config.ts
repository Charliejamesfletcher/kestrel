import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  CONTACT_EMAIL: z.string().email(),
  APP_NAME: z.string().min(1).default('kestrel'),
  APP_VERSION: z.string().min(1).default('0.1.0')
});

export type Config = z.infer<typeof ConfigSchema>;

/** Validates env vars at start-up so a bad .env fails fast. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid configuration. Check your .env file:\n${problems}`);
  }
  return parsed.data;
}

// Walks up from `from` to find a .env for scripts run outside Docker.
// Existing env vars take precedence.
export function loadDotEnv(from: string = process.cwd()): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const file = join(dir, '.env');
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return file;
    }
    if (dirname(dir) === dir) return null;
  }
}
