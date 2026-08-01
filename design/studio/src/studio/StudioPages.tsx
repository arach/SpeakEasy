"use client";

import { ArrowRight, Shell } from "lucide-react";
import { EngMarkdown } from "studio/doc";
import type { StudioHudsonRenderContext } from "studio/app-shell";
import { useStudioRouter } from "studio/router";
import { DeckHomePage } from "@/studio/DeckHome";
import { PageHeader } from "@/studio/PageHeader";
import { ThemesStudyPage } from "@/studio/ThemesStudy";
import {
  HOME_HREF,
  type Bucket,
  type Status,
  type StudioAppPage,
  type Surface,
} from "@/studio/studioRegistry";

type RenderContext = StudioHudsonRenderContext<Bucket, Surface, Status>;

export interface StudioPageExtras {
  /** Repo docs read from disk by the server route, keyed by page href. */
  docs: Record<string, string>;
}

export function renderStudioPage(
  { pathname, page }: RenderContext,
  extras: StudioPageExtras,
) {
  if (pathname === HOME_HREF) return <DeckHomePage />;
  if (page?.href === "/studio/studies/deck-themes") {
    return <ThemesStudyPage page={page} />;
  }
  const body = page ? extras.docs[page.href] : undefined;
  if (page && body !== undefined) {
    return <EngDocPage page={page} body={body} />;
  }
  return <NotFoundPage />;
}

function EngDocPage({ page, body }: { page: StudioAppPage; body: string }) {
  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />
      <section className="max-w-[900px] py-8">
        <EngMarkdown body={body} fromSlug={page.href.split("/").pop() ?? ""} />
      </section>
    </main>
  );
}

function NotFoundPage() {
  const { Link } = useStudioRouter();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
      <div className="mb-5 flex gap-2 text-studio-ink-faint">
        <Shell size={16} />
      </div>
      <h1 className="text-[34px] font-medium text-studio-ink-strong">
        Page not found.
      </h1>
      <Link
        href={HOME_HREF}
        className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-ink-faint hover:text-studio-ink"
      >
        Back to SpeakEasy Deck
        <ArrowRight size={13} />
      </Link>
    </main>
  );
}
