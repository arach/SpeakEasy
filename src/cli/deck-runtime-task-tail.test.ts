import { afterEach, describe, expect, test } from 'bun:test';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { deckAgentRuntimeDir } from './deck-agent-client';
import { DeckRuntime } from './deck-runtime';
import {
  loadLaneTailCursor,
  readDeckTaskTail,
  saveLaneTailCursor,
  type DeckTaskTailOutcome,
} from './deck-task-tail';

const cleanup: string[] = [];

afterEach(() => {
  while (cleanup.length) {
    const dir = cleanup.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

type RuntimeInternals = {
  threads: Array<Array<{ role: string; text: string }>>;
  lanes: Array<{ threadId?: string; sessionAlias?: string; title: string }>;
  laneKeys: string[];
  laneTailSeen: Map<number, Set<string>>;
  syncLaneTaskTail: (
    index: number,
    options?: { reason: string; forceInitial?: boolean },
  ) => void;
  assignLane: (index: number, threadId: string | null) => void;
  selectLane: (index: number) => void;
};

function internals(runtime: DeckRuntime): RuntimeInternals {
  return runtime as unknown as RuntimeInternals;
}

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  cleanup.push(dir);
  return dir;
}

function writeRollout(sessionsRoot: string, taskId: string, pairs: Array<[string, string]>): string {
  const day = path.join(sessionsRoot, '2026', '08', '03');
  mkdirSync(day, { recursive: true });
  const file = path.join(day, `rollout-2026-08-03T12-00-00-${taskId}.jsonl`);
  const lines: object[] = [
    {
      timestamp: '2026-08-03T12:00:00.000Z',
      type: 'session_meta',
      payload: { id: taskId, cwd: '/Users/arach/dev/speakeasy', originator: 'codex_desktop' },
    },
  ];
  pairs.forEach(([user, assistant], i) => {
    lines.push({
      timestamp: `2026-08-03T12:00:${String(i * 2).padStart(2, '0')}.000Z`,
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: user }],
        id: `u-${taskId}-${i}`,
      },
    });
    lines.push({
      timestamp: `2026-08-03T12:00:${String(i * 2 + 1).padStart(2, '0')}.000Z`,
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: assistant }],
        id: `a-${taskId}-${i}`,
      },
    });
  });
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return file;
}

function readerFor(sessions: string) {
  return (input: Parameters<typeof readDeckTaskTail>[0]): DeckTaskTailOutcome =>
    readDeckTaskTail({ ...input, sessionsDir: sessions });
}

describe('DeckRuntime task-tail integration', () => {
  test('assigning a lane hydrates recent canonical messages', () => {
    const sessions = tempDir('speakeasy-rt-assign-');
    const taskId = '019f-assign-hydrate-0001';
    writeRollout(sessions, taskId, [
      ['first question', 'first answer'],
      ['second question', 'second answer'],
    ]);

    const runtime = new DeckRuntime({
      warmCatalog: false,
      warmCanonical: false,
      taskTailRead: readerFor(sessions),
    });
    const internal = internals(runtime);
    internal.assignLane(0, taskId);

    expect(internal.lanes[0].threadId).toBe(taskId);
    expect(internal.threads[0].length).toBeGreaterThan(0);
    expect(internal.threads[0].some((m) => m.text.includes('second question'))).toBe(true);
    expect(internal.threads[0].some((m) => m.text.includes('second answer'))).toBe(true);

    const cursor = loadLaneTailCursor(deckAgentRuntimeDir(internal.laneKeys[0]));
    expect(cursor?.taskId).toBe(taskId);
    expect(cursor?.cursor.length).toBeGreaterThan(10);

    runtime.destroy();
  });

  test('lane switching does not duplicate hydrated messages', () => {
    const sessions = tempDir('speakeasy-rt-switch-');
    const taskA = '019f-switch-a-0001';
    const taskB = '019f-switch-b-0001';
    writeRollout(sessions, taskA, [['ask a', 'reply a']]);
    writeRollout(sessions, taskB, [['ask b', 'reply b']]);

    const runtime = new DeckRuntime({
      warmCatalog: false,
      warmCanonical: false,
      taskTailRead: readerFor(sessions),
    });
    const internal = internals(runtime);
    internal.assignLane(0, taskA);
    internal.assignLane(1, taskB);
    const countA = internal.threads[0].length;
    const countB = internal.threads[1].length;
    expect(countA).toBeGreaterThan(0);
    expect(countB).toBeGreaterThan(0);

    internal.selectLane(1);
    internal.selectLane(0);
    internal.selectLane(1);
    internal.syncLaneTaskTail(0, { reason: 'test-reselect' });
    internal.syncLaneTaskTail(1, { reason: 'test-reselect' });

    expect(internal.threads[0].length).toBe(countA);
    expect(internal.threads[1].length).toBe(countB);
    expect(internal.threads[0].filter((m) => m.text === 'ask a').length).toBe(1);
    expect(internal.threads[1].filter((m) => m.text === 'ask b').length).toBe(1);

    runtime.destroy();
  });

  test('reconnect with a stored cursor continues incrementally without loss', () => {
    const sessions = tempDir('speakeasy-rt-reconnect-');
    const taskId = '019f-reconnect-0001';
    const file = writeRollout(sessions, taskId, [['before', 'answer before']]);

    const runtime = new DeckRuntime({
      warmCatalog: false,
      warmCanonical: false,
      taskTailRead: readerFor(sessions),
    });
    const internal = internals(runtime);
    internal.assignLane(2, taskId);
    expect(internal.threads[2].some((m) => m.text === 'before')).toBe(true);
    const cursorBefore = loadLaneTailCursor(deckAgentRuntimeDir(internal.laneKeys[2]));
    expect(cursorBefore?.cursor).toBeTruthy();

    // Append new turns after the stored cursor.
    appendFileSync(
      file,
      `${JSON.stringify({
        timestamp: '2026-08-03T12:10:00.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'after reconnect' }],
          id: 'u-after',
        },
      })}\n${JSON.stringify({
        timestamp: '2026-08-03T12:10:01.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'reply after' }],
          id: 'a-after',
        },
      })}\n`,
    );

    internal.syncLaneTaskTail(2, { reason: 'reconnect-poll' });
    expect(internal.threads[2].some((m) => m.text === 'before')).toBe(true);
    expect(internal.threads[2].some((m) => m.text === 'after reconnect')).toBe(true);
    expect(internal.threads[2].some((m) => m.text === 'reply after')).toBe(true);
    expect(internal.threads[2].filter((m) => m.text === 'before').length).toBe(1);

    runtime.destroy();
  });

  test('task mismatch fails closed without wiping a healthy thread', () => {
    const sessions = tempDir('speakeasy-rt-mismatch-');
    const taskId = '019f-mismatch-runtime-0001';
    writeRollout(sessions, taskId, [['ok', 'yes']]);

    const runtime = new DeckRuntime({
      warmCatalog: false,
      warmCanonical: false,
      taskTailRead: readerFor(sessions),
    });
    const internal = internals(runtime);
    internal.assignLane(0, taskId);
    const before = internal.threads[0].map((m) => m.text);

    saveLaneTailCursor(deckAgentRuntimeDir(internal.laneKeys[0]), {
      taskId: '019f-wrong-task-id-0001',
      cursor: 'task-tail.v1.not-a-real-cursor',
    });
    // Threads already populated → cursor path attempted, then reset/retry.
    internal.syncLaneTaskTail(0, { reason: 'mismatch-test' });
    expect(internal.threads[0].length).toBeGreaterThan(0);
    // Original content remains available after fail-closed recovery.
    expect(internal.threads[0].some((m) => before.includes(m.text) || m.text === 'ok')).toBe(true);

    runtime.destroy();
  });

  test('background resume keeps fingerprints when re-applying the same tail', () => {
    const sessions = tempDir('speakeasy-rt-resume-');
    const taskId = '019f-resume-0001';
    writeRollout(sessions, taskId, [['resume me', 'resumed']]);

    const runtime = new DeckRuntime({
      warmCatalog: false,
      warmCanonical: false,
      taskTailRead: readerFor(sessions),
    });
    const internal = internals(runtime);
    internal.assignLane(3, taskId);
    const first = internal.threads[3].length;
    // Simulate reconnect/background: clear in-memory seen ids but keep messages + cursor.
    internal.laneTailSeen.delete(3);
    internal.syncLaneTaskTail(3, { reason: 'background-resume' });
    expect(internal.threads[3].length).toBe(first);
    expect(internal.threads[3].filter((m) => m.text === 'resume me').length).toBe(1);

    runtime.destroy();
  });
});
