import { useId, useRef, type FormEvent, type KeyboardEvent } from 'react';
import type { Platform } from '@kestrel/shared';
import { Link } from '../nav.js';
import { reportPath } from '../route.js';
import {
  DEMO,
  DEMO_NAME,
  DEMO_TABS,
  FORM,
  FREE_WEAK_SPOTS,
  HOURS,
  LOCKED,
  OPENINGS,
  OPENINGS_KEY,
  PEAK_HOURS,
  RESULTS,
  SIDES,
  WEAK_SPOTS,
  type DemoTab,
  type Tone
} from './data.js';
import { Padlock } from './pieces.js';
import type { DemoState } from './useDemo.js';

const TONE_CLASS: Record<Tone, string> = { plain: '', warn: ' lp-warn', good: ' lp-good' };
const RESULT_WORD: Record<string, string> = { W: 'win', L: 'loss', D: 'draw' };

// Always the sample player, whatever name is typed, so no real person gets invented numbers.
export function DemoReport({ demo, platform }: { demo: DemoState; platform: Platform }) {
  const inputId = useId();
  const scanning = demo.phase === 'scanning';

  function submit(e: FormEvent) {
    e.preventDefault();
    demo.scan(demo.query, platform);
  }

  return (
    <section id="demo" className="lp-section lp-demo" aria-labelledby="demo-title">
      <div className="k-reveal lp-demo__head">
        <div className="lp-head">
          <span className="lp-eyebrow">{DEMO.eyebrow}</span>
          <h2 id="demo-title" className="lp-h2">
            {DEMO.title}
          </h2>
        </div>
        <p className="lp-demo__intro">{DEMO.intro}</p>
      </div>

      <div className="k-reveal lp-demo__card">
        <p className="lp-sample-tag">
          <span className="lp-sample-tag__dot" aria-hidden="true" />
          {DEMO.tag}
        </p>
        <div className="lp-demo__cols">
          <div className="lp-demo__left">
            <form className="lp-demo__form" onSubmit={submit} noValidate>
              <label htmlFor={inputId} className="lp-demo__label">
                {DEMO.inputLabel}
              </label>
              <div className="lp-demo__row">
                <input
                  id={inputId}
                  className="k-in lp-input lp-input--demo"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={demo.query}
                  onChange={(e) => demo.setQuery(e.target.value)}
                />
                <button className="k-btn k-go lp-btn-mid" type="submit">
                  {DEMO.button}
                </button>
              </div>
            </form>

            {scanning ? <ScanProgress /> : <Summary demo={demo} />}
          </div>

          <div className="lp-demo__right">
            <DemoTabs demo={demo} scanning={scanning} />
          </div>
        </div>
      </div>

      <div className="k-reveal lp-demo__cta">
        <span>{DEMO.cta}</span>
        <a className="k-btn k-go lp-btn-cta" href="#early-access">
          {DEMO.ctaButton}
        </a>
      </div>
    </section>
  );
}

function ScanProgress() {
  return (
    <div className="k-fade lp-scan" role="status">
      <span className="lp-scan__title">{DEMO.scanTitle}</span>
      <div className="lp-track">
        <div className="k-scan lp-track__fill" />
      </div>
      <div className="lp-scan__steps">
        {DEMO.scanSteps.map((s, i) => (
          <span key={s} className={`k-up ${['', 'k-d3', 'k-d5'][i] ?? ''}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Summary({ demo }: { demo: DemoState }) {
  const other = demo.other;
  return (
    <div className="k-fade lp-summary">
      {other && (
        <p className="lp-sample-note">
          {DEMO.sampleNote}{' '}
          {other.username && (
            <Link href={reportPath(other.platform, other.username)}>See {other.username}'s real report →</Link>
          )}
        </p>
      )}
      <div className="lp-summary__who">
        <div className="lp-avatar lp-avatar--big" aria-hidden="true">
          {DEMO_NAME[0]!.toUpperCase()}
        </div>
        <div className="lp-summary__names">
          <span className="lp-summary__name">{DEMO_NAME}</span>
          <span className="lp-summary__sub">{DEMO.subtitle}</span>
        </div>
      </div>
      <div className="lp-stat-grid">
        {DEMO.stats.map((s) => (
          <div key={s.label} className="lp-stat">
            <span className={`lp-stat__value${TONE_CLASS[s.tone]}`}>{s.value}</span>
            <span className="lp-stat__label">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="lp-plan">
        <span className="lp-plan__label">{DEMO.planLabel}</span>
        <span className="lp-plan__text">{DEMO.plan}</span>
      </div>
    </div>
  );
}

function DemoTabs({ demo, scanning }: { demo: DemoState; scanning: boolean }) {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabId = (t: DemoTab) => `${baseId}-tab-${t}`;
  const panelId = (t: DemoTab) => `${baseId}-panel-${t}`;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = DEMO_TABS.findIndex((t) => t.id === demo.tab);
    const last = DEMO_TABS.length - 1;
    const next =
      e.key === 'ArrowRight' ? (i + 1) % DEMO_TABS.length
      : e.key === 'ArrowLeft' ? (i + last) % DEMO_TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    demo.setTab(DEMO_TABS[next]!.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <div className="lp-tabs-row">
        <div role="tablist" aria-label="Report sections" className="lp-tabs" onKeyDown={onKeyDown}>
          {DEMO_TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={tabId(t.id)}
              className="k-btn lp-tab"
              type="button"
              role="tab"
              aria-selected={demo.tab === t.id}
              aria-controls={panelId(t.id)}
              tabIndex={demo.tab === t.id ? 0 : -1}
              onClick={() => demo.setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {demo.tab === 'openings' && (
          <div className="lp-pill" role="group" aria-label="Colour">
            {SIDES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="k-btn lp-pill__btn"
                aria-pressed={demo.side === s.id}
                onClick={() => demo.setSide(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* all panels stay mounted so aria-controls always resolves */}
      {DEMO_TABS.map((t) => (
        <div
          key={t.id}
          id={panelId(t.id)}
          role="tabpanel"
          aria-labelledby={tabId(t.id)}
          aria-busy={scanning}
          hidden={demo.tab !== t.id}
          className="lp-panel"
        >
          {demo.tab === t.id &&
            (scanning ? <Skeleton />
            : t.id === 'openings' ? <Openings side={demo.side} />
            : t.id === 'weak' ? <WeakSpots />
            : <Form />)}
        </div>
      ))}
    </>
  );
}

function Skeleton() {
  return (
    <div className="lp-skeleton" aria-hidden="true">
      {[1, 2, 3, 4].map((k) => (
        <div key={k} className="lp-skeleton__row">
          <div className="k-sweep lp-skeleton__sweep" />
        </div>
      ))}
    </div>
  );
}

function Openings({ side }: { side: 'white' | 'black' }) {
  const rows = OPENINGS[side];
  const worst = Math.min(...rows.map((r) => r.score));
  return (
    <div className="lp-openings">
      <div className="lp-openings__head" aria-hidden="true">
        <span className="lp-openings__name-col">Opening</span>
        <span className="lp-openings__played">Played</span>
        <span className="lp-openings__score">They score</span>
      </div>
      <ul className="lp-list">
        {rows.map((o, i) => {
          const weakest = o.score === worst;
          return (
            <li key={`${side}-${o.name}`} className="k-row lp-opening">
              <div className="lp-opening__line">
                <div className="lp-opening__names">
                  <span className="lp-opening__name">{o.name}</span>
                  <span className="lp-opening__moves">{o.moves}</span>
                </div>
                <span className="lp-openings__played lp-opening__share">
                  <span className="lp-sr">Played in </span>
                  {o.share}%<span className="lp-sr"> of games</span>
                </span>
                <span className={`lp-openings__score lp-opening__score${weakest ? ' lp-good' : ''}`}>
                  <span className="lp-sr">, they score </span>
                  {o.score}%{weakest && <span className="lp-sr"> (their weakest line)</span>}
                </span>
              </div>
              <div className="lp-track" aria-hidden="true">
                <div
                  className={`k-bar lp-track__fill${weakest ? '' : ' lp-track__fill--other'}`}
                  style={{ width: `${o.share}%`, animationDelay: `${i * 0.08}s` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="lp-key">
        <span>
          <span className="lp-key__swatch" aria-hidden="true" />
          {OPENINGS_KEY.weakest}
        </span>
        <span>
          <span className="lp-key__swatch lp-key__swatch--other" aria-hidden="true" />
          {OPENINGS_KEY.other}
        </span>
      </div>
    </div>
  );
}

function WeakSpots() {
  const free = WEAK_SPOTS.slice(0, FREE_WEAK_SPOTS);
  const locked = WEAK_SPOTS.slice(FREE_WEAK_SPOTS);
  return (
    <div className="lp-weak">
      <ol className="lp-list lp-weak__list">
        {free.map((w, i) => (
          <li key={w.title} className="k-row lp-weak__item">
            <div className="lp-weak__num" aria-hidden="true">
              {i + 1}
            </div>
            <div className="lp-weak__body">
              <div className="lp-weak__top">
                <span className="lp-weak__title">{w.title}</span>
                <span className={`lp-level${w.level === 'HIGH' ? ' lp-level--high' : ''}`}>
                  <span className="lp-sr">Level: </span>
                  {w.level}
                </span>
              </div>
              <span className="lp-weak__detail">{w.detail}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="lp-locked">
        <div className="lp-locked__blur" aria-hidden="true">
          {locked.map((w) => (
            <div key={w.title} className="lp-weak__item">
              <div className="lp-weak__num" />
              <div className="lp-weak__body">
                <span className="lp-weak__title">{w.title}</span>
                <span className="lp-weak__detail">{w.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="lp-locked__over">
          <div className="k-pop lp-locked__card">
            <span className="lp-locked__text">
              <Padlock size={18} stroke="#FFC93D" width={2.4} />
              {LOCKED.text}
            </span>
            <a className="k-btn k-go lp-btn-small" href="#pricing">
              {LOCKED.button}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Form() {
  const max = Math.max(...HOURS);
  const resultWords = RESULTS.split('').map((r) => RESULT_WORD[r] ?? r);
  return (
    <div className="lp-form">
      <div className="lp-form__block">
        <span className="lp-form__label">{FORM.resultsLabel}</span>
        <div className="lp-results" role="img" aria-label={`${FORM.resultsLabel}: ${resultWords.join(', ')}`}>
          {RESULTS.split('').map((r, i) => (
            <span
              key={i}
              className={`k-up lp-result lp-result--${r}`}
              style={{ animationDelay: `${i * 0.04}s` }}
              aria-hidden="true"
            >
              {r}
            </span>
          ))}
        </div>
      </div>
      <div className="lp-form__block">
        <span className="lp-form__label">{FORM.hoursLabel}</span>
        <div className="lp-hours" role="img" aria-label="Games per hour of the day, busiest from 9pm to 11pm">
          {HOURS.map((v, i) => (
            <div
              key={i}
              className={`k-fade lp-hour${i >= PEAK_HOURS.from && i <= PEAK_HOURS.to ? ' lp-hour--peak' : ''}`}
              style={{ height: `${Math.max(3, Math.round((v / max) * 100))}%`, animationDelay: `${i * 0.02}s` }}
              title={`${String(i).padStart(2, '0')}:00 · ${v} games`}
            />
          ))}
        </div>
        <div className="lp-hour-ticks" aria-hidden="true">
          {FORM.hourTicks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      <div className="lp-stat-grid">
        {FORM.stats.map((s) => (
          <div key={s.label} className="lp-stat lp-stat--form">
            <span className={`lp-stat__value${TONE_CLASS[s.tone]}`}>{s.value}</span>
            <span className="lp-stat__label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
