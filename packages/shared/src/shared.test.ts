import { describe, expect, it } from 'vitest';
import { buildUserAgent, loadConfig, normaliseUsername } from './index.js';

describe('buildUserAgent', () => {
  it('includes app, version and contact email', () => {
    expect(buildUserAgent('kestrel', '0.1.0', 'me@example.com')).toBe(
      'kestrel/0.1.0 (contact: me@example.com)'
    );
  });

  it('refuses a missing contact email', () => {
    expect(() => buildUserAgent('kestrel', '0.1.0', '')).toThrow();
  });
});

describe('normaliseUsername', () => {
  it('lowercases and trims valid names', () => {
    expect(normaliseUsername('  Hikaru ')).toBe('hikaru');
  });

  it('rejects names with illegal characters', () => {
    expect(normaliseUsername('bad name!')).toBeNull();
    expect(normaliseUsername('../etc')).toBeNull();
  });
});

describe('loadConfig', () => {
  it('parses a valid environment', () => {
    const cfg = loadConfig({
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      CONTACT_EMAIL: 'me@example.com',
      PORT: '4000'
    });
    expect(cfg.PORT).toBe(4000);
    expect(cfg.APP_NAME).toBe('kestrel');
  });

  it('explains what is wrong with a bad environment', () => {
    expect(() => loadConfig({ DATABASE_URL: 'nope' })).toThrow(/CONTACT_EMAIL/);
  });
});
