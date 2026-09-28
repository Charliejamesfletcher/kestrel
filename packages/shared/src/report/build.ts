import type { GameRow } from '../types.js';
import { REPORT_VERSION, type BuildReportOptions, type Report } from './types.js';
import { clockSection } from './clock.js';
import { castlingSection, endingsSection, lengthSection, scheduleSection } from './habits.js';
import { materialSection } from './material-section.js';
import { blackOpenings, facedCount, whiteOpenings } from './openings.js';
import { gamePlan } from './plan.js';
import { formSection, opponentsSection, ratingSection } from './results.js';
import { endedMs, selectGames } from './select.js';
import { styleFacts, type ReportBody } from './style.js';
import { biggestFirst, groupBy, tally } from './tally.js';

export const MAX_TIME_CONTROLS = 5;

/** Pure: same games and `now` always give the same report. */
export function buildReport(games: readonly GameRow[], opts: BuildReportOptions): Report {
  const used = selectGames(games, opts.scope);
  const white = used.filter((g) => g.colour === 'white');
  const black = used.filter((g) => g.colour === 'black');
  const clock = opts.scope === 'daily' ? null : clockSection(used, opts.platform);

  const newest = used[0];
  const oldest = used[used.length - 1];

  const body: ReportBody = {
    version: REPORT_VERSION,
    platform: opts.platform,
    username: opts.username,
    scope: opts.scope,
    builtAt: opts.now.toISOString(),
    gamesUsed: used.length,
    rated: used.filter((g) => g.rated).length,
    period:
      newest && oldest
        ? { from: new Date(endedMs(oldest)).toISOString(), to: new Date(endedMs(newest)).toISOString() }
        : null,
    timeControls: biggestFirst(groupBy(used, (g) => g.timeControl))
      .slice(0, MAX_TIME_CONTROLS)
      .map(([timeControl, gs]) => ({ timeControl, games: gs.length })),
    overall: tally(used),
    asWhite: tally(white),
    asBlack: tally(black),
    form: formSection(used),
    rating: opts.scope === 'all' ? null : ratingSection(used, opts.platform),
    opponents: opponentsSection(used),
    openings: { white: whiteOpenings(white), black: blackOpenings(black) },
    clock: clock?.section ?? null,
    material: materialSection(used),
    length: lengthSection(used),
    endings: endingsSection(used),
    castling: castlingSection(used),
    schedule: scheduleSection(used)
  };

  const extras = {
    readingsAt20: clock?.readingsAt20 ?? 0,
    timedLosses: clock?.timedLosses ?? 0,
    facedE4: facedCount(black, 'e4'),
    facedD4: facedCount(black, 'd4')
  };
  const style = styleFacts(body, extras);
  return { ...body, style, plan: gamePlan(body, style, extras) };
}
