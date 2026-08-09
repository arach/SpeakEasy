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
  /** synthesized audio owned by the runtime — real transport control when present */
  file?: string;
  /** where a connected deck can fetch the audio to play it on the device */
  audioUrl?: string;
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
}

export interface DeckSnapshot {
  type: 'snapshot';
  rev: number;
  lane: number;
  lanes: DeckLaneInfo[];
  threads: DeckMessage[][];
  playing: string | null;
  paused: boolean;
  pos: number;
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
  z.object({ name: z.literal('capture.end'), text: z.string().max(500).optional() }),
  z.object({ name: z.literal('speak'), text: z.string().min(1).max(4000) }),
  z.object({ name: z.literal('lane.cycle'), index: z.number().int().min(0).max(8) }),
  z.object({ name: z.literal('catalog.refresh') }),
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
const MAX_MESSAGES_PER_LANE = 50;

export type DeckTurnRoute =
  | { kind: 'canonical'; taskId: string }
  | { kind: 'unassigned' }
  | { kind: 'overview' };

/** Resolve authority before a transcript can touch any model transport. */
export function resolveDeckTurnRoute(laneIx: number, taskId?: string): DeckTurnRoute {
  if (laneIx === MASTER_IX) return { kind: 'overview' };
  const exactTaskId = taskId?.trim();
  return exactTaskId ? { kind: 'canonical', taskId: exactTaskId } : { kind: 'unassigned' };
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

function conciseReply(value: string, emptyMessage: string): string {
  const text = value.trim();
  if (!text) throw new Error(emptyMessage);
  return text.length > 600 ? text.slice(0, 600).replace(/\s+\S*$/, '') + '…' : text;
}

/** Rough speech duration: ~2.5 words per second at 1x, floor 1.5s. */
export function estimateDuration(text: string, rate = 1): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.5, words / (2.5 * rate));
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
  private playing: string | null = null;
  private paused = false;
  private pos = 0;
  private speedIx = 0;
  private vol = 0.8;
  private autoplay = true;
  private listening = false;
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
    this.restoreLaneBindings();
    // Warm the exact Codex task catalog before the user opens lane setup. The
    // explicit refresh action reuses this in-flight request if it is still busy.
    if (options.warmCatalog !== false) void this.refreshThreadCatalog();
    if (options.warmCanonical !== false) queueMicrotask(() => this.warmCanonicalLane(this.laneIx));
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

  private log(kind: string, detail: string): void {
    this.trace = [{ at: clock(), kind, detail }, ...this.trace].slice(0, 7);
  }

  // ── lanes ────────────────────────────────────────────────────────────────

  /** The Deck-owned overview session. Worker pads are input/output peripherals
   * for explicit Codex tasks and must never create an app-server session. */
  private async laneClient(ix: number): Promise<DeckAgentClient> {
    if (ix !== MASTER_IX) throw new Error('Assign a Codex task to this lane before speaking.');
    const key = MASTER_REUSE_KEY;
    const existing = this.laneClients.get(ix);
    if (existing && existing.key === key) return existing.client;
    if (existing) {
      this.laneClients.delete(ix);
      void existing.client.close().catch(() => undefined);
    }
    const options: DeckAgentClientOptions = {
      harness: 'codex',
      cwd: process.cwd(),
      reuseKey: key,
      warmth: 'lazy',
      systemPrompt: OVERVIEW_SYSTEM_PROMPT,
      model: OVERVIEW_MODEL,
      effort: OVERVIEW_EFFORT,
    };
    const client = await createDeckAgentClient(options);
    // a reset or destroy during creation must not install a stale client
    const currentKey = MASTER_REUSE_KEY;
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
    const existing = this.laneClients.get(index);
    if (existing) {
      this.laneClients.delete(index);
      void existing.client.close().catch(() => undefined);
    }
    lane.name = `LANE ${index + 1}`;
    lane.state = 'idle';
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
    } else {
      lane.title = 'assign a Codex task before speaking';
      lane.threadId = undefined;
      lane.sessionAlias = undefined;
      lane.project = undefined;
      lane.cwd = undefined;
      lane.branch = undefined;
      lane.updatedAt = undefined;
      this.log(threadId ? 'ASSIGN FAILED' : 'LANE CLEARED', `lane ${index + 1} → unassigned`);
    }
    this.changed();
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
  }

  /** Reuse one proven Desktop owner while a task remains selected. Switching
   * targets replaces the warm channel only while no canonical response is in
   * flight; navigation during work therefore cannot detach the origin turn. */
  private canonicalSessionFor(taskId: string): CodexDesktopSession {
    if (this.canonicalSession?.threadId === taskId) return this.canonicalSession;
    this.canonicalSession?.close();
    this.canonicalSession = new CodexDesktopSession(taskId);
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
          if (msg.file) this.playFile(msg.file);
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
            this.playFile(t[i].file!);
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
      case 'capture.end': {
        if (!this.listening) return { ok: false, rev: this.rev, error: 'not recording' };
        this.listening = false;
        if (this.busy) {
          this.changed(); // corrective snapshot — the client learns listening cleared
          return { ok: false, rev: this.rev, error: 'response already in flight' };
        }
        const command = intent.text?.trim() || 'Walk me through what is still blocking, then keep going.';
        void this.respond(this.laneIx, command, this.gen);
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
        // the device owns playback of runtime files — adopt its clock
        if (this.playing !== intent.id) return { ok: false, rev: this.rev, error: 'not playing' };
        this.pos = intent.pos;
        if (intent.dur) {
          const msg = this.messageAt(intent.id);
          if (msg) msg.dur = intent.dur;
        }
        this.changed();
        return { ok: true, rev: this.rev };
      }
      case 'playback.ended': {
        if (this.playing !== intent.id) return { ok: false, rev: this.rev, error: 'not playing' };
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
      const file = await this.synthesize(text);
      if (file) this.playFile(file);
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

      this.setPhase('preparingSpeech', `PREPARING SPEECH · ${laneNumber(lane)}`);
      this.log('AGENT REPLY', `${msg.dur.toFixed(0)}s queued`);
      this.changed();

      const file = await this.synthesize(reply);
      if (!alive()) {
        // cancelled while synthesizing — finalize the reply as text-only
        if (!msg.file) {
          msg.mirrored = true;
          this.changed();
        }
        return;
      }
      if (!file) {
        // synthesis failed — show the reply without audio, never fake playback
        msg.mirrored = true;
        this.setPhase('idle', `READY · ${laneNumber(lane)}`);
        this.log('NO AUDIO', 'synthesis unavailable · text-only reply');
        this.changed();
        return;
      }
      msg.file = file;
      msg.audioUrl = `/audio/${path.basename(file)}`;
      if (this.autoplay && this.suppressAutoplayForGeneration !== gen) {
        this.startPlayback(id, `SPEAKING · ${laneNumber(lane)}`);
        this.setLaneState(lane, 'speaking');
        this.ensureTicker();
        this.changed();
        // a connected deck plays the audio on the device; the Mac speaks only
        // when nobody is watching
        if (this.liveClients() === 0) this.playFile(file);
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
    const route = resolveDeckTurnRoute(laneIx, lane?.threadId);
    try {
      if (route.kind === 'unassigned') {
        this.log('LANE UNASSIGNED', `lane ${laneIx + 1} · no Codex task`);
        return 'Assign a Codex task to this lane before speaking.';
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
          return conciseReply(result.response, 'empty reply from the canonical task');
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
      return conciseReply(result.text, 'empty reply from session');
    } catch (error) {
      const canonical = route.kind === 'canonical';
      this.log(canonical ? 'CANONICAL FAILED' : 'AGENT FAILED', (error as Error).message.slice(0, 60));
      if (canonical) {
        return 'I could not reach the exact Codex task. Open that task in Codex Desktop and try again. SpeakEasy did not send this turn anywhere else.';
      }
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

  /** Synthesize to a runtime-owned file — the user's configured provider first
   * (cloud silent mode → exact cache entry copied out), the macOS system voice
   * as fallback. The copy means cache eviction can never pull audio mid-play. */
  private async synthesize(text: string): Promise<string | null> {
    try {
      const { SpeakEasy } = await import('../index');
      const speaker = new SpeakEasy({
        volume: this.vol,
        // The deck needs a durable file it can copy to its own playback area.
        // Caching also makes silent system-voice synthesis return that exact file.
        cache: { enabled: true },
      });
      await speaker.speak(text, { silent: true });
      // the SDK reports the exact file it used — no scanning, no correlation guesswork
      if (speaker.lastAudioFile && existsSync(speaker.lastAudioFile)) {
        const owned = path.join(this.synthDir, `reply-${Date.now()}${path.extname(speaker.lastAudioFile) || '.mp3'}`);
        copyFileSync(speaker.lastAudioFile, owned);
        return owned;
      }
    } catch {
      // cloud silent mode unavailable — fall through to the system voice
    }
    const file = path.join(this.synthDir, `reply-${Date.now()}.aiff`);
    try {
      await run('say', ['-o', file, text], 30_000);
      return file;
    } catch (error) {
      this.log('SYNTH FAILED', (error as Error).message.slice(0, 60));
      this.changed();
      return null;
    }
  }

  /** Controlled playback of a runtime-owned file: pause/resume/stop are real.
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
      // natural completion is authoritative — the audio really is done
      if (this.playing && !this.paused) {
        this.finishPlayback(true);
        this.changed();
      }
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
    for (const { client } of this.laneClients.values()) void client.close().catch(() => undefined);
    this.laneClients.clear();
    rmSync(this.synthDir, { recursive: true, force: true });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
