import type { Report, Section, StyleFact } from './types.js';
import { CASTLING_MIN_MOVES, SHORT_GAME_MOVES } from './habits.js';
import { compareText, pct, ratio } from './tally.js';

// Style facts are measured statements ("Castles queenside in 40% of games"),
// never judgements. Each one is ranked by how far past its threshold it is.

export type ReportBody = Omit<Report, 'style' | 'plan'>;

export interface StyleExtras {
  readingsAt20: number;
  timedLosses: number;
  facedE4: number;
  facedD4: number;
}

export const MAX_STYLE_FACTS = 8;

export const FACT_MIN_GAMES = 10;
export const FACT_MIN_NARROW_GAMES = 8;

export const FIRST_MOVE_SHARE = 0.5;
export const REPLY_SHARE = 0.5;
export const TOP_FAMILY_SHARE = 0.25;
export const TOP_FAMILY_MIN_GAMES = 5;
export const QUEENSIDE_SHARE = 0.2;
export const NO_CASTLE_SHARE = 0.3;
export const LOW_CLOCK_AT_20 = 0.45;
export const LOW_CLOCK_AT_30 = 0.3;
export const UNDER_10_SHARE = 0.15;
export const FLAG_LOSS_SHARE = 0.2;
export const AHEAD_SCORE = 0.85;
export const BEHIND_SCORE = 0.35;
export const SHORT_WIN_SHARE = 0.3;
export const RESIGN_SHARE = 0.8;
export const MATED_SHARE = 0.2;

interface Candidate {
  fact: StyleFact;
  strength: number;
}

export function idPart(move: string): string {
  return move.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function nameable(family: string): boolean {
  return family !== 'Other' && !/^[A-E]\d\d$/.test(family);
}

function above(value: number, threshold: number, max = 1): number {
  return Math.min(1, (value - threshold) / (max - threshold));
}

function below(value: number, threshold: number): number {
  return Math.min(1, (threshold - value) / threshold);
}

function data<T>(s: Section<T> | null): T | null {
  return s?.enough ? s.data : null;
}

export function styleFacts(r: ReportBody, extra: StyleExtras): StyleFact[] {
  const out: Candidate[] = [];
  const add = (id: string, text: string, value: number, games: number, strength: number): void => {
    out.push({ fact: { id, text, value, games }, strength });
  };

  const white = data(r.openings.white);
  const top = white?.firstMoves[0];
  if (white && top && top.share >= FIRST_MOVE_SHARE) {
    const n = r.openings.white.games;
    add(
      `first-move-${idPart(top.move)}`,
      `Plays 1.${top.move} in ${pct(top.share)}% of games as White (${n} games)`,
      top.share,
      n,
      above(top.share, FIRST_MOVE_SHARE)
    );
  }

  const black = data(r.openings.black);
  for (const [first, replies, faced] of [
    ['e4', black?.vsE4, extra.facedE4],
    ['d4', black?.vsD4, extra.facedD4]
  ] as const) {
    const main = replies?.[0];
    if (main && faced >= FACT_MIN_NARROW_GAMES && main.share >= REPLY_SHARE) {
      add(
        `reply-${first}-${idPart(main.move)}`,
        `Answers 1.${first} with 1...${main.move} in ${pct(main.share)}% of games (${faced} games)`,
        main.share,
        faced,
        above(main.share, REPLY_SHARE)
      );
    }
  }

  // Sites name games after either side's choice, so don't say "plays the X"
  for (const [colour, label, stats, games] of [
    ['white', 'White', white?.openings, r.openings.white.games],
    ['black', 'Black', black?.openings, r.openings.black.games]
  ] as const) {
    const fam = stats?.[0];
    if (fam && nameable(fam.family) && fam.tally.games >= TOP_FAMILY_MIN_GAMES && fam.share >= TOP_FAMILY_SHARE) {
      add(
        `top-opening-${colour}`,
        `Most common opening in their games as ${label}: ${fam.family} (${pct(fam.share)}% of ${games} games)`,
        fam.share,
        games,
        above(fam.share, TOP_FAMILY_SHARE)
      );
    }
  }

  const castling = data(r.castling);
  if (castling) {
    const n = r.castling.games;
    const queenside = castling.queenside / n;
    const none = castling.none / n;
    if (queenside >= QUEENSIDE_SHARE) {
      add(
        'castles-queenside',
        `Castles queenside in ${pct(queenside)}% of games (${n} games)`,
        queenside,
        n,
        above(queenside, QUEENSIDE_SHARE)
      );
    }
    if (none >= NO_CASTLE_SHARE) {
      add(
        'no-castling',
        `Doesn't castle in ${pct(none)}% of games of ${CASTLING_MIN_MOVES}+ moves (${n} games)`,
        none,
        n,
        above(none, NO_CASTLE_SHARE)
      );
    }
  }

  const clock = data(r.clock);
  if (clock) {
    if (clock.leftAt20 !== null && extra.readingsAt20 >= FACT_MIN_GAMES && clock.leftAt20 <= LOW_CLOCK_AT_20) {
      add(
        'low-clock-20',
        `Has ${pct(clock.leftAt20)}% of their starting time left after move 20 on average (${extra.readingsAt20} games)`,
        clock.leftAt20,
        extra.readingsAt20,
        below(clock.leftAt20, LOW_CLOCK_AT_20)
      );
    }
    if (clock.leftAt30 !== null && clock.readingsAt30 >= FACT_MIN_GAMES && clock.leftAt30 <= LOW_CLOCK_AT_30) {
      add(
        'low-clock-30',
        `Has ${pct(clock.leftAt30)}% of their starting time left after move 30 on average (${clock.readingsAt30} games)`,
        clock.leftAt30,
        clock.readingsAt30,
        below(clock.leftAt30, LOW_CLOCK_AT_30)
      );
    }
    const under = clock.under10PctAt30;
    if (under !== null && clock.readingsAt30 >= FACT_MIN_GAMES && under >= UNDER_10_SHARE) {
      add(
        'under-10-at-30',
        `Has under 10% of their starting time left at move 30 in ${pct(under)}% of games (${clock.readingsAt30} games)`,
        under,
        clock.readingsAt30,
        above(under, UNDER_10_SHARE)
      );
    }
    const losses = extra.timedLosses;
    if (clock.lossesOnTimeShare !== null && losses >= FACT_MIN_NARROW_GAMES && clock.lossesOnTimeShare >= FLAG_LOSS_SHARE) {
      add(
        'flag-losses',
        `Loses on time in ${pct(clock.lossesOnTimeShare)}% of their losses (${losses} losses)`,
        clock.lossesOnTimeShare,
        losses,
        above(clock.lossesOnTimeShare, FLAG_LOSS_SHARE)
      );
    }
  }

  const material = data(r.material);
  if (material) {
    const { ahead, behind } = material;
    if (ahead.score !== null && ahead.games >= FACT_MIN_NARROW_GAMES && ahead.score < AHEAD_SCORE) {
      add(
        'score-when-ahead',
        `Scores ${pct(ahead.score)}% when two or more pawns up at move 30 (${ahead.games} games)`,
        ahead.score,
        ahead.games,
        below(ahead.score, AHEAD_SCORE)
      );
    }
    if (behind.score !== null && behind.games >= FACT_MIN_NARROW_GAMES && behind.score >= BEHIND_SCORE) {
      add(
        'score-when-behind',
        `Scores ${pct(behind.score)}% when two or more pawns down at move 30 (${behind.games} games)`,
        behind.score,
        behind.games,
        above(behind.score, BEHIND_SCORE)
      );
    }
  }

  const length = data(r.length);
  const shortWins = length ? ratio(length.short.wins, r.overall.wins) : null;
  if (shortWins !== null && r.overall.wins >= FACT_MIN_GAMES && shortWins >= SHORT_WIN_SHARE) {
    add(
      'short-wins',
      `Wins ${pct(shortWins)}% of their won games in ${SHORT_GAME_MOVES} moves or fewer (${r.overall.wins} wins)`,
      shortWins,
      r.overall.wins,
      above(shortWins, SHORT_WIN_SHARE)
    );
  }

  const endings = data(r.endings);
  const losses = r.overall.losses;
  if (endings && losses >= FACT_MIN_GAMES) {
    const resigned = (endings.losses.resign ?? 0) / losses;
    const mated = (endings.losses.checkmate ?? 0) / losses;
    if (resigned >= RESIGN_SHARE) {
      add(
        'resigns-losses',
        `Resigns in ${pct(resigned)}% of their losses (${losses} losses)`,
        resigned,
        losses,
        above(resigned, RESIGN_SHARE)
      );
    }
    if (mated >= MATED_SHARE) {
      add(
        'mated-losses',
        `Gets checkmated in ${pct(mated)}% of their losses (${losses} losses)`,
        mated,
        losses,
        above(mated, MATED_SHARE)
      );
    }
  }

  const higher = data(r.opponents)?.higher;
  if (higher && higher.score !== null && higher.games >= FACT_MIN_GAMES) {
    add(
      'vs-higher-rated',
      `Scores ${pct(higher.score)}% against opponents rated 50+ points higher (${higher.games} games)`,
      higher.score,
      higher.games,
      Math.abs(higher.score - 0.5)
    );
  }

  return out
    .sort((a, b) => b.strength - a.strength || b.fact.games - a.fact.games || compareText(a.fact.id, b.fact.id))
    .slice(0, MAX_STYLE_FACTS)
    .map((c) => c.fact);
}
