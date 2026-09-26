import { describe, expect, it } from 'vitest';
import { runLoop } from './loop.js';

describe('runLoop', () => {
  it('never runs two ticks at the same time', async () => {
    const controller = new AbortController();
    let running = 0;
    let maxRunning = 0;
    let ticks = 0;

    await runLoop(
      async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        ticks++;
        if (ticks === 5) controller.abort();
        return true;
      },
      { idleMs: 1, signal: controller.signal, onError: () => {} }
    );

    expect(ticks).toBe(5);
    expect(maxRunning).toBe(1);
  });

  it('keeps going after a failed tick', async () => {
    const controller = new AbortController();
    const errors: unknown[] = [];
    let ticks = 0;

    await runLoop(
      async () => {
        ticks++;
        if (ticks === 1) throw new Error('boom');
        controller.abort();
        return true;
      },
      { idleMs: 1, signal: controller.signal, onError: (e) => errors.push(e) }
    );

    expect(errors).toHaveLength(1);
    expect(ticks).toBe(2);
  });
});
