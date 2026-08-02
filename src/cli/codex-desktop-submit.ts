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
}

interface SubmitOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  bridgePath?: string;
  runtimePath?: string;
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

function parseBridgeResult(stdout: string, expectedThreadId: string): CodexDesktopTurnResult {
  const line = stdout.trim().split('\n').filter(Boolean).at(-1);
  if (!line) throw new Error('Codex Desktop returned no bridge result.');

  let result: BridgeEnvelope;
  try {
    result = JSON.parse(line) as BridgeEnvelope;
  } catch {
    throw new Error('Codex Desktop returned an unreadable bridge result.');
  }

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

function stop(child: ChildProcessWithoutNullStreams): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const hardStop = setTimeout(() => child.kill('SIGKILL'), 1_000);
  hardStop.unref();
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
