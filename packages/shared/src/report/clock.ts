import type { GameRow, Platform } from '../types.js';
import type { ClockData, Section } from './types.js';
import { average, ratio, section } from './tally.js';

// Clock readings are stored as a share of the starting clock so different
// time controls can be averaged together.

export const LOW_CLOCK_SHARE = 0.1;

/** "180+2" -> 180, daily -> null */
export function baseSeconds(timeControl: string): number | null {
  const m = /^(\d+)(?:\+\d+)?$/.exec(timeControl.trim());
  if (!m) return null;
  const base = Number(m[1]);
  return base > 0 ? base : null;
}

// Old Lichess rows without clockStart are skipped: they might have berserked,
// so the base time could be double the truth.
export function startingClock(g: GameRow, platform: Platform): number | null {
  if (g.clockStart != null && g.clockStart > 0) return g.clockStart;
  return platform === 'chesscom' ? baseSeconds(g.timeControl) : null;
}

// Capped at 1 since increment can push you above your starting time
function clockShare(clock: number | null, base: number): number | null {
  return clock === null ? null : Math.min(1, Math.max(0, clock / base));
}

export interface ClockResult {
  section: Section<ClockData>;
  readingsAt20: number;
  timedLosses: number;
}

export function clockSection(games: readonly GameRow[], platform: Platform): ClockResult {
  const timed = games.filter((g) => g.timeClass !== 'daily' && baseSeconds(g.timeControl) !== null);

  const at20: number[] = [];
  const at30: number[] = [];
  let losses = 0;
  let lossesOnTime = 0;
  let wins = 0;
  let winsOnTime = 0;
  for (const g of timed) {
    const start = startingClock(g, platform);
    if (start !== null) {
      const s20 = clockShare(g.clockAt20, start);
      const s30 = clockShare(g.clockAt30, start);
      if (s20 !== null) at20.push(s20);
      if (s30 !== null) at30.push(s30);
    }
    if (g.score === 0) {
      losses++;
      if (g.resultDetail === 'timeout') lossesOnTime++;
    } else if (g.score === 1) {
      wins++;
      if (g.resultDetail === 'timeout') winsOnTime++;
    }
  }

  return {
    readingsAt20: at20.length,
    timedLosses: losses,
    section: section(timed.length, () => ({
      leftAt20: average(at20),
      leftAt30: average(at30),
      readingsAt30: at30.length,
      under10PctAt30: ratio(at30.filter((s) => s < LOW_CLOCK_SHARE).length, at30.length),
      lossesOnTime,
      lossesOnTimeShare: ratio(lossesOnTime, losses),
      winsOnTime,
      winsOnTimeShare: ratio(winsOnTime, wins)
    }))
  };
}
