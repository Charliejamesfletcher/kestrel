import type { GamePlan, MoveStat, StyleFact } from './types.js';
import { FACT_MIN_NARROW_GAMES, idPart, type ReportBody, type StyleExtras } from './style.js';
import { LONG_GAME_MOVES } from './habits.js';
import { MIN_SECTION_GAMES, pct } from './tally.js';

// One line: what to expect in the opening plus at most one edge to play for.
// Each edge's effect is how many times over its threshold it is; biggest wins.

export const MAX_PLAN_LENGTH = 220;

export const PLAN_LOW_CLOCK_AT_30 = 0.15;
export const PLAN_FLAG_SHARE = 0.25;
export const PLAN_FLAG_MIN_LOSSES = 8;
export const PLAN_AHEAD_SCORE = 0.75;
export const PLAN_AHEAD_MIN_GAMES = 8;
export const PLAN_LONG_GAP = 0.12;
export const PLAN_LONG_MIN_GAMES = 10;
export const PLAN_LEVEL_GAP = 0.15;
export const PLAN_LEVEL_MIN_GAMES = 10;
export const PLAN_MIN_CLOCK_READINGS = 10;

export const EXPECT_SHARE = 0.4;

function howOften(share: number): string {
  return share >= 0.75 ? '' : share >= 0.5 ? 'usually ' : 'most often ';
}

interface Edge {
  effect: number;
  text: string;
  basis: string[];
}

function edges(r: ReportBody, extra: StyleExtras): Edge[] {
  const found: Edge[] = [];
  const overall = r.overall.score;

  const clock = r.clock?.enough ? r.clock.data : null;
  if (clock) {
    const tactic = 'keep it complicated and make them use their clock.';
    const left = clock.leftAt30;
    if (left !== null && clock.readingsAt30 >= PLAN_MIN_CLOCK_READINGS && left < PLAN_LOW_CLOCK_AT_30) {
      found.push({
        // capped so a near-zero clock doesn't drown out everything else
        effect: Math.min(10, PLAN_LOW_CLOCK_AT_30 / Math.max(left, 0.01)),
        text: `They average ${pct(left)}% of their clock left at move 30, so ${tactic}`,
        basis: ['clock']
      });
    }
    const flag = clock.lossesOnTimeShare;
    if (flag !== null && extra.timedLosses >= PLAN_FLAG_MIN_LOSSES && flag >= PLAN_FLAG_SHARE) {
      found.push({
        effect: flag / PLAN_FLAG_SHARE,
        text: `${pct(flag)}% of their losses are on time, so ${tactic}`,
        basis: ['clock', 'flag-losses']
      });
    }
  }

  const material = r.material.enough ? r.material.data : null;
  if (material) {
    const ahead = material.ahead;
    if (ahead.score !== null && ahead.games >= PLAN_AHEAD_MIN_GAMES && ahead.score < PLAN_AHEAD_SCORE) {
      found.push({
        effect: (1 - ahead.score) / (1 - PLAN_AHEAD_SCORE),
        text: `They score only ${pct(ahead.score)}% when two pawns up at move 30, so don't give up when behind.`,
        basis: ['material']
      });
    }
    const level = material.level;
    if (overall !== null && level.score !== null && level.games >= PLAN_LEVEL_MIN_GAMES && overall - level.score >= PLAN_LEVEL_GAP) {
      found.push({
        effect: (overall - level.score) / PLAN_LEVEL_GAP,
        text: `They score ${pct(level.score)}% when material is level at move 30 (${pct(overall)}% overall), so keep it balanced and play on.`,
        basis: ['material']
      });
    }
  }

  const long = r.length.enough ? r.length.data.long : null;
  if (overall !== null && long && long.score !== null && long.games >= PLAN_LONG_MIN_GAMES && overall - long.score >= PLAN_LONG_GAP) {
    found.push({
      effect: (overall - long.score) / PLAN_LONG_GAP,
      text: `They score ${pct(long.score)}% in games of ${LONG_GAME_MOVES}+ moves (${pct(overall)}% overall), so aim for long games.`,
      basis: ['length']
    });
  }

  return found.sort((a, b) => b.effect - a.effect);
}

function factOr(style: readonly StyleFact[], id: string, fallback: string): string {
  return style.some((f) => f.id === id) ? id : fallback;
}

interface Phrase {
  text: string;
  basis: string;
}

interface Reply extends Phrase {
  often: string;
}

interface OpeningParts {
  white: Phrase | null;
  blackE4: Reply | null;
  blackD4: Reply | null;
}

interface OpeningSentence {
  text: string;
  basis: string[];
}

// A 50/50 split names neither move
function expected(stats: readonly MoveStat[] | undefined): boolean {
  const [top, next] = stats ?? [];
  return top !== undefined && top.share >= EXPECT_SHARE && (next === undefined || top.share > next.share);
}

function reply(
  first: 'e4' | 'd4',
  stats: readonly MoveStat[] | undefined,
  faced: number,
  style: readonly StyleFact[]
): Reply | null {
  const top = stats?.[0];
  if (!top || faced < FACT_MIN_NARROW_GAMES || !expected(stats)) return null;
  return {
    text: `1.${first} with 1...${top.move}`,
    often: howOften(top.share),
    basis: factOr(style, `reply-${first}-${idPart(top.move)}`, 'openings.black')
  };
}

function openingParts(r: ReportBody, style: readonly StyleFact[], extra: StyleExtras): OpeningParts {
  const white = r.openings.white.enough ? r.openings.white.data : null;
  const black = r.openings.black.enough ? r.openings.black.data : null;
  const first = white?.firstMoves[0];
  return {
    white:
      first && expected(white?.firstMoves)
        ? {
            text: `as White they ${howOften(first.share)}open 1.${first.move}`,
            basis: factOr(style, `first-move-${idPart(first.move)}`, 'openings.white')
          }
        : white
          ? { text: 'as White they vary their first move', basis: 'openings.white' }
          : null,
    blackE4: reply('e4', black?.vsE4, extra.facedE4, style),
    blackD4: reply('d4', black?.vsD4, extra.facedD4, style)
  };
}

function blackText(replies: readonly Reply[]): string {
  const [a, b] = replies;
  if (!a) return '';
  if (!b) return `as Black they ${a.often}meet ${a.text}`;
  if (a.often === b.often) return `as Black they ${a.often}meet ${a.text} and ${b.text}`;
  return `as Black they ${a.often}meet ${a.text} and ${b.often}meet ${b.text}`;
}

// Fullest first; the plan takes the longest one that still fits
function openingSentences(p: OpeningParts): OpeningSentence[] {
  const combos: [Phrase | null, Reply | null, Reply | null][] = [
    [p.white, p.blackE4, p.blackD4],
    [p.white, p.blackE4, null],
    [p.white, null, null],
    [null, p.blackE4, p.blackD4],
    [null, p.blackE4, null]
  ];
  const out: OpeningSentence[] = [];
  for (const [white, e4, d4] of combos) {
    const replies = [e4, d4].filter((x): x is Reply => x !== null);
    const parts: string[] = [];
    if (white) parts.push(white.text);
    if (replies.length > 0) parts.push(blackText(replies));
    const text = parts.join('; ');
    if (text === '' || out.some((o) => o.text === text)) continue;
    out.push({ text, basis: [white, ...replies].filter((x): x is Phrase => !!x).map((x) => x.basis) });
  }
  return out;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function gamePlan(r: ReportBody, style: readonly StyleFact[], extra: StyleExtras): GamePlan | null {
  if (r.gamesUsed < MIN_SECTION_GAMES) return null;

  const opening = openingParts(r, style, extra);
  const edge = edges(r, extra)[0];
  const sentences = openingSentences(opening);

  const compose = (open: string | null): string =>
    edge
      ? open
        ? `${capitalise(open)}. ${edge.text}`
        : capitalise(edge.text)
      : open
        ? `No clear weakness found in ${r.gamesUsed} games. ${capitalise(open)}. Play solid chess.`
        : `No clear weakness found in ${r.gamesUsed} games. Play solid chess.`;

  let text = compose(null);
  let openingBasis: string[] = [];
  for (const open of sentences) {
    const candidate = compose(open.text);
    if (candidate.length <= MAX_PLAN_LENGTH) {
      text = candidate;
      openingBasis = open.basis;
      break;
    }
  }
  if (text.length > MAX_PLAN_LENGTH) text = `${text.slice(0, MAX_PLAN_LENGTH - 1)}…`;

  const basis = [...openingBasis, ...(edge?.basis ?? [])];
  return { text, basis: [...new Set(basis)] };
}
