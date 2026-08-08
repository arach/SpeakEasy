import { EventEmitter } from 'node:events';
import { spawn, execFile, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import {
  createDeckAgentClient,
  deckAgentRuntimeDir,
  type DeckAgentClient,
  type DeckAgentClientOptions,
} from './deck-agent-client.js';
import { CodexDesktopSession } from './codex-desktop-submit.js';
import {
  findCodexRollout,
  listCodexRolloutReferences,
  listCodexThreadReferences,
  type CodexThreadCandidate,
} from './codex-thread-catalog.js';
import { DECK_LANES_FILE } from '../paths.js';
import {
  clearLaneTailCursor,
  isBoundedLargeRead,
  loadLaneTailCursor,
  mergeTailMessages,
  readDeckTaskTail,
  saveLaneTailCursor,
  type TailDeckMessage,
} from './deck-task-tail.js';

/** execFile as a promise, capturing stdout, with a hard timeout. */
function run(cmd: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/** Best-effort branch identity for a task workspace. A detached checkout is
 * still useful identity, so fall back to its short commit instead of hiding it. */
function gitBranchFor(cwd: string): string {
  if (!cwd) return '';
  try {
    const branch = execFileSync('git', ['-C', cwd, 'branch', '--show-current'], {
      encoding: 'utf8',
      timeout: 1_500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (branch) return branch;
    const commit = execFileSync('git', ['-C', cwd, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      timeout: 1_500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return commit ? `detached @ ${commit}` : '';
  } catch {
    return '';
  }
}

export interface DeckMessage {
  role: 'you' | 'agent';
  text: string;
  dur: number;
  /** true while this is only a progress mirror — no controllable audio behind it */
  mirrored?: boolean;
  /** the segment currently being spoken — real transport control when present */
  file?: string;
  /** where a connected deck can fetch the current segment to play it on the device */
  audioUrl?: string;
  /** every narration segment, in speaking order. Long replies span several files. */
  segments?: string[];
  /** the deck-facing URL of each segment, index-aligned with `segments` */
  segmentUrls?: string[];
  /** estimated seconds per segment, index-aligned with `segments` */
  segmentDurs?: number[];
}

export interface DeckTraceEntry {
  at: string;
  kind: string;
  detail: string;
}

/** A resumable codex thread, discovered from local rollout files. */
export interface DeckThreadInfo {
  id: string;
  cwd: string;
  /** Exact user-facing task title from Codex app-server. */
  snippet: string;
  /** Original first-message preview; useful for search without replacing title. */
  preview?: string;
  /** Exact project label from the Codex app when available. */
  project?: string;
  at: number;
  originator: string;
  isPinned?: boolean;
}

export interface DeckLaneInfo {
  num: string;
  name: string;
  title: string;
  state: 'speaking' | 'working' | 'idle' | 'empty';
  /** full codex thread id while bound — the mapper's identity for this lane */
  threadId?: string;
  /** short codex thread id, shown once the lane's session has answered (display only) */
  sessionAlias?: string;
  /** Codex project and checkout identity, repeated on the active-lane console. */
  project?: string;
  cwd?: string;
  branch?: string;
  /** Last known task timestamp from the Codex catalog. */
  updatedAt?: number;
  /** Who owns the conversation behind this lane. 'codex' is a task started in
   * Codex Desktop and steered through the exact-owner bridge. 'deck' is a
   * thread this deck created itself, on an explicit operator action, and drives
   * over its own app-server session. Absent means the lane is unassigned. */
  origin?: DeckLaneOrigin;
}

export type DeckLaneOrigin = 'codex' | 'deck';

export interface DeckSnapshot {
  type: 'snapshot';
  rev: number;
  lane: number;
  lanes: DeckLaneInfo[];
  threads: DeckMessage[][];
  playing: string | null;
  paused: boolean;
  /** elapsed seconds across the whole narration, not just the current segment */
  pos: number;
  /** which narration segment is playing — long replies span several files */
  segIx: number;
  /** seconds of narration before the current segment begins */
  segStart: number;
  /** total number of segments in the narration in flight */
  segCount: number;
  speedIx: number;
  vol: number;
  autoplay: boolean;
  listening: boolean;
  phase: string;
  confirm: string;
  trace: DeckTraceEntry[];
  /** short name of the Mac serving this deck — the deck is titled after it */
  host: string;
  /** recent resumable codex threads — filled by the catalog.refresh intent */
  catalog: DeckThreadInfo[];
  /** set when the last catalog scan failed and the list is stale */
  catalogError: string | null;
  /** live deck clients connected to the data plane right now */
  clients: number;
}

export interface DeckRuntimeOptions {
  /** Skip the eager Codex catalog read in isolated runtime tests. */
  warmCatalog?: boolean;
  /** Skip exact-task owner prewarming in isolated runtime tests. */
  warmCanonical?: boolean;
  /** Test seam for bounded task-tail reads. */
  taskTailRead?: typeof readDeckTaskTail;
}

const intentSchema = z.discriminatedUnion('name', [
  // max 9: lanes 0-8 plus the deck-owned overview lane (MASTER_IX below —
  // a literal here because the schema initializes before the constants)
  z.object({ name: z.literal('lane.select'), index: z.number().int().min(0).max(9) }),
  z.object({ name: z.literal('playback.toggle'), id: z.string().regex(/^\d:\d{1,3}$/) }),
  z.object({ name: z.literal('playback.scrub'), id: z.string().regex(/^\d:\d{1,3}$/), frac: z.number().min(0).max(1) }),
  z.object({ name: z.literal('playback.speed') }),
  z.object({ name: z.literal('playback.volume'), vol: z.number().min(0).max(1) }),
  z.object({ name: z.literal('playback.autoplay') }),
  z.object({ name: z.literal('playback.stop') }),
  z.object({ name: z.literal('playback.replay') }),
  z.object({ name: z.literal('capture.start') }),
  z.object({ name: z.literal('capture.cancel'), reason: z.string().max(60).optional() }),
  /** Take back a turn already sent. See the handler for why this is separate
   *  from `capture.cancel` and from `playback.stop`. */
  z.object({ name: z.literal('turn.abort') }),
  z.object({
    name: z.literal('capture.end'),
    text: z.string().max(500).optional(),
    /** Idempotency key. A client that never loses a transcript must be free to
     *  retry one whose ack it never saw; the same id is accepted exactly once. */
    utteranceId: z.string().max(64).optional(),
    /** The lane the operator was addressing when they spoke. Delivery can lag
     *  capture by minutes, so the target travels with the words. */
    lane: z.number().int().min(0).max(8).optional(),
  }),
  z.object({ name: z.literal('speak'), text: z.string().min(1).max(4000) }),
  z.object({ name: z.literal('lane.cycle'), index: z.number().int().min(0).max(8) }),
  z.object({ name: z.literal('catalog.refresh') }),
  z.object({
    name: z.literal('lane.new'),
    index: z.number().int().min(0).max(8),
    /** Working directory for the new thread. Defaults to the deck's own cwd. */
    cwd: z.string().max(512).optional(),
  }),
  z.object({
    name: z.literal('lane.assign'),
    index: z.number().int().min(0).max(8),
    threadId: z.string().max(64).nullable(),
    /** The Deck picker activates what the operator just chose; Mac settings can map silently. */
    activate: z.boolean().optional(),
  }),
  z.object({ name: z.literal('playback.progress'), id: z.string().regex(/^\d:\d{1,3}$/), pos: z.number().min(0), dur: z.number().positive().optional() }),
  z.object({ name: z.literal('playback.ended'), id: z.string().regex(/^\d:\d{1,3}$/) }),
]);

export type DeckIntent = z.infer<typeof intentSchema>;

const SPEEDS = [1, 1.25, 1.5, 0.75]; // must match the deck client's SPEEDS exactly
const LANE_COUNT = 9;
/** The overview officer: a deck-owned 10th lane on a cheap, fast model that
 * answers questions about the whole system from a live digest. Not mappable. */
const MASTER_IX = 9;
/** v2: session prompts apply at session creation, so a prompt change means a
 * fresh key — the old thread held the old instructions. */
const MASTER_REUSE_KEY = 'speakeasy-deck-master-v2';
const OVERVIEW_MODEL = 'gpt-5.6-luna';
/** low on purpose: the digest does the work — the overview lane should read
 * the board and report, never overthink or get clever. */
const OVERVIEW_EFFORT = 'low';
const TICK_MS = 250;
/** Deep enough to hold a failure and the turn that caused it. */
const TRACE_LIMIT = 24;
const MAX_MESSAGES_PER_LANE = 50;

/** Marker inside a lane's runtime dir: this lane holds a deck-created thread,
 * and its contents are that thread's working directory. Kept beside
 * codex-thread-id.txt so lane ownership survives a restart the same way. */
const DECK_ORIGIN_FILE = 'deck-thread-cwd.txt';

/**
 * How long to wait for Codex Desktop to prove which window owns a task.
 *
 * The bridge handshake has two stages and they are asked entirely different
 * questions. `warm()` asks "does a Desktop window own this task" — a local IPC
 * round-trip against a running app, which answers in about a second or is never
 * going to. `turn()` asks "what is the answer" — a model, which may legitimately
 * think for minutes.
 *
 * They shipped sharing one deadline (125s / 185s), and that is what wedges the
 * deck. `this.busy` is global and is held for the whole of `respond()`, so a
 * turn aimed at a task no window owns locks *every* lane's microphone for over
 * three minutes. The iPad's outbox is durable by design — it never drops a
 * transcript — so it re-delivers the moment the block lifts, onto the same
 * unowned task, and buys another three minutes. That livelock is what the
 * operator sees as "my sends are queued": the deck looks healthy the whole time,
 * because lane selection is not gated on `busy`.
 *
 * So the owner question gets a deadline sized to the owner question. An answer
 * still gets its minutes; only "is anyone home" fails fast.
 */
const CANONICAL_OWNER_TIMEOUT_MS = 9_000;

export type DeckTurnRoute =
  | { kind: 'canonical'; taskId: string }
  | { kind: 'deck'; index: number }
  | { kind: 'unassigned' }
  | { kind: 'overview' };

/** Resolve authority before a transcript can touch any model transport. */
export function resolveDeckTurnRoute(
  laneIx: number,
  taskId?: string,
  origin?: DeckLaneOrigin,
): DeckTurnRoute {
  if (laneIx === MASTER_IX) return { kind: 'overview' };
  // Ownership picks the transport; the thread id is only identity. A deck
  // thread acquires a codex thread id as soon as its first turn answers, and
  // routing that id through the Desktop bridge would hang forever — no Desktop
  // window owns it. Origin is authoritative because only an explicit lane.new
  // sets 'deck', and binding a Codex task always rotates the lane key away.
  if (origin === 'deck') return { kind: 'deck', index: laneIx };
  const exactTaskId = taskId?.trim();
  // A lane bound to a Desktop task is answered by that task or not at all.
  // This is deliberately NOT a fallback to a session — the silent shadow
  // session is what 38ed6d6 removed.
  if (exactTaskId) return { kind: 'canonical', taskId: exactTaskId };
  return { kind: 'unassigned' };
}

/**
 * Turn a bridge failure into something the operator can act on.
 *
 * The three ways a canonical turn dies are three different problems with three
 * different fixes, and they are told apart by evidence rather than guessed at:
 *
 *  - ECONNREFUSED on the IPC socket. The socket *file* is there but nothing is
 *    bound to it, which is what a unix socket looks like after the process that
 *    created it exits without unlinking. Codex Desktop is not running. (Had it
 *    never run, the error would be ENOENT instead — the distinction is the
 *    whole diagnosis, so both are matched and named separately.)
 *  - No owner. Desktop is up, but no window holds that task, and the bridge can
 *    only steer a task some window owns.
 *  - Anything else. Say what it was rather than inventing a cause.
 *
 * This used to collapse the first case into the catch-all, so a stopped Codex
 * Desktop surfaced on the iPad as `connect ECONNREFUSED
 * /Users/…/.codex/ipc/ipc.sock` — an errno and a path, in a voice interface,
 * naming neither the app at fault nor the thing to do about it.
 */
export function describeCanonicalFailure(detail: string): string {
  if (/ECONNREFUSED/i.test(detail)) {
    return 'Codex Desktop is not running, so nothing can be steered. Start it on the Mac and try again.';
  }
  if (/ENOENT/i.test(detail) && /ipc\.sock/i.test(detail)) {
    return 'Codex Desktop has never opened its bridge on this Mac. Start Codex Desktop, then try again.';
  }
  // A warm timeout is not a slow answer — it is the owner handshake never
  // completing, which only happens when no window holds the task. Reporting it
  // as "timed out" invites the operator to wait, and waiting never fixes it.
  if (/owner|Open the locked task|warming the exact Codex task/i.test(detail)) {
    return 'No Codex Desktop window owns that task, so it cannot be steered. Open it in Codex Desktop, or start a new thread from the lane picker.';
  }
  return `The exact Codex task did not answer — ${detail.slice(0, 120)}`;
}

function deckThreadInfo(thread: CodexThreadCandidate): DeckThreadInfo {
  return {
    id: thread.id,
    cwd: thread.cwd,
    snippet: thread.title,
    preview: thread.preview,
    project: thread.project,
    at: thread.at,
    originator: thread.source,
    isPinned: thread.isPinned,
  };
}

/** Per-lane binding keys. The files beneath these keys persist only the exact
 * Codex task assigned to each worker pad; they are not worker-agent identities.
 * Only Deck-owned keys are honored — legacy Scout session ids are ignored. */
function loadLaneKeys(): string[] {
  const base = Array.from({ length: LANE_COUNT }, (_, i) => `speakeasy-deck-lane-${i}`);
  try {
    const saved = JSON.parse(readFileSync(DECK_LANES_FILE, 'utf8')) as Record<string, unknown>;
    return base.map((b, i) => {
      const v = saved[String(i)];
      return typeof v === 'string' && v.startsWith('speakeasy-deck-lane-') ? v : b;
    });
  } catch {
    return base;
  }
}

/** Session-level instructions for the overview lane: the digest is its eyes. */
const OVERVIEW_SYSTEM_PROMPT =
  'You are the overview officer of a voice-command deck with nine lanes, each a live codex thread. ' +
  'Every question arrives with a DECK STATUS digest that is live and authoritative. ' +
  'Report exactly what the digest shows and nothing more — no interpretation, no suggestions, no color commentary, never invent state. ' +
  'Do not use tools, do not read or write files, do not access the network. ' +
  'Plain spoken words, no lists, no code: one or two sentences for a status question, a few plain sentences for a summary.';

/** A deck thread answers out loud, so it is told to speak rather than format.
 * Unlike the overview officer it is a full working agent — tools and files are
 * exactly the point; only the shape of the reply is constrained. */
const DECK_THREAD_SYSTEM_PROMPT =
  'You are answering over a voice deck: your replies are read aloud, not displayed. ' +
  'Speak in plain sentences — no markdown, no bullet lists, no code blocks, no file paths read out character by character. ' +
  'Lead with the answer, then the reason. Two or three sentences unless asked for more. ' +
  'Work normally otherwise: read and edit files, run commands, and use your tools as needed.';

function clock(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function laneNumber(index: number): string {
  return `LANE ${String(index + 1).padStart(2, '0')}`;
}

function threadAlias(threadId: string): string {
  return threadId.replace(/-/g, '').slice(-8);
}

function storedThreadId(key: string): string | null {
  try {
    return readFileSync(path.join(deckAgentRuntimeDir(key), 'codex-thread-id.txt'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** Rough speech duration: ~2.5 words per second at 1x, floor 1.5s. */
export function estimateDuration(text: string, rate = 1): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, words / (2.5 * rate));
}

/** Exact duration of a rendered audio file, or null when it cannot be read. */
export function audioDurationOf(file: string): number | null {
  try {
    const info = execFileSync('afinfo', [file], {
      encoding: 'utf8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = info.match(/estimated duration:\s*([\d.]+)\s*sec/i);
    const seconds = match ? Number.parseFloat(match[1]) : Number.NaN;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}

/**
 * Per-segment durations for a multi-part narration. The rendered audio is the
 * authority; the word-rate estimate is only a fallback so the transport still
 * has a usable clock when `afinfo` cannot read a file.
 */
export function measureSegmentDurations(files: string[], text: string): number[] {
  if (files.length === 0) return [];
  const fallback = Math.max(1.5, estimateDuration(text) / files.length);
  return files.map((file) => audioDurationOf(file) ?? fallback);
}

export function parseIntent(raw: unknown): { intent?: DeckIntent; error?: string } {
  const parsed = intentSchema.safeParse(raw);
  if (!parsed.success) return { error: 'invalid intent' };
  return { intent: parsed.data };
}

/**
 * The Mac-authoritative deck runtime. Owns lanes, threads, the phase machine,
 * and playback state; the deck renders snapshots and sends intents.
 *
 * Audio model: runtime-originated speech is synthesized to a file and played
 * through our own afplay child process, so pause (SIGSTOP), resume (SIGCONT),
 * and stop (kill) are real. Mirrored items (spoken by another process) are
 * progress mirrors only — the transport does not pretend to control them.
 */
export class DeckRuntime extends EventEmitter {
  private rev = 0;
  private laneIx = 1;
  private lanes: DeckLaneInfo[] = [
    ...Array.from({ length: LANE_COUNT }, (_, i) => ({
      num: String(i + 1).padStart(2, '0'),
      name: `LANE ${i + 1}`,
      title: 'assign a Codex task before speaking',
      state: 'idle' as const,
    })),
    {
      num: 'OV',
      name: 'OVERVIEW',
      title: `whole-deck view · ${OVERVIEW_MODEL} · ${OVERVIEW_EFFORT}`,
      state: 'idle' as const,
    },
  ];
  /** per-lane binding keys — clearing a lane rotates the persisted assignment */
  private laneKeys: string[] = loadLaneKeys();
  /** The single hidden overview client. Worker conversations never use it. */
  private laneClients = new Map<number, { key: string; client: DeckAgentClient }>();
  /** One direct turn currently owned by the Codex Desktop bridge. */
  private canonicalTurnAbort: AbortController | null = null;
  /** Warm exact-task channel. Owner discovery is intentionally amortized
   * across turns because mature Codex task snapshots can be hundreds of MB. */
  private canonicalSession: CodexDesktopSession | null = null;
  private canonicalSessionReady = false;
  private threads: DeckMessage[][] = Array.from({ length: LANE_COUNT + 1 }, () => []);
  /** Opaque task-tail cursors and seen source ids, keyed by lane index. */
  private laneTailSeen = new Map<number, Set<string>>();
  private laneTailInFlight = new Set<number>();
  private tailPollTimer: NodeJS.Timeout | null = null;
  private taskTailRead: typeof readDeckTaskTail = readDeckTaskTail;
  private playing: string | null = null;
  private paused = false;
  private pos = 0;
  /** Index of the narration segment currently being spoken for `playing`. */
  private segIx = 0;
  private speedIx = 0;
  private vol = 0.8;
  private autoplay = true;
  private listening = false;
  /** Recently accepted utterance ids, so a client's retry cannot double-submit. */
  private acceptedUtterances: string[] = [];
  private phase = 'idle';
  private confirm = 'READY';
  private trace: DeckTraceEntry[] = [];
  private host = hostname().replace(/\.(local|lan)$/, '');
  private catalog: DeckThreadInfo[] = [];
  private catalogError: string | null = null;
  private catalogRefresh: Promise<void> | null = null;
  private ticker: NodeJS.Timeout | null = null;
  private busy = false;
  private destroyed = false;
  /** Bumped for each accepted capture and teardown; async phases retain only
   * the generation that created them. */
  private gen = 0;
  /** A transport stop silences the current reply without detaching from Codex. */
  private suppressAutoplayForGeneration: number | null = null;
  private player: ChildProcess | null = null;
  private playerRate = 1;
  private synthDir = mkdtempSync(path.join(tmpdir(), 'speakeasy-deck-synth-'));
  /** set by the data plane — how many live deck clients are connected */
  liveClients: () => number = () => 0;

  /** the directory synthesized audio is served from (deck-live exposes it at /audio) */
  get audioDir(): string {
    return this.synthDir;
  }

  constructor(options: DeckRuntimeOptions = {}) {
    super();
    if (options.taskTailRead) this.taskTailRead = options.taskTailRead;
    this.restoreLaneBindings();
    // Warm the exact Codex task catalog before the user opens lane setup. The
    // explicit refresh action reuses this in-flight request if it is still busy.
    if (options.warmCatalog !== false) void this.refreshThreadCatalog();
    if (options.warmCanonical !== false) queueMicrotask(() => this.warmCanonicalLane(this.laneIx));
    // Hydrate recent canonical messages for restored bindings without loading
    // full Codex rollouts. Scout is not involved — local readTaskTail only.
    queueMicrotask(() => {
      for (let i = 0; i < LANE_COUNT; i++) {
        if (this.lanes[i]?.threadId) void this.syncLaneTaskTail(i, { reason: 'restore' });
      }
      this.ensureTailPoll();
    });
  }

  /** Copy identity from the exact Codex catalog record used for the binding.
   * This keeps the web/iPad surface from inferring a project from task copy or
   * accidentally showing the runtime's own checkout. */
  private applyThreadIdentity(lane: DeckLaneInfo, info: DeckThreadInfo): void {
    lane.title = info.snippet;
    lane.project = info.project || path.basename(info.cwd) || 'Codex';
    lane.cwd = info.cwd || undefined;
    lane.branch = info.cwd ? gitBranchFor(info.cwd) || undefined : undefined;
    lane.updatedAt = info.at;
  }

  private refreshThreadCatalog(): Promise<void> {
    if (this.catalogRefresh) return this.catalogRefresh;
    this.catalogRefresh = (async () => {
      let next: DeckThreadInfo[] | null = null;
      let fallback = false;
      try {
        const refs = await listCodexThreadReferences(process.cwd());
        next = refs.map(deckThreadInfo);
      } catch {
        // Older Codex builds may not have thread/list. Preserve a useful, if
        // less polished, catalog instead of making lane setup unusable.
        const references = listCodexRolloutReferences();
        next = references?.map(deckThreadInfo) ?? null;
        fallback = references !== null;
      }
      if (this.destroyed) return;
      if (next) {
        const master = this.masterThreadId();
        this.catalog = master ? next.filter((thread) => thread.id !== master) : next;
        this.catalogError = fallback
          ? 'Codex task titles are unavailable — showing rollout references.'
          : null;
        // A catalog refresh also upgrades restored lane labels from a rollout
        // snippet to the exact title currently shown by the Codex app.
        for (let i = 0; i < LANE_COUNT; i++) {
          const id = this.laneThreadId(i);
          const match = id ? this.catalog.find((thread) => thread.id === id) : undefined;
          if (match) this.applyThreadIdentity(this.lanes[i], match);
        }
      } else {
        // Keep whatever was already visible — a stale list beats an empty one.
        this.catalogError = 'Could not read Codex tasks — showing the last list.';
        this.log('CATALOG FAILED', 'Codex app-server and rollout catalog unavailable');
      }
      this.changed();
    })().finally(() => {
      this.catalogRefresh = null;
    });
    return this.catalogRefresh;
  }

  /** Rebuild lane labels for persisted task bindings. The direct Desktop
   * bridge uses the exact task id; this restores what the pad says it targets.
   * Restores honor the one-thread-one-lane invariant too: legacy state from
   * before dedupe can double-bind a thread, and the first lane keeps it. */
  private restoreLaneBindings(): void {
    const claimed = new Set<string>();
    let rotated = false;
    this.laneKeys.forEach((key, i) => {
      // Deck ownership is checked first and wins outright. The session adapter
      // writes codex-thread-id.txt for a deck thread too, so keying off that
      // file alone would silently hand the lane to the Desktop bridge, which
      // can never reach a thread no Desktop window owns.
      const deckCwd = this.laneDeckOrigin(i);
      if (deckCwd) {
        const lane = this.lanes[i];
        lane.origin = 'deck';
        lane.cwd = deckCwd;
        lane.project = path.basename(deckCwd) || 'Codex';
        lane.branch = gitBranchFor(deckCwd) || undefined;
        const deckThread = this.laneThreadId(i);
        if (deckThread) {
          lane.threadId = deckThread;
          lane.sessionAlias = deckThread.replace(/-/g, '').slice(-8);
          lane.title = `deck thread · ${lane.project}`;
          claimed.add(deckThread);
        } else {
          lane.title = 'new thread · speak to start';
        }
        return;
      }
      const threadId = storedThreadId(key);
      if (!threadId) return;
      if (claimed.has(threadId)) {
        // double binding from an older build — rotate to an unassigned key
        this.laneKeys[i] = `speakeasy-deck-lane-${i}-${Date.now().toString(36)}`;
        rotated = true;
        this.log('LANE DEDUPED', `lane ${i + 1} → unassigned (task already bound)`);
        return;
      }
      claimed.add(threadId);
      const lane = this.lanes[i];
      lane.threadId = threadId;
      lane.origin = 'codex';
      lane.sessionAlias = threadAlias(threadId);
      const info = findCodexRollout(threadId);
      if (info) this.applyThreadIdentity(lane, deckThreadInfo(info));
      else lane.title = 'codex thread';
    });
    if (rotated) this.persistLaneKeys();
  }

  snapshot(): DeckSnapshot {
    return {
      type: 'snapshot',
      rev: this.rev,
      lane: this.laneIx,
      lanes: this.lanes,
      threads: this.threads,
      playing: this.playing,
      paused: this.paused,
      pos: this.pos,
      // Narration segment the device should be playing, and where it starts in
      // the whole-message timeline, so the deck can seek inside the right file.
      segIx: this.segIx,
      segStart: this.segmentStart(),
      segCount: this.segmentCount(),
      speedIx: this.speedIx,
      vol: this.vol,
      autoplay: this.autoplay,
      listening: this.listening,
      phase: this.phase,
      confirm: this.confirm,
      trace: this.trace,
      host: this.host,
      catalog: this.catalog,
      catalogError: this.catalogError,
      clients: this.liveClients(),
    };
  }

  private changed(): void {
    this.rev++;
    this.emit('changed', this.snapshot());
  }

  /** Routine background polling must never evict the diagnostic history. A
   * 4s task-tail poll against a 7-entry ring wiped every failure within half a
   * minute, which is why a dead lane binding was invisible for a whole evening.
   * Uneventful polls collapse into a single rolling entry. */
  private log(kind: string, detail: string): void {
    const entry = { at: clock(), kind, detail };
    if (kind === 'TASK TAIL' && /· 0 msgs/.test(detail)) {
      const [head, ...rest] = this.trace;
      this.trace = head?.kind === 'TASK TAIL' ? [entry, ...rest] : [entry, ...this.trace].slice(0, TRACE_LIMIT);
      return;
    }
    this.trace = [entry, ...this.trace].slice(0, TRACE_LIMIT);
  }

  // ── lanes ────────────────────────────────────────────────────────────────

  /** A deck-owned session: the overview officer, or a worker lane holding a
   * thread the operator explicitly created. A worker pad bound to a Codex task
   * is an input/output peripheral for that task and must never reach this —
   * the origin check below is what keeps a failed bind from quietly becoming a
   * shadow app-server session the operator cannot see in Codex Desktop. */
  private async laneClient(ix: number): Promise<DeckAgentClient> {
    // Origin alone decides this. A deck thread has a codex-thread-id.txt of its
    // own once it has answered, so the id file says nothing about ownership.
    const deckOwned = ix === MASTER_IX || this.lanes[ix]?.origin === 'deck';
    if (!deckOwned) throw new Error('Assign a Codex task to this lane before speaking.');
    const key = ix === MASTER_IX ? MASTER_REUSE_KEY : this.laneKeys[ix];
    const existing = this.laneClients.get(ix);
    if (existing && existing.key === key) return existing.client;
    if (existing) {
      this.laneClients.delete(ix);
      void existing.client.close().catch(() => undefined);
    }
    const options: DeckAgentClientOptions = ix === MASTER_IX
      ? {
        harness: 'codex',
        cwd: process.cwd(),
        reuseKey: key,
        warmth: 'lazy',
        systemPrompt: OVERVIEW_SYSTEM_PROMPT,
        model: OVERVIEW_MODEL,
        effort: OVERVIEW_EFFORT,
      }
      : {
        harness: 'codex',
        cwd: this.lanes[ix]?.cwd || process.cwd(),
        reuseKey: key,
        warmth: 'lazy',
        systemPrompt: DECK_THREAD_SYSTEM_PROMPT,
      };
    const client = await createDeckAgentClient(options);
    // a reset or destroy during creation must not install a stale client
    const currentKey = ix === MASTER_IX ? MASTER_REUSE_KEY : this.laneKeys[ix];
    if (this.destroyed || currentKey !== key) {
      void client.close().catch(() => undefined);
      throw new Error('lane was reset');
    }
    this.laneClients.set(ix, { key, client });
    return client;
  }

  private persistLaneKeys(): void {
    try {
      const out: Record<string, string> = {};
      this.laneKeys.forEach((k, i) => {
        out[String(i)] = k;
      });
      writeFileSync(DECK_LANES_FILE, JSON.stringify(out), { mode: 0o600 });
    } catch {
      // best-effort
    }
  }

  /** The overview lane's own thread id, if it has one. A worker pad must never
   * be mapped to it — two sessions steering one codex thread is the failure
   * this guards (runtime dedupe only sweeps the nine worker lanes). */
  private masterThreadId(): string | null {
    const live = this.lanes[MASTER_IX].threadId;
    return live || storedThreadId(MASTER_REUSE_KEY);
  }

  /** The exact Codex task assigned to a worker pad, if one was recorded. */
  private laneThreadId(index: number): string | null {
    return storedThreadId(this.laneKeys[index]);
  }

  /** Channel mapper: bind a pad to an existing Codex task, or clear its
   * assignment when threadId is null. Only ever called while no response is in
   * flight (apply() rejects lane.cycle/lane.assign when busy), so this never
   * touches another lane's turn. */
  private assignLane(index: number, threadId: string | null): void {
    // re-affirming the current binding must be a no-op — rekeying would close
    // the warm session and clear the visible thread for nothing
    if (threadId && this.laneThreadId(index) === threadId) {
      this.log('LANE UNCHANGED', `lane ${index + 1} already holds this thread`);
      // Still refresh the tail so a re-selected mapping rehydrates recent history.
      void this.syncLaneTaskTail(index, { reason: 'reaffirm' });
      this.changed();
      return;
    }
    // never let the old session's audio keep playing under a new one
    if (this.playing?.startsWith(`${index}:`)) {
      this.stopPlayer();
      this.clearPlayback('READY');
    }
    const lane = this.lanes[index];
    const key = `speakeasy-deck-lane-${index}-${Date.now().toString(36)}`;
    // seed BEFORE persisting the key, and only claim the bind when the seed
    // actually landed — a failed seed must not masquerade as a mapped lane
    let bound = false;
    if (threadId) {
      try {
        const dir = deckAgentRuntimeDir(key);
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, 'codex-thread-id.txt'), threadId);
        bound = true;
      } catch {
        bound = false;
      }
    }
    this.laneKeys[index] = key;
    this.persistLaneKeys();
    // the new binding starts with a clean conversation — no orphaned replies
    // from the old thread, and nothing for replay to resurrect
    this.threads[index] = [];
    this.laneTailSeen.delete(index);
    const existing = this.laneClients.get(index);
    if (existing) {
      this.laneClients.delete(index);
      void existing.client.close().catch(() => undefined);
    }
    lane.name = `LANE ${index + 1}`;
    lane.state = 'idle';
    // The key rotated above, so any deck-thread marker under the old key is
    // already unreachable; clear the in-memory flag to match.
    lane.origin = threadId && bound ? 'codex' : undefined;
    if (threadId && bound) {
      const info = this.catalog.find((t) => t.id === threadId);
      if (info) this.applyThreadIdentity(lane, info);
      else lane.title = 'codex thread';
      lane.threadId = threadId;
      lane.sessionAlias = threadAlias(threadId);
      this.log('LANE ASSIGNED', `lane ${index + 1} → thread ${lane.sessionAlias}`);
      // One exact thread occupies at most one lane: now that the destination
      // seed has landed, clear every other lane holding this thread — the
      // binding MOVES here. Doing this before the seed would let a failed
      // write destroy the source binding for nothing.
      for (let j = 0; j < LANE_COUNT; j++) {
        if (j !== index && this.laneThreadId(j) === threadId) {
          this.log('LANE MOVED', `thread left lane ${j + 1} for lane ${index + 1}`);
          this.assignLane(j, null);
        }
      }
      // Initial last-20 hydration from the local rollout via readTaskTail.
      void this.syncLaneTaskTail(index, { reason: 'assign', forceInitial: true });
    } else {
      lane.title = 'assign a Codex task before speaking';
      lane.threadId = undefined;
      lane.sessionAlias = undefined;
      lane.project = undefined;
      lane.cwd = undefined;
      lane.branch = undefined;
      lane.updatedAt = undefined;
      try {
        clearLaneTailCursor(laneRuntimeDir(this.laneKeys[index]));
      } catch {
        // ignore
      }
      this.log(threadId ? 'ASSIGN FAILED' : 'LANE CLEARED', `lane ${index + 1} → unassigned`);
    }
    this.changed();
  }

  /** Start a fresh, deck-owned thread on a worker lane. The session — and so
   * the codex thread id — is created lazily on the first turn, exactly like
   * the overview lane; this call establishes ownership and clears whatever the
   * lane held before, so the operator can simply speak into it. */
  private newDeckThread(index: number, cwd?: string): void {
    // clear any prior binding first: this rotates the reuse key, so the new
    // thread can never resume the previous occupant's conversation
    this.assignLane(index, null);
    const key = this.laneKeys[index];
    const lane = this.lanes[index];
    const workingDir = cwd?.trim() || process.cwd();
    try {
      const dir = laneRuntimeDir(key);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, DECK_ORIGIN_FILE), workingDir);
    } catch {
      this.log('NEW THREAD FAILED', `lane ${index + 1} · could not seed the lane`);
      this.changed();
      return;
    }
    lane.origin = 'deck';
    lane.state = 'idle';
    lane.cwd = workingDir;
    lane.project = path.basename(workingDir) || 'Codex';
    lane.branch = gitBranchFor(workingDir) || undefined;
    lane.title = 'new thread · speak to start';
    lane.threadId = undefined;
    lane.sessionAlias = undefined;
    lane.updatedAt = Date.now();
    this.log('NEW THREAD', `lane ${index + 1} · ${lane.project}`);
    this.changed();
  }

  /** The working directory recorded for a deck-owned lane, if it has one. */
  private laneDeckOrigin(index: number): string | null {
    try {
      const dir = readFileSync(path.join(laneRuntimeDir(this.laneKeys[index]), DECK_ORIGIN_FILE), 'utf8').trim();
      return dir || null;
    } catch {
      return null;
    }
  }

  private laneLabel(ix: number): string {
    return this.lanes[ix]?.name.toLowerCase() ?? `lane ${ix + 1}`;
  }

  /** Change only what the operator is viewing and targeting next.
   *
   * Canonical work and playback belong to their origin lane, not to the
   * currently visible lane. Navigation must therefore never abort the Codex
   * waiter, bump its generation, or stop its audio. */
  private selectLane(index: number): void {
    this.laneIx = index;
    const label = index === MASTER_IX ? 'OVERVIEW' : laneNumber(index);
    const state = this.lanes[index]?.state;
    const status = state === 'working' ? 'WORKING' : state === 'speaking' ? 'SPEAKING' : 'READY';
    this.setPhase(this.phase, `${status} · ${label}`);
    this.log('LANE SELECTED', index === MASTER_IX ? 'overview' : `lane ${index + 1}`);
    this.changed();
    this.warmCanonicalLane(index);
    // Lane focus resumes the bounded tail cursor so background growth appears
    // without reloading the full Codex rollout.
    if (index !== MASTER_IX) void this.syncLaneTaskTail(index, { reason: 'select' });
  }

  private tailMessageToDeck(msg: TailDeckMessage): DeckMessage {
    return {
      role: msg.role,
      text: msg.text,
      dur: estimateDuration(msg.text),
      mirrored: true,
    };
  }

  /**
   * Hydrate or incrementally advance one lane's conversation from the local
   * Codex rollout via `@openscout/agent-sessions` `readTaskTail`. Never a Scout
   * broker hop — dictation still uses canonical Desktop IPC separately.
   */
  private syncLaneTaskTail(
    index: number,
    options: { reason: string; forceInitial?: boolean } = { reason: 'sync' },
  ): void {
    if (this.destroyed || index === MASTER_IX) return;
    if (this.laneTailInFlight.has(index)) return;
    const taskId = this.lanes[index]?.threadId?.trim();
    if (!taskId) return;

    const runtimeDir = laneRuntimeDir(this.laneKeys[index]);
    const stored = loadLaneTailCursor(runtimeDir);
    // Empty presentation always rehydrates last-N. A stored cursor alone is not
    // enough to rebuild the visible thread after a process restart.
    const useCursor =
      !options.forceInitial
      && this.threads[index].length > 0
      && stored?.taskId === taskId
      ? stored.cursor
      : undefined;

    this.laneTailInFlight.add(index);
    try {
      const result = this.taskTailRead({
        taskId,
        cursor: useCursor,
      });
      if (this.destroyed || this.lanes[index]?.threadId !== taskId) return;

      if (!result.ok) {
        if (result.code === 'TASK_MISMATCH' || result.code === 'CURSOR_TASK_MISMATCH'
          || result.code === 'CURSOR_INVALID' || result.code === 'SOURCE_REPLACED'
          || result.code === 'SOURCE_TRUNCATED') {
          clearLaneTailCursor(runtimeDir);
          this.laneTailSeen.delete(index);
          if (useCursor) {
            this.laneTailInFlight.delete(index);
            this.syncLaneTaskTail(index, { reason: `${options.reason}:reset`, forceInitial: true });
            return;
          }
        }
        this.log('TASK TAIL', `lane ${index + 1} · ${result.code}: ${result.message.slice(0, 48)}`);
        return;
      }

      if (!isBoundedLargeRead(result) && result.fileSize > 32 * 1024 * 1024) {
        this.log(
          'TASK TAIL',
          `lane ${index + 1} · refused oversized scan ${result.bytesRead}/${result.fileSize}`,
        );
        return;
      }

      const seen = this.laneTailSeen.get(index) ?? new Set<string>();
      let changed = false;

      if (result.mode === 'initial') {
        if (this.threads[index].length === 0 || options.forceInitial) {
          this.threads[index] = result.messages.map((m) => this.tailMessageToDeck(m));
          seen.clear();
          for (const m of result.messages) seen.add(m.sourceId);
          changed = result.messages.length > 0;
        } else {
          const merged = mergeTailMessages({
            existing: this.threads[index],
            incoming: result.messages,
            seenIds: seen,
            maxMessages: MAX_MESSAGES_PER_LANE,
            toMessage: (m) => this.tailMessageToDeck(m),
          });
          this.threads[index] = merged.messages;
          changed = merged.added > 0;
        }
      } else {
        const merged = mergeTailMessages({
          existing: this.threads[index],
          incoming: result.messages,
          seenIds: seen,
          maxMessages: MAX_MESSAGES_PER_LANE,
          toMessage: (m) => this.tailMessageToDeck(m),
        });
        this.threads[index] = merged.messages;
        changed = merged.added > 0;
      }

      this.laneTailSeen.set(index, seen);
      saveLaneTailCursor(runtimeDir, { taskId, cursor: result.cursor });
      this.log(
        'TASK TAIL',
        `lane ${index + 1} · ${result.mode} · ${result.messages.length} msgs · `
          + `${Math.round(result.bytesRead / 1024)}KB/${Math.round(result.fileSize / 1024 / 1024)}MB · ${options.reason}`,
      );
      if (changed) this.changed();
    } finally {
      this.laneTailInFlight.delete(index);
    }
  }

  /** Background poll so reconnecting decks pick up new rollout turns. */
  private ensureTailPoll(): void {
    if (this.tailPollTimer || this.destroyed) return;
    this.tailPollTimer = setInterval(() => {
      if (this.destroyed) return;
      const targets = new Set<number>([this.laneIx]);
      for (let i = 0; i < LANE_COUNT; i++) {
        if (this.lanes[i]?.state === 'working' || this.lanes[i]?.state === 'speaking') {
          targets.add(i);
        }
      }
      for (const ix of targets) {
        if (ix === MASTER_IX) continue;
        if (this.lanes[ix]?.threadId) void this.syncLaneTaskTail(ix, { reason: 'poll' });
      }
    }, 4_000);
    this.tailPollTimer.unref?.();
  }

  /** Reuse one proven Desktop owner while a task remains selected. Switching
   * targets replaces the warm channel only while no canonical response is in
   * flight; navigation during work therefore cannot detach the origin turn. */
  private canonicalSessionFor(taskId: string): CodexDesktopSession {
    if (this.canonicalSession?.threadId === taskId) return this.canonicalSession;
    this.canonicalSession?.close();
    this.canonicalSession = new CodexDesktopSession(taskId, {
      readyTimeoutMs: CANONICAL_OWNER_TIMEOUT_MS,
    });
    this.canonicalSessionReady = false;
    return this.canonicalSession;
  }

  private warmCanonicalLane(index: number): void {
    if (this.destroyed || this.busy) return;
    const route = resolveDeckTurnRoute(index, this.lanes[index]?.threadId);
    if (route.kind !== 'canonical') return;
    const session = this.canonicalSessionFor(route.taskId);
    if (this.canonicalSessionReady) return;
    void session.warm().then(() => {
      if (this.destroyed || this.canonicalSession !== session || this.canonicalSessionReady) return;
      this.canonicalSessionReady = true;
      this.log('CODEX LINK READY', `lane ${index + 1} · exact task owner verified`);
      this.changed();
    }).catch((error) => {
      if (this.destroyed || this.canonicalSession !== session) return;
      this.canonicalSessionReady = false;
      this.log('CODEX LINK FAILED', (error as Error).message.slice(0, 60));
      this.changed();
    });
  }

  /** Live, compact picture of the whole deck — the overview lane's eyes. One
   * line per lane: binding, state, title, and the last exchange if there is one. */
  private systemDigest(): string {
    const lines = this.lanes.slice(0, LANE_COUNT).map((lane, i) => {
      const bound = lane.threadId ? `bound ${lane.sessionAlias}` : 'unassigned';
      let line = `lane ${i + 1}: ${bound} · ${lane.state} · "${lane.title}"`;
      const msgs = this.threads[i];
      const lastYou = [...msgs].reverse().find((m) => m.role === 'you')?.text;
      const lastAgent = [...msgs].reverse().find((m) => m.role === 'agent')?.text;
      if (lastYou) line += ` · last asked "${lastYou.slice(0, 80)}"`;
      if (lastAgent) line += ` · last answered "${lastAgent.slice(0, 80)}"`;
      return line;
    });
    return [`DECK STATUS (live, authoritative): host ${this.host} · ${LANE_COUNT} lanes`, ...lines].join('\n');
  }

  private setLaneState(ix: number, state: DeckLaneInfo['state']): boolean {
    const lane = this.lanes[ix];
    if (!lane || lane.state === 'empty') return false;
    if (lane.state === state) return false;
    lane.state = state;
    return true;
  }

  private startPlayback(id: string, confirm: string): void {
    this.playing = id;
    this.paused = false;
    this.pos = 0;
    this.setPhase('speaking', confirm);
  }

  private finishPlayback(settleLane = false): void {
    if (settleLane && this.playing) {
      const [lane] = this.playing.split(':').map(Number);
      this.setLaneState(lane, 'idle');
    }
    this.playing = null;
    this.paused = false;
    this.pos = 0;
    // a finished narration starts over at its first segment, never mid-way
    this.segIx = 0;
    this.setPhase('idle', 'READY');
    this.log('PLAYBACK ENDED', 'buffer complete');
  }

  /** Reset playback and the state of whichever lane was playing. */
  private clearPlayback(confirm?: string): void {
    if (this.playing) {
      const [li] = this.playing.split(':').map(Number);
      this.setLaneState(li, 'idle');
    }
    this.playing = null;
    this.paused = false;
    this.pos = 0;
    this.segIx = 0;
    if (confirm) this.setPhase(this.phase === 'speaking' ? 'idle' : this.phase, confirm);
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      if (!this.playing || this.paused) return;
      if (!this.player && this.liveClients() > 0 && !this.messageAt(this.playing)?.mirrored) {
        // a connected deck owns playback of runtime files — progress arrives
        // as playback.progress intents; nothing to estimate here
        return;
      }
      // file-backed progress tracks the launch rate; completion for those is
      // owned exclusively by the afplay exit handler. Only mirrors use the
      // estimated-duration completion.
      const rate = this.player ? this.playerRate : 1;
      this.pos += (TICK_MS / 1000) * rate;
      const dur = this.durOf(this.playing);
      if (!this.player && this.pos >= dur) {
        this.finishPlayback();
      }
      this.changed();
    }, TICK_MS);
    this.ticker.unref();
  }

  private durOf(id: string | null): number {
    if (!id) return 30;
    const [li, mi] = id.split(':').map(Number);
    return this.threads[li]?.[mi]?.dur ?? 30;
  }

  private messageAt(id: string): DeckMessage | null {
    const [li, mi] = id.split(':').map(Number);
    return this.threads[li]?.[mi] ?? null;
  }

  private setPhase(phase: string, confirm: string): void {
    this.phase = phase;
    this.confirm = confirm;
  }

  /** User actions from the deck — already schema-validated by parseIntent. */
  async apply(intent: DeckIntent): Promise<{ ok: boolean; rev: number; error?: string }> {
    switch (intent.name) {
      case 'lane.select': {
        this.selectLane(intent.index);
        return { ok: true, rev: this.rev };
      }
      case 'playback.toggle': {
        const msg = this.messageAt(intent.id);
        if (!msg) return { ok: false, rev: this.rev, error: 'no such message' };
        if (!msg.file) return { ok: false, rev: this.rev, error: 'no controllable audio for this item' };
        if (this.playing === intent.id && !this.paused) {
          this.paused = true;
          this.player?.kill('SIGSTOP');
          this.log('PLAYBACK PAUSED', `${Math.floor(this.pos)}s elapsed`);
        } else if (this.playing === intent.id && this.paused) {
          this.paused = false;
          this.player?.kill('SIGCONT');
          this.log('PLAYBACK RESUMED', `${Math.floor(this.pos)}s elapsed`);
        } else {
          this.stopPlayer();
          this.startPlayback(intent.id, 'PLAYING');
          this.log('PLAYBACK STARTED', `${SPEEDS[this.speedIx].toFixed(2)}x`);
          this.startSegments(msg);
        }
        this.ensureTicker();
        this.changed();
        return { ok: true, rev: this.rev };
      }
      case 'playback.scrub':
        // afplay cannot seek — scrub stays rejected until real seeking exists
        return { ok: false, rev: this.rev, error: 'seek not supported yet' };
      case 'playback.speed':
        this.speedIx = (this.speedIx + 1) % SPEEDS.length;
        this.log('SPEED CHANGE', `${SPEEDS[this.speedIx].toFixed(2)}x · applies to next play`);
        this.changed();
        return { ok: true, rev: this.rev };
      case 'playback.volume':
        this.vol = intent.vol;
        this.log('NARRATION VOLUME', `${Math.round(this.vol * 100)}%`);
        this.changed();
        return { ok: true, rev: this.rev };
      case 'playback.autoplay':
        this.autoplay = !this.autoplay;
        this.log('AUTOPLAY', this.autoplay ? 'on' : 'off');
        this.changed();
        return { ok: true, rev: this.rev };
      case 'playback.stop':
        // Transport control is intentionally not task control. Aborting the
        // bridge here would leave Codex running while silently dropping its
        // result from the Deck. Preserve the canonical waiter and merely keep
        // this response from autoplaying when it lands.
        if (this.busy) this.suppressAutoplayForGeneration = this.gen;
        this.stopPlayer();
        this.clearPlayback();
        this.listening = false;
        this.setPhase('idle', this.busy ? 'AUDIO STOPPED · TASK CONTINUES' : 'AUDIO STOPPED');
        this.log('PLAYBACK STOPPED', this.busy ? 'audio cleared · canonical task continues' : 'buffer cleared');
        this.changed();
        return { ok: true, rev: this.rev };
      case 'playback.replay': {
        const t = this.threads[this.laneIx];
        for (let i = t.length - 1; i >= 0; i--) {
          // only file-backed replies can actually replay — mirrors have no audio here
          if (t[i].role === 'agent' && t[i].file) {
            this.stopPlayer();
            this.startPlayback(`${this.laneIx}:${i}`, 'REPLAYING LAST REPLY');
            this.ensureTicker();
            this.log('REPLAY', `lane ${this.laneIx + 1} · last reply`);
            this.startSegments(t[i]);
            this.changed();
            return { ok: true, rev: this.rev };
          }
        }
        return { ok: false, rev: this.rev, error: 'no replayable reply' };
      }
      case 'capture.start':
        // Until one bridge can correlate multiple steering requests to a
        // single terminal Codex turn, fail explicitly instead of detaching the
        // response already in flight. The operator can still browse all lanes.
        if (this.busy) return { ok: false, rev: this.rev, error: 'response already in flight' };
        this.gen++;
        this.stopPlayer();
        this.clearPlayback();
        this.listening = true;
        this.setPhase('recording', 'LISTENING');
        this.log('VOICE COMMAND', `${this.laneLabel(this.laneIx)} · recording`);
        this.changed();
        return { ok: true, rev: this.rev };
      case 'capture.cancel':
        if (!this.listening) return { ok: false, rev: this.rev, error: 'not recording' };
        this.listening = false;
        this.setPhase('idle', intent.reason ?? 'READY');
        this.log('VOICE COMMAND', intent.reason ?? 'cancelled');
        this.changed();
        return { ok: true, rev: this.rev };
      case 'turn.abort': {
        // The third meaning of "stop", and the only one that was missing.
        //
        // `capture.cancel` abandons a *recording* and answers "not recording"
        // once the words have been sent. `playback.stop` silences the
        // loudspeaker and says so plainly — AUDIO STOPPED · TASK CONTINUES.
        // Neither takes back the request, and the abort path that could was
        // reachable only from runtime teardown. So an operator who misspoke
        // had to sit and watch the turn they no longer wanted run to
        // completion. Being able to withdraw something you just said is table
        // stakes for a voice instrument.
        if (!this.busy) return { ok: false, rev: this.rev, error: 'nothing in flight' };
        // Generation first, and the order matters. `respond()` re-checks
        // `alive()` immediately after `askAgent` returns, so bumping before the
        // abort lands means the abandoned turn leaves through its own `finally`
        // — clearing `busy`, releasing the lane — without pushing a reply to a
        // question the operator has already withdrawn.
        this.gen++;
        this.canonicalTurnAbort?.abort();
        // Deck-owned lanes answer over their own client, which the canonical
        // AbortController knows nothing about.
        for (const { client } of this.laneClients.values()) client.interrupt?.();
        // Deliberately does NOT close the canonical session: cancelling one
        // turn is not a reason to make the next one pay for a fresh owner
        // handshake. `cancelAgentWork()` stays teardown-only.
        this.stopPlayer();
        this.clearPlayback();
        this.setPhase('idle', 'CANCELLED');
        this.log('TURN ABORTED', this.laneLabel(this.laneIx));
        this.changed();
        return { ok: true, rev: this.rev };
      }
      case 'capture.end': {
        const text = intent.text?.trim();
        // A client that transcribes on-device already owns the words, so
        // delivery must not depend on this runtime still believing it is
        // recording — that belief dies with every socket drop and restart.
        // Only the textless form (the Mac is the recorder) still needs it.
        if (!text && !this.listening) return { ok: false, rev: this.rev, error: 'not recording' };
        // Retried delivery of an utterance already accepted is a success, not a
        // second command. Without this, an ack lost in flight submits twice.
        if (intent.utteranceId && this.acceptedUtterances.includes(intent.utteranceId)) {
          return { ok: true, rev: this.rev };
        }
        this.listening = false;
        if (this.busy) {
          this.changed(); // corrective snapshot — the client learns listening cleared
          return { ok: false, rev: this.rev, error: 'response already in flight' };
        }
        const laneIx = intent.lane ?? this.laneIx;
        if (!this.threads[laneIx]) return { ok: false, rev: this.rev, error: 'unknown lane' };
        if (intent.utteranceId) {
          this.acceptedUtterances.push(intent.utteranceId);
          if (this.acceptedUtterances.length > 64) this.acceptedUtterances.shift();
        }
        const command = text || 'Walk me through what is still blocking, then keep going.';
        void this.respond(laneIx, command, this.gen);
        return { ok: true, rev: this.rev };
      }
      case 'speak': {
        void this.narrate(intent.text, this.laneIx, true);
        return { ok: true, rev: this.rev };
      }
      case 'lane.cycle': {
        // resetting mid-response would cancel whichever lane is answering —
        // the reset is instant, so just ask the user to wait a beat
        if (this.busy) return { ok: false, rev: this.rev, error: 'response in flight — try again in a moment' };
        this.assignLane(intent.index, null);
        return { ok: true, rev: this.rev };
      }
      case 'catalog.refresh': {
        await this.refreshThreadCatalog();
        return { ok: true, rev: this.rev };
      }
      case 'lane.new': {
        if (this.busy) return { ok: false, rev: this.rev, error: 'response in flight — try again in a moment' };
        this.newDeckThread(intent.index, intent.cwd);
        this.selectLane(intent.index);
        return { ok: true, rev: this.rev };
      }
      case 'lane.assign': {
        if (this.busy) return { ok: false, rev: this.rev, error: 'response in flight — try again in a moment' };
        if (intent.threadId && intent.threadId === this.masterThreadId()) {
          return { ok: false, rev: this.rev, error: 'that thread belongs to the overview lane' };
        }
        this.assignLane(intent.index, intent.threadId);
        // Mapping from the Deck is also a destination choice. Do this only
        // after the exact binding is visible, so a failed write cannot switch
        // the microphone to a lane that merely looks assigned.
        if (
          intent.activate &&
          intent.threadId &&
          this.lanes[intent.index]?.threadId === intent.threadId
        ) {
          this.selectLane(intent.index);
        }
        return { ok: true, rev: this.rev };
      }
      case 'playback.progress': {
        // the device owns playback of runtime files — adopt its clock. It
        // reports a position inside the segment it is playing, so offset by
        // everything already narrated.
        if (this.playing !== intent.id) return { ok: false, rev: this.rev, error: 'not playing' };
        this.pos = this.segmentStart() + intent.pos;
        if (intent.dur) {
          const msg = this.messageAt(intent.id);
          const durs = msg?.segmentDurs;
          if (durs) durs[this.segIx] = intent.dur;
          if (msg) msg.dur = durs ? durs.reduce((total, d) => total + d, 0) : intent.dur;
        }
        this.changed();
        return { ok: true, rev: this.rev };
      }
      case 'playback.ended': {
        if (this.playing !== intent.id) return { ok: false, rev: this.rev, error: 'not playing' };
        // The device finished one segment. Hand it the next before declaring
        // the narration over — this is where long replies used to stop.
        if (this.advanceSegment()) {
          this.pos = this.segmentStart();
          this.log('SEGMENT', `${this.segIx + 1}/${this.segmentCount()}`);
          this.changed();
          return { ok: true, rev: this.rev };
        }
        this.finishPlayback(true);
        this.changed();
        return { ok: true, rev: this.rev };
      }
    }
  }

  /** CLI mirror: an item spoken elsewhere, shown (and optionally voiced) here.
   * Audio is never runtime-owned on this path — always a progress mirror. */
  async narrate(text: string, laneIx: number, play: boolean): Promise<void> {
    const lane = Math.min(MASTER_IX, Math.max(0, laneIx));
    const msg: DeckMessage = { role: 'agent', text, dur: estimateDuration(text), mirrored: true };
    this.pushMessage(lane, msg);
    const id = `${lane}:${this.threads[lane].length - 1}`;
    this.log('NARRATION', `lane ${lane + 1} · ${msg.dur.toFixed(0)}s`);
    if (this.autoplay) {
      this.startPlayback(id, 'SPEAKING');
      this.ensureTicker();
    }
    this.changed();
    if (play) {
      const files = await this.synthesizeSegments(text);
      if (files.length === 0) return;
      // A mirror stays Mac-local: segments drive ordered local playback, but no
      // deck-facing URLs are published, so a connected device stays silent.
      this.attachSegments(msg, files, text, false);
      if (this.playing === id) this.startSegments(msg);
      this.changed();
    }
  }

  private pushMessage(lane: number, msg: DeckMessage): void {
    const t = [...this.threads[lane], msg];
    this.threads[lane] = t.slice(-MAX_MESSAGES_PER_LANE);
  }

  /** The PTT loop: real question → real agent answer → real voice, cancellable via this.gen. */
  private async respond(laneIx: number, command: string, gen: number): Promise<void> {
    this.busy = true;
    const lane = laneIx;
    const alive = () => this.gen === gen;
    this.setLaneState(lane, 'working');
    try {
      this.setPhase('transcribing', `TRANSCRIBING · ${laneNumber(lane)}`);
      this.changed();
      await wait(600);
      if (!alive()) return;

      this.pushMessage(lane, { role: 'you', text: command, dur: estimateDuration(command) });
      this.setPhase('submitting', `SUBMITTING · ${laneNumber(lane)}`);
      this.log('AGENT ASKED', `${this.laneLabel(lane)} · ${command.slice(0, 40)}`);
      this.changed();

      const reply = await this.askAgent(command, lane);
      if (!alive()) return;

      const msg: DeckMessage = { role: 'agent', text: reply, dur: estimateDuration(reply) };
      this.pushMessage(lane, msg);
      const id = `${lane}:${this.threads[lane].length - 1}`;
      // Advance the opaque tail cursor after live presentation so reconnect
      // and poll merge the same exchange by fingerprint instead of duplicating it.
      if (lane !== MASTER_IX) this.syncLaneTaskTail(lane, { reason: 'after-turn' });

      this.setPhase('preparingSpeech', `PREPARING SPEECH · ${laneNumber(lane)}`);
      this.log('AGENT REPLY', `${msg.dur.toFixed(0)}s queued`);
      this.changed();

      const files = await this.synthesizeSegments(reply);
      if (!alive()) {
        // cancelled while synthesizing — finalize the reply as text-only
        if (!msg.file) {
          msg.mirrored = true;
          this.changed();
        }
        return;
      }
      if (files.length === 0) {
        // synthesis failed — show the reply without audio, never fake playback
        msg.mirrored = true;
        this.setPhase('idle', `READY · ${laneNumber(lane)}`);
        this.log('NO AUDIO', 'synthesis unavailable · text-only reply');
        this.changed();
        return;
      }
      this.attachSegments(msg, files, reply);
      if (files.length > 1) {
        this.log('NARRATION SEGMENTS', `${files.length} parts · ${msg.dur.toFixed(0)}s total`);
      }
      if (this.autoplay && this.suppressAutoplayForGeneration !== gen) {
        this.startPlayback(id, `SPEAKING · ${laneNumber(lane)}`);
        this.setLaneState(lane, 'speaking');
        this.ensureTicker();
        this.changed();
        // a connected deck plays the audio on the device; the Mac speaks only
        // when nobody is watching
        this.startSegments(msg);
      } else {
        this.setPhase('idle', `READY · ${laneNumber(lane)}`);
        this.changed();
      }
    } finally {
      this.busy = false;
      if (this.suppressAutoplayForGeneration === gen) this.suppressAutoplayForGeneration = null;
      if (this.lanes[lane]?.state !== 'speaking' && this.setLaneState(lane, 'idle')) this.changed();
      if (this.laneIx !== lane) this.warmCanonicalLane(this.laneIx);
    }
  }

  /** Ask one lane. Existing worker bindings go through the sole Codex Desktop
   * owner so the user's dictation is a native turn in the exact visible task.
   * Luna remains confined to the deck-owned overview lane; it never receives
   * or proxies a bound lane's user turn. */
  private async askAgent(question: string, laneIx: number): Promise<string> {
    const lane = this.lanes[laneIx];
    const route = resolveDeckTurnRoute(laneIx, lane?.threadId, lane?.origin);
    try {
      if (route.kind === 'unassigned') {
        this.log('LANE UNASSIGNED', `lane ${laneIx + 1} · no Codex task`);
        return 'Assign a Codex task to this lane, or start a new thread from the picker.';
      }
      // A thread this deck created. It owns the session, so the turn goes over
      // the deck's own app-server client rather than the Desktop owner bridge.
      if (route.kind === 'deck') {
        const client = await this.laneClient(laneIx);
        const result = await client.turn({ input: question.slice(0, 500), timeoutMs: 180_000 });
        const thread = result.session.nativeId;
        if (lane && thread && !lane.threadId) {
          // The thread id only exists once the session has actually answered.
          // Record it for display and restore; the lane stays deck-owned.
          lane.sessionAlias = thread.replace(/-/g, '').slice(-8);
          lane.updatedAt = Date.now();
          this.log('DECK THREAD', `lane ${laneIx + 1} · ${lane.sessionAlias}`);
        }
        const deckText = result.text.trim();
        if (!deckText) throw new Error('empty reply from the deck thread');
        return deckText.length > 600 ? deckText.slice(0, 600).replace(/\s+\S*$/, '') + '…' : deckText;
      }
      if (route.kind === 'canonical') {
        const controller = new AbortController();
        this.canonicalTurnAbort = controller;
        try {
          const session = this.canonicalSessionFor(route.taskId);
          const result = await session.turn(question, {
            signal: controller.signal,
            timeoutMs: 180_000,
          });
          this.canonicalSessionReady = true;
          lane.updatedAt = Date.now();
          this.log(
            'CANONICAL TURN',
            result.delivery === 'steered-active-turn'
              ? `lane ${laneIx + 1} · steered active Codex task`
              : `lane ${laneIx + 1} · started in Codex Desktop`,
          );
          const text = result.response.trim();
          if (!text) throw new Error('empty reply from the canonical task');
          // The full canonical answer is returned. Narration length is bounded
          // by ordered segment synthesis, never by clipping the agent's reply.
          return text;
        } finally {
          if (this.canonicalTurnAbort === controller) this.canonicalTurnAbort = null;
        }
      }

      // Only the hidden overview role reaches this path. It receives a status
      // digest, never a worker lane's transcript or canonical task context.
      const client = await this.laneClient(MASTER_IX);
      const input = `${this.systemDigest()}\n\nOperator asks: ${question.slice(0, 500)}`;
      const result = await client.turn({ input, timeoutMs: 180_000 });
      const thread = result.session.nativeId;
      // codex thread ids are UUIDv7 — the leading bytes are a timestamp, so
      // alias from the random tail to tell threads apart
      if (lane && thread) {
        lane.threadId = thread;
        lane.sessionAlias = threadAlias(thread);
        if (!lane.cwd) {
          lane.cwd = process.cwd();
          lane.project = path.basename(lane.cwd) || 'Codex';
          lane.branch = gitBranchFor(lane.cwd) || undefined;
        }
        lane.updatedAt = Date.now();
      }
      const text = result.text.trim();
      if (!text) throw new Error('empty reply from session');
      return text;
    } catch (error) {
      const canonical = route.kind === 'canonical';
      const detail = (error as Error).message.trim();
      this.log(canonical ? 'CANONICAL FAILED' : 'AGENT FAILED', detail.slice(0, 60));
      if (canonical) {
        // Say what actually went wrong. A dead socket, an unowned task and a
        // protocol fault have three different fixes, and collapsing them into
        // one sentence made this undiagnosable.
        return `${describeCanonicalFailure(detail)} SpeakEasy did not send this turn anywhere else.`;
      }
      if (route.kind === 'deck') return 'That deck thread did not answer — try again in a moment.';
      if (route.kind === 'unassigned') return 'Assign a Codex task to this lane before speaking.';
      const who = this.lanes[laneIx]?.name.toLowerCase();
      return who
        ? `${who[0].toUpperCase() + who.slice(1)} didn't answer that one — try again in a moment.`
        : 'Sorry, the agent did not answer that one. Try again in a moment.';
    }
  }

  /** Detach from in-flight work during runtime teardown only. User-facing
   * navigation and transport controls must preserve canonical task delivery. */
  private cancelAgentWork(): void {
    this.canonicalTurnAbort?.abort();
    this.canonicalTurnAbort = null;
    this.canonicalSession?.close();
    this.canonicalSession = null;
    this.canonicalSessionReady = false;
    for (const { client } of this.laneClients.values()) client.interrupt?.();
  }

  /** Synthesize to runtime-owned files — the user's configured provider first
   * (cloud silent mode → exact cache entries copied out), the macOS system voice
   * as fallback. The copy means cache eviction can never pull audio mid-play.
   *
   * A reply longer than one provider request becomes several ordered segments.
   * Partial synthesis is still returned: speaking most of a long answer beats
   * discarding all of it, and the shortfall is logged rather than hidden. */
  private async synthesizeSegments(text: string): Promise<string[]> {
    const stamp = Date.now();
    try {
      const { SpeakEasy } = await import('../index');
      const speaker = new SpeakEasy({
        volume: this.vol,
        // The deck needs durable files it can copy to its own playback area.
        // Caching also makes silent system-voice synthesis return those files.
        cache: { enabled: true },
      });
      try {
        await speaker.speak(text, { silent: true });
      } catch (error) {
        // Some segments may still have rendered — keep whatever was produced.
        this.log('SYNTH PARTIAL', (error as Error).message.slice(0, 60));
      }
      // the SDK reports the exact files it used — no scanning, no correlation guesswork
      const owned: string[] = [];
      speaker.lastAudioFiles.forEach((source, i) => {
        if (!existsSync(source)) return;
        const target = path.join(
          this.synthDir,
          `reply-${stamp}-${String(i).padStart(2, '0')}${path.extname(source) || '.mp3'}`
        );
        copyFileSync(source, target);
        owned.push(target);
      });
      if (owned.length > 0) return owned;
    } catch {
      // cloud silent mode unavailable — fall through to the system voice
    }
    const file = path.join(this.synthDir, `reply-${stamp}.aiff`);
    try {
      // `say` reads from argv and has no practical length limit, so the system
      // fallback stays a single file regardless of how long the reply is.
      await run('say', ['-o', file, text], 120_000);
      return [file];
    } catch (error) {
      this.log('SYNTH FAILED', (error as Error).message.slice(0, 60));
      this.changed();
      return [];
    }
  }

  /** Attach ordered narration segments to a message and point it at the first.
   *
   * `exposeToDeck` decides whether a connected device may fetch and play the
   * audio. Mirrors stay Mac-local, so publishing their URLs would produce the
   * double audio the transport is careful to avoid. */
  private attachSegments(
    msg: DeckMessage,
    files: string[],
    text: string,
    exposeToDeck = true
  ): void {
    const durations = measureSegmentDurations(files, text);
    msg.segments = files;
    msg.segmentUrls = exposeToDeck ? files.map((f) => `/audio/${path.basename(f)}`) : undefined;
    msg.segmentDurs = durations;
    msg.dur = durations.reduce((total, d) => total + d, 0);
    this.focusSegment(msg, 0);
  }

  /** Point a message's transport fields at segment `ix`. */
  private focusSegment(msg: DeckMessage, ix: number): void {
    msg.file = msg.segments?.[ix];
    msg.audioUrl = msg.segmentUrls?.[ix];
  }

  /** Seconds of narration before the current segment starts. */
  private segmentStart(): number {
    const msg = this.playing ? this.messageAt(this.playing) : null;
    const durs = msg?.segmentDurs;
    if (!durs) return 0;
    return durs.slice(0, this.segIx).reduce((total, d) => total + d, 0);
  }

  /** How many segments the narration in flight has. */
  private segmentCount(): number {
    const msg = this.playing ? this.messageAt(this.playing) : null;
    return msg?.segments?.length ?? (msg?.file ? 1 : 0);
  }

  /**
   * Advance to the next narration segment. Returns false once the last segment
   * has been spoken, which is the only point at which playback is complete.
   */
  private advanceSegment(): boolean {
    if (!this.playing) return false;
    const msg = this.messageAt(this.playing);
    const segments = msg?.segments;
    if (!msg || !segments || this.segIx + 1 >= segments.length) return false;
    this.segIx += 1;
    this.focusSegment(msg, this.segIx);
    return true;
  }

  /** Begin a message's narration from its first segment. */
  private startSegments(msg: DeckMessage): void {
    this.segIx = 0;
    this.focusSegment(msg, 0);
    this.pos = 0;
    if (this.liveClients() === 0 && msg.file) this.playFile(msg.file);
  }

  /** Controlled playback of one runtime-owned segment: pause/resume/stop are real.
   *
   * Each invocation costs ~1s of `afplay` process and audio-device startup, so a
   * multi-segment narration has a short seam between parts. Chunks are sized in
   * the ~80s range to keep that overhead near one percent; removing it entirely
   * would mean a persistent audio process rather than one-shot `afplay`.
   * Skipped entirely while a deck is connected — the deck plays the audio on
   * the device instead (double audio is the bug this prevents). */
  private playFile(file: string): void {
    if (this.liveClients() > 0) return;
    this.stopPlayer();
    const args: string[] = [];
    if (this.vol !== 1) args.push('-v', this.vol.toFixed(2));
    this.playerRate = SPEEDS[this.speedIx];
    if (this.playerRate !== 1) args.push('-r', String(this.playerRate));
    const player = spawn('afplay', [...args, file]);
    this.player = player;
    player.once('exit', () => {
      // a killed predecessor must not clear the reference of its replacement
      if (this.player !== player) return;
      this.player = null;
      // natural completion is authoritative — this segment really is done
      if (!this.playing || this.paused) return;

      // A long reply is several ordered segments. Only the last one ends the
      // narration; the rest hand off to their successor.
      if (this.advanceSegment()) {
        const next = this.messageAt(this.playing)?.file;
        this.pos = this.segmentStart();
        if (next) {
          this.log('SEGMENT', `${this.segIx + 1}/${this.segmentCount()}`);
          this.changed();
          this.playFile(next);
          return;
        }
      }

      this.finishPlayback(true);
      this.changed();
    });
  }

  private stopPlayer(): void {
    if (this.player) {
      this.player.kill('SIGKILL');
      this.player = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.gen++;
    this.cancelAgentWork();
    this.stopPlayer();
    if (this.ticker) clearInterval(this.ticker);
    if (this.tailPollTimer) {
      clearInterval(this.tailPollTimer);
      this.tailPollTimer = null;
    }
    for (const { client } of this.laneClients.values()) void client.close().catch(() => undefined);
    this.laneClients.clear();
    rmSync(this.synthDir, { recursive: true, force: true });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
