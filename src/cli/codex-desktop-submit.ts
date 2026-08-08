import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 185_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export type CodexDesktopDelivery = 'started-turn' | 'steered-active-turn';

export interface CodexDesktopTurnResult {
  response: string;
  delivery: CodexDesktopDelivery;
  threadId: string;
  turnId: string;
}

interface BridgeEnvelope {
  ok?: boolean;
  code?: string;
  error?: string;
  response?: string;
  delivery?: string;
  threadId?: string;
  turnId?: string;
  type?: string;
  requestId?: string | null;
}

export interface SubmitOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  bridgePath?: string;
  runtimePath?: string;
}

export interface CodexDesktopSessionOptions {
  bridgePath?: string;
  runtimePath?: string;
  readyTimeoutMs?: number;
}

/**
 * The bridge ships in both the npm package and the native macOS app. Prefer an
 * explicit development override, then the copy beside this package, then the
 * installed app. Missing bridge code is an installation error, never a reason
 * to start a second Codex app-server.
 */
export function resolveCodexDesktopBridge(
  override = process.env.SPEAKEASY_CODEX_BRIDGE_PATH,
): string {
  const candidates = [
    override?.trim(),
    path.resolve(__dirname, '..', '..', 'app', 'Sources', 'SpeakEasy', 'Resources', 'codex-desktop-bridge.cjs'),
    '/Applications/SpeakEasy.app/Contents/Resources/SpeakEasy_SpeakEasy.bundle/codex-desktop-bridge.cjs',
  ].filter((candidate): candidate is string => Boolean(candidate));

  const bridge = candidates.find((candidate) => existsSync(candidate));
  if (!bridge) {
    throw new Error('The Codex Desktop bridge is not installed. Update SpeakEasy, then try again.');
  }
  return bridge;
}

function parseBridgeEnvelope(result: BridgeEnvelope, expectedThreadId: string): CodexDesktopTurnResult {
  if (!result.ok) {
    throw new Error(result.error?.trim() || `Codex Desktop bridge failed (${result.code || 'unknown error'}).`);
  }
  if (result.threadId !== expectedThreadId) {
    throw new Error('Codex Desktop returned the wrong task; the turn was not accepted.');
  }
  if (result.delivery !== 'started-turn' && result.delivery !== 'steered-active-turn') {
    throw new Error('Codex Desktop did not confirm how the turn was delivered.');
  }
  const response = result.response?.trim();
  const turnId = result.turnId?.trim();
  if (!response || !turnId) {
    throw new Error('Codex Desktop completed without a correlatable response.');
  }

  return {
    response,
    delivery: result.delivery,
    threadId: result.threadId,
    turnId,
  };
}

function parseBridgeResult(stdout: string, expectedThreadId: string): CodexDesktopTurnResult {
  const line = stdout.trim().split('\n').filter(Boolean).at(-1);
  if (!line) throw new Error('Codex Desktop returned no bridge result.');

  let result: BridgeEnvelope;
  try {
    result = JSON.parse(line) as BridgeEnvelope;
  } catch {
    throw new Error('Codex Desktop returned an unreadable bridge result.');
  }
  return parseBridgeEnvelope(result, expectedThreadId);
}

function stop(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const hardStop = setTimeout(() => child.kill('SIGKILL'), 1_000);
  hardStop.unref();
}

interface PendingWarmTurn {
  resolve: (result: CodexDesktopTurnResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/** A warm, exact-task Desktop channel for latency-sensitive surfaces such as
 * the iPad Deck. The expensive owner snapshot is proven once per selected
 * task; every subsequent transcript remains a native, correlatable Codex turn
 * over that same Desktop-owned IPC connection. */
export class CodexDesktopSession {
  readonly threadId: string;

  private readonly bridgePath: string;
  private readonly runtimePath: string;
  private readonly readyTimeoutMs: number;
  private child: ChildProcessWithoutNullStreams | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private readyTimer: NodeJS.Timeout | null = null;
  private stdout = '';
  private stderr = '';
  private pending = new Map<string, PendingWarmTurn>();
  private disposed = false;

  constructor(threadId: string, options: CodexDesktopSessionOptions = {}) {
    const exactThreadId = threadId.trim();
    if (!exactThreadId) throw new Error('The lane has no exact Codex task ID.');
    this.threadId = exactThreadId;
    this.bridgePath = options.bridgePath ?? resolveCodexDesktopBridge();
    this.runtimePath = options.runtimePath ?? process.execPath;
    this.readyTimeoutMs = Math.max(5_000, options.readyTimeoutMs ?? 125_000);
  }

  /** Resolve after Codex Desktop has proven the exact task owner. Calls share
   * one in-flight handshake and later calls are immediate. */
  warm(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('The Codex Desktop session is closed.'));
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    const child = spawn(this.runtimePath, [this.bridgePath, 'serve', this.threadId], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    this.child = child;
    this.stdout = '';
    this.stderr = '';
    this.readyTimer = setTimeout(() => {
      this.reset(new Error(`Timed out warming the exact Codex task after ${this.readyTimeoutMs}ms.`), child);
    }, this.readyTimeoutMs);
    this.readyTimer.unref();

    child.stdout.on('data', (chunk: Buffer) => this.consumeStdout(chunk, child));
    child.stderr.on('data', (chunk: Buffer) => {
      this.stderr = (this.stderr + chunk.toString('utf8')).slice(-64 * 1024);
    });
    child.stdin.on('error', (error) => this.reset(error, child));
    child.on('error', (error) => this.reset(error, child));
    child.on('close', (code) => {
      if (this.child !== child) return;
      const detail = this.stderr.trim();
      this.reset(new Error(detail || `Codex Desktop warm bridge exited (${code ?? 'signal'}).`), child);
    });
    return this.readyPromise;
  }

  async turn(text: string, options: Pick<SubmitOptions, 'signal' | 'timeoutMs'> = {}): Promise<CodexDesktopTurnResult> {
    const transcript = text.trim();
    if (!transcript) throw new Error('The transcript is empty.');
    if (options.signal?.aborted) throw new Error('The Codex turn was cancelled.');
    // Abort has to cover the handshake, not just the answer.
    //
    // The signal used to be wired up only after `warm()` resolved, so a cancel
    // arriving while the owner was still being proven had nothing listening to
    // it — the caller waited out the full ready timeout before the abort could
    // take effect. That is the exact window an operator is most likely to
    // cancel in: the task is unreachable, nothing is happening, and the deck
    // looks stuck. Measured at 8s to release a turn that had been cancelled
    // immediately; a cancel that takes eight seconds is not a cancel.
    const onWarmAbort = () => this.reset(new Error('The Codex turn was cancelled.'), this.child);
    options.signal?.addEventListener('abort', onWarmAbort, { once: true });
    try {
      await this.warm();
    } finally {
      options.signal?.removeEventListener('abort', onWarmAbort);
    }
    if (options.signal?.aborted) throw new Error('The Codex turn was cancelled.');
    const child = this.child;
    if (!child?.stdin.writable) throw new Error('Codex Desktop warm bridge is unavailable.');
    if (this.pending.size > 0) throw new Error('A canonical Codex turn is already in flight.');

    const requestId = randomUUID();
    const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    return new Promise<CodexDesktopTurnResult>((resolve, reject) => {
      const onAbort = () => this.reset(new Error('The Codex turn was cancelled.'), child);
      const timer = setTimeout(() => {
        this.reset(new Error(`Timed out waiting for the exact Codex task after ${timeoutMs}ms.`), child);
      }, timeoutMs);
      timer.unref();
      const pending: PendingWarmTurn = { resolve, reject, timer, signal: options.signal, onAbort };
      this.pending.set(requestId, pending);
      options.signal?.addEventListener('abort', onAbort, { once: true });
      child.stdin.write(`${JSON.stringify({ type: 'submit', requestId, text: transcript })}\n`);
    });
  }

  close(): void {
    this.disposed = true;
    this.reset(new Error('The Codex Desktop session was closed.'), this.child);
  }

  private consumeStdout(chunk: Buffer, child: ChildProcessWithoutNullStreams): void {
    if (this.child !== child) return;
    this.stdout += chunk.toString('utf8');
    if (Buffer.byteLength(this.stdout, 'utf8') > MAX_OUTPUT_BYTES) {
      this.reset(new Error('Codex Desktop bridge output exceeded its safety limit.'), child);
      return;
    }
    const lines = this.stdout.split('\n');
    this.stdout = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let envelope: BridgeEnvelope;
      try {
        envelope = JSON.parse(line) as BridgeEnvelope;
      } catch {
        this.reset(new Error('Codex Desktop returned an unreadable bridge result.'), child);
        return;
      }
      if (envelope.type === 'ready') {
        if (!envelope.ok || envelope.threadId !== this.threadId) {
          this.reset(new Error(envelope.error || 'Codex Desktop warmed the wrong task.'), child);
          return;
        }
        if (this.readyTimer) clearTimeout(this.readyTimer);
        this.readyTimer = null;
        const resolve = this.readyResolve;
        this.readyResolve = null;
        this.readyReject = null;
        resolve?.();
        continue;
      }
      if (this.readyResolve && envelope.ok === false && !envelope.requestId) {
        this.reset(new Error(envelope.error || 'Codex Desktop could not warm the exact task.'), child);
        return;
      }
      const requestId = envelope.requestId;
      if (!requestId) continue;
      const pending = this.pending.get(requestId);
      if (!pending) continue;
      this.pending.delete(requestId);
      clearTimeout(pending.timer);
      if (pending.onAbort) pending.signal?.removeEventListener('abort', pending.onAbort);
      try {
        pending.resolve(parseBridgeEnvelope(envelope, this.threadId));
      } catch (error) {
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private reset(error: Error, child: ChildProcessWithoutNullStreams | null): void {
    if (child && this.child !== child) return;
    const active = this.child;
    this.child = null;
    if (this.readyTimer) clearTimeout(this.readyTimer);
    this.readyTimer = null;
    const rejectReady = this.readyReject;
    this.readyResolve = null;
    this.readyReject = null;
    this.readyPromise = null;
    rejectReady?.(error);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      if (pending.onAbort) pending.signal?.removeEventListener('abort', pending.onAbort);
      pending.reject(error);
    }
    this.pending.clear();
    if (active) stop(active);
  }
}

/**
 * Submit one exact user transcript to an already-bound Codex Desktop task.
 * The bridge chooses start-vs-steer from the Desktop owner's live state and
 * returns only after the matching canonical turn completes.
 */
export function submitCodexDesktopTurn(
  threadId: string,
  text: string,
  options: SubmitOptions = {},
): Promise<CodexDesktopTurnResult> {
  const exactThreadId = threadId.trim();
  const transcript = text.trim();
  if (!exactThreadId) return Promise.reject(new Error('The lane has no exact Codex task ID.'));
  if (!transcript) return Promise.reject(new Error('The transcript is empty.'));
  if (options.signal?.aborted) return Promise.reject(new Error('The Codex turn was cancelled.'));

  const bridgePath = options.bridgePath ?? resolveCodexDesktopBridge();
  const runtimePath = options.runtimePath ?? process.execPath;
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    const child = spawn(runtimePath, [bridgePath, 'submit', exactThreadId], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let settled = false;

    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      callback();
    };
    const fail = (error: Error): void => finish(() => reject(error));
    const append = (current: Buffer, chunk: Buffer): Buffer => {
      if (current.length + chunk.length > MAX_OUTPUT_BYTES) {
        stop(child);
        fail(new Error('Codex Desktop bridge output exceeded its safety limit.'));
        return current;
      }
      return Buffer.concat([current, chunk]);
    };
    const onAbort = (): void => {
      stop(child);
      fail(new Error('The Codex turn was cancelled.'));
    };
    const timer = setTimeout(() => {
      stop(child);
      fail(new Error(`Timed out waiting for the exact Codex task after ${timeoutMs}ms.`));
    }, timeoutMs);
    timer.unref();

    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.on('error', (error) => fail(error));
    child.on('close', (code) => {
      if (settled) return;
      try {
        const parsed = parseBridgeResult(stdout.toString('utf8'), exactThreadId);
        if (code !== 0) {
          const detail = stderr.toString('utf8').trim();
          throw new Error(detail || 'Codex Desktop rejected the turn.');
        }
        finish(() => resolve(parsed));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });

    options.signal?.addEventListener('abort', onAbort, { once: true });
    child.stdin.on('error', (error) => fail(error));
    child.stdin.end(transcript);
  });
}
