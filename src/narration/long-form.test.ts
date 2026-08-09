import { describe, expect, test } from 'bun:test';
import { NarrationSegmentError, SpeakEasy } from '../index';
import { chunkForNarration } from './chunk';

/**
 * The regression these tests exist for: narration used to stop at ~40 seconds
 * because the reply was clipped to 600 characters before synthesis. A response
 * substantially longer than that must now be spoken in full, in order.
 */

/** ~13.5 characters per second, measured from cached eleven_multilingual_v2 audio. */
const CHARS_PER_SECOND = 13.5;
/** Comfortably past the old ~43s ceiling. */
const LONG_RESPONSE = Array.from(
  { length: 90 },
  (_, i) =>
    `Point ${i} says the narration pipeline must speak this sentence instead of ` +
    `truncating the response part way through.`
).join(' ');

function speakerWithStubbedSynthesis() {
  const speaker = new SpeakEasy({ provider: 'system', cache: { enabled: false } });
  const spoken: string[] = [];
  (speaker as unknown as { speakText: (t: string) => Promise<void> }).speakText = async (
    text: string
  ) => {
    spoken.push(text);
    if (text.includes('EXPLODE')) throw new Error('provider exploded');
  };
  return { speaker, spoken };
}

describe('long-form narration', () => {
  test('the fixture is well past the duration where narration used to stop', () => {
    expect(LONG_RESPONSE.length).toBeGreaterThan(600);
    expect(LONG_RESPONSE.length / CHARS_PER_SECOND).toBeGreaterThan(40);
  });

  test('a response longer than forty seconds is spoken as ordered segments', async () => {
    const { speaker, spoken } = speakerWithStubbedSynthesis();

    await speaker.speak(LONG_RESPONSE);

    expect(spoken.length).toBeGreaterThan(1);
    // every segment, concatenated in speaking order, reproduces the response
    expect(spoken.join('').replace(/\s+/g, '')).toBe(LONG_RESPONSE.replace(/\s+/g, ''));
  });

  test('total narration exceeds the old ceiling instead of stopping at it', async () => {
    const { speaker, spoken } = speakerWithStubbedSynthesis();

    await speaker.speak(LONG_RESPONSE);
    const seconds = spoken.reduce((total, s) => total + s.length / CHARS_PER_SECOND, 0);

    expect(seconds).toBeGreaterThan(40);
  });

  test('segments are queued in reading order', async () => {
    const { speaker, spoken } = speakerWithStubbedSynthesis();

    await speaker.speak(LONG_RESPONSE);

    const expected = chunkForNarration(LONG_RESPONSE.replace(/\s+/g, ' ').trim(), {
      maxChars: 1_200,
    });
    expect(spoken).toEqual(expected);
  });

  test('high priority narration also keeps its segments in order', async () => {
    const { speaker, spoken } = speakerWithStubbedSynthesis();

    await speaker.speak(LONG_RESPONSE, { priority: 'high' });

    const first = spoken[0];
    const last = spoken[spoken.length - 1];
    expect(LONG_RESPONSE.startsWith(first.slice(0, 20))).toBe(true);
    expect(last.endsWith('through.')).toBe(true);
  });

  test('short text still takes the single-request path', async () => {
    const { speaker, spoken } = speakerWithStubbedSynthesis();

    await speaker.speak('A short update.');

    expect(spoken).toEqual(['A short update.']);
  });

  test('a failing segment surfaces without losing the remaining narration', async () => {
    const speaker = new SpeakEasy({ provider: 'system', cache: { enabled: false } });
    const spoken: string[] = [];
    let calls = 0;
    (speaker as unknown as { speakText: (t: string) => Promise<void> }).speakText = async (
      text: string
    ) => {
      calls += 1;
      // fail the second segment only
      if (calls === 2) throw new Error('provider exploded');
      spoken.push(text);
    };

    const expected = chunkForNarration(LONG_RESPONSE.replace(/\s+/g, ' ').trim(), {
      maxChars: 1_200,
    });

    let raised: unknown;
    try {
      await speaker.speak(LONG_RESPONSE);
    } catch (error) {
      raised = error;
    }

    // the failure is reported, not swallowed
    expect(raised).toBeInstanceOf(NarrationSegmentError);
    expect((raised as NarrationSegmentError).failures).toHaveLength(1);
    // and every other segment was still spoken
    expect(calls).toBe(expected.length);
    expect(spoken).toHaveLength(expected.length - 1);
  });

  test('cancel() abandons narration still queued', async () => {
    const speaker = new SpeakEasy({ provider: 'system', cache: { enabled: false } });
    const spoken: string[] = [];
    (speaker as unknown as { speakText: (t: string) => Promise<void> }).speakText = async (
      text: string
    ) => {
      spoken.push(text);
      // interrupt the narration partway through, as a stop intent would
      if (spoken.length === 2) speaker.cancel();
    };

    await speaker.speak(LONG_RESPONSE);

    const expected = chunkForNarration(LONG_RESPONSE.replace(/\s+/g, ' ').trim(), {
      maxChars: 1_200,
    });
    expect(spoken).toHaveLength(2);
    expect(expected.length).toBeGreaterThan(2);
  });

  test('every audio file produced is exposed in speaking order', async () => {
    const speaker = new SpeakEasy({ provider: 'system', cache: { enabled: false } });
    let n = 0;
    (speaker as unknown as { speakText: (t: string) => Promise<void> }).speakText = async () => {
      (speaker as unknown as { recordAudioFile: (f: string) => void }).recordAudioFile(
        `/tmp/segment-${n++}.mp3`
      );
    };

    await speaker.speak(LONG_RESPONSE);

    expect(speaker.lastAudioFiles.length).toBeGreaterThan(1);
    expect(speaker.lastAudioFiles[0]).toBe('/tmp/segment-0.mp3');
    expect(speaker.lastAudioFiles).toEqual(
      speaker.lastAudioFiles.map((_, i) => `/tmp/segment-${i}.mp3`)
    );
    expect(speaker.lastAudioFile).toBe(
      speaker.lastAudioFiles[speaker.lastAudioFiles.length - 1]
    );
  });
});
