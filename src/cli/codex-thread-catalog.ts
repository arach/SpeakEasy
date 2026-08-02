import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export interface CodexThreadReference {
  id: string;
  /** The same human-facing title returned to the Codex app. */
  title: string;
  preview: string;
  cwd: string;
  /** The Codex app project label, e.g. "speakeasy". */
  project: string;
  at: number;
  createdAt: number;
  source: string;
  isPinned: boolean;
}

interface AppThread {
  id?: unknown;
  name?: unknown;
  title?: unknown;
  preview?: unknown;
  cwd?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  recencyAt?: unknown;
  source?: unknown;
  sourceKind?: unknown;
  isPinned?: unknown;
  ephemeral?: unknown;
}

interface AppThreadPage {
  data?: AppThread[];
  nextCursor?: string | null;
}

interface CodexAppState {
  'local-projects'?: Record<string, { name?: unknown; rootPaths?: unknown }>;
  'thread-project-assignments'?: Record<string, { projectId?: unknown }>;
  'pinned-thread-ids'?: unknown;
}

interface JsonRpcResponse {
  id?: number | string;
  result?: unknown;
  error?: { message?: string };
  method?: string;
}

const APP_STATE_FILE = path.join(homedir(), '.codex', '.codex-global-state.json');
const DEFAULT_LIMIT = 150;
const REQUEST_TIMEOUT_MS = 12_000;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Turn broker-generated Scout prompts into a task-sized display title. The
 * complete prompt remains available as `preview` for search and diagnostics;
 * only the chrome-facing title loses routing and reply-mode machinery. */
export function displayCodexThreadTitle(value: unknown): string {
  let title = stringValue(value).replace(/\s+/g, ' ');
  if (!title) return 'Untitled task';

  if (title.startsWith('⌖')) {
    const subjectStart = title.indexOf('›');
    if (subjectStart >= 0 && subjectStart < 400) title = title.slice(subjectStart + 1).trim();

    const brokerMarkers = [
      /\s+delivery:\s*routed\b/i,
      /\s*<!--\s*SCOUT BROKER\b/i,
      /\s*<details>\s*<summary>Scout routing context/i,
    ];
    let end = title.length;
    for (const marker of brokerMarkers) {
      const match = marker.exec(title);
      if (match && match.index < end) end = match.index;
    }
    title = title.slice(0, end).trim();

    // Shell hints are useful in the full request but read like a broken title,
    // especially when the broker marker interrupted the closing parenthesis.
    title = title.replace(/\s+\(run:\s*.*$/i, '').trim();
  }

  const limit = 120;
  if (title.length > limit) {
    title = title.slice(0, limit - 1).replace(/\s+\S*$/, '').trimEnd() + '…';
  }
  return title || 'Untitled task';
}

function secondsToMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 10_000_000_000 ? n : n * 1000;
}

function fallbackProject(cwd: string): string {
  const clean = cwd.replace(/\/+$/, '');
  return path.basename(clean) || 'Codex';
}

async function loadCodexAppState(): Promise<CodexAppState> {
  try {
    return JSON.parse(await readFile(APP_STATE_FILE, 'utf8')) as CodexAppState;
  } catch {
    return {};
  }
}

/** Resolve the same project label the Codex sidebar uses. The direct
 * thread-to-project assignment wins; root matching covers older app state. */
export function codexProjectName(state: CodexAppState, threadId: string, cwd: string): string {
  const projects = state['local-projects'] ?? {};
  const assignedId = stringValue(state['thread-project-assignments']?.[threadId]?.projectId);
  const assignedName = stringValue(projects[assignedId]?.name);
  if (assignedName) return assignedName;

  let best: { length: number; name: string } | null = null;
  for (const project of Object.values(projects)) {
    const name = stringValue(project?.name);
    const roots = Array.isArray(project?.rootPaths) ? project.rootPaths : [];
    if (!name) continue;
    for (const rawRoot of roots) {
      const root = stringValue(rawRoot).replace(/\/+$/, '');
      if (!root || (cwd !== root && !cwd.startsWith(`${root}/`))) continue;
      if (!best || root.length > best.length) best = { length: root.length, name };
    }
  }
  if (best) return best.name;

  // Codex worktrees live outside their project root but retain its leaf name
  // (`~/.codex/worktrees/<id>/SpeakEasy`). The desktop app still groups those
  // under `speakeasy`, so mirror that final best-effort association.
  const leaf = path.basename(cwd.replace(/\/+$/, '')).toLowerCase();
  if (leaf) {
    for (const project of Object.values(projects)) {
      const name = stringValue(project?.name);
      const roots = Array.isArray(project?.rootPaths) ? project.rootPaths : [];
      if (name && roots.some((root) => path.basename(stringValue(root).replace(/\/+$/, '')).toLowerCase() === leaf)) {
        return name;
      }
    }
  }
  return fallbackProject(cwd);
}

/** Some app-server tasks report `/` as their execution cwd even though Codex
 * has an explicit project assignment. For identity display, replay the
 * configured project root instead of presenting that adapter placeholder as
 * the task checkout. A real, non-root thread cwd always wins. */
export function codexProjectCwd(state: CodexAppState, threadId: string, cwd: string): string {
  if (cwd && cwd !== '/') return cwd;
  const projects = state['local-projects'] ?? {};
  const assignedId = stringValue(state['thread-project-assignments']?.[threadId]?.projectId);
  const roots = Array.isArray(projects[assignedId]?.rootPaths) ? projects[assignedId].rootPaths : [];
  return roots.map(stringValue).find(Boolean) || cwd;
}

class AppServerClient {
  private child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private nextId = 0;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private stderr = '';
  private closed = false;

  constructor(cwd: string) {
    const executable = process.env.CODEX_BIN?.trim() || 'codex';
    this.child = spawn(executable, ['app-server'], {
      cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.consume(chunk));
    this.child.stderr.on('data', (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-4000);
    });
    this.child.once('error', (error) => this.fail(error));
    this.child.once('exit', (code, signal) => {
      if (this.closed) return;
      const suffix = this.stderr.trim() ? `: ${this.stderr.trim().split('\n').slice(-1)[0]}` : '';
      this.fail(new Error(`Codex app-server exited (${code ?? signal ?? 'unknown'})${suffix}`));
    });
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message: JsonRpcResponse;
      try {
        message = JSON.parse(line) as JsonRpcResponse;
      } catch {
        continue;
      }
      if (typeof message.id === 'number' && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(message.error.message || 'Codex app-server request failed.'));
        else pending.resolve(message.result);
        continue;
      }
      // SpeakEasy only issues read-only requests. Reject unexpected server
      // requests explicitly so neither side waits forever.
      if (message.id !== undefined && message.method) {
        this.write({ id: message.id, error: { code: -32601, message: 'Unsupported by SpeakEasy catalog client' } });
      }
    }
  }

  private write(message: unknown): void {
    if (this.closed || !this.child.stdin.writable) throw new Error('Codex app-server is not running.');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server ${method} timed out.`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      try {
        this.write({ method, id, ...(params ? { params } : {}) });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  notify(method: string, params?: Record<string, unknown>): void {
    this.write({ method, ...(params ? { params } : {}) });
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error('Codex app-server closed.'));
    this.child.stdin.end();
    if (this.child.exitCode === null && !this.child.killed) this.child.kill('SIGTERM');
  }
}

/** List the exact interactive thread references exposed to Codex clients.
 * This intentionally uses app-server rather than scraping rollout prompts. */
export async function listCodexThreadReferences(
  cwd = process.cwd(),
  limit = DEFAULT_LIMIT,
): Promise<CodexThreadReference[]> {
  const client = new AppServerClient(cwd);
  try {
    await client.request('initialize', {
      clientInfo: { name: 'speakeasy', title: 'SpeakEasy', version: '0.2.8' },
    });
    client.notify('initialized');

    const threads: AppThread[] = [];
    let cursor: string | null = null;
    do {
      const page = await client.request<AppThreadPage>('thread/list', {
        cursor,
        limit: Math.min(100, Math.max(1, limit - threads.length)),
        sortKey: 'recency_at',
        sortDirection: 'desc',
        archived: false,
      });
      if (Array.isArray(page?.data)) threads.push(...page.data);
      cursor = typeof page?.nextCursor === 'string' && page.nextCursor ? page.nextCursor : null;
    } while (cursor && threads.length < limit);

    const state = await loadCodexAppState();
    const pinnedThreadIds = new Set(
      Array.isArray(state['pinned-thread-ids'])
        ? state['pinned-thread-ids'].map(stringValue).filter(Boolean)
        : [],
    );
    return threads
      .filter((thread) => thread.ephemeral !== true)
      .map((thread): CodexThreadReference | null => {
        const id = stringValue(thread.id);
        const threadCwd = stringValue(thread.cwd);
        if (!id || !threadCwd) return null;
        const identityCwd = codexProjectCwd(state, id, threadCwd);
        const preview = stringValue(thread.preview);
        const title = displayCodexThreadTitle(
          stringValue(thread.name) || stringValue(thread.title) || preview || 'Untitled task',
        );
        return {
          id,
          title,
          preview,
          cwd: identityCwd,
          project: codexProjectName(state, id, identityCwd),
          at: secondsToMs(thread.recencyAt) || secondsToMs(thread.updatedAt) || secondsToMs(thread.createdAt),
          createdAt: secondsToMs(thread.createdAt),
          source: stringValue(thread.sourceKind) || stringValue(thread.source),
          isPinned: thread.isPinned === true || pinnedThreadIds.has(id),
        };
      })
      .filter((thread): thread is CodexThreadReference => thread !== null)
      .slice(0, limit);
  } finally {
    client.close();
  }
}
