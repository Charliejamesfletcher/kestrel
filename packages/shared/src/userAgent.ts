/**
 * The User-Agent sent with every request to Chess.com and Lichess.
 * Chess.com recommends including contact details so they can reach you
 * instead of blocking you. Never change this per request or per server:
 * Kestrel is one app and should always identify as one app.
 */
export function buildUserAgent(appName: string, version: string, contactEmail: string): string {
  if (!contactEmail.includes('@')) {
    throw new Error('A real contact email is required in the User-Agent');
  }
  return `${appName}/${version} (contact: ${contactEmail})`;
}
