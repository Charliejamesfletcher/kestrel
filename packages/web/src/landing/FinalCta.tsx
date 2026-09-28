import { useId } from 'react';
import { FINAL_CTA, HERO } from './data.js';
import type { ScoutFormProps } from './Hero.js';
import { GhostPiece } from './pieces.js';
import { SitePill } from './SitePill.js';

export function FinalCta(props: ScoutFormProps) {
  const inputId = useId();
  const errorId = useId();

  return (
    <section id="get" className="lp-section lp-get" aria-labelledby="get-title">
      <div className="k-reveal lp-get__card">
        <GhostPiece type="n" size={300} rotate="-14deg" style={{ left: '4%', bottom: -70 }} />
        <GhostPiece type="p" size={260} rotate="12deg" delay="-4s, -7s" style={{ right: '5%', top: -50 }} />
        <h2 id="get-title" className="lp-get__title">
          {FINAL_CTA.title}
        </h2>
        <p className="lp-get__body">{FINAL_CTA.body}</p>
        <form className="lp-get__form" onSubmit={props.onSubmit} noValidate>
          <SitePill value={props.platform} onChange={props.onPlatform} />
          <div className="lp-field-row lp-field-row--center">
            <label htmlFor={inputId} className="lp-sr">
              {FINAL_CTA.label}
            </label>
            <input
              id={inputId}
              className="k-in lp-input lp-input--big lp-input--dark"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={HERO.placeholder}
              value={props.value}
              onChange={(e) => props.onValue(e.target.value)}
              aria-invalid={props.error ? true : undefined}
              aria-describedby={props.error ? errorId : undefined}
            />
            <button className="k-btn k-go lp-btn-big" type="submit">
              {HERO.button}
            </button>
          </div>
          {props.error && (
            <p id={errorId} className="lp-error" role="alert">
              {props.error}
            </p>
          )}
        </form>
        <span className="lp-get__or">
          {FINAL_CTA.before}
          <a href="#early-access">{FINAL_CTA.link}</a>
          {FINAL_CTA.after}
        </span>
      </div>
    </section>
  );
}
