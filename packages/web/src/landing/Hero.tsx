import { useId, type FormEvent } from 'react';
import type { Platform } from '@kestrel/shared';
import { HERO } from './data.js';
import { DemoBoard } from './DemoBoard.js';
import { GhostPiece, Icon, TICK } from './pieces.js';
import { SitePill } from './SitePill.js';

const CHECKER = Array.from({ length: 36 }, (_, i) => (Math.floor(i / 6) + (i % 6)) % 2 === 1);

export interface ScoutFormProps {
  value: string;
  onValue: (v: string) => void;
  platform: Platform;
  onPlatform: (p: Platform) => void;
  error: string | null;
  onSubmit: (e: FormEvent) => void;
}

export function Hero(props: ScoutFormProps) {
  const inputId = useId();
  const errorId = useId();

  return (
    <section id="top" className="lp-hero">
      <GhostPiece type="n" size={420} rotate="-12deg" style={{ left: -110, top: 40 }} />
      <GhostPiece type="r" size={300} rotate="10deg" delay="-4s, -6s" style={{ right: -60, bottom: -40 }} />
      <div className="lp-hero__checker" aria-hidden="true">
        {CHECKER.map((white, i) => (
          <div key={i} className={white ? 'lp-checker-on' : undefined} />
        ))}
      </div>

      <div className="lp-hero__inner">
        <div className="lp-hero__copy">
          <div className="k-up lp-chip-line">
            <span className="lp-new">{HERO.chip}</span>
            {HERO.chipText}
          </div>
          <h1 className="k-up k-d1 lp-h1" tabIndex={-1}>
            {HERO.title}
          </h1>
          <p className="k-up k-d2 lp-lede">{HERO.lede}</p>

          <form className="k-up k-d3 lp-hero__form" onSubmit={props.onSubmit} noValidate>
            <div className="lp-hero__label-row">
              <label htmlFor={inputId} className="lp-hero__label">
                {HERO.label}
              </label>
              <SitePill value={props.platform} onChange={props.onPlatform} />
            </div>
            <div className="lp-field-row">
              <input
                id={inputId}
                className="k-in lp-input lp-input--big"
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
            <ul className="lp-reassure">
              {HERO.reassure.map((r) => (
                <li key={r}>
                  <Icon d={TICK} size={16} stroke="#81B64C" width={3} />
                  {r}
                </li>
              ))}
            </ul>
          </form>
        </div>

        <DemoBoard />
      </div>
    </section>
  );
}
