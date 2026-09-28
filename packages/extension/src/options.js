const { kestrelBase, DEFAULT_KESTREL_URL } = globalThis.KestrelLib;
const input = document.getElementById('url');
const status = document.getElementById('status');

chrome.storage.sync.get('kestrelUrl', ({ kestrelUrl }) => {
  input.value = kestrelBase(kestrelUrl);
});

document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = input.value.trim() || DEFAULT_KESTREL_URL;
  const base = kestrelBase(raw);
  if (!/^https?:\/\//i.test(raw)) {
    status.textContent = 'Use a full address starting with http:// or https://';
    return;
  }
  chrome.storage.sync.set({ kestrelUrl: base }, () => {
    input.value = base;
    status.innerHTML = '<span class="saved">Saved.</span> Reports will open at ' + base.replace(/</g, '&lt;');
  });
});
