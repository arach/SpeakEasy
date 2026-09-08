import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { DeckRuntime } from './deck-runtime';

function browserCapture() {
  const html = readFileSync(new URL('../../deck/index.html', import.meta.url), 'utf8');
  const context = createContext({
    holdOwner: 42, arming: false, live: true, settling: false, captureGeneration: 1,
    captureLane: 6, transcriptionAbort: null, nativeFinish: null,
    S: { lane: 6, listening: true, confirm: 'LISTENING' },
    sent: [] as any[], finished: null as any, paints: 0,
    crypto: { randomUUID: () => 'utterance-test' },
  });
  runInContext(`
    function lane() { return { num: String(S.lane + 1) }; }
    function nativeSpeech() { return false; }
    function paint() { paints++; }
    const host = { post() {} };
    function sendIntent(name, args) { sent.push({name, ...args}); return true; }
    function stopTranscription(abort, done) { finished = done; }
    ${html.slice(html.indexOf('function holdEnd('), html.indexOf('function cycleSpeed('))}
    ${html.slice(html.indexOf('function stopAll('), html.indexOf('function replayLast('))}
  `, context);
  return context;
}

test('release turns off the listening display immediately and pins the target lane', () => {
  const c = browserCapture();
  runInContext('holdEnd(42)', c);
  expect(c.S.listening).toBe(false);
  expect(c.settling).toBe(true);
  expect(c.sent[0].name).toBe('capture.release');
  runInContext("S.lane = 1; finished({transcript:'Test words', failed:false})", c);
  expect(c.sent[1]).toEqual({ name: 'capture.end', text: 'Test words', lane: 6, utteranceId: 'utterance-test' });
});

test('cancel during transcription prevents late words from reaching the agent', () => {
  const c = browserCapture();
  runInContext('holdEnd(42); stopAll(); finished({transcript:"Late words", failed:false})', c);
  expect(c.settling).toBe(false);
  expect(c.sent.map((i: any) => i.name)).toEqual(['capture.release', 'capture.cancel']);
});

test('runtime distinguishes a released microphone from recording and allows cancellation', async () => {
  const r = new DeckRuntime({ warmCatalog: false, warmCanonical: false });
  try {
    await r.apply({ name: 'capture.start' });
    expect((await r.apply({ name: 'capture.release' })).ok).toBe(true);
    expect(r.snapshot()).toMatchObject({ listening: false, phase: 'transcribing' });
    expect((await r.apply({ name: 'capture.cancel' })).ok).toBe(true);
    expect(r.snapshot()).toMatchObject({ listening: false, phase: 'idle' });
  } finally { r.destroy(); }
});
