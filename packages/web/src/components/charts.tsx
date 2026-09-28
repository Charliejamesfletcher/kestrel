import { useId, useMemo, useState, type PointerEvent } from 'react';
import { plural, shortDate } from '../format.js';

// Plain SVG, no chart library.

export interface Column {
  label: string;
  tick: string;
  value: number;
}

export function ColumnChart({ columns, caption, unit = 'game' }: { columns: Column[]; caption: string; unit?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...columns.map((c) => c.value));
  const total = columns.reduce((a, c) => a + c.value, 0);
  const shown = active === null ? null : columns[active];
  return (
    <figure className="columns" onPointerLeave={() => setActive(null)}>
      <div className="columns__tip" aria-hidden="true">
        {shown ? (
          <>
            <strong>{shown.label}</strong> · {plural(shown.value, unit)}
            {total > 0 && ` (${Math.round((shown.value / total) * 100)}%)`}
          </>
        ) : (
          ' '
        )}
      </div>
      <div className="columns__plot" role="img" aria-label={`${caption}: ${columns.map((c) => `${c.label} ${c.value}`).join(', ')}`}>
        {columns.map((c, i) => (
          <div
            key={c.label}
            className={`columns__col${active === i ? ' is-active' : ''}`}
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          >
            <span className="columns__bar" style={{ height: `${(c.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="columns__ticks" aria-hidden="true">
        {columns.map((c) => (
          <span key={c.label}>{c.tick}</span>
        ))}
      </div>
      <figcaption className="visually-hidden">{caption}</figcaption>
    </figure>
  );
}

// y-axis is zoomed to their range, so min/max are labelled on the chart
export function Sparkline({ points }: { points: { date: string; rating: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();
  const W = 320;
  const H = 96;
  const PAD_Y = 10;

  const geo = useMemo(() => {
    const ratings = points.map((p) => p.rating);
    const lo = Math.min(...ratings);
    const hi = Math.max(...ratings);
    const span = Math.max(hi - lo, 20);
    const mid = (hi + lo) / 2;
    const yMin = mid - span / 2;
    const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
    const y = (r: number) => PAD_Y + (1 - (r - yMin) / span) * (H - PAD_Y * 2);
    const coords = points.map((p, i) => [x(i), y(p.rating)] as const);
    const line = coords.map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ');
    const area = coords.length > 1 ? `${line} L${W},${H} L0,${H} Z` : '';
    return { lo, hi, coords, line, area };
  }, [points]);

  if (points.length === 0) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const activeIndex = active ?? points.length - 1;
  const shown = points[activeIndex]!;
  const shownXY = geo.coords[activeIndex]!;

  function pick(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - box.left) / Math.max(1, box.width);
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1)))));
  }

  const summary = `Rating from ${first.rating} on ${shortDate(first.date)} to ${last.rating} on ${shortDate(last.date)}; highest ${geo.hi}, lowest ${geo.lo}.`;

  return (
    <figure className="spark">
      <div className="spark__tip" aria-hidden="true">
        <strong>{shown.rating}</strong> <span className="muted">on {shortDate(shown.date)}</span>
      </div>
      <div className="spark__plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={summary}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--green)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geo.area && <path d={geo.area} fill={`url(#${gradientId})`} />}
          <path d={geo.line} className="spark__line" vectorEffect="non-scaling-stroke" />
          {active !== null && (
            <line
              x1={shownXY[0]}
              x2={shownXY[0]}
              y1={0}
              y2={H}
              className="spark__cross"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {/* HTML dot so it stays round when the SVG stretches */}
        <span
          className="spark__dot"
          style={{ left: `${(shownXY[0] / W) * 100}%`, top: `${(shownXY[1] / H) * 100}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="spark__axis" aria-hidden="true">
        <span>{shortDate(first.date)}</span>
        <span>
          low {geo.lo} · high {geo.hi}
        </span>
        <span>{shortDate(last.date)}</span>
      </div>
      <figcaption className="visually-hidden">{summary}</figcaption>
    </figure>
  );
}
