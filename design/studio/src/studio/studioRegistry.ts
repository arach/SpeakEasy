import { createRegistry, type StudioPage } from "studio/registry";
import { createStatusPalette } from "studio/atoms";

/**
 * SpeakEasy studio registry. Product prefix SE. Buckets follow the internal
 * convention: foundations for the product boundary and operating model, eng
 * for engineering docs rendered from the repo, studies for UI/design studies.
 */

export type Bucket = "foundations" | "eng" | "studies";
export type Surface = "deck" | "pad" | "mac" | "cross";
export type Status = "stable" | "preview" | "wip";

export type StudioAppPage = StudioPage<Bucket, Surface, Status>;

export const HOME_HREF = "/studio";

export const pages: readonly StudioAppPage[] = [
  {
    href: HOME_HREF,
    label: "SpeakEasy Deck",
    bucket: "foundations",
    surface: "deck",
    status: "stable",
    blurb:
      "Project layout for the embeddable deck control surface — what is built and usable now, the adjacent Pad surface, and what is missing before the deck is connected.",
    source: ["deck/index.html", "deck/README.md"],
  },
  {
    href: "/studio/eng/deck-readme",
    label: "SE-ENG · Deck README",
    bucket: "eng",
    surface: "deck",
    status: "stable",
    blurb:
      "Boot options, seed themes, and the HudsonKit embedding contract — rendered from deck/README.md on disk.",
    source: ["deck/README.md"],
  },
  {
    href: "/studio/eng/design-layers",
    label: "SE-ENG · Design layers",
    bucket: "eng",
    surface: "deck",
    status: "stable",
    blurb:
      "The extensibility map — URL overrides, file-based variants, templates as apps, the catalog, and what is deferred.",
    source: ["docs/design/deck-design-layers.md"],
  },
  {
    href: "/studio/eng/connect-brief",
    label: "SE-ENG · Connect brief",
    bucket: "eng",
    surface: "mac",
    status: "wip",
    blurb:
      "Agent execution brief — the ordered tasks that take the deck from demo state to a real Mac-driven loop.",
    source: ["docs/design/deck-connect-brief.md"],
  },
  {
    href: "/studio/studies/audio-instrument",
    label: "SE-STU · Audio instrument",
    bucket: "studies",
    surface: "pad",
    status: "wip",
    blurb:
      "The Micro Deck bottom-right panel — every capture and playback state, driveable. 1U idle, 2U while playing, on the key-bank grid.",
    source: ["deck/ipad/Sources/DeckAudioInstrument.swift"],
  },
  {
    href: "/studio/studies/lane-console",
    label: "SE-STU · Lane console",
    bucket: "studies",
    surface: "pad",
    status: "wip",
    blurb:
      "One surface: identity + exchange (panel) over player foot (plate). Ring in numeral gutter; figure is scrub — no second rail.",
    source: [
      "deck/ipad/Sources/DeckPlayerConsole.swift",
      "deck/ipad/Sources/NativeDeckView.swift",
    ],
  },
  {
    href: "/studio/studies/micro-themes-mature",
    label: "SE-STU · Micro themes · Mature",
    bucket: "studies",
    surface: "pad",
    status: "wip",
    blurb:
      "Product-grade full Micro Deck. Quiet surfaces, one accent as signal — Linear/Cursor/Apple maturity, not workshop cosplay.",
    source: [
      "design/studio/src/studio/MicroThemesMatureStudy.tsx",
      "design/studio/src/studio/MicroDeckFullMock.tsx",
      "deck/ipad/Sources/DeckTheme.swift",
    ],
  },
  {
    href: "/studio/studies/micro-themes-opus",
    label: "SE-STU · Micro themes · Opus",
    bucket: "studies",
    surface: "pad",
    status: "wip",
    blurb:
      "Exploratory materials (full Micro). Knobs and presets — workshop lab, not ship defaults.",
    source: [
      "docs/design/micro-deck-theme-material-brief.md",
      "design/studio/src/studio/MicroDeckFullMock.tsx",
      "deck/ipad/Sources/DeckTheme.swift",
    ],
  },
  {
    href: "/studio/studies/player-face",
    label: "SE-STU · Player face",
    bucket: "studies",
    surface: "pad",
    status: "wip",
    blurb:
      "Turn player — circular play ring, caption-first, one scrub, chip controls. State matrix 2a–2g (empty → finished).",
    source: [
      "design/studio/src/studio/PlayerFaceStudy.tsx",
      "deck/ipad/Sources/DeckPlayerConsole.swift",
    ],
  },
  {
    href: "/studio/studies/micro-themes-kimi",
    label: "SE-STU · Micro themes · Kimi",
    bucket: "studies",
    surface: "pad",
    status: "wip",
    blurb:
      "Exploratory materials (full Micro). Texture lab — phosphor, glaze, bakelite. Use Mature for ship-grade.",
    source: [
      "design/studio/src/studio/MicroThemesKimiStudy.tsx",
      "design/studio/src/studio/MicroDeckFullMock.tsx",
      "deck/ipad/Sources/DeckTheme.swift",
    ],
  },
  {
    href: "/studio/studies/deck-themes",
    label: "SE-STU · Seed themes",
    bucket: "studies",
    surface: "deck",
    status: "preview",
    blurb:
      "paper, ember, flight — one token set, three seeds, switched at boot with ?theme= or at runtime with speakeasyDeck.setTheme().",
    source: ["deck/index.html"],
  },
];

export const registry = createRegistry<Bucket, Surface, Status>({
  pages,
  surfaceOrder: ["deck", "pad", "mac", "cross"],
  defaultSurface: "cross",
  bucketLabel: (bucket) =>
    ({
      foundations: "Foundations",
      eng: "Engineering",
      studies: "Studies",
    })[bucket],
  surfaceLabel: (surface) =>
    ({
      deck: "Deck",
      pad: "Pad",
      mac: "Mac",
      cross: "Cross",
    })[surface],
});

export const statusPalette = createStatusPalette<Status>({
  stable: { tone: "ok", label: "STABLE" },
  preview: { tone: "warn", label: "PREVIEW" },
  wip: { tone: "info", label: "WIP" },
});

export const STATUS_COLORS: Record<Status, string> = {
  stable: statusPalette.statusToColor("stable"),
  preview: statusPalette.statusToColor("preview"),
  wip: statusPalette.statusToColor("wip"),
};

export const BUCKETS = [
  { key: "foundations" },
  { key: "eng", title: "Engineering" },
  { key: "studies" },
] as const;
