// Chess.com asks API clients to include contact details in the User-Agent.
// Keep it identical across requests and servers.
export function buildUserAgent(appName: string, version: string, contactEmail: string): string {
  if (!contactEmail.includes('@')) {
    throw new Error('A real contact email is required in the User-Agent');
  }
  return `${appName}/${version} (contact: ${contactEmail})`;
}

export function assertRealContactEmail(email: string): void {
  if (/@example\.(com|org|net)$/i.test(email)) {
    throw new Error(`CONTACT_EMAIL is still the placeholder (${email}). Set your real address in .env before fetching games.`);
  }
}
