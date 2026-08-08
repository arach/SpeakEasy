"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/studio/PageHeader";
import { MicroDeckFullMock, type FullMockTokens } from "@/studio/MicroDeckFullMock";
import type { StudioAppPage } from "@/studio/studioRegistry";

/**
 * Premium theme targets for the real Micro Deck product language.
 *
 * Structure matches shipping iPad (pad faces, hold key, lane chips, ledger rail).
 * Color is where class lives — each theme is a considered material + signal pair.
 */

type ThemeId = "flight" | "obsidian" | "ceramic" | "porcelain" | "amber";
type Mode = "ready" | "listening" | "speaking" | "paused";

const MONO =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';

const GUTTER = 46;
const GAP = 12;

/**
 * Hand-tuned. Not Tailwind defaults.
 * Flight specifically avoids “black + neon mint.”
 */
const THEMES: {
  id: ThemeId;
  name: string;
  scheme: "dark" | "light";
  thesis: string;
  kinship: string;
  tokens: FullMockTokens;
}[] = [
  {
    id: "flight",
    name: "Flight",
    scheme: "dark",
    thesis:
      "Blue-graphite instrument case. Signal is sea-glass — cool, soft, jewelry-store green, not esports mint.",
    kinship: "Bang & Olufsen night · aviation glass",
    tokens: {
      page: "#080b0f",
      panel: "#0e1319",
      panelHead: "#131920",
      cell: "#171e27",
      line: "#2a333f",
      lineSoft: "#1c242e",
      ink: "#eef2f5",
      ink2: "#9aa7b4",
      ink3: "#6a7786",
      ink4: "#4b5664",
      accent: "#6eb8a4",
      accentDim: "#3d8a78",
      amber: "#c4a05a",
      pad: "#171e27",
      padBottom: "#11171f",
      plate: "#0b0f14",
      plateTop: "#151c24",
      plateBottom: "#090c10",
      micTop: "#4a9a86",
      micBottom: "#2a6456",
      empty: "#080b0f",
    },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    scheme: "dark",
    thesis:
      "Ink black with cold depth. Signal is pewter-blue — mission steel, not SaaS hyperlink blue.",
    kinship: "Hasselblad UI · ops theater",
    tokens: {
      page: "#050506",
      panel: "#0b0b0d",
      panelHead: "#111114",
      cell: "#16161a",
      line: "#2a2a30",
      lineSoft: "#1a1a1f",
      ink: "#f3f3f4",
      ink2: "#a3a3ab",
      ink3: "#70707a",
      ink4: "#505058",
      accent: "#7f96b5",
      accentDim: "#536a8a",
      amber: "#b89650",
      pad: "#16161a",
      padBottom: "#101014",
      plate: "#08080a",
      plateTop: "#131316",
      plateBottom: "#060607",
      micTop: "#5a7190",
      micBottom: "#354a66",
      empty: "#050506",
    },
  },
  {
    id: "ceramic",
    name: "Ceramic",
    scheme: "light",
    thesis:
      "Warm bone field (not kraft paper). Accent is oxblood — print shop, not marketing orange.",
    kinship: "Hermès packaging · Apple light",
    tokens: {
      page: "#efe9e0",
      panel: "#f7f3ec",
      panelHead: "#fcf9f4",
      cell: "#fffcf7",
      line: "#ddd4c6",
      lineSoft: "#e8e1d5",
      ink: "#1c1612",
      ink2: "#5a4f46",
      ink3: "#7d7166",
      ink4: "#a39689",
      accent: "#7a3428",
      accentDim: "#9a4a3a",
      amber: "#8f6528",
      pad: "#fffcf7",
      padBottom: "#f0ebe2",
      plate: "#e8e1d5",
      plateTop: "#fcf9f4",
      plateBottom: "#e0d8cb",
      micTop: "#9a4a3a",
      micBottom: "#7a3428",
      empty: "#efe9e0",
    },
  },
  {
    id: "porcelain",
    name: "Porcelain",
    scheme: "light",
    thesis:
      "Cool gallery white. Signal is deep navy-ink — almost typographic, never sky-blue chrome.",
    kinship: "Braun white · Swiss product",
    tokens: {
      page: "#ececee",
      panel: "#f5f5f6",
      panelHead: "#fbfbfc",
      cell: "#ffffff",
      line: "#dcdce0",
      lineSoft: "#e8e8ec",
      ink: "#121214",
      ink2: "#484850",
      ink3: "#6c6c76",
      ink4: "#9898a2",
      accent: "#1e2d48",
      accentDim: "#3a4d6e",
      amber: "#7a5c24",
      pad: "#ffffff",
      padBottom: "#f0f0f2",
      plate: "#e6e6ea",
      plateTop: "#ffffff",
      plateBottom: "#dcdee2",
      micTop: "#3a4d6e",
      micBottom: "#1e2d48",
      empty: "#ececee",
    },
  },
  {
    id: "amber",
    name: "Amber",
    scheme: "dark",
    thesis:
      "Espresso chassis. Copper signal kept matte and expensive — never neon, never pumpkin.",
    kinship: "Aged brass · late studio",
    tokens: {
      page: "#0e0c0a",
      panel: "#161310",
      panelHead: "#1c1914",
      cell: "#221e18",
      line: "#383028",
      lineSoft: "#28241e",
      ink: "#f6f0e6",
      ink2: "#c0b2a0",
      ink3: "#8a7c6c",
      ink4: "#685c50",
      accent: "#b88458",
      accentDim: "#8f6240",
      amber: "#a88838",
      pad: "#221e18",
      padBottom: "#18140f",
      plate: "#12100d",
      plateTop: "#1e1a15",
      plateBottom: "#0e0c0a",
      micTop: "#a07048",
      micBottom: "#6f4a2c",
      empty: "#0e0c0a",
    },
  },
];

const LEDGER = [
  { role: "you" as const, text: "Walk the full lifecycle without Codex." },
  {
    role: "agent" as const,
    text: "Lifecycle complete. Listening, transcription, and narration held geometry.",
  },
  { role: "you" as const, text: "Tighten the player foot and ledger rail." },
  {
    role: "agent" as const,
    text: "Ring in the gutter, caption on the text rail, tape clock under the bay only.",
  },
];

export function MicroThemesMatureStudyPage({ page }: { page: StudioAppPage }) {
  const [themeId, setThemeId] = useState<ThemeId>("flight");
  const [mode, setMode] = useState<Mode>("speaking");
  const [pos] = useState(0.34);

  const theme = THEMES.find((x) => x.id === themeId) ?? THEMES[0];
  const t = theme.tokens;
  const live = mode === "listening" || mode === "speaking";

  const messages = useMemo(
    () =>
      mode === "ready" ? [] : mode === "listening" ? LEDGER.slice(0, 1) : LEDGER,
    [mode],
  );

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />

      <section className="mx-auto max-w-[1220px] space-y-10 py-8">
        <div className="max-w-[54ch]">
          <h2 className="mb-2 text-[15px] font-semibold tracking-[-0.02em] text-studio-ink-strong">
            Premium targets
          </h2>
          <p className="text-[13px] leading-[1.65] text-studio-ink">
            Structure matches the shipping Micro Deck (pad faces, hold key, lane
            chips, ledger rail). Class is in the palette and type weight — sea-glass
            on graphite, oxblood on bone, pewter on black. Not Tailwind emerald. Not
            workshop grain.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {THEMES.map((th) => {
            const on = th.id === themeId;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => setThemeId(th.id)}
                className="rounded-lg px-3 py-2 text-left"
                style={{
                  border: `1px solid ${on ? th.tokens.accent : "var(--studio-rule, #333)"}`,
                  background: on ? th.tokens.panel : "transparent",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: th.tokens.accent }}
                  />
                  <span className="text-[12px] font-semibold tracking-[-0.02em] text-studio-ink-strong">
                    {th.name}
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-studio-ink-faint">{th.kinship}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["ready", "Ready"],
              ["listening", "Listening"],
              ["speaking", "Speaking"],
              ["paused", "Paused"],
            ] as const
          ).map(([key, word]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium"
              style={{
                border: `1px solid ${mode === key ? t.accent : "var(--studio-rule, #333)"}`,
                color: mode === key ? t.accent : "var(--studio-ink-faint, #888)",
                background: mode === key ? rgba(t.accent, 0.08) : "transparent",
              }}
            >
              {word}
            </button>
          ))}
        </div>

        <div
          className="overflow-x-auto rounded-2xl p-4"
          style={{ background: t.page, border: `1px solid ${t.lineSoft}` }}
        >
          <MicroDeckFullMock
            tokens={t}
            mode={mode}
            handWidth={318}
            consoleWidth={400}
            height={600}
          >
            <ShipConsole
              t={t}
              mode={mode}
              messages={messages}
              pos={mode === "speaking" || mode === "paused" ? pos : 0}
              live={live}
            />
          </MicroDeckFullMock>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => setThemeId(th.id)}
              className="rounded-xl p-3 text-left"
              style={{
                background: th.tokens.page,
                border: `1px solid ${th.id === themeId ? th.tokens.accent : th.tokens.line}`,
              }}
            >
              <div
                className="text-[12px] font-semibold tracking-[-0.02em]"
                style={{ color: th.tokens.ink }}
              >
                {th.name}
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: th.tokens.ink4 }}>
                {th.kinship}
              </div>
              <p className="mt-2 text-[11px] leading-snug" style={{ color: th.tokens.ink3 }}>
                {th.thesis}
              </p>
              <div className="mt-3 flex gap-1">
                {[th.tokens.panel, th.tokens.accent, th.tokens.ink2, th.tokens.micTop].map(
                  (c) => (
                    <span
                      key={c + th.id}
                      className="h-5 flex-1 rounded"
                      style={{
                        background: c,
                        border: `1px solid ${th.tokens.lineSoft}`,
                      }}
                    />
                  ),
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

/** Console matches shipping language: mono instrument, ledger rail. */
function ShipConsole({
  t,
  mode,
  messages,
  pos,
  live,
}: {
  t: FullMockTokens;
  mode: Mode;
  messages: { role: "you" | "agent"; text: string }[];
  pos: number;
  live: boolean;
}) {
  const status =
    mode === "listening"
      ? "LISTENING"
      : mode === "speaking"
        ? "SPEAKING"
        : mode === "paused"
          ? "PAUSED"
          : "ACTIVE LANE";

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{
        fontFamily: MONO,
        background: t.panel,
        border: `1px solid ${live ? rgba(t.accent, 0.4) : t.line}`,
        borderRadius: 10,
      }}
    >
      <div
        className="flex items-start gap-3 px-3.5 pb-2.5 pt-3"
        style={{ borderBottom: `1px solid ${t.lineSoft}` }}
      >
        <span
          style={{
            width: GUTTER,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: t.accent,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          01
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate"
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: t.ink,
              }}
            >
              LINEA
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: live ? t.accent : t.ink4,
                  boxShadow: live ? `0 0 6px ${t.accent}` : undefined,
                }}
              />
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: live ? t.accent : t.ink3,
                }}
              >
                {status}
              </span>
            </span>
          </div>
          <div className="mt-1 flex gap-2" style={{ fontSize: 8, color: t.ink4 }}>
            <span>main</span>
            <span
              className="rounded px-1"
              style={{
                border: `1px solid ${t.lineSoft}`,
                color: t.ink3,
              }}
            >
              6B306A13
            </span>
            <span
              className="rounded px-1"
              style={{
                border: `1px solid ${rgba(t.accent, 0.35)}`,
                color: t.accent,
                fontSize: 7,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              DECK
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3.5 py-2.5">
        {messages.length === 0 ? (
          <p style={{ paddingLeft: GUTTER + GAP, fontSize: 10, color: t.ink4 }}>
            No exchange yet on this lane.
          </p>
        ) : (
          <div className="space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  style={{
                    width: GUTTER,
                    fontSize: 7.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: t.ink4,
                    paddingTop: 2,
                  }}
                >
                  {m.role === "you" ? "YOU" : "AGENT"}
                </span>
                <p
                  className="min-w-0 flex-1"
                  style={{
                    fontSize: 10,
                    lineHeight: 1.45,
                    color: m.role === "agent" ? t.ink2 : t.ink3,
                  }}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: `1px solid ${t.lineSoft}`,
          background: `linear-gradient(180deg, ${t.plateTop}, ${t.plateBottom})`,
          padding: "10px 14px 11px",
        }}
      >
        <div style={{ paddingLeft: GUTTER + GAP }} className="mb-2">
          <div className="flex items-center gap-1.5" style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em" }}>
            <span style={{ color: live ? t.accent : t.ink3 }}>TURN 1</span>
            <span style={{ color: t.ink4 }}>·</span>
            <span style={{ color: live ? t.accent : t.ink3 }}>
              {mode === "speaking" ? "SPEAKING" : mode === "paused" ? "PAUSED" : "SUMMARY"}
            </span>
          </div>
          <div
            className="mt-1 truncate"
            style={{ fontSize: 10, color: t.ink, lineHeight: 1.35 }}
          >
            {messages.find((m) => m.role === "agent")?.text ?? "Nothing to play"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex justify-center" style={{ width: GUTTER }}>
            <div
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full"
              style={{
                background: t.empty,
                border: `2px solid ${live || mode === "ready" || mode === "paused" ? t.accent : t.line}`,
                color: live || mode === "ready" || mode === "paused" ? t.accent : t.ink4,
              }}
            >
              <span style={{ fontSize: 12 }}>{mode === "speaking" ? "❚❚" : "▶"}</span>
            </div>
          </div>
          <div
            className="relative h-[44px] min-w-0 flex-1 overflow-hidden"
            style={{
              borderRadius: 6,
              background: t.empty,
              border: `1px solid ${t.line}`,
            }}
          >
            <div className="absolute inset-0 flex items-center px-2">
              <Wave
                pos={mode === "speaking" || mode === "paused" ? pos : 0}
                accent={t.accent}
                line={t.line}
              />
            </div>
          </div>
        </div>

        {(mode === "speaking" || mode === "paused" || mode === "ready") && (
          <div
            className="relative mt-1.5 tabular-nums"
            style={{
              marginLeft: GUTTER + GAP,
              fontSize: 9,
              color: t.ink4,
            }}
          >
            <div className="flex justify-between">
              <span>0:00</span>
              <span>0:04</span>
            </div>
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ color: t.ink3 }}
            >
              {mode === "ready" ? "0:00" : "0:01"}
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-1.5">
          {[
            { a: "1.00×", b: "" },
            { a: "VOL", b: "——" },
            { a: "AUTOPLAY", b: "ON" },
          ].map((chip) => (
            <span
              key={chip.a}
              className="rounded px-1.5 py-1"
              style={{
                border: `1px solid ${chip.a === "AUTOPLAY" ? rgba(t.amber, 0.45) : t.lineSoft}`,
                background: chip.a === "AUTOPLAY" ? rgba(t.amber, 0.1) : t.cell,
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: chip.a === "AUTOPLAY" ? t.amber : t.ink3,
              }}
            >
              {chip.a}
              {chip.b ? ` ${chip.b}` : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Wave({ pos, accent, line }: { pos: number; accent: string; line: string }) {
  const n = 56;
  return (
    <div className="flex h-7 w-full items-center gap-px">
      {Array.from({ length: n }, (_, i) => {
        const x = i / (n - 1);
        const h = 0.12 + Math.abs(Math.sin(x * Math.PI * 3.1)) * 0.8;
        const played = x <= pos;
        return (
          <div
            key={i}
            className="flex-1"
            style={{
              height: `${h * 100}%`,
              borderRadius: 1,
              background: played ? accent : line,
              opacity: played ? 0.92 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
}

function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
