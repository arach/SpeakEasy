import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import {
  isTaskTailError,
  readTaskTail,
  type TaskTailMessage,
  type TaskTailResult,
} from '@openscout/agent-sessions';

const CURSOR_FILE = 'task-tail-cursor.json';
const DEFAULT_MAX_MESSAGES = 20;

function defaultSessionsDir(): string {
  return process.env.SPEAKEASY_CODEX_SESSIONS_DIR?.trim()
    || path.join(homedir(), '.codex', 'sessions');
}

export interface LaneTailCursorRecord {
  taskId: string;
  cursor: string;
}

/** Presentation-ready tail message before the runtime attaches audio fields. */
export interface TailDeckMessage {
  role: 'you' | 'agent';
  text: string;
  sourceId: string;
}

export interface DeckTaskTailRead {
  taskId: string;
  messages: TailDeckMessage[];
  cursor: string;
  mode: 'initial' | 'incremental';
  bytesRead: number;
  fileSize: number;
  truncated: boolean;
  path: string;
}

export interface DeckTaskTailError {
  ok: false;
  code: string;
  message: string;
}

export type DeckTaskTailOutcome =
  | ({ ok: true } & DeckTaskTailRead)
  | DeckTaskTailError;

/** Locate the Codex rollout JSONL for an exact task id without reading file bodies. */
export function findCodexRolloutPath(
  taskId: string,
  sessionsDir = defaultSessionsDir(),
): string | null {
  const id = taskId.trim();
  if (!id) return null;
  let names: string[];
  try {
    names = readdirSync(sessionsDir, { recursive: true }) as string[];
  } catch {
    return null;
  }
  const match = names.find((n) => n.includes(id) && n.endsWith('.jsonl'));
  if (!match) return null;
  return path.join(sessionsDir, match);
}

export function laneTailCursorPath(runtimeDir: string): string {
  return path.join(runtimeDir, CURSOR_FILE);
}

export function loadLaneTailCursor(runtimeDir: string): LaneTailCursorRecord | null {
  try {
    const raw = JSON.parse(readFileSync(laneTailCursorPath(runtimeDir), 'utf8')) as Record<string, unknown>;
    const taskId = typeof raw.taskId === 'string' ? raw.taskId.trim() : '';
    const cursor = typeof raw.cursor === 'string' ? raw.cursor : '';
    if (!taskId || !cursor) return null;
    return { taskId, cursor };
  } catch {
    return null;
  }
}

export function saveLaneTailCursor(runtimeDir: string, record: LaneTailCursorRecord): void {
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(
    laneTailCursorPath(runtimeDir),
    JSON.stringify({ taskId: record.taskId, cursor: record.cursor }),
    { mode: 0o600 },
  );
}

export function clearLaneTailCursor(runtimeDir: string): void {
  const file = laneTailCursorPath(runtimeDir);
  try {
    if (existsSync(file)) writeFileSync(file, '', { mode: 0o600 });
  } catch {
    // best-effort
  }
}

export function toTailDeckMessage(message: TaskTailMessage): TailDeckMessage | null {
  const text = message.text?.trim();
  if (!text) return null;
  return {
    role: message.role === 'user' ? 'you' : 'agent',
    text,
    sourceId: message.id,
  };
}

export function messageFingerprint(role: string, text: string): string {
  return `${role}\0${text.trim()}`;
}

/**
 * Read the bounded conversational tail for a proven Codex task.
 * Pass an opaque cursor for incremental forward reads; omit it for last-N.
 */
export function readDeckTaskTail(input: {
  taskId: string;
  cursor?: string | null;
  maxMessages?: number;
  sessionsDir?: string;
  rolloutPath?: string;
  /** Injected for tests. */
  read?: typeof readTaskTail;
}): DeckTaskTailOutcome {
  const taskId = input.taskId.trim();
  if (!taskId) return { ok: false, code: 'INVALID_INPUT', message: 'task id required' };

  const rolloutPath = input.rolloutPath ?? findCodexRolloutPath(taskId, input.sessionsDir);
  if (!rolloutPath || !existsSync(rolloutPath)) {
    return { ok: false, code: 'SOURCE_UNAVAILABLE', message: 'Codex rollout not found for task' };
  }

  const read = input.read ?? readTaskTail;
  const mode: 'initial' | 'incremental' = input.cursor ? 'incremental' : 'initial';
  try {
    const result: TaskTailResult = read({
      path: rolloutPath,
      adapterType: 'codex',
      expectedTaskId: taskId,
      ...(input.cursor ? { cursor: input.cursor } : {}),
      maxMessages: input.maxMessages ?? DEFAULT_MAX_MESSAGES,
    });

    const messages: TailDeckMessage[] = [];
    for (const item of result.messages) {
      const deck = toTailDeckMessage(item);
      if (deck) messages.push(deck);
    }

    return {
      ok: true,
      taskId: result.taskId,
      messages,
      cursor: result.cursor,
      mode,
      bytesRead: result.source.bytesRead,
      fileSize: result.source.fileSize,
      truncated: result.truncated,
      path: result.source.path,
    };
  } catch (error) {
    if (isTaskTailError(error)) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: 'SOURCE_UNAVAILABLE',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Merge incremental tail messages into an existing thread without duplicates. */
export function mergeTailMessages<T extends { role: string; text: string }>(options: {
  existing: T[];
  incoming: TailDeckMessage[];
  seenIds: Set<string>;
  maxMessages: number;
  toMessage: (msg: TailDeckMessage) => T;
}): { messages: T[]; added: number } {
  const fingerprints = new Set(
    options.existing.map((m) => messageFingerprint(m.role, m.text)),
  );
  const next = [...options.existing];
  let added = 0;
  for (const msg of options.incoming) {
    if (options.seenIds.has(msg.sourceId)) continue;
    const fp = messageFingerprint(msg.role, msg.text);
    if (fingerprints.has(fp)) {
      options.seenIds.add(msg.sourceId);
      continue;
    }
    next.push(options.toMessage(msg));
    fingerprints.add(fp);
    options.seenIds.add(msg.sourceId);
    added += 1;
  }
  return {
    messages: next.slice(-options.maxMessages),
    added,
  };
}

/** True when a source read stayed within a bounded budget for a large file. */
export function isBoundedLargeRead(result: Pick<DeckTaskTailRead, 'bytesRead' | 'fileSize'>): boolean {
  if (result.fileSize <= 32 * 1024 * 1024) return true;
  return result.bytesRead < result.fileSize * 0.5 && result.bytesRead <= 64 * 1024 * 1024;
}

export function rolloutFileSize(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}
