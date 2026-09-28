import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, NavContext, type Navigate } from './nav.js';
import { parseRoute } from './route.js';
import { Landing } from './landing/Landing.js';
import { ReportPage } from './pages/ReportPage.js';
import { KestrelMark } from './landing/pieces.js';

function currentLocation() {
  return { pathname: window.location.pathname, search: window.location.search };
}

export function App() {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const onPop = () => setLocation(currentLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback<Navigate>((to, opts) => {
    const here = window.location.pathname + window.location.search;
    if (to !== here) {
      if (opts?.replace) window.history.replaceState(null, '', to);
      else window.history.pushState(null, '', to);
    }
    setLocation(currentLocation());
    if (!opts?.replace && !opts?.keepScroll) {
      // scroll to top and move focus to the heading for screen readers
      window.scrollTo(0, 0);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }));
    }
  }, []);

  const route = parseRoute(location.pathname, location.search);

  if (route.page === 'home') {
    return (
      <NavContext.Provider value={navigate}>
        <Landing />
      </NavContext.Provider>
    );
  }

  return (
    <NavContext.Provider value={navigate}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap site-header__inner">
          <Link href="/" className="brand" aria-label="Kestrel home">
            <span className="brand__mark">
              <KestrelMark size={22} />
            </span>
            <span>Kestrel</span>
          </Link>
          <div className="site-header__right">
            <span className="site-header__tag">Opponent prep from public games</span>
            <Link href="/" className="button button--primary button--small">
              Scout someone
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="wrap">
        {route.page === 'report' && (
          // reset state on player change, but not on scope change
          <ReportPage
            key={`${route.platform}/${route.username}`}
            platform={route.platform}
            username={route.username}
            scope={route.scope}
          />
        )}
        {route.page === 'invalid' && (
          <Message title="That doesn't look like a username">
            Usernames are 2–30 letters, numbers, underscores or hyphens. <Link href="/">Try another search</Link>.
          </Message>
        )}
        {route.page === 'not_found' && (
          <Message title="Page not found">
            Nothing lives at this address. <Link href="/">Scout a player</Link> instead.
          </Message>
        )}
      </main>
      <footer className="site-footer">
        <div className="wrap site-footer__inner">
          <span className="site-footer__brand">
            <span className="site-footer__name">Kestrel</span>© 2026
          </span>
          <p>
            Preparation before a game and review after it, never during a live game. Not affiliated with Chess.com or
            Lichess. Uses public game data only.
          </p>
        </div>
      </footer>
    </NavContext.Provider>
  );
}

function Message({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Kestrel`;
  }, [title]);
  return (
    <section className="panel message">
      <h1 tabIndex={-1}>{title}</h1>
      <p>{children}</p>
    </section>
  );
}
