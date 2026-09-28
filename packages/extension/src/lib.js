// No Chrome APIs in here so it can be tested. Content scripts can't be
// modules, hence the global.
(() => {
  const DEFAULT_KESTREL_URL = 'http://localhost:3000';

  // same rule as normaliseUsername on the server
  function normaliseUsername(raw) {
    const name = String(raw || '').trim().toLowerCase();
    return /^[a-z0-9_-]{2,30}$/.test(name) ? name : null;
  }

  function parse(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  const isChessCom = (host) => host === 'chess.com' || host === 'www.chess.com';
  const isLichess = (host) => host === 'lichess.org' || host === 'www.lichess.org';

  function profileFromUrl(url) {
    const u = parse(url);
    if (!u) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (isChessCom(u.hostname) && parts[0] === 'member' && parts[1]) {
      const username = normaliseUsername(decodeURIComponent(parts[1]));
      return username ? { platform: 'chesscom', username } : null;
    }
    if (isLichess(u.hostname) && parts[0] === '@' && parts[1]) {
      const username = normaliseUsername(decodeURIComponent(parts[1]));
      return username ? { platform: 'lichess', username } : null;
    }
    return null;
  }

  // Deliberately broad: when in doubt, treat it as a game page
  const CHESSCOM_GAME = /^\/(game|games\/live|live|play|variants|daily)(\/|$)/i;

  // Lichess games are /<8 char id> (12 for the player's own view)
  const LICHESS_GAME = /^\/[a-zA-Z0-9]{8}([a-zA-Z0-9]{4})?(\/(white|black))?\/?$/;
  const LICHESS_PAGES = new Set([
    'analysis', 'practice', 'streamer', 'training', 'download', 'features', 'contacts', 'insights',
    'playlist', 'settings', 'calendar', 'coaching', 'resource', 'register', 'tutorial', 'versions'
  ]);
  const LICHESS_PLAY = /^\/(tv|games|round|lobby|setup|challenge|swiss\/[^/]+\/?$|tournament\/[^/]+\/?$)/i;

  function isGameUrl(url) {
    const u = parse(url);
    if (!u) return false;
    if (isChessCom(u.hostname)) {
      // old live page keeps the game id in the hash
      return CHESSCOM_GAME.test(u.pathname) || /(^|[#&])g=/.test(u.hash.slice(1));
    }
    if (isLichess(u.hostname)) {
      if (u.pathname === '/' && /^#(hook|friend|ai)/.test(u.hash)) return true; // the "create a game" pop-ups
      if (LICHESS_PLAY.test(u.pathname)) return true;
      const m = u.pathname.match(LICHESS_GAME);
      return !!m && !LICHESS_PAGES.has(u.pathname.split('/')[1].toLowerCase());
    }
    return false;
  }

  function isLocked(tabUrls) {
    return tabUrls.some((url) => !!url && isGameUrl(url));
  }

  function kestrelBase(saved) {
    const u = parse(saved || DEFAULT_KESTREL_URL);
    if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) return DEFAULT_KESTREL_URL;
    return u.origin;
  }

  function reportUrl(base, platform, username) {
    return `${kestrelBase(base)}/${platform}/${encodeURIComponent(username)}`;
  }

  // Accepts a name, @name, or a pasted profile URL (URL's site wins)
  function readSearchInput(input, platform) {
    const text = String(input || '').trim();
    const fromLink = profileFromUrl(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (fromLink && /(chess\.com|lichess\.org)\//i.test(text)) return fromLink;
    const username = normaliseUsername(text.replace(/^@/, ''));
    return username ? { platform, username } : null;
  }

  globalThis.KestrelLib = {
    DEFAULT_KESTREL_URL,
    normaliseUsername,
    profileFromUrl,
    isGameUrl,
    isLocked,
    kestrelBase,
    reportUrl,
    readSearchInput
  };
})();
