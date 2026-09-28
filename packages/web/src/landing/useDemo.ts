import { useCallback, useEffect, useRef, useState } from 'react';
import type { Platform } from '@kestrel/shared';
import { readSearchInput } from '../format.js';
import { DEMO_NAME, type DemoTab, type Side } from './data.js';

const SCAN_MS = 1700;

export type DemoPhase = 'ready' | 'scanning';

export interface OtherName {
  platform: Platform;
  username: string | null;
}

export interface DemoState {
  phase: DemoPhase;
  query: string;
  setQuery: (q: string) => void;
  tab: DemoTab;
  setTab: (t: DemoTab) => void;
  side: Side;
  setSide: (s: Side) => void;
  other: OtherName | null;
  /** Always shows the sample player, whatever was typed. */
  scan: (input: string, platform: Platform) => void;
}

export function useDemo(): DemoState {
  const [phase, setPhase] = useState<DemoPhase>('ready');
  const [query, setQuery] = useState(DEMO_NAME);
  const [tab, setTab] = useState<DemoTab>('openings');
  const [side, setSide] = useState<Side>('black');
  const [other, setOther] = useState<OtherName | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const scan = useCallback((input: string, platform: Platform) => {
    const text = input.trim() || DEMO_NAME;
    const read = readSearchInput(text);
    const isSample = read.username === DEMO_NAME;
    setOther(isSample ? null : { platform: read.platform ?? platform, username: read.username });
    setQuery(text);
    setTab('openings');
    setPhase('scanning');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase('ready'), SCAN_MS);
  }, []);

  return { phase, query, setQuery, tab, setTab, side, setSide, other, scan };
}
