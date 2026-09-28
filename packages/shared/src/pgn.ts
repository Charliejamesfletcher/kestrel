// Minimal PGN reading: SAN moves and clocks. Regex only, since a full replay
// is ~500x slower.

const TOKEN = /\{[^}]*\}|\([^)]*\)|[^\s{}()]+/g;
const MOVE_NUMBER = /^\d+\.+/;
const RESULT = /^(1-0|0-1|1\/2-1\/2|\*)$/;
const CLOCK = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/;

export interface Movetext {
  sans: string[];
  /** Seconds left after each ply */
  clocks: (number | null)[];
}

export function pgnHeader(pgn: string, name: string): string | null {
  const m = pgn.match(new RegExp(`^\\[${name} "([^"]*)"\\]`, 'm'));
  return m?.[1] ?? null;
}

export function readMovetext(pgn: string): Movetext {
  const body = pgn.replace(/^\[.*\]\s*$/gm, '');
  const sans: string[] = [];
  const clocks: (number | null)[] = [];

  for (const [token] of body.matchAll(TOKEN)) {
    if (token.startsWith('{')) {
      const clk = token.match(CLOCK);
      if (clk && sans.length > 0) {
        clocks[sans.length - 1] = Number(clk[1]) * 3600 + Number(clk[2]) * 60 + Number(clk[3]);
      }
      continue;
    }
    if (token.startsWith('(') || token.startsWith('$') || RESULT.test(token)) continue;
    const san = token.replace(MOVE_NUMBER, '');
    if (san) {
      sans.push(san);
      clocks.push(null);
    }
  }
  return { sans, clocks };
}

// White's nth move is ply 2n-2, Black's 2n-1
export function clockAfterMove(
  clocks: readonly (number | null)[],
  colour: 'white' | 'black',
  n: number
): number | null {
  return clocks[2 * (n - 1) + (colour === 'white' ? 0 : 1)] ?? null;
}

export function lineFields(sans: readonly string[]) {
  return {
    openingLine: sans.slice(0, 20).join(' '),
    movetext: sans.join(' '),
    moves: Math.ceil(sans.length / 2)
  };
}
