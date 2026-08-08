"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardCopy,
  ClipboardPaste,
  Diff,
  Grid3x3,
  ListChecks,
  MessageSquareText,
  Mic,
  Play,
  Redo2,
  RefreshCw,
  Scissors,
  Square,
  X,
} from "lucide-react";

/**
 * Full Micro Deck shell — fidelity to shipping iPad pad + picker.
 * Premium craft is in proportion, type, and tokens — not a different product.
 */

export type FullMockTokens = {
  page: string;
  panel: string;
  panelHead: string;
  cell: string;
  line: string;
  lineSoft: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  accent: string;
  accentDim: string;
  amber: string;
  pad: string;
  padBottom: string;
  plate: string;
  plateTop: string;
  plateBottom: string;
  micTop: string;
  micBottom: string;
  empty: string;
};

export type FullMockMode =
  | "ready"
  | "listening"
  | "transcribing"
  | "submitting"
  | "speaking"
  | "paused";

export type FullMockLane = {
  index: number;
  name: string;
  task: string;
  state: "active" | "armed" | "idle";
};

const DEFAULT_LANES: FullMockLane[] = [
  { index: 0, name: "linea", task: "ask/graduate-to-the-sidebar · 1d ago", state: "active" },
  { index: 1, name: "usetalkie.com", task: "main · 6h ago", state: "armed" },
  { index: 2, name: "speakeasy", task: "codex/bounded-task-tail · 3d ago", state: "armed" },
  { index: 3, name: "LANE 4", task: "codex thread", state: "armed" },
  { index: 4, name: "Codex", task: "final bundle works · 6d ago", state: "armed" },
];

const PAD_ROWS: { label: string; caption: string; Icon: LucideIcon }[][] = [
  [
    { label: "STATUS", caption: "SAY", Icon: MessageSquareText },
    { label: "GO", caption: "SAY", Icon: Play },
    { label: "TESTS", caption: "SAY", Icon: ListChecks },
    { label: "ESC", caption: "CANCEL", Icon: X },
  ],
  [
    { label: "CUT", caption: "IN", Icon: Scissors },
    { label: "DIFF", caption: "SAY", Icon: Diff },
    { label: "COPY", caption: "CLIP", Icon: ClipboardCopy },
    { label: "PASTE", caption: "SEND", Icon: ClipboardPaste },
  ],
  [
    { label: "REPLAY", caption: "LAST", Icon: Redo2 },
    { label: "STOP", caption: "AUDIO", Icon: Square },
    { label: "AUTO", caption: "PLAY", Icon: RefreshCw },
    { label: "ACTIVITY", caption: "LOG", Icon: Activity },
  ],
];

const MONO =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
const UI =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function MicroDeckFullMock({
  tokens: t,
  mode = "speaking",
  lanes = DEFAULT_LANES,
  handWidth = 320,
  consoleWidth = 400,
  height = 620,
  children,
  style,
}: {
  tokens: FullMockTokens;
  mode?: FullMockMode;
  lanes?: FullMockLane[];
  handWidth?: number;
  consoleWidth?: number;
  height?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const holdLabel =
    mode === "listening"
      ? "LISTENING…"
      : mode === "transcribing"
        ? "TRANSCRIBING…"
        : mode === "submitting"
          ? "WORKING…"
          : "HOLD TO SPEAK";

  return (
    <div
      className="flex overflow-hidden"
      style={{
        fontFamily: UI,
        background: t.page,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        height,
        minWidth: handWidth + consoleWidth + 28,
        boxShadow: `0 32px 64px ${rgba("#000000", 0.28)}`,
        ...style,
      }}
    >
      <div
        className="flex shrink-0 flex-col gap-[7px] p-2.5"
        style={{
          width: handWidth,
          borderRight: `1px solid ${t.lineSoft}`,
          background: t.page,
        }}
      >
        <LanePicker tokens={t} lanes={lanes} />
        <PadBank tokens={t} />
        <div className="grid grid-cols-4 gap-[7px]">
          <HoldKey tokens={t} label={holdLabel} live={mode === "listening"} />
          <PadKey tokens={t} label="LANES" caption="BIND" Icon={Grid3x3} />
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 p-2.5" style={{ maxWidth: consoleWidth + 20 }}>
        <div className="h-full min-h-0">{children}</div>
      </div>
    </div>
  );
}

function LanePicker({
  tokens: t,
  lanes,
}: {
  tokens: FullMockTokens;
  lanes: FullMockLane[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[6px] overflow-auto">
      {lanes.map((lane) => {
        const selected = lane.state === "active";
        return (
          <div
            key={lane.index}
            className="flex items-center gap-2.5 px-2.5 py-[9px]"
            style={{
              borderRadius: 8,
              background: selected ? rgba(t.accent, 0.1) : t.cell,
              border: `1px solid ${selected ? rgba(t.accent, 0.45) : t.lineSoft}`,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                width: 28,
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: selected ? t.accent : t.ink3,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {String(lane.index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="truncate"
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: selected ? t.ink : t.ink2,
                  }}
                >
                  {lane.name}
                </span>
                <span
                  className="ml-auto shrink-0 rounded px-1.5 py-px"
                  style={{
                    fontFamily: MONO,
                    fontSize: 7.5,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: selected ? t.accent : t.ink4,
                    border: `1px solid ${selected ? rgba(t.accent, 0.4) : t.lineSoft}`,
                    background: selected ? rgba(t.accent, 0.08) : "transparent",
                  }}
                >
                  {selected ? "ACTIVE" : lane.state === "armed" ? "ARMED" : "IDLE"}
                </span>
              </div>
              <div
                className="mt-0.5 truncate"
                style={{
                  fontFamily: MONO,
                  fontSize: 8.5,
                  fontWeight: 500,
                  color: t.ink4,
                }}
              >
                {lane.task}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PadBank({ tokens: t }: { tokens: FullMockTokens }) {
  return (
    <div className="flex flex-col gap-[7px]">
      {PAD_ROWS.map((row, ri) => (
        <div key={ri} className="grid grid-cols-4 gap-[7px]">
          {row.map((key) => (
            <PadKey
              key={key.label}
              tokens={t}
              label={key.label}
              caption={key.caption}
              Icon={key.Icon}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PadKey({
  tokens: t,
  label,
  caption,
  Icon,
}: {
  tokens: FullMockTokens;
  label: string;
  caption: string;
  Icon: LucideIcon;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        height: 58,
        borderRadius: 8,
        background: `linear-gradient(180deg, ${t.pad} 0%, ${t.padBottom} 100%)`,
        border: `1px solid ${t.line}`,
        boxShadow: `inset 0 1px 0 ${rgba("#ffffff", 0.045)}`,
      }}
    >
      <Icon size={12} strokeWidth={2} style={{ color: t.ink2, marginBottom: 3 }} />
      <span
        style={{
          fontFamily: MONO,
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: t.ink,
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 6.5,
          fontWeight: 500,
          letterSpacing: "0.08em",
          color: t.ink4,
          marginTop: 2,
        }}
      >
        {caption}
      </span>
    </div>
  );
}

function HoldKey({
  tokens: t,
  label,
  live,
}: {
  tokens: FullMockTokens;
  label: string;
  live: boolean;
}) {
  return (
    <div
      className="col-span-3 flex items-center gap-3 px-3.5"
      style={{
        height: 58,
        borderRadius: 10,
        background: `linear-gradient(180deg, ${t.micTop}, ${t.micBottom})`,
        border: `1.5px solid ${t.accentDim}`,
        boxShadow: live
          ? `0 0 0 1px ${rgba(t.accent, 0.25)}, 0 0 20px ${rgba(t.accent, 0.2)}`
          : `inset 0 1px 0 ${rgba("#ffffff", 0.1)}`,
      }}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          background: rgba("#000000", 0.25),
          border: `1.5px solid ${rgba("#ffffff", 0.15)}`,
        }}
      >
        <Mic size={13} strokeWidth={2.25} color="#fff" />
      </div>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "#fff",
        }}
      >
        {label}
      </span>
      {live && (
        <span className="ml-auto flex items-end gap-[3px]">
          {[0.35, 0.75, 0.5, 0.95, 0.4].map((h, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 2.5,
                height: 5 + h * 11,
                background: rgba("#ffffff", 0.9),
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}
