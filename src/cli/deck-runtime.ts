import { EventEmitter } from 'node:events';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';

export interface DeckMessage {
  role: 'you' | 'agent';
  text: string;
  dur: number;
  /** true while this is only a progress mirror — no controllable audio behind it */
  mirrored?: boolean;
  /** synthesized audio owned by the runtime — real transport control when present */
  file?: string;
}

export interface DeckTraceEntry {
  at: string;
  kind: string;
  detail: string;
}

export interface DeckSnapshot {
  type: 'snapshot';
  rev: number;
  lane: number;
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
}

const intentSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('lane.select'), index: z.number().int().min(0).max(8) }),
  z.object({ name: z.literal('playback.toggle'), id: z.string().regex(/^\d:\d{1,3}$/) }),
  z.object({ name: z.literal('playback.scrub'), id: z.string().regex(/^\d:\d{1,3}$/), frac: z.number().min(0).max(1) }),
  z.object({ name: z.literal('playback.speed') }),
  z.object({ name: z.literal('playback.volume'), vol: z.number().min(0).max(1) }),
  z.object({ name: z.literal('playback.autoplay') }),
  z.object({ name: z.literal('playback.stop') }),
  z.object({ name: z.literal('playback.replay') }),
  z.object({ name: z.literal('capture.start') }),
  z.object({ name: z.literal('capture.cancel') }),
  z.object({ name: z.literal('capture.end'), text: z.string().max(500).optional() }),
  z.object({ name: z.literal('speak'), text: z.string().min(1).max(4000) }),
]);

export type DeckIntent = z.infer<typeof intentSchema>;

const SPEEDS = [1, 1.25, 1.5, 0.75]; // must match the deck client's SPEEDS exactly
const LANE_COUNT = 9;
const TICK_MS = 250;
const MAX_MESSAGES_PER_LANE = 50;

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

const REPLIES = [
  'On it. The blocking item is the manifest signature; I am rotating the stale key in the same pass and will read back the result when it lands.',
  'Status: the merge train is green except for one pending check. I am watching it and will pick up the release notes next.',
  'Update: the queue is clear, the last two checks passed, and I am moving on to the cleanup pass now.',
];

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
  private threads: DeckMessage[][] = Array.from({ length: LANE_COUNT }, () => []);
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
  private ticker: NodeJS.Timeout | null = null;
  private busy = false;
  /** bumped on stop/cancel — pending response work checks it before every phase */
  private gen = 0;
  private player: ChildProcess | null = null;
  private playerRate = 1;
  private replyIx = 0;
  private synthDir = mkdtempSync(path.join(tmpdir(), 'speakeasy-deck-synth-'));

  snapshot(): DeckSnapshot {
    return {
      type: 'snapshot',
      rev: this.rev,
      lane: this.laneIx,
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
    };
  }

  private changed(): void {
    this.rev++;
    this.emit('changed', this.snapshot());
  }

  private log(kind: string, detail: string): void {
    this.trace = [{ at: clock(), kind, detail }, ...this.trace].slice(0, 7);
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      if (!this.playing || this.paused) return;
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
        this.laneIx = intent.index;
        this.stopPlayer();
        this.playing = null;
        this.pos = 0;
        this.paused = false;
        this.setPhase(this.phase, `READY · LANE ${String(intent.index + 1).padStart(2, '0')}`);
        this.log('LANE SELECTED', `lane ${intent.index + 1}`);
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
        this.stopPlayer();
        this.playing = null;
        this.paused = false;
        this.pos = 0;
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
        this.stopPlayer();
        this.listening = true;
        this.playing = null;
        this.setPhase('recording', 'LISTENING');
        this.log('VOICE COMMAND', `lane ${this.laneIx + 1} · recording`);
        this.changed();
        return { ok: true, rev: this.rev };
      case 'capture.cancel':
        if (!this.listening) return { ok: false, rev: this.rev, error: 'not recording' };
        this.listening = false;
        this.setPhase('idle', 'READY');
        this.log('VOICE COMMAND', 'cancelled');
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
    }
  }

  /** CLI mirror: an item spoken elsewhere, shown (and optionally voiced) here.
   * Audio is never runtime-owned on this path — always a progress mirror. */
  async narrate(text: string, laneIx: number, play: boolean): Promise<void> {
    const lane = Math.min(LANE_COUNT - 1, Math.max(0, laneIx));
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
    if (play) await this.voice(text);
  }

  private pushMessage(lane: number, msg: DeckMessage): void {
    const t = [...this.threads[lane], msg];
    this.threads[lane] = t.slice(-MAX_MESSAGES_PER_LANE);
  }

  /** The PTT loop: real phases, real synthesis, cancellable via this.gen. */
  private async respond(laneIx: number, command: string, gen: number): Promise<void> {
    this.busy = true;
    const lane = laneIx;
    const alive = () => this.gen === gen;
    try {
      this.setPhase('transcribing', 'TRANSCRIBING');
      this.changed();
      await wait(600);
      if (!alive()) return;
      this.setPhase('submitting', 'SUBMITTING');
      this.changed();
      await wait(500);
      if (!alive()) return;

      this.pushMessage(lane, { role: 'you', text: command, dur: estimateDuration(command) });
      const reply = REPLIES[this.replyIx++ % REPLIES.length];
      const msg: DeckMessage = { role: 'agent', text: reply, dur: estimateDuration(reply) };
      this.pushMessage(lane, msg);
      const id = `${lane}:${this.threads[lane].length - 1}`;

      this.setPhase('preparingSpeech', 'PREPARING SPEECH');
      this.log('AGENT REPLY', `${msg.dur.toFixed(0)}s queued`);
      this.changed();

      const file = await this.synthesize(reply);
      if (!alive()) return;
      if (!file) {
        // synthesis failed — show the reply without audio, never fake playback
        msg.mirrored = true;
        this.setPhase('idle', 'READY');
        this.log('NO AUDIO', 'synthesis unavailable · text-only reply');
        this.changed();
        return;
      }
      msg.file = file;
      if (this.autoplay) {
        this.playing = id;
        this.paused = false;
        this.pos = 0;
        this.setPhase('speaking', 'SPEAKING');
        this.ensureTicker();
        this.changed();
        this.playFile(file);
      } else {
        this.setPhase('idle', 'READY');
        this.changed();
      }
    } finally {
      this.busy = false;
    }
  }

  /** Synthesize to a file without playing. System voice via `say -o`; cloud via the SDK's silent mode. */
  private async synthesize(text: string): Promise<string | null> {
    const file = path.join(this.synthDir, `reply-${Date.now()}.aiff`);
    try {
      await new Promise<void>((resolve, reject) => {
        execFile('say', ['-o', file, text], { timeout: 30_000 }, (err) => (err ? reject(err) : resolve()));
      });
      return file;
    } catch (error) {
      this.log('SYNTH FAILED', (error as Error).message.slice(0, 60));
      this.changed();
      return null;
    }
  }

  /** Cloud-provider narration through the SDK (plays on the Mac's speakers). */
  private async voice(text: string): Promise<void> {
    try {
      const { SpeakEasy } = await import('../index');
      await new SpeakEasy({ volume: this.vol }).speak(text);
    } catch (error) {
      this.log('SYNTH FAILED', (error as Error).message.slice(0, 60));
      this.changed();
    }
  }

  /** Controlled playback of a runtime-owned file: pause/resume/stop are real. */
  private playFile(file: string): void {
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
        this.playing = null;
        this.pos = 0;
        this.paused = false;
        this.setPhase('idle', 'READY');
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
    this.gen++;
    this.stopPlayer();
    if (this.ticker) clearInterval(this.ticker);
    rmSync(this.synthDir, { recursive: true, force: true });
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
