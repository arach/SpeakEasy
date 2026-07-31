import { EventEmitter } from 'node:events';

export interface DeckMessage {
  role: 'you' | 'agent';
  text: string;
  dur: number;
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
  pos: number;
  speedIx: number;
  vol: number;
  autoplay: boolean;
  listening: boolean;
  phase: string;
  confirm: string;
  trace: DeckTraceEntry[];
}

export interface DeckIntent {
  name: string;
  [key: string]: unknown;
}

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const LANE_COUNT = 9;
const TICK_MS = 250;

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

/**
 * The Mac-authoritative deck runtime. Owns lanes, threads, the phase machine,
 * and playback state; the deck renders snapshots and sends intents.
 */
export class DeckRuntime extends EventEmitter {
  private rev = 0;
  private laneIx = 1;
  private threads: DeckMessage[][] = Array.from({ length: LANE_COUNT }, () => []);
  private playing: string | null = null;
  private pos = 0;
  private speedIx = 0;
  private vol = 0.8;
  private autoplay = true;
  private listening = false;
  private phase = 'idle';
  private confirm = 'READY';
  private trace: DeckTraceEntry[] = [];
  private ticker: NodeJS.Timeout | null = null;
  private speaking = false;
  private replyIx = 0;

  snapshot(): DeckSnapshot {
    return {
      type: 'snapshot',
      rev: this.rev,
      lane: this.laneIx,
      threads: this.threads,
      playing: this.playing,
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
      if (!this.playing) return;
      this.pos += TICK_MS / 1000;
      const dur = this.durOf(this.playing);
      if (this.pos >= dur) {
        this.playing = null;
        this.pos = 0;
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

  private setPhase(phase: string, confirm: string): void {
    this.phase = phase;
    this.confirm = confirm;
  }

  /** User actions from the deck. Unknown intents fail explicitly. */
  async apply(intent: DeckIntent): Promise<{ ok: boolean; error?: string }> {
    switch (intent.name) {
      case 'lane.select': {
        const i = Number(intent.index);
        if (!Number.isInteger(i) || i < 0 || i >= LANE_COUNT) return { ok: false, error: 'bad lane index' };
        this.laneIx = i;
        this.playing = null;
        this.pos = 0;
        this.setPhase(this.phase, `READY · LANE ${String(i + 1).padStart(2, '0')}`);
        this.log('LANE SELECTED', `lane ${i + 1}`);
        this.changed();
        return { ok: true };
      }
      case 'playback.toggle': {
        const id = String(intent.id ?? '');
        if (this.playing === id) {
          this.playing = null;
          this.log('PLAYBACK PAUSED', `${Math.floor(this.pos)}s elapsed`);
        } else {
          this.playing = id;
          this.pos = 0;
          this.setPhase('speaking', 'PLAYING');
          this.log('PLAYBACK STARTED', `${SPEEDS[this.speedIx].toFixed(2)}x`);
          this.ensureTicker();
        }
        this.changed();
        return { ok: true };
      }
      case 'playback.scrub': {
        const id = String(intent.id ?? '');
        const frac = Math.min(1, Math.max(0, Number(intent.frac) || 0));
        this.playing = id;
        this.pos = frac * this.durOf(id);
        this.ensureTicker();
        this.changed();
        return { ok: true };
      }
      case 'playback.speed':
        this.speedIx = (this.speedIx + 1) % SPEEDS.length;
        this.log('SPEED CHANGE', `${SPEEDS[this.speedIx].toFixed(2)}x`);
        this.changed();
        return { ok: true };
      case 'playback.volume':
        this.vol = Math.min(1, Math.max(0, Number(intent.vol) || 0));
        this.log('NARRATION VOLUME', `${Math.round(this.vol * 100)}%`);
        this.changed();
        return { ok: true };
      case 'playback.autoplay':
        this.autoplay = !this.autoplay;
        this.log('AUTOPLAY', this.autoplay ? 'on' : 'off');
        this.changed();
        return { ok: true };
      case 'playback.stop':
        this.playing = null;
        this.pos = 0;
        this.listening = false;
        this.setPhase('idle', 'CANCELLED');
        this.log('PLAYBACK STOPPED', 'buffer cleared');
        this.changed();
        return { ok: true };
      case 'playback.replay': {
        const t = this.threads[this.laneIx];
        for (let i = t.length - 1; i >= 0; i--) {
          if (t[i].role === 'agent') {
            this.playing = `${this.laneIx}:${i}`;
            this.pos = 0;
            this.setPhase('speaking', 'REPLAYING LAST REPLY');
            this.ensureTicker();
            this.log('REPLAY', `lane ${this.laneIx + 1} · last reply`);
            this.changed();
            return { ok: true };
          }
        }
        return { ok: false, error: 'no reply to replay' };
      }
      case 'capture.start':
        this.listening = true;
        this.playing = null;
        this.setPhase('recording', 'LISTENING');
        this.log('VOICE COMMAND', `lane ${this.laneIx + 1} · recording`);
        this.changed();
        return { ok: true };
      case 'capture.cancel':
        if (!this.listening) return { ok: false, error: 'not recording' };
        this.listening = false;
        this.setPhase('idle', 'READY');
        this.log('VOICE COMMAND', 'cancelled');
        this.changed();
        return { ok: true };
      case 'capture.end': {
        if (!this.listening) return { ok: false, error: 'not recording' };
        this.listening = false;
        const command = typeof intent.text === 'string' && intent.text.trim()
          ? intent.text.trim()
          : 'Walk me through what is still blocking, then keep going.';
        void this.respond(this.laneIx, command);
        return { ok: true };
      }
      case 'speak': {
        const text = String(intent.text ?? '').trim();
        if (!text) return { ok: false, error: 'text required' };
        void this.narrate(text, this.laneIx, true);
        return { ok: true };
      }
      default:
        return { ok: false, error: `unknown intent: ${intent.name}` };
    }
  }

  /** CLI mirror: an item spoken elsewhere, shown (and optionally voiced) here. */
  async narrate(text: string, laneIx: number, play: boolean): Promise<void> {
    const lane = Math.min(LANE_COUNT - 1, Math.max(0, laneIx));
    const msg: DeckMessage = { role: 'agent', text, dur: estimateDuration(text) };
    this.threads[lane] = [...this.threads[lane], msg];
    const id = `${lane}:${this.threads[lane].length - 1}`;
    this.log('NARRATION', `lane ${lane + 1} · ${msg.dur.toFixed(0)}s`);
    if (this.autoplay) {
      this.playing = id;
      this.pos = 0;
      this.setPhase('speaking', 'SPEAKING');
      this.ensureTicker();
    }
    this.changed();
    if (play) await this.voice(text);
  }

  /** The PTT loop with the real phase machine and real synthesis on the Mac. */
  private async respond(laneIx: number, command: string): Promise<void> {
    if (this.speaking) return;
    this.speaking = true;
    const lane = laneIx;
    try {
      this.setPhase('transcribing', 'TRANSCRIBING');
      this.changed();
      await wait(600);
      this.setPhase('submitting', 'SUBMITTING');
      this.changed();
      await wait(500);

      this.threads[lane] = [...this.threads[lane], { role: 'you', text: command, dur: estimateDuration(command) }];
      const reply = REPLIES[this.replyIx++ % REPLIES.length];
      const msg: DeckMessage = { role: 'agent', text: reply, dur: estimateDuration(reply) };
      this.threads[lane] = [...this.threads[lane], msg];
      const id = `${lane}:${this.threads[lane].length - 1}`;

      this.setPhase('preparingSpeech', 'PREPARING SPEECH');
      this.log('AGENT REPLY', `${msg.dur.toFixed(0)}s queued`);
      this.changed();

      const speech = this.voice(reply);
      if (this.autoplay) {
        this.playing = id;
        this.pos = 0;
        this.setPhase('speaking', 'SPEAKING');
        this.ensureTicker();
        this.changed();
      }
      await speech;
    } finally {
      this.speaking = false;
    }
  }

  /** Real audio through the SpeakEasy providers — the Mac actually speaks. */
  private async voice(text: string): Promise<void> {
    try {
      const { SpeakEasy } = await import('../index');
      await new SpeakEasy({ volume: this.vol }).speak(text);
    } catch (error) {
      this.log('SYNTH FAILED', (error as Error).message.slice(0, 60));
      this.changed();
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
