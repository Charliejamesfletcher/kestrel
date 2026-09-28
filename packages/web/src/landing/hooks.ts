import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { Platform } from '@kestrel/shared';
import { FINAL_PLY, LOOP_LENGTH } from './board.js';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION).matches
    : false;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Ticks every 1.4s. With reduced motion it just shows the final position. */
export function useBoardLoop(intervalMs = 1400): number {
  const reduced = useReducedMotion();
  const [ply, setPly] = useState(() => (prefersReducedMotion() ? FINAL_PLY : 0));
  useEffect(() => {
    if (reduced) {
      setPly(FINAL_PLY);
      return;
    }
    const timer = window.setInterval(() => setPly((p) => (p + 1) % LOOP_LENGTH), intervalMs);
    return () => window.clearInterval(timer);
  }, [reduced, intervalMs]);
  return ply;
}

/** Adds k-in-view to each .k-reveal the first time it scrolls into view. */
export function useRevealOnScroll(root: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>('.k-reveal'));
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('k-in-view'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('k-in-view');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [root]);
}

// Same storage key as SearchForm so both pages agree
const PLATFORM_KEY = 'kestrel.platform';

function loadPlatform(): Platform {
  try {
    return window.localStorage.getItem(PLATFORM_KEY) === 'lichess' ? 'lichess' : 'chesscom';
  } catch {
    return 'chesscom';
  }
}

export function useRememberedPlatform(): [Platform, (p: Platform) => void] {
  const [platform, setPlatform] = useState<Platform>(loadPlatform);
  const choose = useCallback((p: Platform) => {
    setPlatform(p);
    try {
      window.localStorage.setItem(PLATFORM_KEY, p);
    } catch {
    }
  }, []);
  return [platform, choose];
}

export function scrollToSection(id: string): void {
  const target = document.getElementById(id);
  target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
