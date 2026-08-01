import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type {
  Adapter,
  AdapterConfig,
  PairingEvent,
} from '@openscout/agent-sessions';

export interface DeckAgentClient {
  turn(input: { input: string; timeoutMs?: number; signal?: AbortSignal }): Promise<{
    text: string;
    session: { id: string; nativeId?: string };
  }>;
  close(): Promise<void>;
  interrupt(): void;
}

export interface DeckAgentClientOptions {
  harness: 'codex';
  cwd: string;
  reuseKey: string;
  warmth: 'lazy' | 'warm';
  systemPrompt: string;
  model?: string;
  effort?: string;
}

type AdapterFactory = (config: AdapterConfig) => Adapter;

interface DeckAgentClientDependencies {
  createAdapter?: AdapterFactory;
}

const DEFAULT_TIMEOUT_MS = 300_000;

function safeSessionSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'codex';
}

/**
 * Stable lane state owned by SpeakEasy. This intentionally matches the path
 * used by the former agent-sessions/local helper so upgrades keep every lane
 * binding and existing Codex thread.
 */
export function deckAgentRuntimeDir(sessionId: string): string {
  return path.join(homedir(), '.scout', 'local', 'codex', safeSessionSegment(sessionId), 'runtime');
}

function threadIdPath(sessionId: string): string {
  return path.join(deckAgentRuntimeDir(sessionId), 'codex-thread-id.txt');
}

async function readThreadId(sessionId: string): Promise<string | undefined> {
  try {
    const value = (await readFile(threadIdPath(sessionId), 'utf8')).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

async function persistThreadId(sessionId: string, nativeId: string | undefined): Promise<void> {
  if (!nativeId) return;
  const runtimeDir = deckAgentRuntimeDir(sessionId);
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(threadIdPath(sessionId), nativeId, { mode: 0o600 });
}

function nativeThreadId(adapter: Adapter): string | undefined {
  const value = adapter.session.providerMeta?.threadId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizedModel(model: string): string {
  const trimmed = model.trim();
  if (trimmed === '5.6' || trimmed === 'gpt-5.6') return 'gpt-5.6-sol';
  return /^\d+(?:\.\d+)*(?:-[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(trimmed)
    ? `gpt-${trimmed}`
    : trimmed;
}

/** Codex app-server reads model selection from normal `-c` overrides. */
function launchArgs(model?: string, effort?: string): string[] {
  return [
    ...(model?.trim() ? ['-c', `model=${JSON.stringify(normalizedModel(model))}`] : []),
    ...(effort?.trim() ? ['-c', `model_reasoning_effort=${JSON.stringify(effort.trim())}`] : []),
  ];
}

async function npmAdapterFactory(): Promise<AdapterFactory> {
  // Keep this a literal dynamic import: the normal CLI can load the ESM npm
  // package from its CJS build, while Bun can bundle it into the native helper.
  const module = await import('@openscout/agent-sessions');
  return module.createCodexAdapter;
}

function terminalError(event: PairingEvent): Error | undefined {
  if (event.event === 'turn:error') return new Error(event.message || 'Codex turn failed.');
  if (event.event !== 'turn:end') return undefined;
  if (event.status === 'failed') return new Error('Codex turn failed.');
  if (event.status === 'stopped') return new Error('Codex turn was interrupted.');
  return undefined;
}

export async function createDeckAgentClient(
  options: DeckAgentClientOptions,
  dependencies: DeckAgentClientDependencies = {},
): Promise<DeckAgentClient> {
  const sessionId = options.reuseKey.trim() || randomUUID();
  const createAdapter = dependencies.createAdapter ?? await npmAdapterFactory();
  const existingThreadId = await readThreadId(sessionId);
  const adapter = createAdapter({
    sessionId,
    name: 'SpeakEasy Deck',
    cwd: options.cwd,
    options: {
      systemPrompt: options.systemPrompt,
      launchArgs: launchArgs(options.model, options.effort),
      ...(existingThreadId ? { threadId: existingThreadId } : {}),
    },
  });
  let closed = false;
  let started = false;
  let queue: Promise<unknown> = Promise.resolve();

  const ensureStarted = async (): Promise<void> => {
    if (closed) throw new Error('Deck agent client is closed.');
    if (started) return;
    await adapter.start();
    started = true;
    await persistThreadId(sessionId, nativeThreadId(adapter));
  };

  if (options.warmth === 'warm') await ensureStarted();

  const runTurn = async (turn: { input: string; timeoutMs?: number; signal?: AbortSignal }) => {
    await ensureStarted();
    if (turn.signal?.aborted) throw new Error('Codex turn was aborted.');

    const timeoutMs = Math.max(1, turn.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const blocks = new Map<string, { index: number; text: string }>();
    let activeTurnId: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener: (() => void) | undefined;

    const text = await new Promise<string>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        adapter.off('event', onEvent);
        adapter.off('error', onError);
        removeAbortListener?.();
      };
      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };
      const finish = (): void => {
        const output = [...blocks.values()]
          .sort((a, b) => a.index - b.index)
          .map((block) => block.text.trim())
          .filter(Boolean)
          .join('\n\n');
        settle(() => resolve(output));
      };
      const onEvent = (event: PairingEvent): void => {
        if ('sessionId' in event && event.sessionId !== sessionId) return;
        if (event.event === 'turn:start') {
          activeTurnId = event.turn.id;
          return;
        }
        if (event.event === 'block:start' && event.block.type === 'text') {
          blocks.set(event.block.id, { index: event.block.index, text: event.block.text });
          return;
        }
        if (event.event === 'block:delta') {
          const block = blocks.get(event.blockId);
          if (block) block.text += event.text;
          return;
        }
        if ((event.event === 'turn:end' || event.event === 'turn:error')
          && activeTurnId === event.turnId) {
          const error = terminalError(event);
          if (error) settle(() => reject(error));
          else finish();
        }
      };
      const onError = (error: Error): void => settle(() => reject(error));

      adapter.on('event', onEvent);
      adapter.on('error', onError);
      timer = setTimeout(() => {
        adapter.interrupt();
        settle(() => reject(new Error(`Timed out waiting for Codex after ${timeoutMs}ms.`)));
      }, timeoutMs);
      if (turn.signal) {
        const abort = (): void => {
          adapter.interrupt();
          settle(() => reject(new Error('Codex turn was aborted.')));
        };
        turn.signal.addEventListener('abort', abort, { once: true });
        removeAbortListener = () => turn.signal?.removeEventListener('abort', abort);
      }
      adapter.send({ sessionId, text: turn.input.trim() });
    });

    const nativeId = nativeThreadId(adapter);
    await persistThreadId(sessionId, nativeId);
    return { text, session: { id: sessionId, nativeId } };
  };

  return {
    turn(turn) {
      const next = queue.then(() => runTurn(turn), () => runTurn(turn));
      queue = next.then(() => undefined, () => undefined);
      return next;
    },
    async close() {
      closed = true;
      await adapter.shutdown();
    },
    interrupt() {
      adapter.interrupt();
    },
  };
}
