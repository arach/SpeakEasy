"use client";

import type { ReactNode } from "react";
import { DataRow, EngDocSheet } from "studio/doc";
import { statusPalette, type Status } from "@/studio/studioRegistry";

const StatusPill = statusPalette.StatusPill;

/**
 * Home — the SpeakEasy Deck project layout. What ships today as a single
 * HTML file, the adjacent Pad surface in the worktree, and the punch list
 * that stands between the deck and a connected product loop.
 */

type TreeEntry = {
  depth: number;
  name: string;
  note: string;
  status: Status;
  last?: boolean;
  dir?: boolean;
};

const TREE: TreeEntry[] = [
  { depth: 0, name: "deck/", note: "the control surface, self-contained", status: "stable", dir: true },
  { depth: 1, name: "index.html", note: "9-pad plate + lane console — no framework, no build step", status: "stable" },
  { depth: 1, name: "README.md", note: "boot options · themes · HudsonKit embedding contract", status: "stable", last: true },
  { depth: 0, name: "pad/", note: "worktree · codex/pad-micro-activity-polish", status: "preview", dir: true },
  { depth: 1, name: "src/model.ts", note: "protocol types + fixtures — 12 commands, monotonic revisions", status: "preview" },
  { depth: 1, name: "docs/theme-contract.md", note: "manifest-based custom-theme layer", status: "preview", last: true },
  { depth: 0, name: "docs/design/", note: "", status: "wip", dir: true },
  { depth: 1, name: "speakeasy-pad-turnkey-mvp.md", note: "in the worktree — delivery slice 1 is the product-loop proof", status: "wip", last: true },
];

const BUILT: { title: ReactNode; body: ReactNode }[] = [
  {
    title: <Mono>deck/index.html</Mono>,
    body: (
      <>
        Single-file embeddable control surface: 9-pad hardware plate plus a lane
        console with conversation, audio scrubbing, and a trace rail. No
        framework, no build step.
      </>
    ),
  },
  {
    title: <Mono>deck/README.md</Mono>,
    body: <>Boot options, themes, and the HudsonKit embedding contract.</>,
  },
  {
    title: <>Three seed themes</>,
    body: (
      <>
        <Mono>paper</Mono> (default light), <Mono>ember</Mono> (dark console,
        paper plate), <Mono>flight</Mono> (full dark, signal teal). Switch via
        the <Mono>?theme=</Mono> boot param or{" "}
        <Mono>speakeasyDeck.setTheme()</Mono> at runtime.
      </>
    ),
  },
  {
    title: <>Host bridge</>,
    body: (
      <>
        Deck → native via <Mono>webkit.messageHandlers.speakeasyDeck</Mono> and
        KVO on <Mono>document.title</Mono>; native → deck via{" "}
        <Mono>window.speakeasyDeck</Mono> (<Mono>selectLane</Mono>,{" "}
        <Mono>stop</Mono>, <Mono>setTheme</Mono>, <Mono>state</Mono>).
      </>
    ),
  },
  {
    title: <>Full keyboard access</>,
    body: (
      <>
        Every control is a real button. Space/Enter hold-to-speak, ESC cancels.
      </>
    ),
  },
  {
    title: <>Serve locally</>,
    body: (
      <>
        <Mono>bun run</Mono> a static server on <Mono>deck/</Mono> — e.g.{" "}
        <Mono>http://localhost:43211/?theme=ember</Mono>.
      </>
    ),
  },
];

const PUNCH_LIST: ReactNode[] = [
  <>
    <strong>Mac domain runtime</strong> — lanes, exact-task locks, phases,
    playback queue. The Swift app today is HUD + history only.
  </>,
  <>
    <Mono>SpeakEasyRemoteCoordinator</Mono> + Swift Codable mirror of the
    protocol (TS types/fixtures already exist in <Mono>pad/src/model.ts</Mono>).
  </>,
  <>
    Local listener on <Mono>:8255</Mono> serving <Mono>pad/dist</Mono> +
    WebSocket, DNS-SD <Mono>pad.speakeasy.local</Mono>, active only while the
    feature is on.
  </>,
  <>
    Day-pass: QR link minting, verifier for <Mono>k</Mono>, 24h lease,
    revocation, “End Pad session”.
  </>,
];

export function DeckHomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <header className="grid gap-8 border-b border-studio-rule pb-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-eyebrow text-studio-ink-faint">
            SE / foundations / deck
            <StatusPill status="stable" />
          </div>
          <h1 className="mt-4 max-w-[760px] text-[44px] font-medium leading-tight text-studio-ink-strong">
            SpeakEasy Deck
          </h1>
          <p
            className="mt-5 max-w-[64ch] text-[15px] leading-[1.7] text-studio-ink"
            style={{ fontFamily: "var(--studio-font-serif)" }}
          >
            An embeddable control surface for SpeakEasy: a 9-pad hardware plate
            and a lane console, shipped as one HTML file and built to sit inside
            HudsonKit&apos;s web surface. This page is the project layout — what
            is built, what sits next to it, and what is still missing.
          </p>
        </div>

        <EngDocSheet className="self-start">
          <DataRow label="surface">deck/index.html</DataRow>
          <DataRow label="themes">paper · ember · flight</DataRow>
          <DataRow label="bridge">webkit + KVO title</DataRow>
          <DataRow label="serve">localhost:43211</DataRow>
        </EngDocSheet>
      </header>

      <section className="border-b border-studio-rule py-10">
        <SectionHeading title="Project layout" />
        <div className="mt-5 overflow-hidden rounded-md border border-studio-edge bg-studio-surface">
          {TREE.map((entry, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(220px,320px)_1fr_auto] items-baseline gap-4 border-b border-studio-rule px-4 py-2.5 last:border-b-0"
            >
              <span className="font-mono text-[12.5px] text-studio-ink-strong">
                <span className="text-studio-ink-faint">{treePrefix(entry)}</span>
                {entry.name}
              </span>
              <span className="text-[12.5px] leading-relaxed text-studio-ink-faint">
                {entry.note}
              </span>
              <StatusPill status={entry.status} />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 border-b border-studio-rule py-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center gap-3">
            <SectionHeading title="Built and usable now" />
            <StatusPill status="stable" />
          </div>
          <ul className="mt-5 divide-y divide-studio-rule border-y border-studio-rule">
            {BUILT.map((item, i) => (
              <li key={i} className="grid gap-2 py-4 md:grid-cols-[220px_1fr]">
                <span className="text-[13.5px] font-medium text-studio-ink-strong">
                  {item.title}
                </span>
                <span className="text-[13px] leading-relaxed text-studio-ink">
                  {item.body}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <aside>
          <div className="flex items-center gap-3">
            <SectionHeading title="Related surface" />
            <StatusPill status="preview" />
          </div>
          <EngDocSheet className="mt-5">
            <DataRow label="branch" labelWidth={96}>
              codex/pad-micro-activity-polish
            </DataRow>
            <DataRow label="surface" labelWidth={96}>
              pad/ web app
            </DataRow>
            <DataRow label="protocol" labelWidth={96}>
              12 versioned commands
            </DataRow>
          </EngDocSheet>
          <p className="mt-4 text-[13px] leading-relaxed text-studio-ink">
            The Pad web app lives in the worktree branch{" "}
            <Mono>codex/pad-micro-activity-polish</Mono> (<Mono>pad/</Mono>),
            with the real client protocol — 12 versioned command methods,
            monotonic revisions, day-pass parsing, reconnect — and a
            manifest-based custom-theme layer governed by{" "}
            <Mono>pad/docs/theme-contract.md</Mono>.
          </p>
        </aside>
      </section>

      <section className="py-10">
        <div className="flex items-center gap-3">
          <SectionHeading title="Missing before the deck is connected" />
          <StatusPill status="wip" />
        </div>
        <ol className="mt-5 divide-y divide-studio-rule border-y border-studio-rule">
          {PUNCH_LIST.map((item, i) => (
            <li key={i} className="grid grid-cols-[48px_1fr] gap-4 py-4">
              <span className="font-mono text-[13px] text-studio-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="max-w-[76ch] text-[13.5px] leading-relaxed text-studio-ink">
                {item}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-[76ch] text-[13px] leading-relaxed text-studio-ink-faint">
          Reference: <Mono>docs/design/speakeasy-pad-turnkey-mvp.md</Mono> (in
          the worktree) — delivery slice 1 is the product-loop proof.
        </p>
      </section>
    </main>
  );
}

function treePrefix(entry: TreeEntry): string {
  if (entry.depth === 0) return "";
  const arm = entry.last ? "└── " : "├── ";
  return `${"    ".repeat(entry.depth - 1)}${arm}`;
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-studio-chip-border bg-studio-chip-bg px-1 py-px font-mono text-[11.5px] text-studio-ink-strong">
      {children}
    </code>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-eyebrow text-studio-ink-faint">
      {title}
    </div>
  );
}
