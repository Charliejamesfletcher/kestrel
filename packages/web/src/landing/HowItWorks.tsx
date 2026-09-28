import { useState } from 'react';
import { HOW_HEAD, STEP_PREVIEWS, STEPS } from './data.js';
import { GhostPiece, KestrelMark, Padlock } from './pieces.js';

export function HowItWorks() {
  const [step, setStep] = useState(0);

  return (
    <section id="how" className="lp-section" aria-labelledby="how-title">
      <div className="k-reveal lp-head lp-head--wide">
        <span className="lp-eyebrow">{HOW_HEAD.eyebrow}</span>
        <h2 id="how-title" className="lp-h2">
          {HOW_HEAD.title}
        </h2>
      </div>
      <div className="k-reveal lp-how">
        <div className="lp-how__steps">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className="k-btn lp-step"
              aria-pressed={step === i}
              onClick={() => setStep(i)}
            >
              <span className="lp-step__num">{i + 1}</span>
              <span className="lp-step__text">
                <span className="lp-step__title">{s.title}</span>
                <span className="lp-step__body">{s.body}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="lp-how__preview">
          <GhostPiece type="k" size={260} rotate="-8deg" style={{ right: -50, bottom: -40 }} />
          <div key={step} className="k-pop lp-how__stage">
            {step === 0 && <InstallPreview />}
            {step === 1 && <ScoutPreview />}
            {step === 2 && <LockPreview />}
            {step === 3 && <ReviewPreview />}
          </div>
        </div>
      </div>
    </section>
  );
}

function InstallPreview() {
  const p = STEP_PREVIEWS.install;
  return (
    <div className="lp-stage lp-stage--center">
      <div className="lp-store">
        <span className="lp-store__icon">
          <KestrelMark size={24} />
        </span>
        <span className="lp-store__names">
          <span className="lp-store__name">{p.name}</span>
          <span className="lp-store__sub">{p.store}</span>
        </span>
        <span className="lp-fake-btn">{p.button}</span>
      </div>
      <span className="lp-stage__caption">{p.caption}</span>
    </div>
  );
}

function ScoutPreview() {
  const p = STEP_PREVIEWS.scout;
  return (
    <div className="lp-stage lp-stage--tight">
      <span className="lp-stage__eyebrow">{p.eyebrow}</span>
      <div className="lp-pairing">
        <span className="lp-pairing__names">{p.pairing}</span>
        <span className="lp-fake-btn lp-fake-btn--flat">{p.button}</span>
      </div>
      <div className="lp-pairing__grid">
        {p.cards.map((c) => (
          <div key={c.label} className="lp-pairing__card">
            <div className="lp-pairing__label">{c.label}</div>
            <div className={`lp-pairing__value${c.tone === 'warn' ? ' lp-warn' : ''}`}>{c.value}</div>
          </div>
        ))}
      </div>
      <span className="lp-stage__foot">{p.caption}</span>
    </div>
  );
}

function LockPreview() {
  const p = STEP_PREVIEWS.lock;
  return (
    <div className="lp-stage lp-stage--center lp-stage--lock">
      <div className="lp-lock__icon">
        <Padlock size={44} stroke="#81B64C" width={2} rx={2.5} />
      </div>
      <span className="lp-lock__title">{p.title}</span>
      <span className="lp-lock__body">{p.body}</span>
    </div>
  );
}

function ReviewPreview() {
  const p = STEP_PREVIEWS.review;
  return (
    <div className="lp-stage lp-stage--review">
      <span className="lp-stage__eyebrow">{p.eyebrow}</span>
      {p.cards.map((c) => (
        <div key={c.title} className="lp-review">
          <span className="lp-review__title">{c.title}</span>
          <span className="lp-review__body">{c.body}</span>
        </div>
      ))}
    </div>
  );
}
