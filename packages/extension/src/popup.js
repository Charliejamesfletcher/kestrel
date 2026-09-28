const { readSearchInput, kestrelBase } = globalThis.KestrelLib;
const $ = (id) => document.getElementById(id);
let platform = 'chesscom';

function choose(p) {
  platform = p;
  for (const b of document.querySelectorAll('[data-platform]')) {
    b.setAttribute('aria-pressed', String(b.dataset.platform === p));
  }
  chrome.storage.sync.set({ platform: p });
}

function setLocked(locked) {
  $('lock').hidden = !locked;
  $('form').hidden = locked;
}

for (const b of document.querySelectorAll('[data-platform]')) {
  b.addEventListener('click', () => choose(b.dataset.platform));
}

chrome.storage.sync.get(['platform', 'kestrelUrl'], ({ platform: saved, kestrelUrl }) => {
  if (saved === 'lichess' || saved === 'chesscom') choose(saved);
  $('site').href = kestrelBase(kestrelUrl);
});

setLocked(true);
chrome.runtime.sendMessage({ type: 'lock?' }, (res) => {
  setLocked(!!res?.locked);
  if (!res?.locked) $('username').focus();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && 'locked' in changes) setLocked(changes.locked.newValue !== false);
});

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const read = readSearchInput($('username').value, platform);
  if (!read) {
    $('error').textContent = 'Usernames are 2–30 letters, numbers, underscores or hyphens.';
    $('error').hidden = false;
    return;
  }
  $('error').hidden = true;
  $('go').disabled = true;
  chrome.runtime.sendMessage({ type: 'scout', ...read }, (res) => {
    $('go').disabled = false;
    if (res?.locked) setLocked(true);
    else if (res?.ok) window.close();
  });
});
