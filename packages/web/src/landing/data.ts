// Landing page copy and demo data. The demo player (rook_and_roll_22) is made
// up; never show these numbers next to a real username.

export const DEMO_NAME = 'rook_and_roll_22';

export const USERNAME_ERROR = 'Usernames are 2–30 letters, numbers, underscores or hyphens.';

export const NAV_LINKS = [
  { href: '#demo', label: 'Try it' },
  { href: '#features', label: 'Features' },
  { href: '#fair', label: 'Fair play' },
  { href: '#pricing', label: 'Pricing' }
] as const;

export const HERO = {
  chip: 'NEW',
  chipText: 'Works on Chess.com and Lichess',
  title: 'Know your opponent before the first move.',
  lede: 'Kestrel scouts any player in seconds: their favourite openings, weak spots and bad habits. Sit down prepared and win more games.',
  label: 'Who are you playing next?',
  placeholder: 'Enter their username',
  button: 'Scout for free',
  reassure: ['Free forever plan', 'No password needed', 'Fair-play safe']
} as const;

export const WORKS_ON = ['Works on Chess.com', 'Works on Lichess', 'Bullet, blitz, rapid and daily', 'Reports in seconds'] as const;

/* ---------- Animated hero board ---------- */

/** 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 */
export const BOARD_MOVES: readonly (readonly [string, string])[] = [
  ['e2', 'e4'],
  ['e7', 'e5'],
  ['g1', 'f3'],
  ['b8', 'c6'],
  ['f1', 'c4'],
  ['f8', 'c5']
];

export const BOARD_SAN = ['1. e4', 'e5', '2. Nf3', 'Nc6', '3. Bc4', 'Bc5'] as const;

export const BOARD_NOTES: readonly { text: string; pct: number }[] = [
  { text: 'Scouting rook_and_roll_22 · 312 games', pct: 0 },
  { text: 'Against 1.e4 they answer 1…e5 most often', pct: 62 },
  { text: '1…e5, their main defence, as expected', pct: 62 },
  { text: 'After 2.Nf3 they almost always play 2…Nc6', pct: 71 },
  { text: '2…Nc6, right on script', pct: 71 },
  { text: '3.Bc4 is your best-scoring line against them', pct: 44 },
  { text: 'Italian Game reached. They score just 41% here', pct: 44 }
];

/* ---------- Demo report (sample data) ---------- */

export const DEMO = {
  eyebrow: 'Try it now, no install needed',
  title: 'Every habit they have, on one screen.',
  intro: "Type any username and press Scout. This preview shows sample data so you can see exactly what you'll get.",
  tag: 'Example report · sample data',
  inputLabel: 'Opponent username',
  button: 'Scout',
  subtitle: 'Rapid 1487 · 312 games scanned',
  scanTitle: 'Scanning public games…',
  scanSteps: ['Fetching rapid and blitz games', 'Sorting openings', 'Checking clock and endgames'],
  stats: [
    { value: '52%', label: 'Win rate', tone: 'plain' },
    { value: '34%', label: 'Lost on time', tone: 'warn' },
    { value: '+38', label: 'Last 30 days', tone: 'good' }
  ],
  planLabel: 'Your game plan',
  plan: "Scores worst against 1.d4 and in long endgames. Go for a slower queen's-pawn game and keep it complex past move 30.",
  sampleNote: 'This preview always shows sample data.',
  cta: 'Like what you see? Get reports for every opponent.',
  ctaButton: 'Add Kestrel to Chrome, free'
} as const;

export type Tone = 'plain' | 'warn' | 'good';

export const DEMO_TABS = [
  { id: 'openings', label: 'Openings' },
  { id: 'weak', label: 'Weak spots' },
  { id: 'form', label: 'Form' }
] as const;
export type DemoTab = (typeof DEMO_TABS)[number]['id'];

export const SIDES = [
  { id: 'white', label: 'As White' },
  { id: 'black', label: 'As Black' }
] as const;
export type Side = (typeof SIDES)[number]['id'];

export interface OpeningRow {
  name: string;
  moves: string;
  share: number;
  score: number;
}

export const OPENINGS: Record<Side, readonly OpeningRow[]> = {
  white: [
    { name: 'Italian Game', moves: '1.e4 e5 2.Nf3 Nc6 3.Bc4', share: 41, score: 58 },
    { name: 'London System', moves: '1.d4 d5 2.Bf4', share: 27, score: 51 },
    { name: 'Scotch Game', moves: '1.e4 e5 2.Nf3 Nc6 3.d4', share: 14, score: 62 },
    { name: 'Vienna Game', moves: '1.e4 e5 2.Nc3', share: 10, score: 37 }
  ],
  black: [
    { name: 'Caro-Kann Defence', moves: '1.e4 c6', share: 38, score: 49 },
    { name: 'Scandinavian Defence', moves: '1.e4 d5', share: 25, score: 55 },
    { name: "King's Indian Defence", moves: '1.d4 Nf6 2.c4 g6', share: 21, score: 36 },
    { name: "Queen's Gambit Declined", moves: '1.d4 d5 2.c4 e6', share: 16, score: 44 }
  ]
};

export const OPENINGS_KEY = { weakest: 'Their weakest line: steer here', other: 'Other lines' } as const;

export interface WeakSpot {
  title: string;
  detail: string;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const WEAK_SPOTS: readonly WeakSpot[] = [
  {
    title: 'Clock trouble after move 30',
    detail: '34% of their losses are on time, usually with under 20 seconds left in a level or better position.',
    level: 'HIGH'
  },
  {
    title: 'Long endgames',
    detail: 'Converts only 41% of endgames when a pawn up. Trading pieces early plays into this.',
    level: 'HIGH'
  },
  { title: "Queen's-pawn openings", detail: 'Scores 39% against 1.d4, compared with 55% against 1.e4.', level: 'MEDIUM' },
  { title: 'Late-night tilt', detail: 'Loses 41 rating points on average in sessions past midnight.', level: 'LOW' }
];

export const FREE_WEAK_SPOTS = 2;

export const LOCKED = { text: '2 more weak spots found', button: 'Unlock with Pro' } as const;

/** oldest first */
export const RESULTS = 'WLWDWLLWDWWW';

export const HOURS = [6, 3, 1, 0, 0, 0, 0, 1, 2, 3, 4, 5, 8, 7, 5, 6, 9, 12, 15, 19, 24, 28, 26, 14] as const;

export const PEAK_HOURS = { from: 20, to: 22 } as const;

export const FORM = {
  resultsLabel: 'Last 12 games, oldest to newest',
  hoursLabel: 'When they play (games per hour)',
  hourTicks: ['00:00', '06:00', '12:00', '18:00', '23:00'],
  stats: [
    { value: '3 wins', label: 'Current streak', tone: 'plain' },
    { value: '9–11pm', label: 'Most active', tone: 'plain' },
    { value: '−41', label: 'After midnight', tone: 'warn' }
  ]
} as const;

/* ---------- Features ---------- */

export const ICONS = {
  scout: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6M11 8v6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M9 7h6M9 11h6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  king: 'M12 3v4M10 5h4M7 21h10M8 21l1-9h6l1 9M9 12a3 3 0 0 1 6 0',
  coach: 'M4 19l5-6 4 3 7-9M15 7h5v5',
  team: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M14 15c3 0 8 1 8 5'
} as const;

export const FEATURES_HEAD = { eyebrow: 'Features', title: 'Scout smarter. Then keep getting better.' } as const;

export const FEATURES: readonly { icon: keyof typeof ICONS; title: string; body: string; pro: boolean }[] = [
  {
    icon: 'scout',
    title: 'Opponent scouting',
    body: 'Openings they play, lines they lose with and how they handle the clock, from their public games in seconds.',
    pro: false
  },
  {
    icon: 'book',
    title: 'Repertoire builder',
    body: 'Kestrel reads your own games and shows which openings win you points and which to drop.',
    pro: true
  },
  {
    icon: 'clock',
    title: 'Time-trouble radar',
    body: 'See exactly when an opponent starts burning their clock, so you know what kind of game to aim for.',
    pro: false
  },
  {
    icon: 'king',
    title: 'Endgame profile',
    body: 'Find out whether they convert winning endgames or crumble once the pieces come off.',
    pro: true
  },
  {
    icon: 'coach',
    title: 'Post-game coach',
    body: 'Plain-English breakdowns of the moments that decided your game, and the patterns across your losses.',
    pro: true
  },
  {
    icon: 'team',
    title: 'Club & team prep',
    body: 'Captains get a report on every player in the opposing team before a club or school match.',
    pro: true
  }
];

/* ---------- How it works ---------- */

export const HOW_HEAD = { eyebrow: 'How it works', title: 'Set up in under a minute.' } as const;

export const STEPS = [
  { title: 'Add to Chrome', body: 'Install Kestrel in one click. No account needed to start.' },
  { title: 'Scout before you play', body: 'Look up anyone before a challenge, tournament round or club match.' },
  { title: 'Play clean', body: 'Kestrel locks itself for the whole of every live game.' },
  { title: 'Review and improve', body: 'See what decided the game and which openings work for you.' }
] as const;

export const STEP_PREVIEWS = {
  install: {
    name: 'Kestrel',
    store: 'Chrome Web Store',
    button: 'Add to Chrome',
    caption: 'One click. No account needed to start.'
  },
  scout: {
    eyebrow: 'TOURNAMENT · ROUND 4',
    pairing: `You vs ${DEMO_NAME}`,
    button: 'Scout',
    cards: [
      { label: 'As Black', value: 'Caro-Kann, 38%', tone: 'plain' },
      { label: 'Weak spot', value: 'Clock after move 30', tone: 'warn' }
    ],
    caption: 'Built from their public games before the round starts.'
  },
  lock: {
    title: 'Game on. Kestrel is locked.',
    body: 'Nothing shows while you play. No reports, no hints. Just you and the board.'
  },
  review: {
    eyebrow: 'AFTER THE GAME',
    cards: [
      {
        title: 'Move 23 decided it',
        body: 'You traded into an endgame where their king was more active. Same pattern as 3 of your last 10 losses.'
      },
      { title: 'Your best opening', body: 'London System: 11 games, 64% score. Keep it as your main weapon.' }
    ]
  }
} as const;

/* ---------- Fair play ---------- */

export const FAIR = {
  badge: 'Fair play first',
  title: 'Preparation, never assistance.',
  body: 'Studying an opponent before you play them is what strong players have always done. Getting help during a game is cheating. Kestrel stays firmly on the right side of that line, so your account stays safe.',
  rules: [
    { title: 'Locks during games', body: 'Everything hides the moment a live game starts.' },
    { title: 'No move suggestions', body: 'Kestrel never calculates or recommends moves.' },
    { title: 'Public data only', body: 'Only games anyone can already see on a profile.' },
    { title: 'No password needed', body: 'We never ask for your chess account login.' }
  ]
} as const;

/* ---------- Pricing ---------- */

export const PRICING_HEAD = {
  eyebrow: 'Pricing',
  title: "Start free. Upgrade when you're winning.",
  monthly: 'Monthly',
  yearly: 'Yearly',
  save: 'SAVE 17%',
  footnote: 'Prices in GBP. Cancel any time from the extension settings.'
} as const;

export interface Plan {
  name: string;
  price: string;
  was: string | null;
  per: string;
  blurb: string;
  items: readonly string[];
  cta: string;
  href: string;
  fine: string;
  featured: boolean;
}

export function plans(yearly: boolean): Plan[] {
  return [
    {
      name: 'Free',
      price: '£0',
      was: null,
      per: 'forever',
      blurb: 'For casual players who want an edge in the odd big game.',
      items: ['5 scouting reports a week', 'Openings as White and Black', 'Recent form and results', 'Fair-play lock'],
      cta: 'Get it free',
      href: '#get',
      fine: 'No card needed',
      featured: false
    },
    {
      name: 'Pro',
      price: yearly ? '£4.16' : '£4.99',
      was: yearly ? '£4.99' : null,
      per: yearly ? '/month, billed £49.90 a year' : '/month',
      blurb: 'For players climbing the ladder or entering tournaments.',
      items: [
        'Unlimited scouting reports',
        'All weak spots, clock and endgame profiles',
        'Post-game coach',
        'Repertoire builder',
        'Everything in Free'
      ],
      cta: 'Start 7-day free trial',
      href: '#early-access',
      fine: 'Free for 7 days, then cancel any time',
      featured: true
    },
    {
      name: 'Club',
      // no yearly Club price yet
      price: '£19',
      was: null,
      per: '/month',
      blurb: 'For school, university and local chess clubs.',
      items: ['Pro for up to 30 members', 'Team match scouting', 'Shared prep boards for captains', 'Club leaderboards'],
      cta: 'Set up your club',
      href: '#early-access',
      fine: yearly ? 'Yearly billing coming soon' : 'One bill for the whole club',
      featured: false
    }
  ];
}

export const MOST_POPULAR = 'Most popular';

/* ---------- FAQ ---------- */

export const FAQ_HEAD = { eyebrow: 'FAQ', title: 'Questions, answered.' } as const;

export const FAQS = [
  {
    q: 'Is Kestrel allowed on Chess.com and Lichess?',
    a: 'Kestrel is built for preparation, which is allowed. It only works before and after games, locks itself while a game is live, and never suggests moves. Each site’s own fair-play rules are always the final word, so check them if you’re unsure.'
  },
  {
    q: 'Will it put my chess account at risk?',
    a: 'Kestrel never asks for your password and never touches a live game, so it can’t play or act for you. It only reads public game data.'
  },
  {
    q: 'Where does the data come from?',
    a: 'From public game archives that anyone can view on a player’s profile, through the sites’ public APIs.'
  },
  {
    q: 'Can someone scout me?',
    a: 'Your public games are visible to anyone, with or without Kestrel. Scouting yourself is one of the best ways to see what opponents will notice.'
  },
  {
    q: 'Can I cancel Pro any time?',
    a: 'Yes. Cancel in the extension settings and you keep Pro until the end of the period you paid for. You won’t be charged during the 7-day trial if you cancel before it ends.'
  }
] as const;

/* ---------- Final call to action, early access, footer ---------- */

export const FINAL_CTA = {
  title: 'Your next opponent already has weaknesses. Find them first.',
  body: '5 free reports every week. No card, no password, no catch.',
  label: 'Opponent username',
  before: 'Or ',
  link: 'add Kestrel to Chrome',
  after: ' and scout from any profile page.'
} as const;

export const EARLY_ACCESS = {
  title: 'Get early access',
  body: "The Chrome extension and Pro are coming. Leave your email and we'll tell you when they're ready.",
  label: 'Email address',
  placeholder: 'you@example.com',
  button: 'Get early access',
  invalid: 'Please enter a valid email address, like name@example.com.',
  thanks: 'Thanks! We’ll email you when it’s ready.'
} as const;

export const FOOTER = {
  year: '© 2026',
  note: 'Not affiliated with Chess.com or Lichess. Uses public game data only.',
  // TODO: real legal pages
  links: [
    { href: '#top', label: 'Privacy' },
    { href: '#top', label: 'Terms' },
    { href: '#top', label: 'Contact' }
  ]
} as const;
