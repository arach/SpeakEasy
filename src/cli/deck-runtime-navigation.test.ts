import { describe, expect, test } from 'bun:test';

import { DeckRuntime } from './deck-runtime';

type RuntimeInternals = {
  busy: boolean;
  canonicalTurnAbort: AbortController | null;
  gen: number;
  playing: string | null;
};

function runtimeInternals(runtime: DeckRuntime): RuntimeInternals {
  return runtime as unknown as RuntimeInternals;
}

describe('Deck canonical IPC lifecycle', () => {
  test('lane navigation preserves an in-flight canonical waiter and playback', async () => {
    const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
    const internal = runtimeInternals(runtime);
    const controller = new AbortController();
    internal.busy = true;
    internal.canonicalTurnAbort = controller;
    internal.gen = 41;
    internal.playing = '0:0';

    const result = await runtime.apply({ name: 'lane.select', index: 2 });

    expect(result.ok).toBe(true);
    expect(runtime.snapshot().lane).toBe(2);
    expect(internal.gen).toBe(41);
    expect(controller.signal.aborted).toBe(false);
    expect(runtime.snapshot().playing).toBe('0:0');

    internal.busy = false;
    internal.canonicalTurnAbort = null;
    runtime.destroy();
  });

  test('stop silences transport without dropping the canonical result', async () => {
    const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
    const internal = runtimeInternals(runtime);
    const controller = new AbortController();
    internal.busy = true;
    internal.canonicalTurnAbort = controller;
    internal.gen = 7;

    const result = await runtime.apply({ name: 'playback.stop' });

    expect(result.ok).toBe(true);
    expect(internal.gen).toBe(7);
    expect(controller.signal.aborted).toBe(false);
    expect(runtime.snapshot().confirm).toBe('AUDIO STOPPED · TASK CONTINUES');

    internal.busy = false;
    internal.canonicalTurnAbort = null;
    runtime.destroy();
  });

  test('a second capture is rejected without cancelling the current turn', async () => {
    const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
    const internal = runtimeInternals(runtime);
    const controller = new AbortController();
    internal.busy = true;
    internal.canonicalTurnAbort = controller;
    internal.gen = 13;

    const result = await runtime.apply({ name: 'capture.start' });

    expect(result).toMatchObject({ ok: false, error: 'response already in flight' });
    expect(internal.gen).toBe(13);
    expect(controller.signal.aborted).toBe(false);
    expect(runtime.snapshot().listening).toBe(false);

    internal.busy = false;
    internal.canonicalTurnAbort = null;
    runtime.destroy();
  });
});
