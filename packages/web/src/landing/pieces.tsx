import type { CSSProperties } from 'react';
import type { PieceType } from './board.js';

// Our own piece set, defined once as <symbol>s and reused with <use>.
export function PieceDefs() {
  return (
    <svg width="0" height="0" className="lp-defs" aria-hidden="true" focusable="false">
      <defs>
        <symbol id="pc-p" viewBox="0 0 45 45">
          <circle cx="22.5" cy="12.5" r="5.5" />
          <path d="M18 19h9l-1 2.5c2.8 2 4.5 5.5 4.5 10h-16c0-4.5 1.7-8 4.5-10z" />
          <rect x="12" y="31.5" width="21" height="5.5" rx="2" />
        </symbol>
        <symbol id="pc-r" viewBox="0 0 45 45">
          <path d="M13 8h4v3h3.5V8h4v3H28V8h4v8l-3 2.2v10.8l3 2.5H13l3-2.5V18.2L13 16z" />
          <rect x="11" y="31.5" width="23" height="5.5" rx="2" />
        </symbol>
        <symbol id="pc-b" viewBox="0 0 45 45">
          <circle cx="22.5" cy="6.5" r="2.6" />
          <path d="M22.5 9.2c-5 3.6-7.6 8-7.1 13 .4 3.6 3 5.6 7.1 5.6s6.7-2 7.1-5.6c.5-5-2.1-9.4-7.1-13z" />
          <rect x="16" y="28" width="13" height="3.5" rx="1.5" />
          <rect x="12" y="31.5" width="21" height="5.5" rx="2" />
        </symbol>
        <symbol id="pc-n" viewBox="0 0 45 45">
          <path d="M14 31.5c0-6 3-9.2 6.2-11.6l-5.6 2.5c-1.9.8-3.9-.4-3.6-2.4.4-3.6 2.7-7.1 5.7-9.5l1.4-4.3 2.7 3.1c6.6 1.2 11.6 7.1 11.6 14.7v7.5z" />
          <rect x="11" y="31.5" width="23" height="5.5" rx="2" />
        </symbol>
        <symbol id="pc-q" viewBox="0 0 45 45">
          <path d="M11.5 30.5 9 14.5l6.8 6.8 2.4-10.6 4.3 9.6 4.3-9.6 2.4 10.6 6.8-6.8-2.5 16z" />
          <circle cx="9" cy="12.6" r="2.3" />
          <circle cx="18.2" cy="8.8" r="2.3" />
          <circle cx="26.8" cy="8.8" r="2.3" />
          <circle cx="36" cy="12.6" r="2.3" />
          <rect x="10.5" y="31.5" width="24" height="5.5" rx="2" />
        </symbol>
        <symbol id="pc-k" viewBox="0 0 45 45">
          <rect x="21" y="3.5" width="3" height="10" rx="1" />
          <rect x="17.5" y="6.5" width="10" height="3" rx="1" />
          <path d="M22.5 15c-6.5 0-10.5 3.5-10.5 8.5 0 2.7 1 5 2.5 7h16c1.5-2 2.5-4.3 2.5-7 0-5-4-8.5-10.5-8.5z" />
          <rect x="11" y="31.5" width="23" height="5.5" rx="2" />
        </symbol>
      </defs>
    </svg>
  );
}

export function GhostPiece({
  type,
  size,
  rotate,
  delay,
  style
}: {
  type: PieceType;
  size: number;
  rotate: string;
  delay?: string;
  style: CSSProperties;
}) {
  const vars = { '--r': rotate, animationDelay: delay, ...style } as CSSProperties;
  return (
    <svg className="k-ghost lp-ghost" width={size} height={size} style={vars} aria-hidden="true" focusable="false">
      <use href={`#pc-${type}`} fill="currentColor" />
    </svg>
  );
}

export function KestrelMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 15l8-10 8 10" />
      <path d="M8 20l4-5 4 5" />
    </svg>
  );
}

export function Icon({
  d,
  size,
  stroke = 'currentColor',
  width = 2.4,
  className
}: {
  d: string;
  size: number;
  stroke?: string;
  width?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export const TICK = 'M20 6L9 17l-5-5';
export const SHIELD = 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z';
export const CHEVRON = 'M6 9l6 6 6-6';

export function Padlock({ size, stroke, width, rx = 2 }: { size: number; stroke: string; width: number; rx?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="5" y="11" width="14" height="10" rx={rx} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
