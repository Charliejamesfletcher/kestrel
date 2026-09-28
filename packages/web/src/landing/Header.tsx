import { NAV_LINKS } from './data.js';
import { KestrelMark } from './pieces.js';

export function Header() {
  return (
    <header className="lp-header">
      <div className="lp-header__inner">
        <a href="#top" className="lp-brand" aria-label="Kestrel home">
          <span className="lp-brand__mark">
            <KestrelMark size={22} />
          </span>
          <span className="lp-brand__name">Kestrel</span>
        </a>
        <nav aria-label="Main" className="lp-nav">
          {NAV_LINKS.map((l) => (
            <a key={l.href} className="k-nav lp-nav__link" href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <a className="k-btn k-go lp-header__cta" href="#get">
          Get it free
        </a>
      </div>
    </header>
  );
}
