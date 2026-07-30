"use client";

import { DataRow, EngDocSheet } from "studio/doc";
import { PageHeader } from "@/studio/PageHeader";
import type { StudioAppPage } from "@/studio/studioRegistry";

/**
 * Seed themes study. Token values are lifted from the SEEDS block in
 * deck/index.html — paper is the :root default and needs no overrides;
 * ember and flight replace the token values inline on <html> at boot.
 */

type Seed = {
  name: string;
  scheme: "light" | "dark";
  blurb: string;
  swatches: { token: string; value: string }[];
  note: string;
};

const SEEDS: Seed[] = [
  {
    name: "paper",
    scheme: "light",
    blurb: "Warm field-notes light. The default — the CSS :root token block, no overrides.",
    swatches: [
      { token: "page-bg", value: "#e4ddd0" },
      { token: "panel", value: "#f5f1ea" },
      { token: "ink", value: "#1a1612" },
      { token: "accent", value: "#b5421c" },
    ],
    note: "vars: null — nothing to apply at boot.",
  },
  {
    name: "ember",
    scheme: "dark",
    blurb: "Dark warm console. The pad plate stays paper — the pad surface is always paper, whatever the console does.",
    swatches: [
      { token: "page-bg", value: "#171209" },
      { token: "panel", value: "#211a12" },
      { token: "ink", value: "#f3ead9" },
      { token: "accent", value: "#e0673a" },
    ],
    note: "Console tokens only; plate inherits the paper defaults.",
  },
  {
    name: "flight",
    scheme: "dark",
    blurb: "Full dark with the SpeakEasy signal teal, plate included.",
    swatches: [
      { token: "page-bg", value: "#05090b" },
      { token: "panel", value: "#0c161a" },
      { token: "ink", value: "#e8f0ee" },
      { token: "accent", value: "#74f2ce" },
    ],
    note: "Replaces the plate tokens too — pad-face, plate-bg, led states.",
  },
];

export function ThemesStudyPage({ page }: { page: StudioAppPage }) {
  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />

      <section className="max-w-[980px] py-8">
        <p className="max-w-[72ch] text-[14px] leading-[1.7] text-studio-ink">
          One token set, three seeds. Switch at boot with{" "}
          <code className="rounded border border-studio-chip-border bg-studio-chip-bg px-1 py-px font-mono text-[11.5px] text-studio-ink-strong">
            ?theme=paper|ember|flight
          </code>{" "}
          or at runtime with{" "}
          <code className="rounded border border-studio-chip-border bg-studio-chip-bg px-1 py-px font-mono text-[11.5px] text-studio-ink-strong">
            speakeasyDeck.setTheme(name)
          </code>
          ; <code className="rounded border border-studio-chip-border bg-studio-chip-bg px-1 py-px font-mono text-[11.5px] text-studio-ink-strong">
            state()
          </code>{" "}
          reports the active theme. A new seed is just a token map — no markup
          or JS changes.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {SEEDS.map((seed) => (
            <EngDocSheet key={seed.name} className="w-full">
              <div className="flex items-baseline justify-between px-4 pt-4">
                <span className="font-mono text-[14px] font-medium text-studio-ink-strong">
                  {seed.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-eyebrow text-studio-ink-faint">
                  {seed.scheme}
                </span>
              </div>
              <p className="px-4 pb-3 pt-2 text-[12.5px] leading-relaxed text-studio-ink">
                {seed.blurb}
              </p>
              <div className="grid grid-cols-4 gap-px border-y border-studio-rule bg-studio-rule">
                {seed.swatches.map((swatch) => (
                  <div key={swatch.token} className="bg-studio-surface p-2">
                    <div
                      className="h-10 rounded-sm border border-studio-edge"
                      style={{ background: swatch.value }}
                    />
                    <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-studio-ink-faint">
                      {swatch.token}
                    </div>
                    <div className="font-mono text-[10px] text-studio-ink">
                      {swatch.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3">
                <DataRow label="note" labelWidth={48}>
                  {seed.note}
                </DataRow>
              </div>
            </EngDocSheet>
          ))}
        </div>
      </section>
    </main>
  );
}
