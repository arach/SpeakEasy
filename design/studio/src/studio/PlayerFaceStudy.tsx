"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/studio/PageHeader";
import type { StudioAppPage } from "@/studio/studioRegistry";

/**
 * Player face — turn player cutout (studio only).
 *
 * Design language from the state-range board:
 *   circular play ring · caption-first · one scrub · chip controls
 * Same geometry empty → finished. No iPad deploys from this file.
 */

// ── Palette (dark instrument) ────────────────────────────────

const C = {
  page: "#0a0b0e",
  plate: "#14161b",
  plateEdge: "#22262f",
  well: "#0e1014",
  ink: "#e6e8ee",
  ink2: "#9aa3b2",
  ink3: "#6a7280",
  ink4: "#454b58",
  ink5: "#333842",
  line: "#2a2f3a",
  lineSoft: "#1a1e26",
  mint: "#5ee9c2",
  mintDim: "#3ab894",
  mintSoft: "rgba(94, 233, 194, 0.12)",
  amber: "#d4a04a",
  amberSoft: "rgba(212, 160, 74, 0.12)",
  coral: "#e07a5f",
  chip: "#1a1d25",
  chipEdge: "#2c313c",
} as const;

/** Fixed face height — 3-line caption + status + scrub + chips. */
const CARD_H = 134;
/** Caption measure so copy wraps to 2–3 even lines (matches board). */
const CAPTION_MAX = 430;
/** Default hero face width — instrument, not stretched bar. */
const HERO_DEFAULT_W = 500;

// ── States ───────────────────────────────────────────────────

type PlayerState =
  | "empty"
  | "working"
  | "ready"
  | "playing"
  | "paused"
  | "finished"
  | "failed";

type StateSpec = {
  id: PlayerState;
  code: string;
  title: string;
  head: string;
  headTone: "muted" | "mint" | "amber" | "coral";
  live?: boolean;
  status: string;
  statusTone: "muted" | "mint" | "amber" | "coral";
  meta?: string;
  caption: string;
  captionLive?: boolean;
  progress: number;
  showKnob: boolean;
  duration: string;
  ring: "idle" | "working" | "ready" | "playing" | "paused" | "finished" | "failed";
  ringProgress?: number;
  primary: "play" | "pause" | "replay" | "retry" | "idle";
  speed: string;
  vol: number;
  autoplay: "on" | "off" | "next";
  autoLabel?: string;
};

const CAPTION_READY =
  "Refactored the auth middleware into a single guard and moved token refresh off the request path.";

const STATES: StateSpec[] = [
  {
    id: "empty",
    code: "2a",
    title: "Empty — no turn has returned yet",
    head: "LANE 02",
    headTone: "muted",
    status: "NO AUDIO",
    statusTone: "muted",
    caption: "",
    progress: 0,
    showKnob: false,
    duration: "—:——",
    ring: "idle",
    primary: "idle",
    speed: "1.00×",
    vol: 0.35,
    autoplay: "on",
  },
  {
    id: "working",
    code: "2b",
    title: "Working — turn running, voice not synthesised yet",
    head: "TURN 15",
    headTone: "amber",
    status: "WORKING",
    statusTone: "amber",
    meta: "00:41",
    caption: "Reading src/auth/middleware.ts and the four call sites that touch it",
    captionLive: true,
    progress: 0.1,
    showKnob: false,
    duration: "0:00",
    ring: "working",
    ringProgress: 0.3,
    primary: "idle",
    speed: "1.00×",
    vol: 0.45,
    autoplay: "on",
  },
  {
    id: "ready",
    code: "2c",
    title: "Ready — arrived, untouched (the at-rest face)",
    head: "TURN 14",
    headTone: "mint",
    status: "SUMMARY",
    statusTone: "mint",
    meta: "1:14",
    caption: CAPTION_READY,
    progress: 0,
    showKnob: true,
    duration: "0:00",
    ring: "ready",
    primary: "play",
    speed: "1.00×",
    vol: 0.4,
    autoplay: "on",
  },
  {
    id: "playing",
    code: "2d",
    title: "Playing — caption fills as it speaks",
    head: "TURN 14",
    headTone: "mint",
    live: true,
    status: "SPEAKING",
    statusTone: "mint",
    caption: CAPTION_READY,
    progress: 0.34,
    showKnob: true,
    duration: "0:25",
    ring: "playing",
    ringProgress: 0.34,
    primary: "pause",
    speed: "1.25×",
    vol: 0.55,
    autoplay: "on",
  },
  {
    id: "paused",
    code: "2e",
    title: "Paused — held mid-clip, scrub knob live",
    head: "TURN 14",
    headTone: "muted",
    status: "PAUSED",
    statusTone: "muted",
    meta: "0:28 LEFT",
    caption: CAPTION_READY,
    progress: 0.62,
    showKnob: true,
    duration: "0:46",
    ring: "paused",
    ringProgress: 0.62,
    primary: "play",
    speed: "1.25×",
    vol: 0.35,
    autoplay: "off",
  },
  {
    id: "finished",
    code: "2f",
    title: "Finished — played out, replay offered, next turn armed",
    head: "TURN 14",
    headTone: "muted",
    status: "PLAYED",
    statusTone: "muted",
    meta: "1:14",
    caption: CAPTION_READY,
    progress: 1,
    showKnob: false,
    duration: "REPLAY",
    ring: "finished",
    ringProgress: 1,
    primary: "replay",
    speed: "1.25×",
    vol: 0.35,
    autoplay: "next",
    autoLabel: "NEXT TURN AUTOPLAYS",
  },
  {
    id: "failed",
    code: "2g",
    title: "Voice unavailable — text landed, audio did not",
    head: "TURN 13",
    headTone: "coral",
    status: "SYNTHESIS FAILED",
    statusTone: "coral",
    meta: "READ ABOVE",
    caption: "Migrated the session store to Redis and pinned the client version.",
    progress: 0,
    showKnob: false,
    duration: "RETRY",
    ring: "failed",
    primary: "retry",
    speed: "1.25×",
    vol: 0.3,
    autoplay: "on",
  },
];

function tone(t: StateSpec["headTone"]): string {
  if (t === "mint") return C.mint;
  if (t === "amber") return C.amber;
  if (t === "coral") return C.coral;
  return C.ink4;
}

// ─────────────────────────────────────────────────────────────

export function PlayerFaceStudyPage({ page }: { page: StudioAppPage }) {
  const [focus, setFocus] = useState<PlayerState>("ready");
  const [width, setWidth] = useState(HERO_DEFAULT_W);
  const focused = useMemo(() => STATES.find((s) => s.id === focus) ?? STATES[2], [focus]);

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />

      <section className="max-w-[720px] space-y-14 py-8">
        <p className="max-w-[58ch] text-[14px] leading-[1.7] text-studio-ink">
          Turn player — same geometry empty through finished. Circular play ring,
          caption-first, one scrub, chip controls. Caption measure locked so copy
          wraps to two–three even lines.
        </p>

        {/* Hero */}
        <section>
          <Eyebrow>
            Hero · {focused.code} · {focused.id}
          </Eyebrow>
          <p className="mb-4 text-[13px] text-studio-ink-faint">{focused.title}</p>
          <div
            className="flex justify-center rounded-2xl px-8 py-14"
            style={{ background: C.page, border: `1px solid ${C.lineSoft}` }}
          >
            <div style={{ width, maxWidth: "100%" }}>
              <TurnPlayer spec={focused} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-mono text-[11px] text-studio-ink-faint">
              Width
              <input
                type="range"
                min={420}
                max={560}
                step={4}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                style={{ accentColor: C.mint }}
              />
              <span className="w-12 tabular-nums">{width}pt</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STATES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFocus(s.id)}
                  className="rounded-md px-2 py-1 font-mono text-[10px] transition"
                  style={{
                    background: focus === s.id ? C.mintSoft : C.chip,
                    border: `1px solid ${focus === s.id ? C.mint + "55" : C.chipEdge}`,
                    color: focus === s.id ? C.mint : C.ink3,
                  }}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* State range — single column, full measure (board fidelity) */}
        <section>
          <Eyebrow>2 · State range for 1b — same geometry, empty through finished</Eyebrow>
          <div className="mt-5 flex flex-col gap-4">
            {STATES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFocus(s.id)}
                className="rounded-xl p-4 text-left transition"
                style={{
                  background: C.page,
                  border: `1px solid ${focus === s.id ? C.mint + "44" : C.lineSoft}`,
                }}
              >
                <div className="mb-3 flex items-baseline gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                    style={{
                      background: C.chip,
                      color: C.ink3,
                      border: `1px solid ${C.chipEdge}`,
                    }}
                  >
                    {s.code}
                  </span>
                  <span className="font-mono text-[11px] text-studio-ink-faint">{s.title}</span>
                </div>
                <TurnPlayer spec={s} />
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Note title="One geometry">
            Every state is the same card height and structure. Emptiness is quiet
            chrome, not a different layout.
          </Note>
          <Note title="Ring = transport">
            The circle is play, pause, progress, and error. No second playhead in
            a waveform bay.
          </Note>
          <Note title="Caption first">
            The turn summary is the content. Scrub is one line under it. Chips
            handle speed, volume, autoplay.
          </Note>
        </section>
      </section>
    </main>
  );
}

// ── Component ────────────────────────────────────────────────

function TurnPlayer({ spec }: { spec: StateSpec }) {
  const empty = spec.id === "empty";
  const failed = spec.id === "failed";
  const working = spec.id === "working";
  /** Whole-module dim for empty — keeps geometry, quiets presence. */
  const moduleDim = empty ? 0.42 : 1;

  return (
    <div
      style={{
        height: CARD_H,
        borderRadius: 16,
        background: C.plate,
        border: `1px solid ${C.plateEdge}`,
        display: "flex",
        alignItems: "stretch",
        gap: 14,
        padding: "13px 16px 12px 14px",
        isolation: "isolate",
        overflow: "hidden",
        boxSizing: "border-box",
        opacity: moduleDim,
      }}
    >
      {/* Ring column — fixed */}
      <div
        className="flex shrink-0 flex-col items-center"
        style={{ width: 56, paddingTop: 2, gap: 7 }}
      >
        <PlayRing kind={spec.ring} progress={spec.ringProgress ?? 0} />
        <div
          className="font-mono tabular-nums"
          style={{
            color: failed ? C.coral : empty ? C.ink5 : C.ink3,
            fontSize: spec.duration === "REPLAY" || spec.duration === "RETRY" ? 9 : 10,
            fontWeight: 500,
            letterSpacing:
              spec.duration === "REPLAY" || spec.duration === "RETRY" ? "0.1em" : "0.02em",
            lineHeight: 1,
          }}
        >
          {spec.duration}
        </div>
      </div>

      {/* Body — pinned rows */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        style={{
          paddingTop: 1,
          // status · caption · scrub · chips — fixed slots
          display: "grid",
          gridTemplateRows: "14px 1fr 14px 22px",
          gap: 0,
          minHeight: 0,
        }}
      >
        {/* Status */}
        <div
          className="flex items-center gap-1.5 font-mono"
          style={{
            fontSize: 10,
            lineHeight: 1,
            letterSpacing: "0.05em",
            minWidth: 0,
          }}
        >
          {spec.live && (
            <span
              className="inline-block shrink-0 rounded-full"
              style={{ width: 4, height: 4, background: C.mint }}
            />
          )}
          <span
            style={{
              color: empty ? C.ink5 : tone(spec.headTone),
              fontWeight: 600,
            }}
          >
            {spec.head}
          </span>
          <span style={{ color: C.ink5 }}>·</span>
          <span
            style={{
              color: empty ? C.ink5 : tone(spec.statusTone),
              fontWeight: 600,
            }}
          >
            {spec.status}
          </span>
          {spec.meta != null && (
            <>
              <span style={{ color: C.ink5 }}>·</span>
              <span style={{ color: C.ink4 }}>{spec.meta}</span>
            </>
          )}
        </div>

        {/* Caption — measure capped */}
        <div
          className="min-h-0 overflow-hidden font-sans"
          style={{
            maxWidth: CAPTION_MAX,
            fontSize: 13,
            lineHeight: 1.4,
            color: empty ? C.ink5 : C.ink,
            letterSpacing: "-0.01em",
            paddingTop: 6,
            paddingBottom: 6,
          }}
        >
          {empty ? (
            <EmptyGhostLines />
          ) : (
            <>
              {spec.caption}
              {spec.captionLive && (
                <span
                  className="ml-0.5 inline-block"
                  style={{
                    width: 1.5,
                    height: 12,
                    background: C.amber,
                    verticalAlign: "text-bottom",
                    marginBottom: 1,
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Scrub */}
        <div className="flex items-center">
          <ScrubLine
            progress={spec.progress}
            showKnob={spec.showKnob}
            tone={
              spec.id === "playing" || spec.id === "paused" || spec.id === "finished"
                ? "mint"
                : working
                  ? "amber"
                  : "muted"
            }
            empty={empty || failed}
          />
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1.5" style={{ paddingTop: 4 }}>
          <Chip quiet={empty}>{spec.speed}</Chip>
          <Chip quiet={empty}>
            <span style={{ opacity: 0.5, marginRight: 6 }}>VOL</span>
            <VolBar value={spec.vol} quiet={empty} />
          </Chip>
          <div className="flex-1" />
          <AutoChip kind={spec.autoplay} label={spec.autoLabel} quiet={empty} />
        </div>
      </div>
    </div>
  );
}

function EmptyGhostLines() {
  return (
    <div className="flex flex-col justify-center gap-[8px] pt-1">
      <div style={{ height: 1, width: "88%", background: C.line }} />
      <div style={{ height: 1, width: "64%", background: C.line }} />
      <div style={{ height: 1, width: "42%", background: C.line }} />
    </div>
  );
}

function PlayRing({
  kind,
  progress,
}: {
  kind: StateSpec["ring"];
  progress: number;
}) {
  const size = 52;
  const stroke = 2;
  const r = (size - stroke) / 2 - 1;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));

  let trackColor: string = C.line;
  let progressColor: string = C.line;
  let glyphColor: string = C.ink3;
  let showArc = false;
  let arcFull = false;

  switch (kind) {
    case "idle":
      trackColor = C.line;
      glyphColor = C.ink5;
      break;
    case "working":
      trackColor = C.line;
      progressColor = C.amber;
      glyphColor = C.ink3;
      showArc = true;
      break;
    case "ready":
      trackColor = C.line;
      glyphColor = C.mint;
      break;
    case "playing":
      trackColor = C.line;
      progressColor = C.mint;
      glyphColor = C.mint;
      showArc = true;
      break;
    case "paused":
      trackColor = C.line;
      progressColor = C.mint;
      glyphColor = C.mint;
      showArc = true;
      break;
    case "finished":
      trackColor = C.line;
      progressColor = C.mintDim;
      glyphColor = C.ink2;
      showArc = true;
      arcFull = true;
      break;
    case "failed":
      trackColor = C.coral;
      glyphColor = C.coral;
      break;
  }

  const dashLen = showArc ? circ * (arcFull ? 0.999 : Math.max(0.08, p)) : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill={C.well} stroke="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
          opacity={kind === "failed" ? 0.9 : 0.95}
        />
        {showArc && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={progressColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dashLen.toFixed(2)} ${(circ - dashLen).toFixed(2)}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            opacity={kind === "finished" ? 0.65 : 1}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {kind === "working" ? (
          <span className="flex items-center gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="rounded-full"
                style={{
                  width: 3,
                  height: 3,
                  background: C.ink3,
                  opacity: 0.4 + i * 0.22,
                }}
              />
            ))}
          </span>
        ) : kind === "failed" ? (
          <svg width="16" height="16" viewBox="0 0 16 16">
            <line
              x1="4.5"
              y1="11.5"
              x2="11.5"
              y2="4.5"
              stroke={C.coral}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ) : kind === "playing" ? (
          <PauseGlyph color={glyphColor} />
        ) : (
          <PlayGlyph color={glyphColor} dim={kind === "idle"} />
        )}
      </div>
    </div>
  );
}

function PlayGlyph({ color, dim }: { color: string; dim?: boolean }) {
  // Optical center: triangle sits slightly right of geometric center
  return (
    <svg
      width="12"
      height="14"
      viewBox="0 0 12 14"
      style={{ marginLeft: 1.5, opacity: dim ? 0.5 : 1 }}
    >
      <path d="M1.5 1.2 L11 7 L1.5 12.8 Z" fill={color} />
    </svg>
  );
}

function PauseGlyph({ color }: { color: string }) {
  return (
    <svg width="11" height="12" viewBox="0 0 11 12">
      <rect x="1" y="1" width="3" height="10" rx="0.6" fill={color} />
      <rect x="7" y="1" width="3" height="10" rx="0.6" fill={color} />
    </svg>
  );
}

function ScrubLine({
  progress,
  showKnob,
  tone: t,
  empty,
}: {
  progress: number;
  showKnob: boolean;
  tone: "mint" | "amber" | "muted";
  empty: boolean;
}) {
  const fill = t === "mint" ? C.mint : t === "amber" ? C.amber : C.line;
  const pct = Math.round(progress * 1000) / 10;
  const atStart = showKnob && !empty && progress === 0;

  return (
    <div
      className="relative w-full"
      style={{ height: 12, opacity: empty ? 0.5 : 1, maxWidth: CAPTION_MAX + 40 }}
    >
      {/* track hairline */}
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
        style={{ height: 1, background: C.line }}
      />
      {/* fill hairline */}
      {!empty && progress > 0 && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2"
          style={{
            width: `${pct}%`,
            height: 1,
            background: fill,
            opacity: t === "amber" ? 0.7 : 1,
          }}
        />
      )}
      {/* knob — crisp, no soft blob */}
      {showKnob && !empty && (
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: atStart ? 0 : `${pct}%`,
            width: 8,
            height: 8,
            background: "#eef0f4",
            boxShadow: `0 0 0 1.5px ${C.plate}${
              t === "mint" || atStart ? `, 0 0 0 2.5px ${C.mint}40` : ""
            }`,
          }}
        />
      )}
    </div>
  );
}

function Chip({ children, quiet }: { children: ReactNode; quiet?: boolean }) {
  return (
    <span
      className="inline-flex items-center font-mono tabular-nums"
      style={{
        background: C.chip,
        border: `1px solid ${C.chipEdge}`,
        color: quiet ? C.ink5 : C.ink3,
        fontSize: 10,
        fontWeight: 500,
        padding: "3px 7px",
        borderRadius: 6,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function VolBar({ value, quiet }: { value: number; quiet?: boolean }) {
  const pct = Math.round(value * 100);
  const on = quiet ? C.ink5 : C.ink3;
  return (
    <span
      className="inline-block rounded-sm"
      style={{
        width: 26,
        height: 2.5,
        background: `linear-gradient(90deg, ${on} ${pct}%, ${C.line} ${pct}%)`,
      }}
    />
  );
}

function AutoChip({
  kind,
  label,
  quiet,
}: {
  kind: "on" | "off" | "next";
  label?: string;
  quiet?: boolean;
}) {
  if (kind === "off") {
    return (
      <span
        className="inline-flex items-center gap-1.5 font-mono"
        style={{
          background: C.chip,
          border: `1px solid ${C.chipEdge}`,
          color: C.ink5,
          fontSize: 9.5,
          fontWeight: 500,
          padding: "3px 8px",
          borderRadius: 6,
          lineHeight: 1,
          letterSpacing: "0.05em",
        }}
      >
        <span
          className="rounded-full"
          style={{ width: 4, height: 4, background: C.ink5 }}
        />
        AUTOPLAY OFF
      </span>
    );
  }

  const text = label ?? "AUTOPLAY ON";

  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono"
      style={{
        background: quiet ? C.chip : C.amberSoft,
        border: `1px solid ${quiet ? C.chipEdge : C.amber + "40"}`,
        color: quiet ? C.ink5 : C.amber,
        fontSize: 9.5,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 6,
        lineHeight: 1,
        letterSpacing: "0.05em",
      }}
    >
      <span
        className="rounded-full"
        style={{ width: 4, height: 4, background: quiet ? C.ink5 : C.amber }}
      />
      {text}
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint">
      {children}
    </div>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-studio-rule bg-studio-surface p-4">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint">
        {title}
      </div>
      <p className="text-[12.5px] leading-relaxed text-studio-ink">{children}</p>
    </div>
  );
}
