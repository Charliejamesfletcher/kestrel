export type Platform = 'chesscom' | 'lichess';

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export const PLATFORMS: readonly Platform[] = ['chesscom', 'lichess'] as const;

export const TIME_CLASSES: readonly TimeClass[] = ['bullet', 'blitz', 'rapid', 'daily'] as const;

/** Usernames on both sites: letters, digits, underscores and hyphens, 2-30 chars. */
export function normaliseUsername(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{2,30}$/.test(name) ? name : null;
}
