export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

/**
 * Runs `tick` strictly one at a time until stopped. This is the heart of
 * "one request at a time": the next tick never starts before the last one
 * finished. `tick` returns true when it did work (run again straight away)
 * or false when idle (wait `idleMs` before checking again).
 */
export async function runLoop(
  tick: () => Promise<boolean>,
  { idleMs, signal, onError }: { idleMs: number; signal: AbortSignal; onError: (err: unknown) => void }
): Promise<void> {
  while (!signal.aborted) {
    let didWork = false;
    try {
      didWork = await tick();
    } catch (err) {
      onError(err);
    }
    if (!didWork && !signal.aborted) await sleep(idleMs, signal);
  }
}
