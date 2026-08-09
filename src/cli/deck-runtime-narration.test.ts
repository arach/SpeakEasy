import { afterEach, describe, expect, test } from 'bun:test';
import { DeckRuntime, measureSegmentDurations, type DeckMessage } from './deck-runtime';

/**
 * Long replies are narrated as several ordered audio segments. The regression
 * guarded here is the completion boundary: finishing one segment must hand off
 * to the next, and only the last segment may end the narration.
 */

const created: DeckRuntime[] = [];

function runtimeWithSegments(durations: number[]): {
  runtime: DeckRuntime;
  message: DeckMessage;
  id: string;
} {
  const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
  created.push(runtime);
  // Pretend a deck is connected so the transport stays device-owned and no
  // afplay process is spawned during the test.
  runtime.liveClients = () => 1;

  const message: DeckMessage = {
    role: 'agent',
    text: 'a reply far longer than one provider request',
    dur: durations.reduce((total, d) => total + d, 0),
    segments: durations.map((_, i) => `/tmp/reply-${i}.mp3`),
    segmentUrls: durations.map((_, i) => `/audio/reply-${i}.mp3`),
    segmentDurs: [...durations],
  };

  const internals = runtime as unknown as {
    threads: DeckMessage[][];
    playing: string | null;
    segIx: number;
    focusSegment: (msg: DeckMessage, ix: number) => void;
  };
  internals.threads[0] = [message];
  internals.playing = '0:0';
  internals.segIx = 0;
  internals.focusSegment(message, 0);

  return { runtime, message, id: '0:0' };
}

afterEach(() => {
  while (created.length) created.pop()?.destroy();
});

describe('segmented narration playback', () => {
  test('a finished segment hands off to the next instead of ending narration', async () => {
    const { runtime, message, id } = runtimeWithSegments([30, 30, 25]);

    expect(runtime.snapshot().segCount).toBe(3);
    expect(runtime.snapshot().segIx).toBe(0);
    expect(message.audioUrl).toBe('/audio/reply-0.mp3');

    await runtime.apply({ name: 'playback.ended', id });

    // still narrating — this is exactly where a long reply used to stop
    expect(runtime.snapshot().playing).toBe(id);
    expect(runtime.snapshot().segIx).toBe(1);
    expect(message.audioUrl).toBe('/audio/reply-1.mp3');
  });

  test('only the last segment completes the narration', async () => {
    const { runtime, id } = runtimeWithSegments([30, 30, 25]);

    await runtime.apply({ name: 'playback.ended', id });
    await runtime.apply({ name: 'playback.ended', id });
    expect(runtime.snapshot().playing).toBe(id);
    expect(runtime.snapshot().segIx).toBe(2);

    await runtime.apply({ name: 'playback.ended', id });
    expect(runtime.snapshot().playing).toBeNull();
    expect(runtime.snapshot().segIx).toBe(0);
  });

  test('segments are handed over in order', async () => {
    const { runtime, message, id } = runtimeWithSegments([10, 10, 10, 10]);
    const seen: (string | undefined)[] = [message.audioUrl];

    for (let i = 0; i < 3; i++) {
      await runtime.apply({ name: 'playback.ended', id });
      seen.push(message.audioUrl);
    }

    expect(seen).toEqual([
      '/audio/reply-0.mp3',
      '/audio/reply-1.mp3',
      '/audio/reply-2.mp3',
      '/audio/reply-3.mp3',
    ]);
  });

  test('narration position accumulates across segments', async () => {
    const { runtime, id } = runtimeWithSegments([30, 30, 25]);

    await runtime.apply({ name: 'playback.ended', id });
    expect(runtime.snapshot().segStart).toBe(30);

    // the device reports a position inside the segment it is playing
    await runtime.apply({ name: 'playback.progress', id, pos: 12 });
    expect(runtime.snapshot().pos).toBe(42);

    await runtime.apply({ name: 'playback.ended', id });
    expect(runtime.snapshot().segStart).toBe(60);
    await runtime.apply({ name: 'playback.progress', id, pos: 5 });
    expect(runtime.snapshot().pos).toBe(65);
  });

  test('a whole narration outlasts the forty seconds it used to stop at', async () => {
    const { runtime, id } = runtimeWithSegments([30, 30, 25]);

    let elapsed = 0;
    for (let i = 0; i < 3; i++) {
      const before = runtime.snapshot();
      elapsed = before.segStart;
      await runtime.apply({ name: 'playback.ended', id });
    }

    // the last segment began well past the old ceiling
    expect(elapsed).toBeGreaterThan(40);
    expect(runtime.snapshot().playing).toBeNull();
  });

  test('a single-segment reply still ends on its first completion', async () => {
    const { runtime, id } = runtimeWithSegments([12]);

    await runtime.apply({ name: 'playback.ended', id });

    expect(runtime.snapshot().playing).toBeNull();
    expect(runtime.snapshot().segCount).toBe(0);
  });

  test('stopping cancels the whole narration, not just the current segment', async () => {
    const { runtime, id } = runtimeWithSegments([30, 30, 25]);

    await runtime.apply({ name: 'playback.ended', id });
    expect(runtime.snapshot().segIx).toBe(1);

    await runtime.apply({ name: 'playback.stop' });

    expect(runtime.snapshot().playing).toBeNull();
    expect(runtime.snapshot().segIx).toBe(0);
    expect(runtime.snapshot().pos).toBe(0);
  });

  test('progress for a message that is not playing is rejected', async () => {
    const { runtime } = runtimeWithSegments([30, 30]);

    const result = await runtime.apply({ name: 'playback.progress', id: '0:9', pos: 4 });

    expect(result.ok).toBe(false);
  });
});

describe('measureSegmentDurations', () => {
  test('falls back to an even estimate when a file cannot be read', () => {
    const durations = measureSegmentDurations(
      ['/tmp/does-not-exist-0.mp3', '/tmp/does-not-exist-1.mp3'],
      'some narration text that is long enough to estimate a duration from '.repeat(10)
    );

    expect(durations).toHaveLength(2);
    for (const d of durations) expect(d).toBeGreaterThan(0);
  });

  test('returns nothing for no segments', () => {
    expect(measureSegmentDurations([], 'text')).toEqual([]);
  });
});
