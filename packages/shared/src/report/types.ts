import type { EndReason, Platform, TimeClass } from '../types.js';

// Bump when the shape or the maths changes. Cached reports with an older
// version get rebuilt on read.
export const REPORT_VERSION = 3;

export type ReportScope = TimeClass | 'all';
export const REPORT_SCOPES: readonly ReportScope[] = ['all', 'bullet', 'blitz', 'rapid', 'daily'] as const;

export interface Tally {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** 0..1, null when games is 0 */
  score: number | null;
}

export type Section<T> =
  | { enough: true; games: number; data: T }
  | { enough: false; games: number; needed: number };

export interface MoveStat {
  move: string;
  share: number;
  tally: Tally;
}

export interface OpeningVariation {
  name: string;
  eco: string | null;
  tally: Tally;
}

export interface OpeningStat {
  family: string;
  share: number;
  tally: Tally;
  /** Most common first 10 plies */
  line: string;
  variations: OpeningVariation[];
}

export interface WhiteOpenings {
  firstMoves: MoveStat[];
  openings: OpeningStat[];
}

export interface BlackOpenings {
  vsE4: MoveStat[];
  vsD4: MoveStat[];
  openings: OpeningStat[];
}

export interface FormData {
  /** newest first */
  last10: ('W' | 'D' | 'L')[];
  /** last 20 games */
  recent: Tally;
  streak: { result: 'W' | 'D' | 'L'; length: number };
}

export interface RatingData {
  /** Most played pool, e.g. "Blitz" or Lichess "Classical" */
  pool: string;
  /** Games from other pools, not charted */
  leftOut: number;
  current: number;
  change: number;
  peak: number;
  low: number;
  /** Last rating per day, oldest first, max 90 */
  history: { date: string; rating: number }[];
}

export interface OpponentsData {
  // 50-point bands either side
  higher: Tally;
  similar: Tally;
  lower: Tally;
}

export interface ClockData {
  /** Average share of starting time left, 0..1 */
  leftAt20: number | null;
  leftAt30: number | null;
  readingsAt30: number;
  under10PctAt30: number | null;
  lossesOnTime: number;
  lossesOnTimeShare: number | null;
  winsOnTime: number;
  winsOnTimeShare: number | null;
}

export interface MaterialData {
  reached: number;
  /** +2 pawns or more at move 30 */
  ahead: Tally;
  level: Tally;
  behind: Tally;
}

export interface LengthData {
  averageMoves: number;
  medianMoves: number;
  /** <= 25 moves */
  short: Tally;
  /** >= 60 moves */
  long: Tally;
}

export interface EndingsData {
  wins: Partial<Record<EndReason, number>>;
  draws: Partial<Record<EndReason, number>>;
  losses: Partial<Record<EndReason, number>>;
}

/** Only games where they made 10+ moves */
export interface CastlingData {
  kingside: number;
  queenside: number;
  none: number;
}

export interface ScheduleData {
  byHourUtc: number[];
  /** 0 = Monday */
  byWeekdayUtc: number[];
}

export interface StyleFact {
  id: string;
  /** e.g. "Plays 1.e4 in 82% of games as White" */
  text: string;
  value: number;
  games: number;
}

export interface GamePlan {
  text: string;
  /** style fact ids */
  basis: string[];
}

export interface Report {
  version: typeof REPORT_VERSION;
  platform: Platform;
  username: string;
  scope: ReportScope;
  builtAt: string;
  gamesUsed: number;
  rated: number;
  period: { from: string; to: string } | null;
  timeControls: { timeControl: string; games: number }[];
  overall: Tally;
  asWhite: Tally;
  asBlack: Tally;
  form: Section<FormData>;
  /** null for 'all' */
  rating: Section<RatingData> | null;
  opponents: Section<OpponentsData>;
  openings: {
    white: Section<WhiteOpenings>;
    black: Section<BlackOpenings>;
  };
  /** null for 'daily' */
  clock: Section<ClockData> | null;
  material: Section<MaterialData>;
  length: Section<LengthData>;
  endings: Section<EndingsData>;
  castling: Section<CastlingData>;
  schedule: Section<ScheduleData>;
  style: StyleFact[];
  plan: GamePlan | null;
}

export interface BuildReportOptions {
  platform: Platform;
  username: string;
  scope: ReportScope;
  now: Date;
}
