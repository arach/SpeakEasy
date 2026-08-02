import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TTSCache } from './cache';
import { NotificationHistory } from './history';

const temporaryDirectories: string[] = [];

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function permissions(path: string): number {
  return statSync(path).mode & 0o777;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('local narration privacy', () => {
  test('cache directories and audio files are private to the current user', async () => {
    const directory = temporaryDirectory('speakeasy-cache-permissions-');
    const cache = new TTSCache(directory, '7d');

    const stored = await cache.set(
      'fixture',
      { provider: 'system', voice: 'Samantha', rate: 180, text: 'Private fixture' },
      Buffer.from('ID3fixture'),
      { extension: 'mp3' }
    );

    expect(stored).toBe(true);
    expect(permissions(directory)).toBe(0o700);
    expect(permissions(join(directory, 'fixture.mp3'))).toBe(0o600);
  });

  test('history is capped and stored privately', () => {
    const directory = temporaryDirectory('speakeasy-history-permissions-');
    const history = new NotificationHistory(directory);

    for (let index = 0; index < 1005; index += 1) {
      history.add({ text: `Entry ${index}`, provider: 'system', timestamp: index, cached: false });
    }

    const files = readdirSync(directory).filter((file) => file.endsWith('.json'));
    expect(files).toHaveLength(1);
    expect(history.getAll()).toHaveLength(1000);
    expect(permissions(directory)).toBe(0o700);
    expect(permissions(join(directory, files[0]))).toBe(0o600);
  });
});
