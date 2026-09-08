import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  findCodexRolloutPath,
  isBoundedLargeRead,
  loadLaneTailCursor,
  mergeTailMessages,
  messageFingerprint,
  readDeckTaskTail,
  saveLaneTailCursor,
  toTailDeckMessage,
} from './deck-task-tail';

const cleanup: string[] = [];

afterEach(() => {
  while (cleanup.length) {
    const dir = cleanup.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  cleanup.push(dir);
  return dir;
}

function writeCodexRollout(dir: string, taskId: string, lines: object[]): string {
  const file = path.join(dir, `rollout-2026-08-03T00-00-00-${taskId}.jsonl`);
  const body = [
    {
      timestamp: '2026-08-03T00:00:00.000Z',
      type: 'session_meta',
      payload: { id: taskId, cwd: '/tmp', originator: 'test' },
    },
    ...lines,
  ]
    .map((line) => JSON.stringify(line))
    .join('\n');
  writeFileSync(file, `${body}\n`);
  return file;
}

function userMessage(text: string, turnId = 'turn-1'): object {
  return {
    timestamp: '2026-08-03T00:00:01.000Z',
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text }],
      id: `user-${text.slice(0, 8)}`,
    },
  };
}

function assistantMessage(text: string): object {
  return {
    timestamp: '2026-08-03T00:00:02.000Z',
    type: 'response_item',
    payload: {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text }],
      id: `assistant-${text.slice(0, 8)}`,
    },
  };
}

describe('deck task-tail helpers', () => {
  test('finds a rollout path by task id without reading contents', () => {
    const sessions = tempDir('speakeasy-tail-find-');
    const day = path.join(sessions, '2026', '08', '03');
    mkdirSync(day, { recursive: true });
    const taskId = '019fa9c1-9113-74d2-86a6-9607f89f1953';
    const file = writeCodexRollout(day, taskId, [userMessage('hello'), assistantMessage('hi')]);
    expect(findCodexRolloutPath(taskId, sessions)).toBe(file);
    expect(findCodexRolloutPath('missing-task', sessions)).toBeNull();
  });

  test('persists one opaque cursor per lane/task', () => {
    const runtime = tempDir('speakeasy-tail-cursor-');
    saveLaneTailCursor(runtime, { taskId: 'task-a', cursor: 'opaque-cursor-1' });
    expect(loadLaneTailCursor(runtime)).toEqual({ taskId: 'task-a', cursor: 'opaque-cursor-1' });
    saveLaneTailCursor(runtime, { taskId: 'task-a', cursor: 'opaque-cursor-2' });
    expect(loadLaneTailCursor(runtime)?.cursor).toBe('opaque-cursor-2');
  });

  test('hydrates last messages and continues from the opaque cursor', () => {
    const sessions = tempDir('speakeasy-tail-hydrate-');
    const day = path.join(sessions, '2026', '08', '03');
    mkdirSync(day, { recursive: true });
    const taskId = '019f-test-hydrate-0001';
    const file = writeCodexRollout(day, taskId, [
      userMessage('first'),
      assistantMessage('reply one'),
      userMessage('second'),
      assistantMessage('reply two'),
    ]);

    const initial = readDeckTaskTail({
      taskId,
      sessionsDir: sessions,
      rolloutPath: file,
      maxMessages: 20,
    });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.mode).toBe('initial');
    expect(initial.messages.length).toBeGreaterThanOrEqual(2);
    expect(initial.messages.some((m) => m.role === 'you')).toBe(true);
    expect(initial.messages.some((m) => m.role === 'agent')).toBe(true);
    // bytesRead may include a small head identity proof in addition to the tail window
    expect(initial.bytesRead).toBeLessThan(initial.fileSize + 64 * 1024);
    expect(initial.cursor.length).toBeGreaterThan(10);

    const incremental = readDeckTaskTail({
      taskId,
      sessionsDir: sessions,
      rolloutPath: file,
      cursor: initial.cursor,
    });
    expect(incremental.ok).toBe(true);
    if (!incremental.ok) return;
    expect(incremental.mode).toBe('incremental');
    expect(incremental.messages).toEqual([]);
    expect(incremental.cursor).toBeTruthy();
  });

  test('fails closed on task mismatch', () => {
    const sessions = tempDir('speakeasy-tail-mismatch-');
    const day = path.join(sessions, '2026', '08', '03');
    mkdirSync(day, { recursive: true });
    const taskId = '019f-real-task-id-0001';
    const file = writeCodexRollout(day, taskId, [userMessage('hello'), assistantMessage('world')]);

    const result = readDeckTaskTail({
      taskId: '019f-other-task-id-9999',
      sessionsDir: sessions,
      rolloutPath: file,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code === 'TASK_MISMATCH' || result.code === 'TASK_ID_UNPROVEN').toBe(true);
  });

  test('merge skips already-seen ids and live fingerprints', () => {
    const existing = [
      { role: 'you' as const, text: 'hello', dur: 1 },
      { role: 'agent' as const, text: 'world', dur: 1 },
    ];
    const seen = new Set<string>(['id-1']);
    const merged = mergeTailMessages({
      existing,
      incoming: [
        { role: 'you', text: 'hello', sourceId: 'id-1' },
        { role: 'agent', text: 'world', sourceId: 'id-2' },
        { role: 'you', text: 'next', sourceId: 'id-3' },
      ],
      seenIds: seen,
      maxMessages: 50,
      toMessage: (m) => ({ role: m.role, text: m.text, dur: 1, mirrored: true }),
    });
    expect(merged.added).toBe(1);
    expect(merged.messages.map((m) => m.text)).toEqual(['hello', 'world', 'next']);
    expect(seen.has('id-3')).toBe(true);
  });

  test('maps roles and rejects empty text', () => {
    expect(toTailDeckMessage({
      id: 'a',
      role: 'user',
      text: '  hi  ',
    })).toEqual({ role: 'you', text: 'hi', sourceId: 'a' });
    expect(toTailDeckMessage({ id: 'b', role: 'assistant', text: '   ' })).toBeNull();
    expect(messageFingerprint('you', 'x')).toBe('you\0x');
  });

  test('reports bounded reads for large synthetic rollouts', () => {
    const sessions = tempDir('speakeasy-tail-large-');
    const day = path.join(sessions, '2026', '08', '03');
    mkdirSync(day, { recursive: true });
    const taskId = '019f-large-rollout-0001';
    const file = path.join(day, `rollout-2026-08-03T00-00-00-${taskId}.jsonl`);

    // Build a multi-megabyte rollout with junk tool output, then real messages at the end.
    const chunks: string[] = [
      JSON.stringify({
        timestamp: '2026-08-03T00:00:00.000Z',
        type: 'session_meta',
        payload: { id: taskId, cwd: '/tmp', originator: 'test' },
      }),
    ];
    const pad = 'x'.repeat(64 * 1024);
    for (let i = 0; i < 40; i++) {
      chunks.push(JSON.stringify({
        timestamp: `2026-08-03T00:00:${String(i).padStart(2, '0')}.000Z`,
        type: 'event_msg',
        payload: { type: 'agent_reasoning', text: pad },
      }));
    }
    for (let i = 0; i < 8; i++) {
      chunks.push(JSON.stringify(userMessage(`user-${i}`, `turn-${i}`)));
      chunks.push(JSON.stringify(assistantMessage(`assistant-${i}`)));
    }
    writeFileSync(file, `${chunks.join('\n')}\n`);

    const result = readDeckTaskTail({
      taskId,
      sessionsDir: sessions,
      rolloutPath: file,
      maxMessages: 20,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.fileSize).toBeGreaterThan(2 * 1024 * 1024);
    // Identity proof can add a small head read; still must not retain the full body.
    expect(result.bytesRead).toBeLessThan(result.fileSize + 128 * 1024);
    expect(result.bytesRead).toBeLessThan(8 * 1024 * 1024);
    expect(isBoundedLargeRead({
      bytesRead: Math.min(result.bytesRead, result.fileSize),
      fileSize: result.fileSize,
    })).toBe(true);
    // Tool/reasoning padding must not appear as conversation.
    expect(result.messages.every((m) => !m.text.includes(pad.slice(0, 20)))).toBe(true);
  });
});

describe('live large Codex rollout (optional)', () => {
  const liveTask = '019fa9c1-9113-74d2-86a6-9607f89f1953';
  const livePath = findCodexRolloutPath(liveTask);

  test.skipIf(!livePath)('reads last 20 without scanning the full ~211MB file', () => {
    const result = readDeckTaskTail({
      taskId: liveTask,
      rolloutPath: livePath!,
      maxMessages: 20,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThanOrEqual(20);
    expect(result.fileSize).toBeGreaterThan(100 * 1024 * 1024);
    expect(result.bytesRead).toBeLessThan(result.fileSize);
    expect(isBoundedLargeRead(result)).toBe(true);
  });
});
