import { describe, expect, test } from 'bun:test';

import { DeckRuntime, parseIntent } from './deck-runtime';

type RespondCall = { lane: number; command: string };

/**
 * A client that transcribes on-device owns the words before the Mac ever hears
 * them, so delivery has to survive everything the transport can do to it: a
 * dropped socket, a restarted runtime, a lane that is briefly busy, and an ack
 * that never arrives. These cover the contract that makes that safe.
 */
function harness() {
  const runtime = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
  const calls: RespondCall[] = [];
  const internal = runtime as unknown as {
    listening: boolean;
    busy: boolean;
    laneIx: number;
    respond: (lane: number, command: string, gen: number) => Promise<void>;
  };
  internal.respond = async (lane, command) => {
    calls.push({ lane, command });
  };
  return { runtime, internal, calls };
}

describe('Deck transcript delivery', () => {
  test('accepts a transcript even when the runtime is not recording', async () => {
    const { runtime, internal, calls } = harness();
    internal.listening = false;
    internal.laneIx = 0;

    const result = await runtime.apply({ name: 'capture.end', text: 'ship it' });

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ lane: 0, command: 'ship it' }]);
    runtime.destroy();
  });

  test('still requires a recording session when the client sends no text', async () => {
    const { runtime, internal, calls } = harness();
    internal.listening = false;

    const result = await runtime.apply({ name: 'capture.end' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('not recording');
    expect(calls).toEqual([]);
    runtime.destroy();
  });

  test('a retried utterance is acknowledged once and submitted once', async () => {
    const { runtime, internal, calls } = harness();
    internal.laneIx = 0;

    const first = await runtime.apply({ name: 'capture.end', text: 'deploy', utteranceId: 'u-1' });
    const retry = await runtime.apply({ name: 'capture.end', text: 'deploy', utteranceId: 'u-1' });

    // The client must be free to retry an ack it never saw.
    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    expect(calls).toEqual([{ lane: 0, command: 'deploy' }]);
    runtime.destroy();
  });

  test('distinct utterances are not collapsed', async () => {
    const { runtime, internal, calls } = harness();
    internal.laneIx = 0;

    await runtime.apply({ name: 'capture.end', text: 'first', utteranceId: 'u-1' });
    await runtime.apply({ name: 'capture.end', text: 'second', utteranceId: 'u-2' });

    expect(calls.map((call) => call.command)).toEqual(['first', 'second']);
    runtime.destroy();
  });

  test('delivers to the lane the operator was addressing, not the current one', async () => {
    const { runtime, internal, calls } = harness();
    internal.laneIx = 5;

    // Captured against lane 2 minutes earlier, while the model was downloading.
    await runtime.apply({ name: 'capture.end', text: 'held speech', lane: 2 });

    expect(calls).toEqual([{ lane: 2, command: 'held speech' }]);
    runtime.destroy();
  });

  test('a busy lane defers the transcript instead of consuming it', async () => {
    const { runtime, internal, calls } = harness();
    internal.laneIx = 0;
    internal.busy = true;

    const rejected = await runtime.apply({ name: 'capture.end', text: 'wait for me', utteranceId: 'u-9' });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toBe('response already in flight');
    expect(calls).toEqual([]);

    // Nothing was recorded as accepted, so the client's retry still lands.
    internal.busy = false;
    const retry = await runtime.apply({ name: 'capture.end', text: 'wait for me', utteranceId: 'u-9' });
    expect(retry.ok).toBe(true);
    expect(calls).toEqual([{ lane: 0, command: 'wait for me' }]);
    runtime.destroy();
  });

  test('every addressable lane can receive a carried transcript', async () => {
    const { runtime, calls } = harness();

    for (let lane = 0; lane <= 8; lane += 1) {
      const result = await runtime.apply({ name: 'capture.end', text: `lane ${lane}`, lane });
      expect(result.ok).toBe(true);
    }

    expect(calls.map((call) => call.lane)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    runtime.destroy();
  });

  test('a lane outside the schema never reaches the runtime', () => {
    // The carried target is operator input; the schema is what keeps a bad one
    // from being interpreted as "wherever the Mac happens to be".
    expect(parseIntent({ name: 'capture.end', text: 'x', lane: 12 })).toEqual({ error: 'invalid intent' });
    expect(parseIntent({ name: 'capture.end', text: 'x', lane: -1 })).toEqual({ error: 'invalid intent' });
    expect(parseIntent({ name: 'capture.end', text: 'x', lane: 3 }).intent).toEqual({
      name: 'capture.end',
      text: 'x',
      lane: 3,
    });
  });
});
