// Scout button on profile pages. Both sites navigate without reloading, so we
// poll the URL and remove the button as soon as we leave a profile or any tab
// opens a game.
(() => {
  const { profileFromUrl, isGameUrl } = globalThis.KestrelLib;
  let host = null;
  let locked = true; // hidden until the background says otherwise
  let shownFor = '';

  function remove() {
    host?.remove();
    host = null;
    shownFor = '';
  }

  function show(profile) {
    const key = `${profile.platform}/${profile.username}`;
    if (host && shownFor === key) return;
    remove();
    host = document.createElement('div');
    host.id = 'kestrel-scout';
    // shadow root so neither side's CSS leaks
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        button {
          position: fixed; right: 20px; bottom: 24px; z-index: 2147483000;
          display: inline-flex; align-items: center; gap: 10px;
          min-height: 48px; padding: 0 18px 0 8px;
          border: none; border-radius: 10px; cursor: pointer;
          background: #639a35; color: #fff;
          font: 900 17px/1 'Nunito Sans', 'Segoe UI', Helvetica, Arial, sans-serif;
          box-shadow: 0 5px 0 0 #45753c, 0 16px 30px -10px rgba(0, 0, 0, 0.6);
          transition: background .15s ease, transform .12s ease, box-shadow .12s ease;
        }
        button:hover { background: #72ae41; }
        button:active { transform: translateY(4px); box-shadow: 0 1px 0 0 #45753c; }
        button:focus-visible { outline: 2px solid #a3d160; outline-offset: 3px; }
        .mark {
          width: 32px; height: 32px; border-radius: 8px; background: #45753c;
          display: flex; align-items: center; justify-content: center;
        }
        @media (prefers-reduced-motion: reduce) { button { transition: none; } }
      </style>
      <button type="button" title="Open ${profile.username}'s Kestrel report in a new tab">
        <span class="mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"
               stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l8-10 8 10"/><path d="M8 20l4-5 4 5"/></svg>
        </span>
        Scout with Kestrel
      </button>`;
    root.querySelector('button').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'scout', ...profile }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res?.locked) {
          locked = true;
          update();
        }
      });
    });
    document.documentElement.appendChild(host);
    shownFor = key;
  }

  function update() {
    const here = location.href;
    const profile = profileFromUrl(here);
    if (locked || isGameUrl(here) || !profile) remove();
    else show(profile);
  }

  chrome.storage.session.get('locked', ({ locked: l }) => {
    locked = l !== false;
    update();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && 'locked' in changes) {
      locked = changes.locked.newValue !== false;
      update();
    }
  });
  // session storage is empty after a browser restart
  chrome.runtime.sendMessage({ type: 'lock?' }, (res) => {
    if (chrome.runtime.lastError) return;
    locked = !!res?.locked;
    update();
  });

  setInterval(update, 1000);
})();
