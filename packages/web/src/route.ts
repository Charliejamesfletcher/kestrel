import type { Platform, ReportScope } from '@kestrel/shared';
import { isPlatform, isScope, normaliseUsername } from './format.js';

// Two pages, so no router library. The URL is the source of truth.

export type Route =
  | { page: 'home' }
  | { page: 'report'; platform: Platform; username: string; scope: ReportScope | null }
  | { page: 'invalid'; reason: 'username' }
  | { page: 'not_found' };

export function parseRoute(pathname: string, search: string): Route {
  const parts = pathname.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  if (parts.length === 0) return { page: 'home' };
  const [first, second] = parts;
  if (parts.length === 2 && first !== undefined && second !== undefined && isPlatform(first)) {
    const username = normaliseUsername(second);
    if (!username) return { page: 'invalid', reason: 'username' };
    const scopeParam = new URLSearchParams(search).get('scope');
    const scope = scopeParam && isScope(scopeParam) ? scopeParam : null;
    return { page: 'report', platform: first, username, scope };
  }
  return { page: 'not_found' };
}

export function reportPath(platform: Platform, username: string, scope: ReportScope | null = null): string {
  const base = `/${platform}/${encodeURIComponent(username)}`;
  return scope ? `${base}?scope=${scope}` : base;
}
