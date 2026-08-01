"use client";

import { registry, type StudioAppPage } from "@/studio/studioRegistry";

export function PageHeader({ page }: { page: StudioAppPage }) {
  return (
    <header className="max-w-[980px] border-b border-studio-rule pb-7">
      <div className="font-mono text-[10px] uppercase tracking-eyebrow text-studio-ink-faint">
        SE / {registry.bucketLabel(page.bucket)} /{" "}
        {page.surface ? registry.surfaceLabel(page.surface) : "Cross"}
      </div>
      <h1 className="mt-4 text-[38px] font-medium leading-tight text-studio-ink-strong">
        {page.label}
      </h1>
      {page.blurb ? (
        <p
          className="mt-4 max-w-[66ch] text-[15px] leading-[1.7] text-studio-ink"
          style={{ fontFamily: "var(--studio-font-serif)" }}
        >
          {page.blurb}
        </p>
      ) : null}
    </header>
  );
}
