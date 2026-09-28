import { useState } from 'react';
import { MOST_POPULAR, plans, PRICING_HEAD } from './data.js';
import { GhostPiece, Icon, TICK } from './pieces.js';

export function Pricing() {
  const [yearly, setYearly] = useState(true);
  const options = [
    { yearly: false, label: PRICING_HEAD.monthly },
    { yearly: true, label: PRICING_HEAD.yearly }
  ];

  return (
    <section id="pricing" className="lp-section" aria-labelledby="pricing-title">
      <GhostPiece type="q" size={360} rotate="-10deg" delay="-5s, -2s" style={{ left: -170, top: 120 }} />
      <div className="k-reveal lp-head lp-head--center lp-head--pricing">
        <span className="lp-eyebrow">{PRICING_HEAD.eyebrow}</span>
        <h2 id="pricing-title" className="lp-h2">
          {PRICING_HEAD.title}
        </h2>
        <div className="lp-pill lp-pill--billing" role="group" aria-label="Billing period">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              className="k-btn lp-pill__btn"
              aria-pressed={yearly === o.yearly}
              onClick={() => setYearly(o.yearly)}
            >
              {o.label}
              {o.yearly && <span className="lp-save">{PRICING_HEAD.save}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="k-reveal lp-grid lp-plans">
        {plans(yearly).map((p) => (
          <article key={p.name} className={`k-card lp-plan${p.featured ? ' lp-plan--featured' : ''}`}>
            {p.featured && <span className="lp-popular">{MOST_POPULAR}</span>}
            <h3 className="lp-plan__name">{p.name}</h3>
            <div className="lp-price">
              {p.was && (
                <s className="lp-price__was">
                  <span className="lp-sr">was </span>
                  {p.was}
                </s>
              )}
              <span className="lp-price__now">{p.price}</span>
              <span className="lp-price__per">{p.per}</span>
            </div>
            <p className="lp-plan__blurb">{p.blurb}</p>
            <a className={`k-btn lp-plan__cta ${p.featured ? 'k-go' : 'k-ghostbtn'}`} href={p.href}>
              {p.cta}
            </a>
            <span className="lp-plan__fine">{p.fine}</span>
            <div className="lp-rule" />
            <ul className="lp-plan__items">
              {p.items.map((it) => (
                <li key={it}>
                  <Icon d={TICK} size={18} stroke="#81B64C" width={3} className="lp-plan__tick" />
                  {it}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="k-reveal lp-pricing__foot">{PRICING_HEAD.footnote}</p>
    </section>
  );
}
