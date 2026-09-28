import type { EndReason, Platform, ReportScope, Tally } from '@kestrel/shared';

// Type-only imports from @kestrel/shared: its runtime pulls in Node modules.

export const PLATFORMS: readonly Platform[] = ['chesscom', 'lichess'];
export const SCOPES: readonly ReportScope[] = ['all', 'bullet', 'blitz', 'rapid', 'daily'];

export function platformLabel(platform: Platform): string {
  return platform === 'chesscom' ? 'Chess.com' : 'Lichess';
}

export function scopeLabel(scope: ReportScope): string {
  return scope === 'all' ? 'All' : scope.charAt(0).toUpperCase() + scope.slice(1);
}

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export function isScope(value: string): value is ReportScope {
  return (SCOPES as readonly string[]).includes(value);
}

// Copy of normaliseUsername from shared (can't import runtime code here)
export function normaliseUsername(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  return /^[a-z0-9_-]{2,30}$/.test(name) ? name : null;
}

// Accepts a name, @name, or a profile URL. Any other URL gives null rather
// than guessing at a username.
export function readSearchInput(input: string): { platform: Platform | null; username: string | null } {
  const text = input.trim();
  const looksLikeLink = /^https?:\/\//i.test(text) || /^(www\.)?(chess\.com|lichess\.org)\//i.test(text);
  if (!looksLikeLink) return { platform: null, username: normaliseUsername(text.replace(/^@/, '')) };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { platform: null, username: null };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  if (host === 'chess.com' || host.endsWith('.chess.com')) {
    const at = parts.findIndex((p) => p.toLowerCase() === 'member');
    return { platform: 'chesscom', username: at >= 0 && parts[at + 1] ? normaliseUsername(parts[at + 1]!) : null };
  }
  if (host === 'lichess.org' || host.endsWith('.lichess.org')) {
    return { platform: 'lichess', username: parts[0] === '@' && parts[1] ? normaliseUsername(parts[1]) : null };
  }
  return { platform: null, username: null };
}

export function profileUrl(platform: Platform, username: string): string {
  return platform === 'chesscom'
    ? `https://www.chess.com/member/${encodeURIComponent(username)}`
    : `https://lichess.org/@/${encodeURIComponent(username)}`;
}

/** 0.416 -> "42%" */
export function pct(share: number | null | undefined): string {
  if (share === null || share === undefined || !Number.isFinite(share)) return '–';
  return `${Math.round(share * 100)}%`;
}

export function scoreText(tally: Tally): string {
  return pct(tally.score);
}

/** "12W 3D 5L" */
export function wdl(tally: Tally): string {
  return `${tally.wins}W ${tally.draws}D ${tally.losses}L`;
}

export function wdlLong(tally: Tally): string {
  return `${plural(tally.wins, 'win')}, ${plural(tally.draws, 'draw')}, ${plural(tally.losses, 'loss', 'losses')}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
}

export function fromGames(n: number): string {
  return `from ${plural(n, 'game')}`;
}

const END_LABELS: Record<EndReason, string> = {
  checkmate: 'Checkmate',
  resign: 'Resignation',
  timeout: 'Time',
  abandoned: 'Abandoned',
  draw_agreed: 'Agreed draw',
  repetition: 'Repetition',
  stalemate: 'Stalemate',
  insufficient: 'Insufficient material',
  fifty_moves: '50-move rule',
  timeout_vs_insufficient: 'Time vs insufficient material',
  other: 'Other'
};

export function endReasonLabel(reason: EndReason): string {
  return END_LABELS[reason] ?? 'Other';
}

export function endReasonRows(
  counts: Partial<Record<EndReason, number>>
): { reason: EndReason; label: string; count: number; share: number }[] {
  const entries = Object.entries(counts).filter((e): e is [EndReason, number] => (e[1] ?? 0) > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return entries
    .map(([reason, count]) => ({ reason, label: endReasonLabel(reason), count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// getTimezoneOffset() is minutes *behind* UTC, hence the flip. Half-hour
// zones get rounded and flagged.
export function localHourShift(timezoneOffsetMinutes: number): { hours: number; rounded: boolean } {
  const east = -timezoneOffsetMinutes;
  const hours = Math.round(east / 60);
  return { hours: hours === 0 ? 0 : hours, rounded: east % 60 !== 0 };
}

export function shiftHours(byHourUtc: readonly number[], shift: number): number[] {
  const local = new Array<number>(24).fill(0);
  byHourUtc.forEach((count, utcHour) => {
    const h = (((utcHour + shift) % 24) + 24) % 24;
    local[h] = (local[h] ?? 0) + count;
  });
  return local;
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Busiest run of `width` hours, wrapping past midnight */
export function busiestHours(byHour: readonly number[], width = 3): { start: number; end: number; share: number } | null {
  const total = byHour.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let best = { start: 0, sum: -1 };
  for (let start = 0; start < 24; start++) {
    let sum = 0;
    for (let i = 0; i < width; i++) sum += byHour[(start + i) % 24] ?? 0;
    if (sum > best.sum) best = { start, sum };
  }
  return { start: best.start, end: (best.start + width) % 24, share: best.sum / total };
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// Formatted by hand because browsers disagree on Intl month names ("Sep" vs "Sept")
const DAY_MONTH = { format: (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
const DAY_MONTH_YEAR = { format: (d: Date) => `${DAY_MONTH.format(d)} ${d.getUTCFullYear()}` };

export function dateRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '';
  const end = DAY_MONTH_YEAR.format(to);
  if (DAY_MONTH_YEAR.format(from) === end) return end;
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  return `${sameYear ? DAY_MONTH.format(from) : DAY_MONTH_YEAR.format(from)} – ${end}`;
}

export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${plural(days, 'day')} ago`;
  return `on ${DAY_MONTH_YEAR.format(new Date(then))}`;
}

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '±0';
}

/** "180+2" -> "3+2", "600+0" -> "10+0", "1/259200" -> "3 days/move" */
export function timeControlLabel(tc: string): string {
  const daily = /^1\/(\d+)$/.exec(tc);
  if (daily) {
    const days = Math.round(Number(daily[1]) / 86400);
    return `${plural(days, 'day')}/move`;
  }
  const live = /^(\d+)(?:\+(\d+))?$/.exec(tc);
  if (!live) return tc;
  const base = Number(live[1]);
  const inc = live[2] ?? '0';
  const minutes = base % 60 === 0 ? String(base / 60) : (base / 60).toFixed(1).replace(/\.0$/, '');
  return `${base < 60 ? `${base}s` : minutes}+${inc}`;
}

const RESULT_WORDS = { W: 'Win', D: 'Draw', L: 'Loss' } as const;

export function resultWord(r: 'W' | 'D' | 'L'): string {
  return RESULT_WORDS[r];
}

export function streakText(streak: { result: 'W' | 'D' | 'L'; length: number }): string {
  const noun = streak.result === 'W' ? ['win', 'wins'] : streak.result === 'D' ? ['draw', 'draws'] : ['loss', 'losses'];
  const words = plural(streak.length, noun[0]!, noun[1]!);
  return streak.length > 1 ? `${words} in a row` : words;
}

/** "e4 c5 Nf3 d6" -> "1.e4 c5 2.Nf3 d6" */
export function numberMoves(line: string): string {
  const plies = line.trim().split(/\s+/).filter(Boolean);
  return plies.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ');
}

export function firstMoveLabel(san: string, colour: 'white' | 'black'): string {
  return colour === 'white' ? `1.${san}` : `1…${san}`;
}

// "Sicilian Defense Najdorf Variation" under "Sicilian Defense" -> "Najdorf Variation"
export function variationLabel(name: string, family: string): string {
  if (name === family) return 'Main line';
  if (name.startsWith(family)) {
    const rest = name.slice(family.length).replace(/^[\s:,-]+/, '');
    if (rest) return rest;
  }
  return name;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DAY_MONTH.format(d);
}
