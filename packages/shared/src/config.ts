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

/**
 * Reads and validates environment variables once at start-up.
 * Fails loudly with a readable message instead of crashing later.
 */
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
