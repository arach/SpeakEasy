"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/studio/PageHeader";
import type { StudioAppPage } from "@/studio/studioRegistry";

/**
 * Lane console study — one surface, two textures.
 *
 * Identity + exchange (panel) sit over the player foot (plate). Same outer
 * border, no gap, no second rounded card. Ring lives in the numeral gutter so
 * TURN / caption share the identity text edge. Figure is the scrub surface —
 * no separate rail under the wave. Player height stays 2U (pad grid).
 */

// Flight: void graphite + mint signal (matches DeckTheme.swift)
const F = {
  page: "#06080a",
  panel: "#0d1114",
  panelHead: "#12171b",
  cell: "#161c22",
  trace: "#0a0d10",
  line: "#2c343c",
  lineSoft: "#1c2329",
  ink: "#f2f5f6",
  ink2: "#a8b2ba",
  ink3: "#6b7680",
  ink4: "#4a545c",
  accent: "#74f2ce",
  accentDark: "#0a1f1a",
  accentEdge: "#1a4a3e",
  amber: "#e8b04a",
  pad: "#161c22",
  padBottom: "#0f1317",
  plateTop: "#141a1f",
  plateBottom: "#080b0d",
} as const;

/** One key-bank row — the pad grid unit. */
const U = 78;
const PLAYER_H = U * 2; // exactly 2U, always

type Mode =
  | "ready"
  | "listening"
  | "transcribing"
  | "submitting"
  | "speaking"
  | "paused";

const MODES: { key: Mode; word: string; detail: string; tint: string }[] = [
  { key: "ready", word: "READY", detail: "LANE 02", tint: F.ink2 },
  { key: "listening", word: "LISTENING", detail: "LANE 02", tint: F.accent },
  { key: "transcribing", word: "TRANSCRIBING", detail: "ON DEVICE", tint: F.amber },
  { key: "submitting", word: "SUBMITTING", detail: "MAC", tint: F.amber },
  { key: "speaking", word: "SPEAKING", detail: "LANE 02", tint: F.accent },
  { key: "paused", word: "PAUSED", detail: "LANE 02", tint: F.ink3 },
];

const YOU = "Mock turn — walk the full lifecycle without Codex.";
const AGENT =
  "Lifecycle walkthrough complete. Listening, transcription, Mac work, and narration all lit in sequence. The radio never resized.";

/** Speech-shaped envelope: phrase humps with breaths — not a sine toy. */
function speechEnvelope(count: number, seed = 11) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    // Three phrases of different lengths
    const phrase = Math.sin(t * Math.PI * 3.2);
    const formant = Math.abs(Math.sin(t * 47)) * 0.35 + Math.abs(Math.sin(t * 19)) * 0.25;
    const breath = phrase > 0.12 ? 1 : 0.06;
    const attack = t < 0.04 ? t / 0.04 : t > 0.94 ? (1 - t) / 0.06 : 1;
    // Quantize so SSR and client never disagree on the ladder.
    return Math.round(
      Math.min(1, Math.max(0.04, (Math.abs(phrase) * 0.55 + formant) * breath * attack * (0.85 + rand() * 0.15))) *
        100,
    ) / 100;
  });
}

function clock(frac: number, dur = 4.2) {
  const s = Math.floor(frac * dur);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function LaneConsoleStudyPage({ page }: { page: StudioAppPage }) {
  const [mode, setMode] = useState<Mode>("speaking");
  const [pos, setPos] = useState(0.38);
  const [level, setLevel] = useState(0.62);
  const [volume, setVolume] = useState(0.8);
  const [speedIx, setSpeedIx] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [width, setWidth] = useState(420);
  const [animate, setAnimate] = useState(true);

  // Faster clock so listen/playback feel snappy, not lethargic.
  const phase = useAnimationPhase(animate, 1.65);
  // Dense enough for wide bays; bars stay thin rectangles, not sparse posts.
  const env = useMemo(() => speechEnvelope(96), []);
  const meta = MODES.find((m) => m.key === mode) ?? MODES[0];

  // Defer animated values until after mount so SSR HTML matches the first
  // client paint (phase/level-driven bar styles used to hydrate-mismatch).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const livePhase = hydrated ? phase : 0;

  // Derive from phase — avoid phase→setPos useEffect (update-depth thrash).
  const livePos =
    hydrated && animate && mode === "speaking" ? phase : pos;
  const liveLevel =
    hydrated && mode === "listening"
      ? Math.round(
          (0.18 +
            Math.abs(Math.sin(phase * Math.PI * 2.4)) * 0.42 +
            Math.abs(Math.sin(phase * Math.PI * 7.1)) * 0.22 +
            Math.abs(Math.sin(phase * Math.PI * 13)) * 0.12) *
            100,
        ) / 100
      : level;

  const messages =
    mode === "ready" || mode === "listening" || mode === "transcribing"
      ? mode === "ready"
        ? []
        : [{ role: "you" as const, text: YOU }]
      : [
          { role: "you" as const, text: YOU },
          { role: "agent" as const, text: AGENT },
        ];

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />

      <section className="max-w-[1100px] space-y-12 py-8">
        {/* Thesis */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="mb-2 text-[15px] font-medium text-studio-ink-strong">
              Two pieces, not three
            </h2>
            <p className="max-w-[56ch] text-[13.5px] leading-relaxed text-studio-ink">
              The lane used to be three competing objects: exchange, a radio that
              grew when narration started, and a transport card with its own border
              and gap. One story, three frames.
            </p>
            <p className="mt-3 max-w-[56ch] text-[13.5px] leading-relaxed text-studio-ink">
              Target: <strong className="text-studio-ink-strong">one surface</strong>.
              Identity + exchange keep the panel texture; the player is the plate
              foot — same outer rim, different fill, hairline seam only. Ring sits
              in the numeral gutter so TURN aligns with the announcement. The figure
              is the scrub surface; no second rail under the wave. Height stays{" "}
              <strong className="text-studio-ink-strong">exactly 2U</strong>.
            </p>
          </div>
          <div
            className="rounded-lg p-4 font-mono text-[11px] leading-relaxed"
            style={{
              background: F.page,
              border: `1px solid ${F.line}`,
              color: F.ink3,
            }}
          >
            <div style={{ color: F.ink4 }} className="mb-2 tracking-widest">
              LANE PANEL STACK
            </div>
            <StackRow label="01 · IDENTITY" detail="fixed · project / phase" />
            <StackRow
              label="02 · EXCHANGE"
              detail="flexible · transcript / history"
              accent
            />
            <StackRow
              label="03 · PLAYER 2U"
              detail="fixed · plate foot of same surface"
              accent
              last
            />
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${F.lineSoft}` }}>
              <div style={{ color: F.ink4 }} className="mb-1 tracking-widest">
                HEIGHT · ALIGNMENT
              </div>
              <div>
                Player = <span style={{ color: F.accent }}>2 × {U}pt</span> ={" "}
                <span style={{ color: F.ink }}>{PLAYER_H}pt</span> always
              </div>
              <div className="mt-1">
                Ring in numeral gutter · title = caption left edge
              </div>
              <div className="mt-1">Exchange absorbs leftover. Never pays for play.</div>
            </div>
          </div>
        </div>

        {/* Playground */}
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">Playground</h2>
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
            Drive the lifecycle. Watch the exchange reflow content while the player
            chassis stays put — only light and figures change inside the 2U bay.
          </p>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className="rounded px-2.5 py-1 text-[10px] font-medium tracking-wide transition"
                style={{
                  background: m.key === mode ? F.pad : "transparent",
                  color: m.key === mode ? m.tint : F.ink4,
                  border: `1px solid ${m.key === mode ? m.tint + "66" : F.line}`,
                }}
              >
                {m.word}
              </button>
            ))}
          </div>

          <div
            className="rounded-xl p-6"
            style={{ background: F.page, border: `1px solid ${F.lineSoft}` }}
          >
            <div className="mx-auto" style={{ width }}>
              <LaneColumn
                mode={mode}
                meta={meta}
                messages={messages}
                pos={livePos}
                level={liveLevel}
                volume={volume}
                speedIx={speedIx}
                autoplay={autoplay}
                env={env}
                phase={livePhase}
                onSeek={(v) => {
                  setAnimate(false);
                  setPos(v);
                }}
                onVolume={setVolume}
                onCycleSpeed={() => setSpeedIx((i) => (i + 1) % 4)}
                onToggleAuto={() => setAutoplay((a) => !a)}
                onTogglePlay={() =>
                  setMode((m) => (m === "speaking" ? "paused" : m === "paused" ? "speaking" : m))
                }
              />
            </div>
          </div>

          <div className="mt-4 grid max-w-[720px] grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 text-[11px] text-studio-ink-faint">
              <span className="w-24 shrink-0">Width</span>
              <input
                type="range"
                min={340}
                max={560}
                step={4}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="flex-1 accent-[#74f2ce]"
              />
              <span className="w-12 tabular-nums text-right">{width}</span>
            </label>
            <label className="flex items-center gap-3 text-[11px] text-studio-ink-faint">
              <span className="w-24 shrink-0">Position</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={pos}
                onChange={(e) => {
                  setAnimate(false);
                  setPos(Number(e.target.value));
                }}
                className="flex-1 accent-[#74f2ce]"
              />
              <span className="w-12 tabular-nums text-right">{pos.toFixed(2)}</span>
            </label>
            <button
              type="button"
              onClick={() => setAnimate((a) => !a)}
              className="rounded px-3 py-1.5 text-[11px] font-medium"
              style={{
                border: `1px solid ${animate ? F.line : F.accent}`,
                color: animate ? F.ink2 : F.accent,
                background: animate ? "transparent" : F.accent + "18",
              }}
            >
              {animate ? "❚❚ Freeze" : "▶ Animate"}
            </button>
          </div>
        </div>

        {/* Anatomy */}
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">
            Anatomy of the 2U player
          </h2>
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
            Foot of the lane surface, two rack units. Ring in the identity gutter;
            status + caption share the text column. Figure is the scrub surface
            (lit span + thin playhead). Chips for speed / volume / auto. Hairline
            under exchange is the only seam — not a second card.
          </p>
          <div
            className="overflow-hidden rounded-lg"
            style={{ background: F.page, border: `1px solid ${F.line}` }}
          >
            <div className="grid md:grid-cols-2">
              <div className="p-5" style={{ borderRight: `1px solid ${F.lineSoft}` }}>
                <div
                  className="mb-3 font-mono text-[9px] tracking-[0.16em]"
                  style={{ color: F.ink4 }}
                >
                  UPPER 1U · RADIO
                </div>
                <Bullet>Label + duration (always reserved)</Bullet>
                <Bullet>Waveform / capture / at-rest window — one slot</Bullet>
                <Bullet>Scrubber — always drawn, lit when narrating</Bullet>
                <Bullet>Caption — two lines reserved, never reflows the bay</Bullet>
              </div>
              <div className="p-5">
                <div
                  className="mb-3 font-mono text-[9px] tracking-[0.16em]"
                  style={{ color: F.ink4 }}
                >
                  LOWER 1U · TRANSPORT
                </div>
                <Bullet>PLAY / PAUSE key — works at rest when a reply exists</Bullet>
                <Bullet>State word + detail + work figure</Bullet>
                <Bullet>DEMO · SPEED · AUTO · VOL — settings cluster</Bullet>
                <Bullet>Same plate gradient as the radio — one object</Bullet>
              </div>
            </div>
            <div
              className="px-5 py-3 font-mono text-[10px]"
              style={{
                borderTop: `1px solid ${F.lineSoft}`,
                color: F.ink3,
                background: F.trace,
              }}
            >
              Exchange is <em style={{ color: F.ink2 }}>not</em> in this chassis. It sits
              above as its own well — scrollable history, not a player surface.
            </div>
          </div>
        </div>

        {/* State strip */}
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">
            Same 2U, every state
          </h2>
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
            If two of these rows are different heights, the contract is broken.
          </p>
          <div
            className="space-y-3 rounded-lg p-5"
            style={{ background: F.page, border: `1px solid ${F.lineSoft}` }}
          >
            {MODES.map((m) => (
              <div key={m.key}>
                <div
                  className="mb-1 font-mono text-[9px] tracking-widest"
                  style={{ color: F.ink4 }}
                >
                  {m.key.toUpperCase()} · {PLAYER_H}pt
                </div>
                <PlayerConsole
                  mode={m.key}
                  meta={m}
                  pos={m.key === "speaking" || m.key === "paused" ? 0.42 : 0}
                  level={m.key === "listening" ? 0.7 : 0}
                  volume={0.8}
                  speedIx={0}
                  autoplay
                  env={env}
                  phase={
                    m.key === "transcribing" || m.key === "submitting" || m.key === "listening"
                      ? livePhase
                      : 0.35
                  }
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

function StackRow({
  label,
  detail,
  accent,
  last,
}: {
  label: string;
  detail: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-3 py-1.5"
      style={{
        borderBottom: last ? undefined : `1px solid ${F.lineSoft}`,
        color: accent ? F.ink : F.ink3,
      }}
    >
      <span style={{ color: accent ? F.accent : F.ink2 }}>{label}</span>
      <span className="text-right text-[10px]" style={{ color: F.ink4 }}>
        {detail}
      </span>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex gap-2 text-[12.5px] leading-snug text-studio-ink">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-studio-ink-faint" />
      <span>{children}</span>
    </div>
  );
}

function LaneColumn({
  mode,
  meta,
  messages,
  pos,
  level,
  volume,
  speedIx,
  autoplay,
  env,
  phase,
  onSeek,
  onVolume,
  onCycleSpeed,
  onToggleAuto,
  onTogglePlay,
}: {
  mode: Mode;
  meta: (typeof MODES)[number];
  messages: { role: "you" | "agent"; text: string }[];
  pos: number;
  level: number;
  volume: number;
  speedIx: number;
  autoplay: boolean;
  env: number[];
  phase: number;
  onSeek: (v: number) => void;
  onVolume: (v: number) => void;
  onCycleSpeed: () => void;
  onToggleAuto: () => void;
  onTogglePlay: () => void;
}) {
  const live =
    mode === "listening" || mode === "speaking";

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[10px]"
      style={{
        background: F.panel,
        border: `1px solid ${live ? meta.tint + "66" : F.line}`,
        height: 560,
      }}
    >
      {/* Identity — panel head of the same surface */}
      <div
        className="flex items-start gap-3 px-3.5 pb-2.5 pt-3"
        style={{ borderBottom: `1px solid ${F.lineSoft}` }}
      >
        <div
          className="font-mono text-[28px] font-semibold leading-none tabular-nums"
          style={{ color: F.accent, width: 50 }}
        >
          02
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate font-mono text-[11px] font-semibold tracking-wide"
              style={{ color: F.ink }}
            >
              USETALKIE.COM
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: meta.tint,
                  boxShadow:
                    mode === "listening" || mode === "speaking"
                      ? `0 0 6px ${meta.tint}`
                      : undefined,
                }}
              />
              <span
                className="font-mono text-[7px] font-bold tracking-[0.14em]"
                style={{ color: meta.tint }}
              >
                {meta.word === "READY" ? "ACTIVE LANE" : meta.word}
              </span>
            </span>
          </div>
          <div className="mt-1 flex gap-2 font-mono text-[7.5px]" style={{ color: F.ink3 }}>
            <span>main</span>
            <span style={{ color: F.ink4 }}>5A83404D</span>
          </div>
        </div>
      </div>

      {/* Ledger — role in numeral gutter, body on project-name / TURN rail */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden px-3.5 py-2.5">
          {messages.length === 0 ? (
            <p
              className="font-mono text-[9px] leading-relaxed"
              style={{ color: F.ink3, paddingLeft: 50 + 12 }}
            >
              Check unmerged checkout changes
            </p>
          ) : (
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="shrink-0 font-mono text-[6.5px] font-bold tracking-[0.09em]"
                    style={{ width: 50, color: F.ink4 }}
                  >
                    {m.role === "you" ? "YOU" : "AGENT"}
                  </div>
                  <p
                    className="min-w-0 flex-1 font-mono text-[9px] leading-snug"
                    style={{ color: m.role === "agent" ? F.ink2 : F.ink3 }}
                  >
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PLAYER — plate foot of the same surface (no gap, no second card) */}
      <PlayerConsole
        mode={mode}
        meta={meta}
        pos={pos}
        level={level}
        volume={volume}
        speedIx={speedIx}
        autoplay={autoplay}
        env={env}
        phase={phase}
        embedded
        onSeek={onSeek}
        onVolume={onVolume}
        onCycleSpeed={onCycleSpeed}
        onToggleAuto={onToggleAuto}
        onTogglePlay={onTogglePlay}
      />
    </div>
  );
}

function PlayerConsole({
  mode,
  meta,
  pos,
  level,
  volume,
  speedIx,
  autoplay,
  env,
  phase = 0,
  compact,
  embedded,
  onSeek,
  onVolume,
  onCycleSpeed,
  onToggleAuto,
  onTogglePlay,
}: {
  mode: Mode;
  meta: (typeof MODES)[number];
  pos: number;
  level: number;
  volume: number;
  speedIx: number;
  autoplay: boolean;
  env: number[];
  phase?: number;
  compact?: boolean;
  /** Foot of the lane surface — plate fill, hairline top, gutter-aligned. */
  embedded?: boolean;
  onSeek?: (v: number) => void;
  onVolume?: (v: number) => void;
  onCycleSpeed?: () => void;
  onToggleAuto?: () => void;
  onTogglePlay?: () => void;
}) {
  const narrating = mode === "speaking" || mode === "paused";
  const live = mode === "listening";
  const working = mode === "transcribing" || mode === "submitting";
  const tint = meta.tint;
  // Shared rail with identity numeral / ledger roles / player ring
  const gutter = embedded ? 50 : 60;
  const ring = embedded ? 48 : 56;
  const gap = embedded ? 12 : 14;
  const edge = 14;
  const headInset = gutter + gap;
  const restLabel =
    mode === "ready" ? "READY" : mode === "paused" ? "AT REST" : "NO AUDIO";

  // Face layout matches DeckPlayerConsole:
  // head (status·caption) · transport band (ring + figure same H) · chips on floor
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: PLAYER_H,
        background: `linear-gradient(${F.plateTop}, ${F.plateBottom})`,
        borderRadius: embedded ? 0 : 9,
        border: embedded
          ? undefined
          : `1px solid ${live || mode === "speaking" ? tint + "4d" : F.line}`,
        borderTop: embedded
          ? `1px solid ${live || mode === "speaking" ? tint + "66" : F.lineSoft}`
          : undefined,
        paddingTop: embedded ? 10 : 12,
        paddingBottom: embedded ? 9 : 11,
        paddingLeft: edge,
        paddingRight: edge,
        boxSizing: "border-box",
      }}
    >
      {/* Head — a bit lower so it balances the plate; indented to figure edge */}
      <div style={{ paddingLeft: headInset }}>
        <div
          className="flex items-center gap-1.5 font-mono"
          style={{
            height: 12,
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: mode === "ready" ? F.ink2 : tint,
          }}
        >
          <span>{mode === "ready" || narrating || working || live ? "TURN 14" : meta.detail}</span>
          <span style={{ color: F.ink4, opacity: 0.65 }}>·</span>
          <span style={{ color: mode === "ready" ? F.ink2 : tint }}>{meta.word}</span>
          {mode === "speaking" && (
            <span
              className="inline-block h-1 w-1 shrink-0 rounded-full"
              style={{ background: F.accent }}
            />
          )}
        </div>
        <div
          className="truncate"
          style={{
            marginTop: 2,
            height: embedded ? 20 : 22,
            fontSize: 12,
            lineHeight: 1.35,
            color: F.ink,
          }}
        >
          {narrating || mode === "ready"
            ? AGENT
            : live
              ? "Listening…"
              : working
                ? "Working…"
                : ""}
        </div>
      </div>

      {/* Free space mostly above transport — ring + bay a touch lower */}
      <div style={{ flex: "1 1 8px", minHeight: 8 }} />

      {/* Transport band — ring + figure same height; tape clock under bay only */}
      <div>
        <div className="flex items-center" style={{ gap }}>
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: gutter, height: ring }}
          >
            <button
              type="button"
              onClick={onTogglePlay}
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: ring,
                height: ring,
                background: F.trace,
                border: `2px solid ${F.line}`,
                color: narrating || mode === "ready" ? F.accent : F.ink3,
              }}
            >
              {narrating && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    border: `2px solid ${tint}`,
                    clipPath: `inset(0 ${100 - pos * 100}% 0 0)`,
                    opacity: 0.9,
                  }}
                />
              )}
              <span style={{ fontSize: ring * 0.3, position: "relative" }}>
                {mode === "speaking" ? "❚❚" : "▶"}
              </span>
            </button>
          </div>

          <div
            className="relative min-w-0 flex-1"
            style={{
              height: ring,
              borderRadius: 6,
              background: F.trace,
              border: `1px solid ${F.line}`,
              cursor: narrating || mode === "ready" ? "pointer" : "default",
            }}
            onClick={(e) => {
              if (!onSeek || !(narrating || mode === "ready")) return;
              const r = e.currentTarget.getBoundingClientRect();
              onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
            }}
          >
            <div className="absolute inset-0 px-2 py-1.5">
              {mode === "ready" ? (
                <RestField label="READY" silhouette />
              ) : mode === "listening" ||
                mode === "speaking" ||
                mode === "paused" ||
                mode === "transcribing" ||
                mode === "submitting" ? (
                <RadioFigure
                  mode={mode}
                  env={env}
                  pos={pos}
                  level={level}
                  phase={phase}
                  tint={tint}
                />
              ) : (
                <RestField label={restLabel} />
              )}
            </div>
            {narrating && (
              <span
                className="pointer-events-none absolute top-1.5 bottom-1.5 w-[1.5px] rounded-full"
                style={{
                  left: `${pos * 100}%`,
                  background: mode === "paused" ? F.ink2 : tint,
                  transform: "translateX(-50%)",
                }}
              />
            )}
          </div>
        </div>
        {/* Tape clock under the bay: 0:00 · current · total — not under the ring */}
        {(mode === "ready" || narrating) && (
          <div
            className="relative font-mono tabular-nums"
            style={{
              marginTop: 4,
              marginLeft: gutter + gap,
              fontSize: 9,
              color: F.ink4,
            }}
          >
            <div className="flex justify-between">
              <span>0:00</span>
              <span>0:04</span>
            </div>
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ color: narrating ? F.ink2 : F.ink3 }}
            >
              {narrating ? clock(pos) : "0:00"}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: "0 0 8px", minHeight: 4, maxHeight: 10 }} />

      {/* Chips on the floor of the plate */}
      <div className="flex items-center gap-1.5" style={{ height: 22 }}>
        <button type="button" onClick={onCycleSpeed} className="appearance-none">
          <Chip>
            <span className="font-mono text-[10px]" style={{ color: F.ink3 }}>
              {["1.00×", "1.25×", "1.50×", "0.75×"][speedIx]}
            </span>
          </Chip>
        </button>
        <Chip>
          <span className="font-mono text-[10px]" style={{ color: F.ink4, opacity: 0.55 }}>
            VOL
          </span>
          <span
            className="ml-1.5 inline-block h-[2.5px] w-[26px] rounded-full"
            style={{ background: F.line }}
            onPointerDown={(e) => {
              if (!onVolume) return;
              const el = e.currentTarget;
              const move = (ev: PointerEvent) => {
                const r = el.getBoundingClientRect();
                onVolume(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)));
              };
              move(e.nativeEvent);
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${volume * 100}%`, background: F.ink3 }}
            />
          </span>
        </Chip>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggleAuto}
          className="rounded px-2 py-0.5 font-mono text-[9.5px] font-semibold tracking-wide"
          style={{
            background: autoplay ? F.amber + "1f" : F.pad,
            border: `1px solid ${autoplay ? F.amber + "66" : F.line}`,
            color: autoplay ? F.amber : F.ink4,
          }}
        >
          {autoplay ? "AUTOPLAY ON" : "AUTOPLAY OFF"}
        </button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5"
      style={{
        background: F.pad,
        border: `1px solid ${F.line}`,
      }}
    >
      {children}
    </span>
  );
}

/** Integer px for stable SSR hydration. */
function px(n: number) {
  return Math.max(2, Math.round(n));
}

/** Two-decimal opacity — avoids 0.1800000001 vs "0.18" hydrate fights. */
function op(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Bar stroke — nearly rectangular. rounded-full on a tall thin bar becomes a
 * pill/dot; 1px radius keeps the meter-bar read without soft balloons.
 */
const BAR_RADIUS = 1;

/**
 * Radio figure genres — every one paints the full width of the slot.
 * No quarter-width lodgers, no orphan slices.
 */
function RadioFigure({
  mode,
  env,
  pos,
  level,
  phase,
  tint,
}: {
  mode: Mode;
  env: number[];
  pos: number;
  level: number;
  phase: number;
  tint: string;
}) {
  switch (mode) {
    case "speaking":
    case "paused":
      return <PlaybackWave env={env} pos={pos} tint={mode === "paused" ? F.ink3 : F.accent} />;
    case "listening":
      return <CaptureWave level={level} phase={phase} />;
    case "transcribing":
    case "submitting":
      return <ActivityField tint={tint} phase={phase} kind={mode === "transcribing" ? "sweep" : "pulse"} />;
    default:
      return <RestField />;
  }
}

/** One vertical meter stroke — thin tall rectangle, not a capsule. */
function Bar({
  height,
  color,
  opacity,
}: {
  height: number;
  color: string;
  opacity: number;
}) {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ height: "100%", minWidth: 0 }}>
      <div
        style={{
          // Fill most of the column so dense packs read continuous, not dotted.
          width: "85%",
          maxWidth: 2,
          height,
          borderRadius: BAR_RADIUS,
          background: color,
          opacity: op(opacity),
        }}
      />
    </div>
  );
}

/** Playback: full silhouette of the file + played span lit + playhead. */
function PlaybackWave({ env, pos, tint }: { env: number[]; pos: number; tint: string }) {
  const n = env.length;
  const head = Math.min(n - 1, Math.floor(pos * n));
  const left = `${(Math.round(pos * 1000) / 10).toFixed(1)}%`;
  return (
    <div className="relative flex h-full w-full items-center">
      <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
        {env.map((v, i) => {
          const played = i <= head;
          return (
            <Bar
              key={i}
              height={px(v * 28)}
              color={played ? tint : F.line}
              opacity={played ? 0.95 : 0.3}
            />
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute top-0 bottom-0"
        style={{
          left,
          width: 1,
          background: tint,
          boxShadow: `0 0 5px ${tint}`,
          opacity: 0.95,
        }}
      />
    </div>
  );
}

/**
 * Capture: dense rectangular strokes across the full width.
 * Phase rolls the field so silence still scrolls (tape, not a freeze).
 */
function CaptureWave({ level, phase }: { level: number; phase: number }) {
  const bars = 88;
  // Quantize phase so the ladder is stable and not float-noisy.
  const drift = (Math.round(phase * 100) / 100) * Math.PI * 2;
  const heights = Array.from({ length: bars }, (_, i) => {
    const t = i / bars;
    const speech =
      Math.abs(Math.sin(t * 14 + drift * 1.7)) * 0.45 +
      Math.abs(Math.sin(t * 31 + drift * 2.3)) * 0.3 +
      Math.abs(Math.sin(t * 53 - drift)) * 0.2;
    const window = Math.sin(t * Math.PI);
    const v = level * speech * (0.55 + window * 0.45);
    return { h: px(Math.max(2, v * 28)), hot: v > 0.06 };
  });
  return (
    <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
      {heights.map((bar, i) => (
        <Bar key={i} height={bar.h} color={F.accent} opacity={bar.hot ? 0.92 : 0.14} />
      ))}
    </div>
  );
}

/**
 * Working activity — the whole field is the figure.
 * Sweep: full-width sheen travels edge to edge.
 * Pulse: full-width amplitude breathes.
 */
function ActivityField({
  tint,
  phase,
  kind,
}: {
  tint: string;
  phase: number;
  kind: "sweep" | "pulse";
}) {
  const bars = 80;
  const p = Math.round(phase * 100) / 100;

  if (kind === "pulse") {
    const amp = 0.35 + Math.abs(Math.sin(p * Math.PI * 2)) * 0.55;
    return (
      <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
        {Array.from({ length: bars }, (_, i) => {
          const t = i / bars;
          const hump = Math.sin(t * Math.PI);
          return (
            <Bar
              key={i}
              height={px(2 + hump * amp * 26)}
              color={tint}
              opacity={op(0.25 + hump * 0.55)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
      {Array.from({ length: bars }, (_, i) => {
        const t = i / (bars - 1);
        const d = Math.min(Math.abs(t - p), 1 - Math.abs(t - p));
        const lobe = Math.max(0, 1 - d * 2.4);
        return (
          <Bar
            key={i}
            height={px(3 + lobe * 24)}
            color={tint}
            opacity={op(0.18 + lobe * 0.78)}
          />
        );
      })}
    </div>
  );
}

/**
 * Zero-state bay — same height as the transport ring.
 * Ready: faint speech ghost. Empty: labelled baseline (not a failed graph).
 */
function RestField({
  label = "AT REST",
  silhouette = false,
}: {
  label?: string;
  silhouette?: boolean;
}) {
  const n = 64;
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {silhouette ? (
        <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
          {Array.from({ length: n }, (_, i) => {
            const t = i / (n - 1);
            const phrase = Math.abs(Math.sin(t * Math.PI * 3.2));
            const formant =
              Math.abs(Math.sin(t * 47)) * 0.35 + Math.abs(Math.sin(t * 19)) * 0.25;
            const breath = phrase > 0.12 ? 1 : 0.08;
            const v = Math.min(1, Math.max(0.06, (phrase * 0.55 + formant) * breath));
            return (
              <Bar
                key={i}
                height={px(2 + v * 22)}
                color={F.line}
                opacity={op(0.28 + v * 0.22)}
              />
            );
          })}
        </div>
      ) : (
        <div className="mx-1 h-px w-full" style={{ background: F.lineSoft }} />
      )}
      <span
        className="pointer-events-none absolute font-mono text-[8px] font-semibold tracking-[0.14em]"
        style={{
          color: F.ink4,
          background: F.trace,
          padding: "2px 8px",
          borderRadius: 999,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/** Wall-clock phase — no per-frame setState of the phase value itself. */
function useAnimationPhase(running: boolean, speed: number) {
  const originRef = useRef<number | null>(null);
  const [, setBeat] = useState(0);

  useEffect(() => {
    if (!running) {
      originRef.current = null;
      return;
    }
    originRef.current = performance.now();
    const id = window.setInterval(() => setBeat((n) => (n + 1) % 1_000_000), 80);
    return () => window.clearInterval(id);
  }, [running, speed]);

  if (!running || originRef.current == null) return 0;
  const elapsed = (performance.now() - originRef.current) / 1000;
  return (elapsed * 0.28 * speed) % 1;
}
