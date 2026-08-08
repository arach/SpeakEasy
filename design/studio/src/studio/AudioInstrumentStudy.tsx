"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/studio/PageHeader";
import type { StudioAppPage } from "@/studio/studioRegistry";

/**
 * Audio instrument study — the bottom-right panel of the Micro Deck surface.
 *
 * This is a working replica, not a screenshot. The SwiftUI original lives at
 * deck/ipad/Sources/DeckAudioInstrument.swift and can only be evaluated by
 * building, installing to a simulator, and rotating a framebuffer — a loop far
 * too slow to design in. Everything here is driveable: pick a state, drag the
 * position, push the input level, and watch the figure respond.
 *
 * Palette is the Flight theme, lifted from deck/ipad/Sources/DeckTheme.swift.
 * Geometry follows the shipped component: 1U idle, 2U while playing, where a
 * unit is one key-bank row so the panel always lands on the pad's grid.
 */

const FLIGHT = {
  page: "#05090b",
  panel: "#0c161a",
  pad: "#142328",
  padBottom: "#0d171b",
  line: "#1f333a",
  lineSoft: "#1a2b31",
  ink: "#e8f0ee",
  ink2: "#a9bcb8",
  ink3: "#6c7f7b",
  ink4: "#4d605c",
  accent: "#74f2ce",
  amber: "#e0a83f",
} as const;

/** One key-bank row. The shipped panel derives this from the pad height. */
const UNIT = 78;
const GAP = 7;

type Figure = "flat" | "live" | "sweep" | "travel" | "fill" | "dashes";

type PanelState = {
  key: string;
  word: string;
  detail: string;
  tint: string;
  figure: Figure;
  /** Playing states grow to 2U and gain transport. */
  playing?: boolean;
  progress?: number;
};

const STATES: PanelState[] = [
  { key: "ready", word: "READY", detail: "IDLE", tint: FLIGHT.ink3, figure: "flat" },
  { key: "listening", word: "LISTENING", detail: "LANE 05", tint: FLIGHT.accent, figure: "live" },
  { key: "arming", word: "ARMING", detail: "MIC", tint: FLIGHT.amber, figure: "sweep" },
  { key: "transcribing", word: "TRANSCRIBING", detail: "ON DEVICE", tint: FLIGHT.amber, figure: "sweep" },
  { key: "model", word: "MODEL", detail: "38%", tint: FLIGHT.amber, figure: "fill", progress: 0.38 },
  { key: "speaking", word: "SPEAKING", detail: "LANE 05", tint: FLIGHT.accent, figure: "travel", playing: true },
  { key: "macbusy", word: "SUBMITTING", detail: "MAC", tint: FLIGHT.amber, figure: "sweep" },
  { key: "sending", word: "SENDING", detail: "3 QUEUED", tint: FLIGHT.amber, figure: "dashes" },
  { key: "held", word: "HELD", detail: "2 AUDIO", tint: FLIGHT.amber, figure: "dashes" },
  { key: "unsent", word: "UNSENT", detail: "4 WAITING", tint: FLIGHT.amber, figure: "dashes" },
];

/** Frames sampled across one cycle for the filmstrip. */
const FRAMES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

const MOVING: { figure: Figure; tint: string; blurb: string }[] = [
  { figure: "sweep", tint: FLIGHT.amber, blurb: "a band of light crosses a dim baseline — work with no progress to report" },
  { figure: "dashes", tint: FLIGHT.amber, blurb: "dashes drift — a queue being worked, not stuck" },
  { figure: "travel", tint: FLIGHT.accent, blurb: "played span fills behind the playhead; unplayed stays at baseline" },
];

const NARRATION =
  "Yes — this repo is worth studying, but I would not replace Linea's PDF pipeline with it. " +
  "The extraction layer is stronger than ours on tables. " +
  "The layout model is weaker and would cost us the two-column handling we already have.";

/** Deterministic pseudo-envelope so the study renders identically every load. */
function envelope(count: number, seed = 7) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const speech = Math.abs(Math.sin(t * 11) * 0.5 + Math.sin(t * 27) * 0.3);
    const gate = t % 0.31 < 0.05 ? 0.08 : 1; // breaths between phrases
    return Math.round(Math.min(1, (speech * 0.75 + rand() * 0.25) * gate) * 1000) / 1000;
  });
}

export function AudioInstrumentStudyPage({ page }: { page: StudioAppPage }) {
  const [stateKey, setStateKey] = useState("speaking");
  const [level, setLevel] = useState(0.6);
  const [pos, setPos] = useState(0.34);
  const [volume, setVolume] = useState(0.8);
  const [paused, setPaused] = useState(false);
  const [seekable, setSeekable] = useState(true);
  const [width, setWidth] = useState(565);
  const [animate, setAnimate] = useState(true);
  const [manualPhase, setManualPhase] = useState(0);

  // One clock for the whole page. Each Track used to run its own rAF loop,
  // which meant the stacked states drifted out of step with each other and
  // none of them could be stopped to look at.
  const [speed, setSpeed] = useState(1);
  const runningPhase = useAnimationPhase(animate, speed);
  const phase = animate ? runningPhase : manualPhase;

  const state = STATES.find((s) => s.key === stateKey) ?? STATES[0];

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />

      <section className="max-w-[1100px] space-y-10 py-8">
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">Playground</h2>
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
            Every parameter the shipped panel reacts to, on a control. The panel is 1U when idle and
            2U while playing — a unit is one key-bank row, so it always starts and ends on the pad&apos;s
            grid. Drag <em>position</em> in a playing state to watch the played span fill and the
            sentence estimate move.
          </p>

          <div className="mb-5 flex flex-wrap gap-1.5">
            {STATES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStateKey(s.key)}
                className="rounded px-2.5 py-1 text-[10px] font-medium tracking-wide transition"
                style={{
                  background: s.key === stateKey ? FLIGHT.pad : "transparent",
                  color: s.key === stateKey ? s.tint : FLIGHT.ink4,
                  border: `1px solid ${s.key === stateKey ? s.tint + "66" : FLIGHT.line}`,
                }}
              >
                {s.word}
              </button>
            ))}
          </div>

          <div
            className="rounded-lg p-6"
            style={{ background: FLIGHT.page, border: `1px solid ${FLIGHT.lineSoft}` }}
          >
            <div style={{ width }}>
              <Panel
                state={state}
                level={level}
                pos={pos}
                volume={volume}
                paused={paused}
                seekable={seekable}
                phase={phase}
                onSeek={setPos}
                onVolume={setVolume}
                onTogglePlay={() => setPaused((p) => !p)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-studio-ink-faint">
            <button
              onClick={() => {
                if (animate) setManualPhase(runningPhase); // freeze where it is
                setAnimate((a) => !a);
              }}
              className="rounded px-3 py-1 font-medium transition"
              style={{
                border: `1px solid ${animate ? FLIGHT.line : FLIGHT.accent}`,
                color: animate ? FLIGHT.ink2 : FLIGHT.accent,
                background: animate ? "transparent" : FLIGHT.accent + "18",
              }}
            >
              {animate ? "❚❚  Pause animation" : "▶  Play animation"}
            </button>
            <span className="w-[86px] shrink-0">Frame</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={phase}
              disabled={animate}
              onChange={(e) => setManualPhase(Number(e.target.value))}
              className="flex-1 accent-[#74f2ce] disabled:opacity-30"
              style={{ maxWidth: 320 }}
            />
            <span className="w-[46px] shrink-0 text-right tabular-nums">{phase.toFixed(3)}</span>
            <button
              onClick={() => setManualPhase((v) => (v + 0.02) % 1)}
              disabled={animate}
              className="rounded px-2 py-1 transition disabled:opacity-30"
              style={{ border: `1px solid ${FLIGHT.line}`, color: FLIGHT.ink2 }}
            >
              Step ›
            </button>
          </div>

          <div className="mt-4 grid max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-2">
            <Slider label="Input level" value={level} onChange={setLevel} />
            <Slider label="Position" value={pos} onChange={setPos} />
            <Slider label="Volume" value={volume} onChange={setVolume} />
            <Slider label="Animation speed" value={speed} min={0.1} max={2} step={0.05} onChange={setSpeed} />
            <Slider label="Panel width" value={width} min={360} max={900} step={5} unit="pt" onChange={setWidth} />
            <Toggle label="Paused" checked={paused} onChange={setPaused} />
            <Toggle
              label="Device owns audio (seekable)"
              checked={seekable}
              onChange={setSeekable}
            />
          </div>
        </div>

        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">Motion, unrolled</h2>
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
            A loop that never stops is hard to read — you cannot see the shape of the motion while it
            is moving. Each animated figure below is one full cycle laid out as frames, left to
            right. Read a row like a filmstrip: that is the entire animation, all at once.
          </p>
          <div
            className="space-y-5 rounded-lg p-5"
            style={{ background: FLIGHT.page, border: `1px solid ${FLIGHT.lineSoft}` }}
          >
            {MOVING.map((m) => (
              <div key={m.figure}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-[10px] font-medium tracking-widest" style={{ color: m.tint }}>
                    {m.figure.toUpperCase()}
                  </span>
                  <span className="text-[10px]" style={{ color: FLIGHT.ink4 }}>
                    {m.blurb}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {FRAMES.map((f) => (
                    <div key={f} className="flex-1">
                      <div
                        className="rounded"
                        style={{
                          height: 34,
                          background: FLIGHT.pad,
                          border: `1px solid ${FLIGHT.line}`,
                          padding: "0 6px",
                        }}
                      >
                        <Track
                          figure={m.figure}
                          tint={m.tint}
                          level={0.6}
                          pos={f}
                          phase={f}
                        />
                      </div>
                      <div
                        className="mt-1 text-center text-[8px] tabular-nums"
                        style={{ color: FLIGHT.ink4 }}
                      >
                        {f.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">Every state</h2>
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
            States designed one at a time drift apart; the failure only shows up stacked. This is
            where the shipped component was caught reusing one figure for three different states.
          </p>
          <div
            className="space-y-2 rounded-lg p-5"
            style={{ background: FLIGHT.page, border: `1px solid ${FLIGHT.lineSoft}` }}
          >
            {STATES.map((s) => (
              <div key={s.key}>
                <div className="mb-1 text-[9px] tracking-widest" style={{ color: FLIGHT.ink4 }}>
                  {s.key.toUpperCase()}
                </div>
                <Panel
                  state={s}
                  level={level}
                  pos={pos}
                  volume={volume}
                  paused={paused}
                  seekable={seekable}
                  phase={phase}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Panel({
  state,
  level,
  pos,
  volume,
  paused,
  seekable,
  phase,
  compact,
  onSeek,
  onVolume,
  onTogglePlay,
}: {
  state: PanelState;
  level: number;
  pos: number;
  volume: number;
  paused: boolean;
  seekable: boolean;
  phase: number;
  compact?: boolean;
  onSeek?: (v: number) => void;
  onVolume?: (v: number) => void;
  onTogglePlay?: () => void;
}) {
  const playing = !!state.playing;
  const height = playing ? UNIT * 2 + GAP : UNIT;
  const tint = playing && paused ? FLIGHT.ink3 : state.tint;

  return (
    <div
      className="flex flex-col justify-center rounded-lg"
      style={{
        height,
        background: `linear-gradient(${FLIGHT.pad}, ${FLIGHT.padBottom})`,
        border: `1px solid ${state.figure === "flat" ? FLIGHT.line : tint + "59"}`,
        padding: "8px 14px",
        gap: 8,
      }}
    >
      <div className="flex items-center" style={{ gap: 14 }}>
        <Status word={state.word} detail={state.detail} tint={tint} level={level} figure={state.figure} />
        <div className="flex-1" style={{ height: playing ? 30 : 40 }}>
          <Track figure={state.figure} tint={tint} level={level} pos={pos} progress={state.progress} phase={phase} />
        </div>
        <Dial value={volume} tint={FLIGHT.accent} onChange={onVolume} />
      </div>

      {playing && (
        <div className="flex items-center" style={{ gap: 14 }}>
          <div style={{ width: 112 }} className="flex items-center">
            <button
              onClick={onTogglePlay}
              className="flex items-center justify-center rounded transition"
              style={{
                width: 44,
                height: 30,
                border: `1px solid ${paused ? FLIGHT.accent : FLIGHT.line}`,
                color: paused ? FLIGHT.accent : FLIGHT.ink2,
                background: paused ? FLIGHT.accent + "18" : "transparent",
                fontSize: 11,
              }}
            >
              {paused ? "▶" : "❚❚"}
            </button>
          </div>

          <div className="flex-1">
            <Scrubber pos={pos} tint={tint} seekable={seekable} onSeek={onSeek} />
            <div
              className="mt-1.5 truncate"
              style={{ fontSize: 9.5, color: FLIGHT.ink3, fontFamily: "ui-monospace, monospace" }}
            >
              ≈ {sentenceAt(NARRATION, pos)}
            </div>
          </div>

          <div style={{ width: 46 }} className="text-right">
            <div style={{ fontSize: 10, color: FLIGHT.ink2, fontFamily: "ui-monospace, monospace" }}>
              {clock(pos)}
            </div>
            <div style={{ fontSize: 7, color: FLIGHT.ink4, letterSpacing: 0.8 }}>
              {seekable ? "LOCAL" : "ON MAC"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Status({
  word,
  detail,
  tint,
  level,
  figure,
}: {
  word: string;
  detail: string;
  tint: string;
  level: number;
  figure: Figure;
}) {
  return (
    <div className="flex items-center" style={{ width: 112, gap: 8 }}>
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: 99,
          background: tint,
          opacity: figure === "live" ? 0.35 + level * 0.65 : 1,
          boxShadow: figure === "live" ? `0 0 6px ${tint}` : "none",
        }}
      />
      <div className="min-w-0">
        <div
          className="truncate"
          style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.2, color: tint, fontFamily: "ui-monospace, monospace" }}
        >
          {word}
        </div>
        <div style={{ fontSize: 7, letterSpacing: 0.9, color: FLIGHT.ink4, fontFamily: "ui-monospace, monospace" }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function Track({
  figure,
  tint,
  level,
  pos,
  progress,
  phase,
}: {
  figure: Figure;
  tint: string;
  level: number;
  pos: number;
  progress?: number;
  phase: number;
}) {
  const wave = useMemo(() => envelope(96), []);

  if (figure === "fill") {
    return (
      <div className="flex h-full items-center">
        <div className="h-[5px] w-full rounded-full" style={{ background: FLIGHT.line }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${(progress ?? 0) * 100}%`, background: tint }}
          />
        </div>
      </div>
    );
  }

  if (figure === "sweep") {
    return (
      <div className="relative flex h-full items-center overflow-hidden">
        <div className="h-[3px] w-full rounded-full" style={{ background: tint + "24" }} />
        <div
          className="absolute h-[3px] rounded-full"
          style={{
            width: "32%",
            left: `${phase * 132 - 32}%`,
            background: `linear-gradient(90deg, transparent, ${tint}, transparent)`,
          }}
        />
      </div>
    );
  }

  if (figure === "dashes") {
    return (
      <div className="flex h-full items-center" style={{ gap: 3 }}>
        {Array.from({ length: 26 }).map((_, i) => {
          const lit = (i / 26 + phase) % 0.25 < 0.12;
          return (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{ height: 3, background: tint, opacity: lit ? 0.85 : 0.2 }}
            />
          );
        })}
      </div>
    );
  }

  // live / flat / travel all draw the same bar field; what differs is the data.
  return (
    <div className="flex h-full items-center" style={{ gap: 1.5 }}>
      {wave.map((v, i) => {
        const t = i / wave.length;
        const isTravel = figure === "travel";
        const played = isTravel && t <= pos;
        const amplitude = figure === "flat" ? 0 : isTravel ? (played ? v : 0) : v * level;
        const opacity = figure === "flat" ? 0.16 : isTravel ? (played ? 0.9 : 0.14) : 0.9;
        return (
          <div
            key={i}
            className="flex-1 rounded-full"
            style={{
              // Rounded so SSR and the client serialize identically — a raw
              // float renders as "4.12674px" on the server and 4.1267435...
              // on the client, which trips React's hydration check.
              height: Math.round(Math.max(2, amplitude * 30)),
              background: tint,
              opacity,
              minWidth: 1,
            }}
          />
        );
      })}
    </div>
  );
}

function Scrubber({
  pos,
  tint,
  seekable,
  onSeek,
}: {
  pos: number;
  tint: string;
  seekable: boolean;
  onSeek?: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seek = (clientX: number) => {
    const el = ref.current;
    if (!el || !onSeek || !seekable) return;
    const r = el.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  return (
    <div
      ref={ref}
      className="relative flex items-center"
      style={{ height: 14, cursor: seekable && onSeek ? "pointer" : "default" }}
      onPointerDown={(e) => seek(e.clientX)}
      onPointerMove={(e) => e.buttons === 1 && seek(e.clientX)}
    >
      <div className="h-[4px] w-full rounded-full" style={{ background: FLIGHT.line }}>
        <div className="h-full rounded-full" style={{ width: `${pos * 100}%`, background: tint }} />
      </div>
      {seekable && (
        <div
          className="absolute rounded-full"
          style={{
            left: `calc(${pos * 100}% - 5px)`,
            width: 10,
            height: 10,
            background: tint,
            boxShadow: `0 0 6px ${tint}88`,
          }}
        />
      )}
    </div>
  );
}

function Dial({
  value,
  tint,
  onChange,
}: {
  value: number;
  tint: string;
  onChange?: (v: number) => void;
}) {
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={46}
      height={46}
      style={{ cursor: onChange ? "ns-resize" : "default", flexShrink: 0 }}
      onWheel={(e) => onChange?.(Math.min(1, Math.max(0, value - e.deltaY / 500)))}
    >
      <circle cx={23} cy={23} r={r} fill="none" stroke={FLIGHT.line} strokeWidth={4} />
      <circle
        cx={23}
        cy={23}
        r={r}
        fill="none"
        stroke={tint}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${Math.round(Math.max(0.02, value) * c * 100) / 100} ${Math.round(c * 100) / 100}`}
        transform="rotate(-90 23 23)"
      />
      <text
        x={23}
        y={27}
        textAnchor="middle"
        style={{ fontSize: 10, fill: FLIGHT.ink2, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}
      >
        {Math.round(value * 100)}
      </text>
    </svg>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function useAnimationPhase(active: boolean, speed = 1) {
  const originRef = useRef<number | null>(null);
  const [, setBeat] = useState(0);
  useEffect(() => {
    if (!active) {
      originRef.current = null;
      return;
    }
    originRef.current = performance.now();
    const id = window.setInterval(() => setBeat((n) => (n + 1) % 1_000_000), 80);
    return () => window.clearInterval(id);
  }, [active, speed]);
  if (!active || originRef.current == null) return 0;
  const elapsed = (performance.now() - originRef.current) / 1000;
  return ((elapsed * speed) / 1.6) % 1;
}

/**
 * Sentence containing the playhead, estimated by character position. There is
 * no word-level timing anywhere in the pipeline — duration and position is all
 * we get — so this assumes speech is spread evenly. Sentence granularity is
 * deliberate: a tighter window is wrong by a word constantly and reads as
 * broken, where this is wrong by a sentence occasionally and merely reads early.
 */
function sentenceAt(text: string, pos: number) {
  const parts = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const target = Math.floor(text.length * Math.min(0.999, Math.max(0, pos)));
  let seen = 0;
  for (const part of parts) {
    seen += part.length;
    if (seen > target) return part.trim();
  }
  return parts[parts.length - 1].trim();
}

function clock(pos: number, total = 47) {
  const s = Math.floor(pos * total);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="flex items-center gap-3 text-[11px] text-studio-ink-faint">
      <span className="w-[112px] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#74f2ce]"
      />
      <span className="w-[46px] shrink-0 text-right tabular-nums">
        {unit ? `${Math.round(value)}${unit}` : value.toFixed(2)}
      </span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-[11px] text-studio-ink-faint">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#74f2ce]"
      />
      <span>{label}</span>
    </label>
  );
}
