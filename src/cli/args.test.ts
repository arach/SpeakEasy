import { describe, expect, test } from 'bun:test';
import { parseAndValidate } from './args';

describe('CLI defaults', () => {
  test('leaves provider settings unset so configured defaults can apply', () => {
    const options = parseAndValidate({ text: 'Hello' });

    expect(options.provider).toBeUndefined();
    expect(options.rate).toBeUndefined();
    expect(options.volume).toBeUndefined();
  });

  test('preserves explicit provider settings', () => {
    const options = parseAndValidate({
      text: 'Hello',
      provider: 'elevenlabs',
      rate: '205',
      volume: '0.65',
    });

    expect(options.provider).toBe('elevenlabs');
    expect(options.rate).toBe(205);
    expect(options.volume).toBe(0.65);
  });
});
