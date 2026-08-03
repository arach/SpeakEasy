/**
 * Long-form narration is delivered as an ordered sequence of bounded chunks.
 *
 * The contract every consumer depends on is that chunking never loses text.
 * Splits happen at the strongest semantic boundary that still fits — paragraph,
 * then sentence, then clause, then word — and the words of the returned chunks
 * are exactly the words of the input, in order. Silently dropping a remainder
 * is the failure this module exists to prevent, so the losslessness check runs
 * in `chunkForNarration` itself rather than only in the tests.
 */

import type { TTSProviderId } from '../adapters/types';

/**
 * Per-request input limits documented by each provider. These bound a single
 * synthesis call; they are not the ceiling on how much we can narrate, because
 * anything longer is split across ordered requests.
 */
export const PROVIDER_TEXT_LIMITS: Record<TTSProviderId, number> = {
  // https://platform.openai.com/docs/api-reference/audio/createSpeech — 4096 max
  openai: 4096,
  // eleven_multilingual_v2 accepts 10,000 characters; leave headroom for the
  // trailing-boundary backoff rather than sitting exactly on the limit.
  elevenlabs: 9_500,
  groq: 9_500,
  gemini: 4_000,
  // `say` reads the text from argv, so the practical bound is ARG_MAX.
  system: 32_000,
};

/**
 * Chunks are deliberately far below every provider limit. The bound that
 * matters for narration is time-to-first-audio, not the request cap: ~1200
 * characters is roughly 85 seconds of speech, so the first chunk starts
 * playing while the rest are still being synthesized.
 */
export const NARRATION_CHUNK_CHARS = 1_200;

export interface ChunkOptions {
  /** Hard upper bound on the characters in any returned chunk. */
  maxChars?: number;
}

/** The largest chunk we may send to `provider`, honouring an explicit request. */
export function chunkLimitForProvider(
  provider: TTSProviderId | undefined,
  requested: number = NARRATION_CHUNK_CHARS
): number {
  const providerLimit = provider ? PROVIDER_TEXT_LIMITS[provider] : undefined;
  const limit = Math.min(requested, providerLimit ?? NARRATION_CHUNK_CHARS);
  return Math.max(1, limit);
}

/**
 * The comparison basis for losslessness. Whitespace is normalization, not
 * content, and an over-long token may be cut mid-word, so the invariant is
 * stated over the non-whitespace character sequence.
 */
function significant(text: string): string {
  return text.replace(/\s+/g, '');
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n+/);
}

/** Sentence terminators, keeping any trailing quote or bracket with the sentence. */
function splitSentences(text: string): string[] {
  return text.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*\s*|$)/g) ?? [text];
}

function splitClauses(text: string): string[] {
  return text.match(/[^,;:—–]+(?:[,;:—–]+\s*|$)/g) ?? [text];
}

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * A single token longer than the limit (a URL, a hash, an unspaced blob) has no
 * semantic boundary left. Cut it on the character grid rather than dropping it.
 */
function splitHard(text: string, max: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += max) out.push(text.slice(i, i + max));
  return out;
}

/**
 * Greedily pack `units` into chunks of at most `max` characters, delegating any
 * single unit that cannot fit to the next-weaker boundary.
 */
function pack(units: string[], max: number, deeper: (unit: string) => string[]): string[] {
  const out: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) out.push(trimmed);
    current = '';
  };

  for (const raw of units) {
    const unit = raw.trim();
    if (!unit) continue;

    if (unit.length > max) {
      flush();
      out.push(...deeper(unit));
      continue;
    }

    const joined = current ? `${current} ${unit}` : unit;
    if (joined.length > max) {
      flush();
      current = unit;
    } else {
      current = joined;
    }
  }

  flush();
  return out;
}

export class NarrationChunkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NarrationChunkError';
  }
}

/**
 * Split `text` into ordered, bounded, semantically-aligned narration chunks.
 * Returns `[]` for empty input and `[text]` when the whole text already fits.
 */
export function chunkForNarration(text: string, options: ChunkOptions = {}): string[] {
  const max = Math.max(1, Math.floor(options.maxChars ?? NARRATION_CHUNK_CHARS));
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  const chunks = pack(splitParagraphs(trimmed), max, (paragraph) =>
    pack(splitSentences(paragraph), max, (sentence) =>
      pack(splitClauses(sentence), max, (clause) =>
        pack(splitWords(clause), max, (word) => splitHard(word, max))
      )
    )
  );

  assertLossless(trimmed, chunks);
  return chunks;
}

/**
 * Prove that chunking preserved the text, in order. This is deliberately a
 * throw and not a warning: the algorithm is deterministic, so a mismatch is a
 * real defect, and shipping half a narration is the bug being fixed here.
 */
export function assertLossless(source: string, chunks: string[]): void {
  const expected = significant(source);
  const actual = significant(chunks.join(''));
  if (expected === actual) return;
  throw new NarrationChunkError(
    `Narration chunking lost text: expected ${expected.length} characters, produced ${actual.length}.`
  );
}
