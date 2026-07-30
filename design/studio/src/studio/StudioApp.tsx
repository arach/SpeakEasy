"use client";

import { createElement } from "react";
import { AudioWaveform, Compass } from "lucide-react";
import { StudioHudsonApp } from "studio/app-shell";
import { NextRouterProvider } from "studio/router/next";
import { renderStudioPage } from "@/studio/StudioPages";
import {
  BUCKETS,
  HOME_HREF,
  STATUS_COLORS,
  registry,
  statusPalette,
} from "@/studio/studioRegistry";

export function StudioApp({ docs }: { docs: Record<string, string> }) {
  return (
    <StudioHudsonApp
      app={{
        id: "speakeasy-studio",
        name: "SpeakEasy",
        description: "Design studio for the SpeakEasy deck control surface.",
        icon: createElement(AudioWaveform, { size: 14 }),
        leftPanel: {
          title: "SpeakEasy",
          icon: createElement(Compass, { size: 12 }),
        },
      }}
      registry={registry}
      buckets={BUCKETS}
      statusColors={STATUS_COLORS}
      renderStatusPill={(status) => statusPalette.StatusPill({ status })}
      renderPage={(context) => renderStudioPage(context, { docs })}
      homeHref={HOME_HREF}
      routerProvider={NextRouterProvider}
      theme={{
        storageKey: "speakeasy.studio.theme",
        defaultTheme: "dark",
        defaultTemplate: "hudson",
      }}
    />
  );
}
