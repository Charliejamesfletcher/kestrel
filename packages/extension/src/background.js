// Owns the lock: Kestrel is locked while any chess.com/lichess tab is on a
// game page. Re-checked on every tab change and again before opening a report.
importScripts('lib.js');
const { isLocked, normaliseUsername, reportUrl } = globalThis.KestrelLib;

chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

const WATCHED = ['https://www.chess.com/*', 'https://chess.com/*', 'https://lichess.org/*'];

async function computeLock() {
  const tabs = await chrome.tabs.query({ url: WATCHED });
  const locked = isLocked(tabs.map((t) => t.url));
  await chrome.storage.session.set({ locked });
  await chrome.action.setBadgeBackgroundColor({ color: '#E8A33D' });
  await chrome.action.setBadgeText({ text: locked ? '🔒' : '' });
  await chrome.action.setTitle({
    title: locked ? 'Kestrel is locked while a game is open' : 'Kestrel: scout your next opponent'
  });
  return locked;
}

chrome.runtime.onInstalled.addListener(() => void computeLock());
chrome.runtime.onStartup.addListener(() => void computeLock());
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.url || info.status === 'complete') void computeLock();
});
chrome.tabs.onRemoved.addListener(() => void computeLock());
chrome.tabs.onReplaced.addListener(() => void computeLock());

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === 'lock?') {
    computeLock().then((locked) => reply({ locked }));
    return true; // answering asynchronously
  }
  if (msg?.type === 'scout') {
    (async () => {
      if (await computeLock()) return reply({ ok: false, locked: true });
      // don't trust the message
      const username = normaliseUsername(msg.username);
      if (!username || (msg.platform !== 'chesscom' && msg.platform !== 'lichess')) return reply({ ok: false });
      const { kestrelUrl } = await chrome.storage.sync.get('kestrelUrl');
      await chrome.tabs.create({ url: reportUrl(kestrelUrl, msg.platform, username) });
      reply({ ok: true });
    })();
    return true;
  }
  return false;
});
