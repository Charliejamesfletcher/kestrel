import { FOOTER } from './data.js';

export function Footer() {
  return (
    <footer className="lp-footer">
      <span className="lp-footer__brand">
        <span className="lp-footer__name">Kestrel</span>
        {FOOTER.year}
      </span>
      <span>{FOOTER.note}</span>
      <nav aria-label="Legal" className="lp-footer__nav">
        {FOOTER.links.map((l) => (
          <a key={l.label} className="k-nav lp-footer__link" href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
