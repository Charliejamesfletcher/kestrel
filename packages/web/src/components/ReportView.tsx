import type { MouseEvent, ReactNode } from 'react';
import type { CastlingData, Report, ReportResponse, ReportScope, ScopeSummary } from '@kestrel/shared';
import {
  dateRange,
  pct,
  platformLabel,
  plural,
  profileUrl,
  relativeTime,
  scopeLabel,
  SCOPES,
  timeControlLabel
} from '../format.js';
import { useNavigate } from '../nav.js';
import { reportPath } from '../route.js';
import { Card, TallyText } from './bits.js';
import {
  ClockSection,
  FormSection,
  LengthSection,
  MaterialSection,
  OpeningsSection,
  OpponentsSection,
  ScheduleSection
} from './sections.js';

export type ReadyResponse = Extract<ReportResponse, { status: 'ready' }>;

interface Props {
  response: ReadyResponse;
  switchingTo: ReportScope | null;
  refreshGaveUp: boolean;
}

export function ReportView({ response, switchingTo, refreshGaveUp }: Props) {
  const { report } = response;
  return (
    <article className="report" aria-busy={switchingTo !== null}>
      <ReportHeader response={response} switchingTo={switchingTo} refreshGaveUp={refreshGaveUp} />
      <div className={`report__body${switchingTo ? ' is-stale' : ''}`}>
        {report.gamesUsed === 0 ? (
          <Card id="empty" title="No games here yet">
            <p>
              We have no {report.scope === 'all' ? '' : `${scopeLabel(report.scope).toLowerCase()} `}games for this
              player. Try another time control above.
            </p>
          </Card>
        ) : (
          <>
            <PlanCard report={report} />
            <StyleCard report={report} />
            <OpeningsSection report={report} />
            <ClockSection report={report} />
            <MaterialSection report={report} />
            <FormSection report={report} />
            <OpponentsSection report={report} />
            <LengthSection report={report} />
            <ScheduleSection report={report} />
          </>
        )}
      </div>
    </article>
  );
}

function ReportHeader({ response, switchingTo, refreshGaveUp }: Props) {
  const { report, scopes, refreshing, lastFetchedAt } = response;
  const now = new Date();
  const mainTc = report.timeControls.slice(0, 3);
  return (
    <header className="report-head">
      <div className="report-head__who">
        <h1 tabIndex={-1}>{report.username}</h1>
        <span className={`badge badge--${report.platform}`}>{platformLabel(report.platform)}</span>
        <a className="profile-link" href={profileUrl(report.platform, report.username)} target="_blank" rel="noopener noreferrer">
          Public profile<span className="visually-hidden"> on {platformLabel(report.platform)} (opens in a new tab)</span>
          <span aria-hidden="true"> ↗</span>
        </a>
      </div>

      <p className="basis">
        Based on <strong>{plural(report.gamesUsed, 'game')}</strong>
        {report.period && <> · {dateRange(report.period.from, report.period.to)}</>}
        {report.rated < report.gamesUsed && report.gamesUsed > 0 && (
          <span className="muted"> ({report.rated.toLocaleString('en-GB')} rated)</span>
        )}
      </p>

      {report.gamesUsed > 0 && (
        <dl className="overall">
          <div>
            <dt>Overall</dt>
            <dd>
              <TallyText tally={report.overall} />
            </dd>
          </div>
          <div>
            <dt>As White</dt>
            <dd>
              <TallyText tally={report.asWhite} />
            </dd>
          </div>
          <div>
            <dt>As Black</dt>
            <dd>
              <TallyText tally={report.asBlack} />
            </dd>
          </div>
        </dl>
      )}

      {mainTc.length > 0 && (
        <p className="small muted">
          Mostly {mainTc.map((t) => `${timeControlLabel(t.timeControl)} (${t.games.toLocaleString('en-GB')})`).join(', ')}
        </p>
      )}

      <p className="small muted freshness" aria-live="polite">
        {lastFetchedAt ? `Games downloaded ${relativeTime(lastFetchedAt, now)}` : 'Games downloaded recently'}
        {refreshing && !refreshGaveUp && (
          <span className="refreshing">
            <span className="spinner" aria-hidden="true" /> refreshing…
          </span>
        )}
        {refreshing && refreshGaveUp && <span> · still updating in the background, check back later</span>}
      </p>

      <ScopeTabs report={report} scopes={scopes} switchingTo={switchingTo} />
    </header>
  );
}

function ScopeTabs({ report, scopes, switchingTo }: { report: Report; scopes: ScopeSummary[]; switchingTo: ReportScope | null }) {
  const navigate = useNavigate();
  const counts = new Map(scopes.map((s) => [s.scope, s.games]));
  const current = switchingTo ?? report.scope;
  const shown = SCOPES.filter((s) => s === current || (counts.get(s) ?? 0) > 0);
  if (shown.length <= 1 && current === 'all') return null;

  function go(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href, { keepScroll: true });
  }

  return (
    <nav className="scopes" aria-label="Time control">
      <ul>
        {shown.map((s) => {
          const href = reportPath(report.platform, report.username, s);
          const n = counts.get(s);
          return (
            <li key={s}>
              <a href={href} aria-current={s === current ? 'page' : undefined} onClick={(e) => go(e, href)}>
                {scopeLabel(s)}
                {n !== undefined && <span className="scopes__count">{n.toLocaleString('en-GB')}</span>}
                {n !== undefined && <span className="visually-hidden"> games</span>}
              </a>
            </li>
          );
        })}
      </ul>
      {switchingTo && (
        <p className="small muted" role="status">
          <span className="spinner" aria-hidden="true" /> Loading {scopeLabel(switchingTo).toLowerCase()} games…
        </p>
      )}
    </nav>
  );
}

function PlanCard({ report }: { report: Report }) {
  return (
    <section className="plan" aria-labelledby="plan-title">
      <h2 id="plan-title">Game plan</h2>
      {report.plan ? (
        <>
          <p className="plan__text">{report.plan.text}</p>
          <p className="small plan__basis">
            {`From ${plural(report.gamesUsed, 'game')}. A starting point for your prep, not a guarantee.`}
          </p>
        </>
      ) : (
        <p className="plan__text plan__text--empty">Not enough games for a game plan yet.</p>
      )}
    </section>
  );
}

function StyleCard({ report }: { report: Report }) {
  return (
    <Card id="style" title="Style" intro="Measured from their games, not opinions.">
      {report.style.length === 0 ? (
        <p className="muted">Not enough data yet for clear patterns.</p>
      ) : (
        <ul className="facts">
          {report.style.map((f) => (
            <li key={f.id}>
              {f.text}
              {!/\(\d/.test(f.text) && <span className="facts__games"> · {plural(f.games, 'game')}</span>}
            </li>
          ))}
        </ul>
      )}
      <Castling section={report.castling} />
    </Card>
  );
}

function Castling({ section }: { section: Report['castling'] }) {
  return (
    <SectionCardInline section={section}>
      {(c) => {
        const total = c.kingside + c.queenside + c.none;
        return (
          <p className="small">
            <strong>Castling</strong> (games with 10+ of their moves): kingside {pct(total ? c.kingside / total : null)} ·
            queenside {pct(total ? c.queenside / total : null)} · didn't castle {pct(total ? c.none / total : null)}
            <span className="muted"> · {plural(total, 'game')}</span>
          </p>
        );
      }}
    </SectionCardInline>
  );
}

function SectionCardInline({ section, children }: { section: Report['castling']; children: (d: CastlingData) => ReactNode }) {
  if (!section.enough) {
    return (
      <p className="small muted">
        Castling: not enough data yet ({section.games} of {section.needed} games).
      </p>
    );
  }
  return <>{children(section.data)}</>;
}
