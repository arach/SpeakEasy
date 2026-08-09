import { afterEach, describe, expect, test } from 'bun:test';
import { DeckRuntime, type DeckMessage } from './deck-runtime';

interface RuntimeInternals {
  threads: DeckMessage[][];
  playing: string | null;
  paused: boolean;
  pos: number;
  phase: string;
  devicePlaybackObservedAt: number;
  ensureTicker(): void;
}

const runtimes: DeckRuntime[] = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.destroy();
});

describe('DeckRuntime device playback', () => {
  test('completes locally after device progress expires', async () => {
    const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
    runtimes.push(runtime);
    runtime.liveClients = () => 1;
    const state = runtime as unknown as RuntimeInternals;
    state.threads[0] = [{ role: 'agent', text: 'reply', dur: 1, file: '/tmp/reply.aiff' }];
    state.playing = '0:0';
    state.paused = false;
    state.pos = 1;
    state.phase = 'speaking';
    state.devicePlaybackObservedAt = Date.now() - 11_000;
    state.ensureTicker();

    await Bun.sleep(300);

    const snapshot = runtime.snapshot();
    expect(snapshot.playing).toBeNull();
    expect(snapshot.phase).toBe('idle');
    expect(snapshot.trace[0]?.kind).toBe('PLAYBACK WATCHDOG');
    expect(snapshot.trace[0]?.detail).toContain('device progress expired');
  });

  test('keeps revisions moving while a device owns playback', async () => {
    const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
    runtimes.push(runtime);
    runtime.liveClients = () => 1;
    const state = runtime as unknown as RuntimeInternals;
    state.threads[0] = [{ role: 'agent', text: 'reply', dur: 30, file: '/tmp/reply.aiff' }];
    state.playing = '0:0';
    state.paused = false;
    state.pos = 2;
    state.phase = 'speaking';
    state.devicePlaybackObservedAt = Date.now();
    const rev = runtime.snapshot().rev;
    state.ensureTicker();

    await Bun.sleep(300);

    expect(runtime.snapshot().rev).toBeGreaterThan(rev);
    expect(runtime.snapshot().pos).toBe(2);
  });
});
