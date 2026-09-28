import { FAIR } from './data.js';
import { Icon, SHIELD, TICK } from './pieces.js';

const CHECKER = Array.from({ length: 48 }, (_, i) => (Math.floor(i / 8) + (i % 8)) % 2 === 1);

export function FairPlay() {
  return (
    <section id="fair" className="lp-section" aria-labelledby="fair-title">
      <div className="k-reveal lp-fair">
        <div className="lp-fair__checker" aria-hidden="true">
          {CHECKER.map((white, i) => (
            <div key={i} className={white ? 'lp-checker-on' : undefined} />
          ))}
        </div>
        <div className="lp-fair__copy">
          <span className="lp-fair__badge">
            <Icon d={SHIELD} size={16} />
            {FAIR.badge}
          </span>
          <h2 id="fair-title" className="lp-h2 lp-h2--fair">
            {FAIR.title}
          </h2>
          <p className="lp-fair__body">{FAIR.body}</p>
        </div>
        <ul className="lp-fair__rules">
          {FAIR.rules.map((r) => (
            <li key={r.title} className="k-card lp-rule-card">
              <Icon d={TICK} size={24} stroke="#81B64C" />
              <span className="lp-rule-card__title">{r.title}</span>
              <span className="lp-rule-card__body">{r.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
