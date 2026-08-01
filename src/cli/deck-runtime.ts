import { EventEmitter } from 'node:events';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { tmpdir, homedir, hostname } from 'node:os';
import path from 'node:path';
import { z } from 'zod';

/** execFile as a promise, capturing stdout, with a hard timeout. */
function run(cmd: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
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
  snippet: string;
  at: number;
  originator: string;
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
  z.object({ name: z.literal('lane.assign'), index: z.number().int().min(0).max(8), threadId: z.string().max(64).nullable() }),
  z.object({ name: z.literal('playback.progress'), id: z.string().regex(/^\d:\d{1,3}$/), pos: z.number().min(0), dur: z.number().positive().optional() }),
  z.object({ name: z.literal('playback.ended'), id: z.string().regex(/^\d:\d{1,3}$/) }),
]);

export type DeckIntent = z.infer<typeof intentSchema>;

const SPEEDS = [1, 1.25, 1.5, 0.75]; // must match the deck client's SPEEDS exactly
const LANE_COUNT = 9;
/** The overview officer: a deck-owned 10th lane on a cheap, fast model that
 * answers questions about the whole system from a live digest. Not mappable. */
const MASTER_IX = 9;
const MASTER_REUSE_KEY = 'speakeasy-deck-master';
const OVERVIEW_MODEL = 'gpt-5.6-luna';
/** low on purpose: the digest does the work — the overview lane should read
 * the board and report, never overthink or get clever. */
const OVERVIEW_EFFORT = 'low';
const TICK_MS = 250;
const MAX_MESSAGES_PER_LANE = 50;
const LANES_FILE = path.join(homedir(), '.config', 'speakeasy', 'deck-lanes.json');

const CODEX_SESSIONS_DIR = path.join(homedir(), '.codex', 'sessions');
const CATALOG_LIMIT = 25;

/** Read at most `bytes` from the head of a file. */
function readHead(file: string, bytes: number): string {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.toString('utf8', 0, n);
  } finally {
    closeSync(fd);
  }
}

/** Parse a rollout's head for its identity and first real human prompt. */
function parseRollout(file: string, at: number): DeckThreadInfo | null {
  let head: string;
  try {
    head = readHead(file, 65536);
  } catch {
    return null;
  }
  let id = '';
  let cwd = '';
  let originator = '';
  let snippet = '';
  for (const line of head.split('\n')) {
    if (!line) continue;
    let rec: { type?: string; payload?: Record<string, unknown> };
    try {
      rec = JSON.parse(line);
    } catch {
      continue; // a truncated tail line is not a thread problem
    }
    const p = rec.payload;
    if (rec.type === 'session_meta' && p) {
      id = String(p.session_id ?? p.id ?? '');
      cwd = String(p.cwd ?? '');
      originator = String(p.originator ?? '');
    } else if (!snippet && rec.type === 'response_item' && p?.type === 'message' && p?.role === 'user') {
      const content = Array.isArray(p.content) ? p.content : [];
      const text = content
        .filter((c) => (c as { type?: string }).type === 'input_text')
        .map((c) => String((c as { text?: string }).text ?? ''))
        .join(' ')
        .trim();
      // injected context blocks start with '<' — the first real prompt doesn't
      if (text && !text.startsWith('<')) snippet = text.replace(/\s+/g, ' ').slice(0, 90);
    }
    if (id && snippet) break;
  }
  if (!id) return null;
  return { id, cwd, snippet: snippet || `${path.basename(cwd)} thread`, at, originator };
}

/** The adapter's per-key runtime dir (mirrors codexLocalSessionPaths). */
function laneRuntimeDir(key: string): string {
  return path.join(homedir(), '.scout', 'local', 'codex', key.replace(/[^A-Za-z0-9._-]+/g, '_'), 'runtime');
}

/** Locate and parse the rollout for a thread id — filenames carry the id. */
function findRollout(threadId: string): DeckThreadInfo | null {
  let names: string[];
  try {
    names = readdirSync(CODEX_SESSIONS_DIR, { recursive: true }) as string[];
  } catch {
    return null;
  }
  const match = names.find((n) => n.includes(threadId) && n.endsWith('.jsonl'));
  if (!match) return null;
  const file = path.join(CODEX_SESSIONS_DIR, match);
  try {
    return parseRollout(file, statSync(file).mtimeMs);
  } catch {
    return null;
  }
}

/** Recent codex threads from local rollout files, newest first. Returns null
 * when the sessions dir is unreadable, so the caller can keep its stale list —
 * a stale list the user can read beats an empty one. */
function scanCodexThreads(): DeckThreadInfo[] | null {
  let names: string[];
  try {
    names = readdirSync(CODEX_SESSIONS_DIR, { recursive: true }) as string[];
  } catch {
    return null;
  }
  const rollouts: { file: string; at: number }[] = [];
  for (const n of names) {
    if (!/rollout-.*\.jsonl$/.test(n)) continue;
    try {
      rollouts.push({ file: n, at: statSync(path.join(CODEX_SESSIONS_DIR, n)).mtimeMs });
    } catch {
      // vanished mid-scan — skip
    }
  }
  rollouts.sort((a, b) => b.at - a.at);
  const out: DeckThreadInfo[] = [];
  // scan a few extra — some rollouts carry no usable snippet
  for (const { file, at } of rollouts.slice(0, CATALOG_LIMIT * 3)) {
    const info = parseRollout(path.join(CODEX_SESSIONS_DIR, file), at);
    if (info) out.push(info);
    if (out.length >= CATALOG_LIMIT) break;
  }
  return out;
}

/** Per-lane session reuse keys, persisted so a cycled (reset) lane keeps its
 * fresh session across deck restarts instead of resurrecting the base one.
 * Only deck-owned keys are honored — legacy scout session ids are ignored. */
function loadLaneKeys(): string[] {
  const base = Array.from({ length: LANE_COUNT }, (_, i) => `speakeasy-deck-lane-${i}`);
  try {
    const saved = JSON.parse(readFileSync(LANES_FILE, 'utf8')) as Record<string, unknown>;
    return base.map((b, i) => {
      const v = saved[String(i)];
      return typeof v === 'string' && v.startsWith('speakeasy-deck-lane-') ? v : b;
    });
  } catch {
    return base;
  }
}

/** Session-level instructions for every lane's codex session. */
const VOICE_SYSTEM_PROMPT =
  'You are a voice responder for a spoken interface. Do not use tools, do not read or write files, do not access the network. ' +
  'Answer from general knowledge only, in one or two spoken-style sentences, plain words, no lists, no code.';

/** Session-level instructions for the overview lane: the digest is its eyes. */
const OVERVIEW_SYSTEM_PROMPT =
  'You are the overview officer of a voice-command deck with nine lanes, each a live codex thread. ' +
  'Every question arrives with a DECK STATUS digest that is live and authoritative — answer from it and never invent state. ' +
  'Do not use tools, do not read or write files, do not access the network. ' +
  'Speak plainly, no lists, no code: one or two sentences for a status question, up to five for a full summary.';

/** Kept in a variable so the bundler leaves a native import() — the package is ESM-only. */
const AGENT_SESSIONS_SPEC = '@openscout/agent-sessions/local';

/** Minimal structural type for the agent-sessions local client, declared here
 * so the CJS build never has to resolve the ESM-only package's types. */
interface LaneAgentClient {
  turn(input: { input: string; timeoutMs?: number }): Promise<{ text: string; session: { id: string; nativeId?: string } }>;
  close(): Promise<void>;
  interrupt?(): void;
}

/** Options for the lane session factory — model/effort select a cheaper,
 * faster brain for the overview lane while workers keep the default. */
interface LaneClientOptions {
  harness: 'codex';
  cwd: string;
  reuseKey: string;
  warmth: 'lazy';
  systemPrompt: string;
  model?: string;
  effort?: string;
}

function clock(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
      title: 'new codex session on first ask',
      state: 'idle' as const,
    })),
    {
      num: 'OV',
      name: 'OVERVIEW',
      title: `whole-deck view · ${OVERVIEW_MODEL} · ${OVERVIEW_EFFORT}`,
      state: 'idle' as const,
    },
  ];
  /** per-lane session reuse keys — cycling a lane bumps its key to reset the session */
  private laneKeys: string[] = loadLaneKeys();
  /** warm session clients, created lazily on each lane's first question */
  private laneClients = new Map<number, { key: string; client: LaneAgentClient }>();
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
  private ticker: NodeJS.Timeout | null = null;
  private busy = false;
  private destroyed = false;
  /** bumped on stop/cancel — pending response work checks it before every phase */
  private gen = 0;
  private player: ChildProcess | null = null;
  private playerRate = 1;
  private synthDir = mkdtempSync(path.join(tmpdir(), 'speakeasy-deck-synth-'));
  /** set by the data plane — how many live deck clients are connected */
  liveClients: () => number = () => 0;

  /** the directory synthesized audio is served from (deck-live exposes it at /audio) */
  get audioDir(): string {
    return this.synthDir;
  }

  constructor() {
    super();
    this.restoreLaneBindings();
  }

  /** Rebuild lane labels for persisted thread bindings — the adapter resumes
   * the thread on its own; this restores what the pad SAYS it is bound to.
   * Restores honor the one-thread-one-lane invariant too: legacy state from
   * before dedupe can double-bind a thread, and the first lane keeps it. */
  private restoreLaneBindings(): void {
    const claimed = new Set<string>();
    let rotated = false;
    this.laneKeys.forEach((key, i) => {
      let threadId = '';
      try {
        threadId = readFileSync(path.join(laneRuntimeDir(key), 'codex-thread-id.txt'), 'utf8').trim();
      } catch {
        return; // unseeded lane — fresh session
      }
      if (!threadId) return;
      if (claimed.has(threadId)) {
        // double binding from an older build — rotate to a fresh key
        this.laneKeys[i] = `speakeasy-deck-lane-${i}-${Date.now().toString(36)}`;
        rotated = true;
        this.log('LANE DEDUPED', `lane ${i + 1} → fresh session (thread already bound)`);
        return;
      }
      claimed.add(threadId);
      const lane = this.lanes[i];
      lane.threadId = threadId;
      lane.sessionAlias = threadId.replace(/-/g, '').slice(-8);
      lane.title = findRollout(threadId)?.snippet ?? 'codex thread';
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

  /** The lane's warm codex session client, created on first use. Sessions are
   * owned by the deck via @openscout/agent-sessions — the adapter persists the
   * codex thread id under the reuse key, so a lane resumes its exact thread
   * across deck restarts with no broker involvement. */
  private async laneClient(ix: number): Promise<LaneAgentClient> {
    // the overview lane has a fixed, deck-owned key — it is never remapped
    const key = ix === MASTER_IX ? MASTER_REUSE_KEY : this.laneKeys[ix];
    const existing = this.laneClients.get(ix);
    if (existing && existing.key === key) return existing.client;
    if (existing) {
      this.laneClients.delete(ix);
      void existing.client.close().catch(() => undefined);
    }
    const { createLocalAgentClient } = (await import(AGENT_SESSIONS_SPEC)) as {
      createLocalAgentClient(options: LaneClientOptions): Promise<LaneAgentClient>;
    };
    const options: LaneClientOptions = {
      harness: 'codex',
      cwd: process.cwd(),
      reuseKey: key,
      warmth: 'lazy',
      systemPrompt: ix === MASTER_IX ? OVERVIEW_SYSTEM_PROMPT : VOICE_SYSTEM_PROMPT,
    };
    if (ix === MASTER_IX) {
      options.model = OVERVIEW_MODEL;
      options.effort = OVERVIEW_EFFORT;
    }
    const client = await createLocalAgentClient(options);
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
      writeFileSync(LANES_FILE, JSON.stringify(out), { mode: 0o600 });
    } catch {
      // best-effort
    }
  }

  /** The overview lane's own thread id, if it has one. A worker pad must never
   * be mapped to it — two sessions steering one codex thread is the failure
   * this guards (runtime dedupe only sweeps the nine worker lanes). */
  private masterThreadId(): string | null {
    const live = this.lanes[MASTER_IX].threadId;
    if (live) return live;
    try {
      const id = readFileSync(path.join(laneRuntimeDir(MASTER_REUSE_KEY), 'codex-thread-id.txt'), 'utf8').trim();
      return id || null;
    } catch {
      return null;
    }
  }

  /** The thread a lane's key currently points at, if one was recorded — the
   * adapter writes this for fresh sessions too, so read it live rather than
   * tracking it in memory. */
  private laneThreadId(index: number): string | null {
    try {
      const id = readFileSync(path.join(laneRuntimeDir(this.laneKeys[index]), 'codex-thread-id.txt'), 'utf8').trim();
      return id || null;
    } catch {
      return null;
    }
  }

  /** Channel mapper: bind a pad to an existing codex thread, or to a fresh
   * session when threadId is null. Only ever called while no response is in
   * flight (apply() rejects lane.cycle/lane.assign when busy), so this never
   * touches another lane's turn. */
  private assignLane(index: number, threadId: string | null): void {
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
        const dir = laneRuntimeDir(key);
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
      lane.title = info?.snippet ?? 'codex thread';
      lane.threadId = threadId;
      lane.sessionAlias = threadId.replace(/-/g, '').slice(-8);
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
      lane.title = 'new codex session on first ask';
      lane.threadId = undefined;
      lane.sessionAlias = undefined;
      this.log(threadId ? 'ASSIGN FAILED' : 'LANE RESET', `lane ${index + 1} → fresh session`);
    }
    this.changed();
  }

  private laneLabel(ix: number): string {
    return this.lanes[ix]?.name.toLowerCase() ?? `lane ${ix + 1}`;
  }

  /** Live, compact picture of the whole deck — the overview lane's eyes. One
   * line per lane: binding, state, title, and the last exchange if there is one. */
  private systemDigest(): string {
    const lines = this.lanes.slice(0, LANE_COUNT).map((lane, i) => {
      const bound = lane.threadId ? `bound ${lane.sessionAlias}` : 'fresh session';
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
        this.playing = null;
        this.pos = 0;
        this.paused = false;
        this.log('PLAYBACK ENDED', 'buffer complete');
        this.setPhase('idle', 'READY');
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
        this.gen++; // an in-flight response must not restart audio under a new lane
        this.cancelAgentWork();
        this.laneIx = intent.index;
        this.stopPlayer();
        this.clearPlayback();
        const label = intent.index === MASTER_IX ? 'OVERVIEW' : `LANE ${String(intent.index + 1).padStart(2, '0')}`;
        this.setPhase(this.phase, `READY · ${label}`);
        this.log('LANE SELECTED', intent.index === MASTER_IX ? 'overview' : `lane ${intent.index + 1}`);
        this.changed();
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
          this.playing = intent.id;
          this.paused = false;
          this.pos = 0;
          this.setPhase('speaking', 'PLAYING');
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
        this.gen++; // cancel any pending response work
        this.cancelAgentWork();
        this.stopPlayer();
        this.clearPlayback();
        this.listening = false;
        this.setPhase('idle', 'CANCELLED');
        this.log('PLAYBACK STOPPED', 'buffer cleared');
        this.changed();
        return { ok: true, rev: this.rev };
      case 'playback.replay': {
        const t = this.threads[this.laneIx];
        for (let i = t.length - 1; i >= 0; i--) {
          // only file-backed replies can actually replay — mirrors have no audio here
          if (t[i].role === 'agent' && t[i].file) {
            this.stopPlayer();
            this.playing = `${this.laneIx}:${i}`;
            this.paused = false;
            this.pos = 0;
            this.setPhase('speaking', 'REPLAYING LAST REPLY');
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
        this.gen++;
        this.cancelAgentWork();
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
        const scanned = scanCodexThreads();
        if (scanned) {
          // the overview lane's own thread is deck-owned — never offer it for mapping
          const master = this.masterThreadId();
          this.catalog = master ? scanned.filter((t) => t.id !== master) : scanned;
          this.catalogError = null;
        } else {
          // keep whatever we last showed — a stale list beats an empty one
          this.catalogError = 'Could not read the codex sessions dir — showing the last list.';
          this.log('CATALOG FAILED', 'sessions dir unreadable · keeping stale list');
        }
        this.changed();
        return { ok: true, rev: this.rev };
      }
      case 'lane.assign': {
        if (this.busy) return { ok: false, rev: this.rev, error: 'response in flight — try again in a moment' };
        if (intent.threadId && intent.threadId === this.masterThreadId()) {
          return { ok: false, rev: this.rev, error: 'that thread belongs to the overview lane' };
        }
        this.assignLane(intent.index, intent.threadId);
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
        const [li] = intent.id.split(':').map(Number);
        this.playing = null;
        this.pos = 0;
        this.paused = false;
        this.setPhase('idle', 'READY');
        this.setLaneState(li, 'idle');
        this.log('PLAYBACK ENDED', 'buffer complete');
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
      this.playing = id;
      this.paused = false;
      this.pos = 0;
      this.setPhase('speaking', 'SPEAKING');
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
      this.setPhase('transcribing', 'TRANSCRIBING');
      this.changed();
      await wait(600);
      if (!alive()) return;

      this.pushMessage(lane, { role: 'you', text: command, dur: estimateDuration(command) });
      this.setPhase('submitting', 'SUBMITTING');
      this.log('AGENT ASKED', `${this.laneLabel(lane)} · ${command.slice(0, 40)}`);
      this.changed();

      const reply = await this.askAgent(command, lane);
      if (!alive()) return;

      const msg: DeckMessage = { role: 'agent', text: reply, dur: estimateDuration(reply) };
      this.pushMessage(lane, msg);
      const id = `${lane}:${this.threads[lane].length - 1}`;

      this.setPhase('preparingSpeech', 'PREPARING SPEECH');
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
        this.setPhase('idle', 'READY');
        this.log('NO AUDIO', 'synthesis unavailable · text-only reply');
        this.changed();
        return;
      }
      msg.file = file;
      msg.audioUrl = `/audio/${path.basename(file)}`;
      if (this.autoplay) {
        this.playing = id;
        this.paused = false;
        this.pos = 0;
        this.setPhase('speaking', 'SPEAKING');
        this.setLaneState(lane, 'speaking');
        this.ensureTicker();
        this.changed();
        // a connected deck plays the audio on the device; the Mac speaks only
        // when nobody is watching
        if (this.liveClients() === 0) this.playFile(file);
      } else {
        this.setPhase('idle', 'READY');
        this.changed();
      }
    } finally {
      this.busy = false;
      if (this.lanes[lane]?.state !== 'speaking' && this.setLaneState(lane, 'idle')) this.changed();
    }
  }

  /** Ask the lane's codex session and get a spoken-length answer back. Each
   * lane owns one warm session via @openscout/agent-sessions — turns steer the
   * codex app-server transport directly (no broker dispatch, no receipts), so
   * follow-ups continue the exact same thread. */
  private async askAgent(question: string, laneIx: number): Promise<string> {
    const lane = this.lanes[laneIx];
    try {
      const client = await this.laneClient(laneIx);
      // the overview lane sees the whole deck: its question rides on a live digest
      const input =
        laneIx === MASTER_IX
          ? `${this.systemDigest()}\n\nOperator asks: ${question.slice(0, 500)}`
          : question.slice(0, 500);
      const result = await client.turn({ input, timeoutMs: 180_000 });
      const thread = result.session.nativeId;
      // codex thread ids are UUIDv7 — the leading bytes are a timestamp, so
      // alias from the random tail to tell threads apart
      if (lane && thread) {
        lane.threadId = thread;
        lane.sessionAlias = thread.replace(/-/g, '').slice(-8);
      }
      const text = result.text.trim();
      if (!text) throw new Error('empty reply from session');
      return text.length > 600 ? text.slice(0, 600).replace(/\s+\S*$/, '') + '…' : text;
    } catch (error) {
      this.log('AGENT FAILED', (error as Error).message.slice(0, 60));
      const who = this.lanes[laneIx]?.name.toLowerCase();
      return who
        ? `${who[0].toUpperCase() + who.slice(1)} didn't answer that one — try again in a moment.`
        : 'Sorry, the agent did not answer that one. Try again in a moment.';
    }
  }

  /** Interrupt any in-flight lane turn — called on stop, lane change, new capture, destroy. */
  private cancelAgentWork(): void {
    for (const { client } of this.laneClients.values()) client.interrupt?.();
  }

  /** Synthesize to a runtime-owned file — the user's configured provider first
   * (cloud silent mode → exact cache entry copied out), the macOS system voice
   * as fallback. The copy means cache eviction can never pull audio mid-play. */
  private async synthesize(text: string): Promise<string | null> {
    try {
      const { SpeakEasy } = await import('../index');
      const speaker = new SpeakEasy({ volume: this.vol });
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
        const [li] = this.playing.split(':').map(Number);
        this.playing = null;
        this.pos = 0;
        this.paused = false;
        this.setPhase('idle', 'READY');
        this.setLaneState(li, 'idle');
        this.log('PLAYBACK ENDED', 'buffer complete');
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
