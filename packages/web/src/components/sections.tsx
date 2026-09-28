import type {
  BlackOpenings,
  ClockData,
  EndingsData,
  MoveStat,
  OpeningStat,
  Report,
  ScheduleData,
  Tally,
  WhiteOpenings
} from '@kestrel/shared';
import {
  busiestHours,
  endReasonRows,
  firstMoveLabel,
  hourLabel,
  localHourShift,
  numberMoves,
  pct,
  plural,
  shiftHours,
  signed,
  streakText,
  variationLabel,
  WEEKDAYS
} from '../format.js';
import { Card, ResultBar, ResultChips, SectionCard, ShareBar, Stat, TallyText } from './bits.js';
import { ColumnChart, Sparkline } from './charts.js';

/* ---------- Openings ---------- */

function MoveTable({ moves, colour, caption }: { moves: MoveStat[]; colour: 'white' | 'black'; caption: string }) {
  if (moves.length === 0) return <p className="muted small">Not enough games to show.</p>;
  return (
    <div className="table-wrap">
      <table className="stat-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Move</th>
            <th scope="col">How often</th>
            <th scope="col">Their score</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((m) => (
            <tr key={m.move}>
              <th scope="row" className="san">
                {firstMoveLabel(m.move, colour)}
              </th>
              <td>
                <ShareBar share={m.share} />
              </td>
              <td>
                <TallyText tally={m.tally} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpeningList({ openings }: { openings: OpeningStat[] }) {
  if (openings.length === 0) return <p className="muted small">Not enough games to show.</p>;
  return (
    <ul className="openings">
      {openings.map((o) => (
        <li key={o.family} className="opening">
          <div className="opening__head">
            <h4>{o.family}</h4>
            <span className="opening__share">{pct(o.share)} of games</span>
          </div>
          <ResultBar tally={o.tally} />
          <div className="opening__score">
            <TallyText tally={o.tally} showGames />
          </div>
          {o.line && <p className="san line">{numberMoves(o.line)}</p>}
          {o.variations.length > 0 && (
            <ul className="variations" aria-label={`Most played ${o.family} lines`}>
              {o.variations.map((v) => (
                <li key={v.name}>
                  <span className="variations__name">
                    {variationLabel(v.name, o.family)}
                    {v.eco && <span className="eco">{v.eco}</span>}
                  </span>
                  <TallyText tally={v.tally} showGames />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function OpeningsSection({ report }: { report: Report }) {
  const { white, black } = report.openings;
  return (
    <>
      <SectionCard<WhiteOpenings> id="white" title="Openings as White" section={white}>
        {(d) => (
          <>
            <h3>First move</h3>
            <MoveTable moves={d.firstMoves} colour="white" caption="Their first move as White" />
            <h3>Openings</h3>
            <OpeningList openings={d.openings} />
          </>
        )}
      </SectionCard>
      <SectionCard<BlackOpenings> id="black" title="Openings as Black" section={black}>
        {(d) => (
          <>
            <div className="split">
              <div>
                <h3>Against 1.e4</h3>
                <MoveTable moves={d.vsE4} colour="black" caption="Their reply to 1.e4" />
              </div>
              <div>
                <h3>Against 1.d4</h3>
                <MoveTable moves={d.vsD4} colour="black" caption="Their reply to 1.d4" />
              </div>
            </div>
            <h3>Openings</h3>
            <OpeningList openings={d.openings} />
          </>
        )}
      </SectionCard>
    </>
  );
}

/* ---------- Clock ---------- */

export function ClockSection({ report }: { report: Report }) {
  if (!report.clock) return null;
  return (
    <SectionCard<ClockData>
      id="clock"
      title="Clock"
      intro="Time left on their clock, as a share of what they started with."
      section={report.clock}
    >
      {(c) => (
        <dl className="stats">
          <Stat label="Left after move 20" value={pct(c.leftAt20)} sub="on average" />
          <Stat label="Left after move 30" value={pct(c.leftAt30)} sub="on average" />
          <Stat
            label="Under 10% at move 30"
            value={pct(c.under10PctAt30)}
            sub={`of ${plural(c.readingsAt30, 'game')} that got there`}
          />
          <Stat
            label="Losses on time"
            value={c.lossesOnTime.toLocaleString('en-GB')}
            sub={c.lossesOnTimeShare === null ? 'no losses' : `${pct(c.lossesOnTimeShare)} of their losses`}
          />
          <Stat
            label="Wins on time"
            value={c.winsOnTime.toLocaleString('en-GB')}
            sub={c.winsOnTimeShare === null ? 'no wins' : `${pct(c.winsOnTimeShare)} of their wins`}
          />
        </dl>
      )}
    </SectionCard>
  );
}

/* ---------- Tables of tallies (material, opponents) ---------- */

function TallyTable({ rows, caption, head }: { rows: [string, string, Tally][]; caption: string; head: string }) {
  return (
    <div className="table-wrap">
      <table className="stat-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{head}</th>
            <th scope="col">Games</th>
            <th scope="col">Their score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, hint, t]) => (
            <tr key={label}>
              <th scope="row">
                {label}
                <span className="row-hint">{hint}</span>
              </th>
              <td className="num">{t.games.toLocaleString('en-GB')}</td>
              <td>
                <TallyText tally={t} />
                <ResultBar tally={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MaterialSection({ report }: { report: Report }) {
  return (
    <SectionCard
      id="material"
      title="Material at move 30"
      intro="How they score depending on the material balance after move 30, counted in pawns."
      section={report.material}
    >
      {(m) => (
        <>
          <p className="small muted">{plural(m.reached, 'game')} reached move 30.</p>
          <TallyTable
            head="After move 30"
            caption="Results by material balance at move 30"
            rows={[
              ['Ahead', '2+ pawns up', m.ahead],
              ['Level', 'within a pawn', m.level],
              ['Behind', '2+ pawns down', m.behind]
            ]}
          />
        </>
      )}
    </SectionCard>
  );
}

export function OpponentsSection({ report }: { report: Report }) {
  return (
    <SectionCard id="opponents" title="Against stronger and weaker players" section={report.opponents}>
      {(o) => (
        <TallyTable
          head="Opponent"
          caption="Results by opponent rating"
          rows={[
            ['Higher rated', '50+ points above', o.higher],
            ['Similar', 'within 50 points', o.similar],
            ['Lower rated', '50+ points below', o.lower]
          ]}
        />
      )}
    </SectionCard>
  );
}

/* ---------- Form & rating ---------- */

export function FormSection({ report }: { report: Report }) {
  return (
    <div className="pair">
      <SectionCard id="form" title="Form" section={report.form}>
        {(f) => (
          <>
            <h3 className="small-head">Last {f.last10.length} results, newest first</h3>
            <ResultChips results={f.last10} />
            <p className="chip-key small muted">W win · D draw · L loss</p>
            <dl className="stats stats--two">
              <Stat label="Current run" value={streakText(f.streak)} />
              <Stat
                label={`Last ${plural(f.recent.games, 'game')}`}
                value={pct(f.recent.score)}
                sub={<TallyText tally={f.recent} />}
              />
            </dl>
          </>
        )}
      </SectionCard>
      {report.rating === null ? (
        <Card id="rating" title="Rating">
          <p className="muted">
            Ratings differ between bullet, blitz, rapid and daily. Pick a time control above to see rating.
          </p>
        </Card>
      ) : (
        <SectionCard id="rating" title="Rating" section={report.rating}>
          {(r) => (
            <>
              <dl className="stats stats--three">
                <Stat label="Current" value={r.current} />
                <Stat
                  label="Change"
                  value={<span className={r.change > 0 ? 'up' : r.change < 0 ? 'down' : ''}>{signed(r.change)}</span>}
                  sub="over this report"
                />
                <Stat label="Peak" value={r.peak} sub={`low ${r.low}`} />
              </dl>
              {r.pool && (r.pool.toLowerCase() !== report.scope || (r.leftOut ?? 0) > 0) ? (
                <p className="small muted">
                  {r.pool} rating
                  {(r.leftOut ?? 0) > 0 ? ` only; ${plural(r.leftOut, 'game')} with a different rating left out.` : '.'}
                </p>
              ) : null}
              {r.history.length > 1 ? (
                <Sparkline points={r.history} />
              ) : (
                <p className="small muted">Not enough days of games to draw a trend.</p>
              )}
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* ---------- Length and endings ---------- */

function ReasonList({ title, counts }: { title: string; counts: EndingsData['wins'] }) {
  const rows = endReasonRows(counts);
  return (
    <div>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted small">None.</p>
      ) : (
        <ul className="reasons">
          {rows.map((r) => (
            <li key={r.reason}>
              <span className="reasons__label">{r.label}</span>
              <ShareBar share={r.share} label={`${r.count.toLocaleString('en-GB')} · ${pct(r.share)}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LengthSection({ report }: { report: Report }) {
  return (
    <div className="pair">
      <SectionCard id="length" title="Game length" section={report.length}>
        {(l) => (
          <>
            <dl className="stats stats--two">
              <Stat label="Average" value={Math.round(l.averageMoves)} sub="moves" />
              <Stat label="Median" value={Math.round(l.medianMoves)} sub="moves" />
            </dl>
            <TallyTable
              head="Games"
              caption="Results in short and long games"
              rows={[
                ['Short', '25 moves or fewer', l.short],
                ['Long', '60 moves or more', l.long]
              ]}
            />
          </>
        )}
      </SectionCard>
      <SectionCard id="endings" title="How games end" section={report.endings}>
        {(e) => (
          <div className="split">
            <ReasonList title="Their wins" counts={e.wins} />
            <ReasonList title="Their losses" counts={e.losses} />
            <ReasonList title="Draws" counts={e.draws} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ---------- When they play ---------- */

export function ScheduleSection({ report }: { report: Report }) {
  const { hours: shift, rounded } = localHourShift(new Date().getTimezoneOffset());
  return (
    <SectionCard<ScheduleData> id="schedule" title="When they play" section={report.schedule}>
      {(s) => {
        const local = shiftHours(s.byHourUtc, shift);
        const peak = busiestHours(local);
        return (
          <div className="split">
            <div>
              <h3>Time of day (your time)</h3>
              {peak && (
                <p className="small">
                  Busiest {hourLabel(peak.start)}–{hourLabel(peak.end)}: {pct(peak.share)} of their games.
                </p>
              )}
              <ColumnChart
                caption="Games by hour of day, your time"
                columns={local.map((value, h) => ({
                  label: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`,
                  tick: h % 6 === 0 ? String(h).padStart(2, '0') : '',
                  value
                }))}
              />
              {rounded && <p className="small muted">Your time zone is shifted by half an hour; hours are rounded.</p>}
            </div>
            <div>
              <h3>Day of the week</h3>
              <p className="small muted">Days counted in UTC.</p>
              <ColumnChart
                caption="Games by day of the week (UTC)"
                columns={s.byWeekdayUtc.map((value, d) => ({
                  label: WEEKDAYS[d] ?? '',
                  tick: WEEKDAYS[d] ?? '',
                  value
                }))}
              />
            </div>
          </div>
        );
      }}
    </SectionCard>
  );
}
