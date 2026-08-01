import { afterEach, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  Adapter,
  AdapterConfig,
  PairingEvent,
} from '@openscout/agent-sessions';
import {
  createDeckAgentClient,
  deckAgentRuntimeDir,
} from '../src/cli/deck-agent-client';

const cleanupRoots: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fakeAdapter(config: AdapterConfig): Adapter {
  const eventListeners = new Set<(event: PairingEvent) => void>();
  const errorListeners = new Set<(error: Error) => void>();
  const nativeId = String(config.options?.threadId ?? 'fresh-thread-id');
  const session = {
    id: config.sessionId,
    name: config.name ?? 'Deck test',
    adapterType: 'codex',
    status: 'connecting' as const,
    cwd: config.cwd,
    providerMeta: { threadId: nativeId },
  };

  return {
    type: 'codex',
    session,
    async start() {
      session.status = 'idle' as never;
    },
    send() {
      queueMicrotask(() => {
        const turnId = 'turn-1';
        const emit = (event: PairingEvent) => eventListeners.forEach((listener) => listener(event));
        emit({
          event: 'turn:start',
          sessionId: config.sessionId,
          turn: { id: turnId, sessionId: config.sessionId, status: 'started', startedAt: new Date().toISOString(), blocks: [] },
        });
        emit({
          event: 'block:start',
          sessionId: config.sessionId,
          turnId,
          block: { id: 'answer', turnId, index: 0, type: 'text', text: '', status: 'streaming' },
        });
        emit({ event: 'block:delta', sessionId: config.sessionId, turnId, blockId: 'answer', text: 'npm package works' });
        emit({ event: 'turn:end', sessionId: config.sessionId, turnId, status: 'completed' });
      });
    },
    interrupt() {},
    async shutdown() {
      session.status = 'closed' as never;
    },
    on(event: 'event' | 'error', listener: ((event: PairingEvent) => void) | ((error: Error) => void)) {
      if (event === 'event') eventListeners.add(listener as (event: PairingEvent) => void);
      else errorListeners.add(listener as (error: Error) => void);
    },
    off(event: 'event' | 'error', listener: ((event: PairingEvent) => void) | ((error: Error) => void)) {
      if (event === 'event') eventListeners.delete(listener as (event: PairingEvent) => void);
      else errorListeners.delete(listener as (error: Error) => void);
    },
  } as Adapter;
}

test('uses the npm adapter while preserving an existing lane thread', async () => {
  const reuseKey = `speakeasy-test-${crypto.randomUUID()}`;
  const runtimeDir = deckAgentRuntimeDir(reuseKey);
  cleanupRoots.push(path.dirname(runtimeDir));
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(path.join(runtimeDir, 'codex-thread-id.txt'), 'legacy-thread-id');

  let receivedConfig: AdapterConfig | undefined;
  const client = await createDeckAgentClient({
    harness: 'codex',
    cwd: process.cwd(),
    reuseKey,
    warmth: 'lazy',
    systemPrompt: 'Answer briefly.',
    model: '5.6',
    effort: 'low',
  }, {
    createAdapter(config) {
      receivedConfig = config;
      return fakeAdapter(config);
    },
  });

  const result = await client.turn({ input: 'Does it work?' });
  await client.close();

  expect(result.text).toBe('npm package works');
  expect(result.session.nativeId).toBe('legacy-thread-id');
  expect(receivedConfig?.options?.threadId).toBe('legacy-thread-id');
  expect(receivedConfig?.options?.launchArgs).toEqual([
    '-c', 'model="gpt-5.6-sol"',
    '-c', 'model_reasoning_effort="low"',
  ]);
});
