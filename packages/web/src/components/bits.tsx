import type { ReactNode } from 'react';
import type { Section, Tally } from '@kestrel/shared';
import { fromGames, pct, plural, resultWord, scoreText, wdl, wdlLong } from '../format.js';


export function TallyText({ tally, showGames = false }: { tally: Tally; showGames?: boolean }) {
  if (tally.games === 0) return <span className="muted">No games</span>;
  return (
    <span className="tally">
      <strong className="tally__score">{scoreText(tally)}</strong>
      <span className="tally__wdl" title={wdlLong(tally)}>
        <span aria-hidden="true">{wdl(tally)}</span>
        <span className="visually-hidden">{wdlLong(tally)}</span>
      </span>
      {showGames && <span className="tally__games">{plural(tally.games, 'game')}</span>}
    </span>
  );
}

export function ResultBar({ tally }: { tally: Tally }) {
  if (tally.games === 0) return null;
  const parts = [
    ['win', tally.wins],
    ['draw', tally.draws],
    ['loss', tally.losses]
  ] as const;
  return (
    <span className="result-bar" aria-hidden="true">
      {parts.map(([kind, n]) =>
        n > 0 ? <span key={kind} className={`result-bar__${kind}`} style={{ flexGrow: n }} /> : null
      )}
    </span>
  );
}

export function ShareBar({ share, label }: { share: number; label?: string }) {
  const width = Math.max(0, Math.min(1, share)) * 100;
  return (
    <span className="share">
      <span className="share__track" aria-hidden="true">
        <span className="share__fill" style={{ width: `${width}%` }} />
      </span>
      <span className="share__value">{label ?? pct(share)}</span>
    </span>
  );
}

export function NotEnough({ games, needed }: { games: number; needed: number }) {
  return (
    <p className="not-enough">
      Not enough data yet ({games.toLocaleString('en-GB')} of {needed.toLocaleString('en-GB')} games). We'd rather show
      nothing than guess.
    </p>
  );
}

interface CardProps {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  games?: number;
}

export function Card({ id, title, intro, children, games }: CardProps) {
  return (
    <section className="card" id={id} aria-labelledby={`${id}-title`}>
      <div className="card__head">
        <h2 id={`${id}-title`}>{title}</h2>
        {games !== undefined && <span className="card__count">{fromGames(games)}</span>}
      </div>
      {intro && <p className="card__intro">{intro}</p>}
      {children}
    </section>
  );
}

export function SectionCard<T>({
  id,
  title,
  intro,
  section,
  children
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  section: Section<T>;
  children: (data: T) => ReactNode;
}) {
  return (
    <Card id={id} title={title} intro={intro} games={section.games}>
      {section.enough ? children(section.data) : <NotEnough games={section.games} needed={section.needed} />}
    </Card>
  );
}

export function Stat({ value, label, sub }: { value: ReactNode; label: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{value}</dd>
      {sub && <dd className="stat__sub">{sub}</dd>}
    </div>
  );
}

export function ResultChips({ results }: { results: ('W' | 'D' | 'L')[] }) {
  return (
    <ol className="chips" aria-label="Recent results, newest first">
      {results.map((r, i) => (
        <li key={i} className={`chip chip--${r}`} title={resultWord(r)}>
          <span aria-hidden="true">{r}</span>
          <span className="visually-hidden">{resultWord(r)}</span>
        </li>
      ))}
    </ol>
  );
}
