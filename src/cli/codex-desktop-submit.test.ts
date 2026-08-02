import { afterEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { resolveCodexDesktopBridge, submitCodexDesktopTurn } from './codex-desktop-submit';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

function fakeBridge(source: string): string {
  const directory = mkdtempSync(path.join(tmpdir(), 'speakeasy-desktop-bridge-test-'));
  temporaryDirectories.push(directory);
  const file = path.join(directory, 'bridge.cjs');
  writeFileSync(file, source);
  chmodSync(file, 0o700);
  return file;
}

describe('Codex Desktop submission', () => {
  test('resolves an explicit packaged bridge before any fallback', () => {
    const bridge = fakeBridge('');
    expect(resolveCodexDesktopBridge(bridge)).toBe(bridge);
  });

  test('returns only a response proven to belong to the exact task', async () => {
    const threadId = '019fa9c1-9113-74d2-86a6-9607f89f1953';
    const bridge = fakeBridge(`
      const threadId = process.argv[3];
      let input = '';
      process.stdin.on('data', (chunk) => { input += chunk; });
      process.stdin.on('end', () => {
        process.stdout.write(JSON.stringify({
          ok: true,
          threadId,
          turnId: 'turn-1',
          delivery: 'started-turn',
          response: 'Canonical reply to: ' + input,
        }) + '\\n');
      });
    `);

    const result = await submitCodexDesktopTurn(threadId, 'exact transcript', {
      bridgePath: bridge,
      runtimePath: process.execPath,
      timeoutMs: 2_000,
    });

    expect(result).toEqual({
      threadId,
      turnId: 'turn-1',
      delivery: 'started-turn',
      response: 'Canonical reply to: exact transcript',
    });
  });

  test('fails closed when the bridge reports a different task', async () => {
    const bridge = fakeBridge(`
      process.stdin.resume();
      process.stdin.on('end', () => process.stdout.write(JSON.stringify({
        ok: true,
        threadId: 'shadow-task',
        turnId: 'turn-2',
        delivery: 'started-turn',
        response: 'Wrong destination',
      }) + '\\n'));
    `);

    await expect(submitCodexDesktopTurn('canonical-task', 'hello', {
      bridgePath: bridge,
      runtimePath: process.execPath,
      timeoutMs: 2_000,
    })).rejects.toThrow('wrong task');
  });

  test('cancels an in-flight bridge instead of leaving a hidden turn runner', async () => {
    const bridge = fakeBridge('setInterval(() => {}, 1000); process.stdin.resume();');
    const controller = new AbortController();
    const pending = submitCodexDesktopTurn('canonical-task', 'hello', {
      bridgePath: bridge,
      runtimePath: process.execPath,
      timeoutMs: 5_000,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
  });
});
