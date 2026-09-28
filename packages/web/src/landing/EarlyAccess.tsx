import { useId, useState, type FormEvent } from 'react';
import { EARLY_ACCESS } from './data.js';

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function EarlyAccess() {
  const inputId = useId();
  const errorId = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setError(EARLY_ACCESS.invalid);
      return;
    }
    setError(null);
    setState('sending');
    try {
      // TODO: POST /api/early-access doesn't exist yet (404), thank them anyway
      await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'landing' })
      });
    } catch {
    }
    setState('done');
  }

  return (
    <section id="early-access" className="lp-section lp-early" aria-labelledby="early-title">
      <div className="k-reveal lp-early__card">
        <h2 id="early-title" className="lp-early__title">
          {EARLY_ACCESS.title}
        </h2>
        <p className="lp-early__body">{EARLY_ACCESS.body}</p>
        {state === 'done' ? (
          <p className="k-pop lp-early__thanks" role="status">
            {EARLY_ACCESS.thanks}
          </p>
        ) : (
          <form className="lp-early__form" onSubmit={submit} noValidate>
            <label htmlFor={inputId} className="lp-early__label">
              {EARLY_ACCESS.label}
            </label>
            <div className="lp-field-row lp-field-row--center">
              <input
                id={inputId}
                className="k-in lp-input lp-input--big lp-input--dark"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder={EARLY_ACCESS.placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
              <button className="k-btn k-go lp-btn-big" type="submit" disabled={state === 'sending'}>
                {EARLY_ACCESS.button}
              </button>
            </div>
            {error && (
              <p id={errorId} className="lp-error" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
