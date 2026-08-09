import { describe, expect, test } from 'bun:test';
import {
  NARRATION_CHUNK_CHARS,
  NarrationChunkError,
  PROVIDER_TEXT_LIMITS,
  assertLossless,
  chunkForNarration,
  chunkLimitForProvider,
} from './chunk';

/** ~13.5 characters per second measured from cached eleven_multilingual_v2 output. */
const CHARS_PER_SECOND = 13.5;

function sentences(count: number, word = 'narration'): string {
  return Array.from(
    { length: count },
    (_, i) => `Sentence ${i} explains why the ${word} pipeline must not drop this text.`
  ).join(' ');
}

describe('chunkForNarration', () => {
  test('returns nothing for empty input', () => {
    expect(chunkForNarration('')).toEqual([]);
    expect(chunkForNarration('   \n\n  ')).toEqual([]);
  });

  test('leaves text that already fits as a single chunk', () => {
    const text = 'Short enough to speak in one request.';
    expect(chunkForNarration(text, { maxChars: 100 })).toEqual([text]);
  });

  test('never exceeds the requested bound', () => {
    const chunks = chunkForNarration(sentences(200), { maxChars: 300 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(300);
  });

  test('preserves every character across chunks', () => {
    const source = sentences(200);
    const chunks = chunkForNarration(source, { maxChars: 300 });
    expect(chunks.join('').replace(/\s+/g, '')).toBe(source.replace(/\s+/g, ''));
  });

  test('prefers sentence boundaries when a sentence fits', () => {
    const source = 'First sentence here. Second sentence here. Third sentence here.';
    const chunks = chunkForNarration(source, { maxChars: 45 });
    for (const chunk of chunks) expect(chunk).toMatch(/[.!?]$/);
  });

  test('falls back to clause boundaries for a sentence that cannot fit', () => {
    const source =
      'This one very long sentence runs on, and on, and further still, ' +
      'until it simply cannot be spoken inside a single bounded request.';
    const chunks = chunkForNarration(source, { maxChars: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(40);
    expect(chunks.join('').replace(/\s+/g, '')).toBe(source.replace(/\s+/g, ''));
  });

  test('never splits inside a word that fits the bound', () => {
    const source = sentences(40);
    const chunks = chunkForNarration(source, { maxChars: 200 });
    const rejoined = chunks.join(' ').split(/\s+/).filter(Boolean);
    const original = source.split(/\s+/).filter(Boolean);
    expect(rejoined).toEqual(original);
  });

  test('hard-splits a single token longer than the bound instead of dropping it', () => {
    const token = 'a'.repeat(250);
    const chunks = chunkForNarration(`before ${token} after`, { maxChars: 100 });
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
    expect(chunks.join('').replace(/\s+/g, '')).toBe(`before${token}after`);
  });

  test('splits on paragraph boundaries before sentence boundaries', () => {
    const source = `${sentences(3, 'first')}\n\n${sentences(3, 'second')}`;
    const chunks = chunkForNarration(source, { maxChars: 260 });
    expect(chunks.some((c) => c.includes('first') && c.includes('second'))).toBe(false);
  });

  test('a response far longer than forty seconds survives chunking intact', () => {
    // The regression: 600 characters was ~43s, which is where narration used to stop.
    const source = sentences(120);
    expect(source.length / CHARS_PER_SECOND).toBeGreaterThan(120);

    const chunks = chunkForNarration(source, { maxChars: NARRATION_CHUNK_CHARS });
    const spokenSeconds = chunks.reduce((total, c) => total + c.length / CHARS_PER_SECOND, 0);

    expect(chunks.length).toBeGreaterThan(1);
    expect(spokenSeconds).toBeGreaterThan(40);
    expect(chunks.join('').replace(/\s+/g, '')).toBe(source.replace(/\s+/g, ''));
  });

  test('stays within every provider request limit at the default chunk size', () => {
    const chunks = chunkForNarration(sentences(500), { maxChars: NARRATION_CHUNK_CHARS });
    const smallestProviderLimit = Math.min(...Object.values(PROVIDER_TEXT_LIMITS));
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(smallestProviderLimit);
  });
});

describe('chunkLimitForProvider', () => {
  test('never exceeds the provider request limit', () => {
    expect(chunkLimitForProvider('openai', 100_000)).toBe(PROVIDER_TEXT_LIMITS.openai);
    expect(chunkLimitForProvider('gemini', 100_000)).toBe(PROVIDER_TEXT_LIMITS.gemini);
  });

  test('honours a smaller explicit request', () => {
    expect(chunkLimitForProvider('elevenlabs', 500)).toBe(500);
  });

  test('defaults to the narration chunk size for a known provider', () => {
    expect(chunkLimitForProvider('elevenlabs')).toBe(NARRATION_CHUNK_CHARS);
  });
});

describe('assertLossless', () => {
  test('accepts a faithful split', () => {
    expect(() => assertLossless('one two three', ['one two', 'three'])).not.toThrow();
  });

  test('rejects a dropped remainder — the bug this module exists to prevent', () => {
    expect(() => assertLossless('one two three', ['one two'])).toThrow(NarrationChunkError);
  });
});
