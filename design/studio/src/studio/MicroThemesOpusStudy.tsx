"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/studio/PageHeader";
import { MicroDeckFullMock } from "@/studio/MicroDeckFullMock";
import type { StudioAppPage } from "@/studio/studioRegistry";

/**
 * Micro Deck — theme material study (Opus).
 *
 * The layout is fixed: it is the shipped Micro ledger column from
 * `NativeDeckView.ActiveLaneInstrument` + `DeckPlayerConsole` (see
 * `LaneConsoleStudy` for the same geometry in the studio). One outer surface,
 * 50pt gutter, text rail at 76, fused player foot at 2U, tape clock under the
 * bay only, chips on the plate floor.
 *
 * What changes here is the *material*: every theme is redesigned as a distinct
 * physical object — anodized graphite, obsidian glass, phosphor CRT, fired
 * glaze, kraft press, bisque, frosted glass, Swiss plate, vacuum tube, ferric
 * tape, brass and walnut. Colour is only one axis; texture, lighting, corner
 * language, hairline weight and type do the rest.
 *
 * Everything is live: theme, material preset, every palette token, and a rack
 * of global knobs. Export emits `DeckThemePalette` field names so a direction
 * can be pasted straight back into `deck/ipad/Sources/DeckTheme.swift`.
 */

/* ------------------------------------------------------------------ tokens */

/** Field names mirror `DeckThemePalette` exactly — export must round-trip. */
const TOKEN_KEYS = [
  "page",
  "panel",
  "panelHead",
  "cell",
  "trace",
  "line",
  "lineSoft",
  "ink",
  "ink2",
  "ink3",
  "ink4",
  "accent",
  "accentDim",
  "accentDark",
  "accentEdge",
  "amber",
  "plate",
  "plateTop",
  "plateBottom",
  "pad",
  "padBottom",
  "empty",
  "micTop",
  "micBottom",
] as const;

type TokenKey = (typeof TOKEN_KEYS)[number];
type Tokens = Record<TokenKey, string>;

const TOKEN_GROUPS: { title: string; keys: TokenKey[] }[] = [
  { title: "Chassis", keys: ["page", "panel", "panelHead", "cell", "trace", "empty"] },
  { title: "Rules", keys: ["line", "lineSoft"] },
  { title: "Ink ladder", keys: ["ink", "ink2", "ink3", "ink4"] },
  { title: "Signal", keys: ["accent", "accentDim", "accentDark", "accentEdge", "amber"] },
  { title: "Plate", keys: ["plate", "plateTop", "plateBottom"] },
  { title: "Pad", keys: ["pad", "padBottom"] },
  { title: "Mic", keys: ["micTop", "micBottom"] },
];

/* ---------------------------------------------------------------- material */

const FONTS = {
  mono: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace`,
  typewriter: `"Courier New", Courier, ui-monospace, monospace`,
  grotesk: `"Helvetica Neue", Helvetica, Inter, system-ui, sans-serif`,
  serif: `Georgia, "Iowan Old Style", "Times New Roman", serif`,
} as const;

type FontKey = keyof typeof FONTS;
type Texture = "matte" | "glass" | "scanline" | "brushed" | "paper" | "grain";

/**
 * The non-colour half of a material. Everything here is a live knob; presets
 * only seed it. `playerH` is ignored while `lockU` holds (2U contract).
 */
interface Material {
  texture: Texture;
  grain: number;
  sheen: number;
  bevel: number;
  plateGrad: number;
  radius: number;
  bayRadius: number;
  chipRadius: number;
  hairline: number;
  borderAlpha: number;
  glow: number;
  typeScale: number;
  identTrack: number;
  gutter: number;
  lockU: boolean;
  playerH: number;
  spacing: number;
  fontMono: FontKey;
  fontCaption: FontKey;
  numeralWeight: number;
}

interface Preset {
  id: string;
  label: string;
  blurb: string;
  tokens: Tokens;
  material: Material;
}

interface ThemeDef {
  id: string;
  name: string;
  scheme: "dark" | "light";
  thesis: string;
  presets: Preset[];
}

/** One key-bank row — the Micro pad grid unit. Player is exactly 2U. */
const U = 78;
const PLAYER_2U = U * 2;

/** Quieter defaults — product maturity over workshop texture. */
const BASE_MATERIAL: Material = {
  texture: "matte",
  grain: 0.08,
  sheen: 0.12,
  bevel: 0.15,
  plateGrad: 0.55,
  radius: 10,
  bayRadius: 6,
  chipRadius: 6,
  hairline: 1,
  borderAlpha: 0.75,
  glow: 0.12,
  typeScale: 1,
  identTrack: 0.01,
  gutter: 50,
  lockU: true,
  playerH: PLAYER_2U,
  spacing: 1,
  fontMono: "mono",
  fontCaption: "grotesk",
  numeralWeight: 600,
};

function mat(patch: Partial<Material>): Material {
  return { ...BASE_MATERIAL, ...patch };
}

/* ------------------------------------------------------------------ themes */

const THEMES: ThemeDef[] = [
  {
    id: "flight",
    name: "Flight",
    scheme: "dark",
    thesis:
      "Anodised graphite — a brushed instrument case lit from the top edge, mint kept as a lamp, never a wash.",
    presets: [
      {
        id: "void-graphite",
        label: "Void graphite",
        blurb:
          "Brushed anodised aluminium over void. Top-lit plate, recessed bay, mint only where the signal is live.",
        tokens: {
          page: "#06080a",
          panel: "#0e141a",
          panelHead: "#131a21",
          cell: "#19212a",
          trace: "#05070a",
          line: "#2a333c",
          lineSoft: "#19212a",
          ink: "#f1f5f7",
          ink2: "#a6b1bb",
          ink3: "#6a7681",
          ink4: "#47525c",
          accent: "#5ee9c2",
          accentDim: "#35b394",
          accentDark: "#08201b",
          accentEdge: "#1c4f42",
          amber: "#e0a83f",
          plate: "#0a0e12",
          plateTop: "#151c22",
          plateBottom: "#080b0e",
          pad: "#19212a",
          padBottom: "#0e1318",
          empty: "#05070a",
          micTop: "#14a07a",
          micBottom: "#0a6b50",
        },
        material: mat({
          texture: "brushed",
          grain: 0.45,
          sheen: 0.35,
          bevel: 0.5,
          plateGrad: 0.95,
          radius: 10,
          bayRadius: 6,
          chipRadius: 4,
          glow: 0.35,
        }),
      },
      {
        id: "liquid-glass-mint",
        label: "Liquid glass mint",
        blurb:
          "Refractive slab. Specular sweep off the top-left corner, generous radii, hairlines dissolved to rim light.",
        tokens: {
          page: "#04070b",
          panel: "#0f1821",
          panelHead: "#16222c",
          cell: "#1b2833",
          trace: "#081119",
          line: "#3a5563",
          lineSoft: "#1e2e3a",
          ink: "#effbf7",
          ink2: "#a9c6c6",
          ink3: "#6e8c92",
          ink4: "#4a6670",
          accent: "#7cffda",
          accentDim: "#46c7ac",
          accentDark: "#062822",
          accentEdge: "#2a6f60",
          amber: "#f2c46a",
          plate: "#0b141c",
          plateTop: "#1b2b36",
          plateBottom: "#080f16",
          pad: "#1a2932",
          padBottom: "#101b23",
          empty: "#071018",
          micTop: "#22c79c",
          micBottom: "#0e7c63",
        },
        material: mat({
          texture: "glass",
          grain: 0.12,
          sheen: 1,
          bevel: 0.85,
          plateGrad: 1.25,
          radius: 18,
          bayRadius: 12,
          chipRadius: 9,
          borderAlpha: 0.55,
          glow: 0.85,
          typeScale: 1.02,
          fontCaption: "grotesk",
        }),
      },
      {
        id: "brutal-plate",
        label: "Brutal plate",
        blurb:
          "Cast, not milled. Square corners, 1.5px rules, zero gloss — mint demoted to a hard chip of pigment.",
        tokens: {
          page: "#0b0b0b",
          panel: "#151515",
          panelHead: "#191919",
          cell: "#1e1e1e",
          trace: "#0e0e0e",
          line: "#3a3a3a",
          lineSoft: "#262626",
          ink: "#ffffff",
          ink2: "#b8b8b8",
          ink3: "#7c7c7c",
          ink4: "#565656",
          accent: "#3ce0a8",
          accentDim: "#2a9e77",
          accentDark: "#0c1a15",
          accentEdge: "#1f4535",
          amber: "#d99a2b",
          plate: "#131313",
          plateTop: "#1a1a1a",
          plateBottom: "#101010",
          pad: "#1c1c1c",
          padBottom: "#141414",
          empty: "#0e0e0e",
          micTop: "#199e77",
          micBottom: "#0c6349",
        },
        material: mat({
          texture: "matte",
          grain: 0.2,
          sheen: 0,
          bevel: 0.08,
          plateGrad: 0.25,
          radius: 2,
          bayRadius: 2,
          chipRadius: 0,
          hairline: 1.5,
          borderAlpha: 1,
          glow: 0,
          typeScale: 0.97,
          identTrack: 0.08,
        }),
      },
    ],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    scheme: "dark",
    thesis:
      "Volcanic glass — near-black with a cool blue sub-surface; the plate reads as depth, not as paint.",
    presets: [
      {
        id: "obsidian-glass",
        label: "Obsidian glass",
        blurb:
          "Black glass with blue scatter under the surface. Deep recessed wells, soft corner light, cold ink.",
        tokens: {
          page: "#020304",
          panel: "#080b0e",
          panelHead: "#0c1116",
          cell: "#101720",
          trace: "#06090c",
          line: "#26303a",
          lineSoft: "#161d25",
          ink: "#f0f5fa",
          ink2: "#b3c1ce",
          ink3: "#74838f",
          ink4: "#4a5661",
          accent: "#79b8ff",
          accentDim: "#4b82b8",
          accentDark: "#071827",
          accentEdge: "#244968",
          amber: "#e8b85d",
          plate: "#06090c",
          plateTop: "#121a23",
          plateBottom: "#05080a",
          pad: "#131a22",
          padBottom: "#0b1015",
          empty: "#070a0d",
          micTop: "#256fa8",
          micBottom: "#184a72",
        },
        material: mat({
          texture: "glass",
          grain: 0.1,
          sheen: 0.75,
          bevel: 0.7,
          plateGrad: 1.1,
          radius: 12,
          bayRadius: 8,
          chipRadius: 5,
          borderAlpha: 0.7,
          glow: 0.5,
        }),
      },
      {
        id: "machined-black",
        label: "Machined black",
        blurb:
          "Brutalist instrument plate: bead-blasted black, engraved steel-blue legends, hard 1.25px rules.",
        tokens: {
          page: "#060606",
          panel: "#0d0f10",
          panelHead: "#111415",
          cell: "#171b1d",
          trace: "#0a0c0d",
          line: "#313a40",
          lineSoft: "#1c2226",
          ink: "#edf2f5",
          ink2: "#a9b4bb",
          ink3: "#6e7981",
          ink4: "#4b555c",
          accent: "#6fa8d0",
          accentDim: "#47708c",
          accentDark: "#0b1720",
          accentEdge: "#23485e",
          amber: "#c9932f",
          plate: "#0b0d0e",
          plateTop: "#14181a",
          plateBottom: "#090b0c",
          pad: "#171b1e",
          padBottom: "#0f1214",
          empty: "#0a0c0d",
          micTop: "#2b6f96",
          micBottom: "#1a4a64",
        },
        material: mat({
          texture: "brushed",
          grain: 0.85,
          sheen: 0.22,
          bevel: 0.3,
          plateGrad: 0.5,
          radius: 3,
          bayRadius: 3,
          chipRadius: 2,
          hairline: 1.25,
          borderAlpha: 1,
          glow: 0.05,
          identTrack: 0.06,
        }),
      },
      {
        id: "phosphor-crt",
        label: "Phosphor CRT",
        blurb:
          "Retro-future: scanlined tube face, cyan phosphor bloom, typewriter legends burnt into the glass.",
        tokens: {
          page: "#01060a",
          panel: "#04121a",
          panelHead: "#061821",
          cell: "#08202b",
          trace: "#020d13",
          line: "#12485c",
          lineSoft: "#0a2833",
          ink: "#d6fbff",
          ink2: "#8fd6e4",
          ink3: "#4e93a4",
          ink4: "#2e5f6e",
          accent: "#4fd7ff",
          accentDim: "#2b94b8",
          accentDark: "#032430",
          accentEdge: "#0f5670",
          amber: "#ffc46b",
          plate: "#031017",
          plateTop: "#072029",
          plateBottom: "#020b10",
          pad: "#08202b",
          padBottom: "#041219",
          empty: "#020d13",
          micTop: "#2199c4",
          micBottom: "#0e5f7e",
        },
        material: mat({
          texture: "scanline",
          grain: 0.9,
          sheen: 0.3,
          bevel: 0.2,
          plateGrad: 0.8,
          radius: 6,
          bayRadius: 4,
          chipRadius: 3,
          borderAlpha: 0.85,
          glow: 1.15,
          fontMono: "typewriter",
          fontCaption: "typewriter",
          identTrack: 0.05,
        }),
      },
    ],
  },
  {
    id: "ceramic",
    name: "Ceramic",
    scheme: "light",
    thesis:
      "Fired clay — a warm glazed body with a terracotta signal; daylight console, gloss only on the plate.",
    presets: [
      {
        id: "fired-glaze",
        label: "Fired glaze",
        blurb:
          "Cream glaze over warm bisque. Soft top gloss, terracotta lamp, hairlines the colour of unfired edge.",
        tokens: {
          page: "#e3dacc",
          panel: "#f7f3eb",
          panelHead: "#fcf8f1",
          cell: "#fffdf8",
          trace: "#f0e9dc",
          line: "#d3c6ae",
          lineSoft: "#e6ddcb",
          ink: "#191410",
          ink2: "#3d352a",
          ink3: "#6e6455",
          ink4: "#9a8e7a",
          accent: "#b5421c",
          accentDim: "#c9764f",
          accentDark: "#f8e9da",
          accentEdge: "#e7cfae",
          amber: "#b57b1b",
          plate: "#f2ede3",
          plateTop: "#fdfbf6",
          plateBottom: "#e9e2d5",
          pad: "#fffdf8",
          padBottom: "#efe9dd",
          empty: "#ede6d8",
          micTop: "#b5421c",
          micBottom: "#8f3a1c",
        },
        material: mat({
          texture: "glass",
          grain: 0.14,
          sheen: 0.8,
          bevel: 0.5,
          plateGrad: 1,
          radius: 12,
          bayRadius: 8,
          chipRadius: 6,
          borderAlpha: 0.9,
          glow: 0.28,
        }),
      },
      {
        id: "kraft-press",
        label: "Kraft press",
        blurb:
          "Industrial paper stock. Ink-stamped legends, fibre tooth, no gloss anywhere — a press proof, not a screen.",
        tokens: {
          page: "#dcd3c2",
          panel: "#f2ecdf",
          panelHead: "#f6f1e5",
          cell: "#faf6ec",
          trace: "#eae2d1",
          line: "#c6b99f",
          lineSoft: "#ded4c0",
          ink: "#221d16",
          ink2: "#453c2e",
          ink3: "#6e6250",
          ink4: "#9c8f79",
          accent: "#a8341b",
          accentDim: "#c06a4e",
          accentDark: "#f4e4d6",
          accentEdge: "#dcc3a3",
          amber: "#8c6516",
          plate: "#ede6d6",
          plateTop: "#f4eee1",
          plateBottom: "#e4dbc8",
          pad: "#f7f2e6",
          padBottom: "#e9e1cf",
          empty: "#e6ddca",
          micTop: "#a8341b",
          micBottom: "#7d2814",
        },
        material: mat({
          texture: "paper",
          grain: 1,
          sheen: 0,
          bevel: 0,
          plateGrad: 0.3,
          radius: 3,
          bayRadius: 2,
          chipRadius: 2,
          borderAlpha: 1,
          glow: 0,
          fontMono: "typewriter",
          fontCaption: "typewriter",
          identTrack: 0.05,
        }),
      },
      {
        id: "enamel-steel",
        label: "Enamel steel",
        blurb:
          "Vitreous enamel on pressed steel. Hard specular, saturated orange-red, cool white body — a kitchen instrument.",
        tokens: {
          page: "#dde0dc",
          panel: "#fafbf9",
          panelHead: "#fffffe",
          cell: "#ffffff",
          trace: "#f0f2ee",
          line: "#c8cec6",
          lineSoft: "#e2e6e0",
          ink: "#131711",
          ink2: "#3a4136",
          ink3: "#6b7266",
          ink4: "#9aa096",
          accent: "#d6431a",
          accentDim: "#e4784f",
          accentDark: "#fde7dc",
          accentEdge: "#f3bfa6",
          amber: "#c58a12",
          plate: "#f4f6f2",
          plateTop: "#ffffff",
          plateBottom: "#e8ece5",
          pad: "#ffffff",
          padBottom: "#eff2ec",
          empty: "#e9ece7",
          micTop: "#d6431a",
          micBottom: "#a33212",
        },
        material: mat({
          texture: "glass",
          grain: 0.05,
          sheen: 1,
          bevel: 0.6,
          plateGrad: 1.15,
          radius: 14,
          bayRadius: 10,
          chipRadius: 7,
          borderAlpha: 0.7,
          glow: 0.3,
          fontCaption: "grotesk",
        }),
      },
    ],
  },
  {
    id: "porcelain",
    name: "Porcelain",
    scheme: "light",
    thesis:
      "Unglazed bisque as the default skin — tailored graphite type, slate-teal signal, no warmth borrowed from Ceramic.",
    presets: [
      {
        id: "bisque",
        label: "Bisque",
        blurb:
          "Matte unglazed porcelain. Almost no specular; the object is read through edge and shadow, not shine.",
        tokens: {
          page: "#eceae5",
          panel: "#fcfbf9",
          panelHead: "#f7f5f1",
          cell: "#ffffff",
          trace: "#f2f0eb",
          line: "#d3cfc7",
          lineSoft: "#e5e1d9",
          ink: "#1e2328",
          ink2: "#4c545c",
          ink3: "#757c83",
          ink4: "#a3a8ac",
          accent: "#245a74",
          accentDim: "#5a8396",
          accentDark: "#e6f0f4",
          accentEdge: "#b9d0d9",
          amber: "#9b6b22",
          plate: "#f4f4f2",
          plateTop: "#fdfdfc",
          plateBottom: "#eaeae7",
          pad: "#fcfcfb",
          padBottom: "#efefec",
          empty: "#ebebe8",
          micTop: "#2f6d85",
          micBottom: "#204d60",
        },
        material: mat({
          texture: "matte",
          grain: 0.25,
          sheen: 0.18,
          bevel: 0.25,
          plateGrad: 0.5,
          radius: 10,
          bayRadius: 6,
          chipRadius: 4,
          borderAlpha: 0.85,
          glow: 0.12,
        }),
      },
      {
        id: "frosted-glass",
        label: "Frosted glass",
        blurb:
          "Liquid glass in the light: milk-white refraction, big radii, borders half-dissolved, blue depth under the bay.",
        tokens: {
          page: "#e7ebee",
          panel: "#fafcfd",
          panelHead: "#f3f7fa",
          cell: "#ffffff",
          trace: "#eef3f6",
          line: "#cbd6dd",
          lineSoft: "#e1e9ee",
          ink: "#14202a",
          ink2: "#45545f",
          ink3: "#71818c",
          ink4: "#9fadb6",
          accent: "#1d7fa8",
          accentDim: "#5ca6c4",
          accentDark: "#e2f2f8",
          accentEdge: "#add6e6",
          amber: "#a0761f",
          plate: "#f2f7fa",
          plateTop: "#ffffff",
          plateBottom: "#e7eef3",
          pad: "#fbfdfe",
          padBottom: "#edf3f7",
          empty: "#e9eff3",
          micTop: "#1d7fa8",
          micBottom: "#145a78",
        },
        material: mat({
          texture: "glass",
          grain: 0.05,
          sheen: 1,
          bevel: 0.7,
          plateGrad: 1.2,
          radius: 20,
          bayRadius: 14,
          chipRadius: 10,
          borderAlpha: 0.5,
          glow: 0.45,
          fontCaption: "grotesk",
          typeScale: 1.02,
        }),
      },
      {
        id: "swiss-plate",
        label: "Swiss plate",
        blurb:
          "Brutalist white: square, black hairline rules, zero light modelling. The grid is the only ornament.",
        tokens: {
          page: "#e8e8e6",
          panel: "#ffffff",
          panelHead: "#ffffff",
          cell: "#ffffff",
          trace: "#f4f4f2",
          line: "#111111",
          lineSoft: "#c9c9c6",
          ink: "#000000",
          ink2: "#333333",
          ink3: "#6b6b6b",
          ink4: "#9a9a9a",
          accent: "#14486b",
          accentDim: "#4e7b96",
          accentDark: "#e7eff4",
          accentEdge: "#a9c4d2",
          amber: "#8a6410",
          plate: "#ffffff",
          plateTop: "#ffffff",
          plateBottom: "#f3f3f1",
          pad: "#ffffff",
          padBottom: "#f0f0ee",
          empty: "#f0f0ee",
          micTop: "#14486b",
          micBottom: "#0d3149",
        },
        material: mat({
          texture: "matte",
          grain: 0,
          sheen: 0,
          bevel: 0,
          plateGrad: 0.15,
          radius: 0,
          bayRadius: 0,
          chipRadius: 0,
          hairline: 1.5,
          borderAlpha: 1,
          glow: 0,
          typeScale: 0.96,
          identTrack: 0,
          fontMono: "grotesk",
          fontCaption: "grotesk",
          numeralWeight: 700,
        }),
      },
    ],
  },
  {
    id: "amber",
    name: "Amber",
    scheme: "dark",
    thesis:
      "Low-light studio — warm bakelite and oxide brown carrying a tube filament; the only theme where glow is structural.",
    presets: [
      {
        id: "vacuum-tube",
        label: "Vacuum tube",
        blurb:
          "Bakelite chassis with a filament behind the bay. Heat bloom on the ring; ink warmed like old paper labels.",
        tokens: {
          page: "#140f08",
          panel: "#1f1810",
          panelHead: "#262016",
          cell: "#2b2318",
          trace: "#1a140c",
          line: "#3f3223",
          lineSoft: "#2e2519",
          ink: "#f5ecda",
          ink2: "#dac9af",
          ink3: "#a19278",
          ink4: "#766b59",
          accent: "#e0673a",
          accentDim: "#b25a3a",
          accentDark: "#33200e",
          accentEdge: "#55341f",
          amber: "#e8ae44",
          plate: "#1c1509",
          plateTop: "#2e2416",
          plateBottom: "#191207",
          pad: "#2b2318",
          padBottom: "#1f1710",
          empty: "#1a140c",
          micTop: "#c2521f",
          micBottom: "#93391a",
        },
        material: mat({
          texture: "grain",
          grain: 0.35,
          sheen: 0.45,
          bevel: 0.6,
          plateGrad: 1,
          radius: 9,
          bayRadius: 6,
          chipRadius: 5,
          borderAlpha: 0.85,
          glow: 0.95,
        }),
      },
      {
        id: "ferric-tape",
        label: "Ferric tape",
        blurb:
          "Oxide-coated: matte ferric brown, visible particle tooth, transport chips stamped like a tape deck.",
        tokens: {
          page: "#17110a",
          panel: "#241a11",
          panelHead: "#2a2015",
          cell: "#302417",
          trace: "#1c150d",
          line: "#4a3823",
          lineSoft: "#34281a",
          ink: "#f2e6d2",
          ink2: "#d2be9f",
          ink3: "#99866a",
          ink4: "#6e6049",
          accent: "#d9822f",
          accentDim: "#a9662c",
          accentDark: "#33210e",
          accentEdge: "#5c3a1c",
          amber: "#e5b04c",
          plate: "#1f170e",
          plateTop: "#302518",
          plateBottom: "#1a130b",
          pad: "#2e2317",
          padBottom: "#221a10",
          empty: "#1c150d",
          micTop: "#b96b21",
          micBottom: "#8a4a15",
        },
        material: mat({
          texture: "grain",
          grain: 1,
          sheen: 0.1,
          bevel: 0.25,
          plateGrad: 0.55,
          radius: 4,
          bayRadius: 3,
          chipRadius: 2,
          hairline: 1.25,
          borderAlpha: 1,
          glow: 0.2,
          fontMono: "typewriter",
          fontCaption: "typewriter",
        }),
      },
      {
        id: "brass-walnut",
        label: "Brass & walnut",
        blurb:
          "Dark walnut body, brushed brass foot. The plate is metal and says so; the ledger stays timber-quiet.",
        tokens: {
          page: "#120c07",
          panel: "#23170e",
          panelHead: "#2c1e12",
          cell: "#2f2115",
          trace: "#180f08",
          line: "#6b4d28",
          lineSoft: "#3a2716",
          ink: "#f7eedc",
          ink2: "#dcc59d",
          ink3: "#a98f63",
          ink4: "#7a6444",
          accent: "#e9a93f",
          accentDim: "#b98429",
          accentDark: "#35240d",
          accentEdge: "#6b4d1c",
          amber: "#f0c463",
          plate: "#1c120a",
          plateTop: "#3a2a14",
          plateBottom: "#180f07",
          pad: "#2e2013",
          padBottom: "#1e140b",
          empty: "#180f08",
          micTop: "#c08428",
          micBottom: "#8a5c18",
        },
        material: mat({
          texture: "brushed",
          grain: 0.6,
          sheen: 0.7,
          bevel: 0.55,
          plateGrad: 1.35,
          radius: 8,
          bayRadius: 5,
          chipRadius: 4,
          borderAlpha: 0.9,
          glow: 0.5,
          fontCaption: "serif",
        }),
      },
    ],
  },
];

const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/* ------------------------------------------------------------- colour util */

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** #rrggbb → rgba(). Tolerates #rgb; anything else falls back to the input. */
function rgba(hex: string, alpha: number): string {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return hex;
  const n = parseInt(h, 16);
  const a = Math.round(clamp01(alpha) * 1000) / 1000;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/* --------------------------------------------------------------- lifecycle */

type Mode =
  | "ready"
  | "listening"
  | "transcribing"
  | "submitting"
  | "speaking"
  | "paused";

const MODES: { key: Mode; word: string; detail: string; tint: TokenKey }[] = [
  { key: "ready", word: "READY", detail: "LANE 01", tint: "ink2" },
  { key: "listening", word: "LISTENING", detail: "LANE 01", tint: "accent" },
  { key: "transcribing", word: "TRANSCRIBING", detail: "ON DEVICE", tint: "amber" },
  { key: "submitting", word: "SUBMITTING", detail: "MAC", tint: "amber" },
  { key: "speaking", word: "SPEAKING", detail: "LANE 01", tint: "accent" },
  { key: "paused", word: "PAUSED", detail: "LANE 01", tint: "ink3" },
];

const LEDGER: { role: "you" | "agent"; text: string }[] = [
  { role: "agent", text: "Loud and clear. One, two, one, two." },
  { role: "you", text: "Okay." },
  { role: "agent", text: "All good." },
  { role: "you", text: "I'm still testing to see the difference." },
  { role: "agent", text: "I hear you, and I'll wait until you've finished speaking before responding." },
  { role: "you", text: "Thank you." },
  { role: "agent", text: "You're welcome." },
  {
    role: "you",
    text: "You're even able to hear me before how come you're able to hear me before I'm done.",
  },
];

const CAPTION =
  "Loud and clear. The full message arrived without interruption.";

/* ------------------------------------------------------------------ figure */

/** Speech-shaped envelope: phrase humps with breaths, quantised for SSR. */
function speechEnvelope(count: number, seed = 11) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const phrase = Math.sin(t * Math.PI * 3.2);
    const formant =
      Math.abs(Math.sin(t * 47)) * 0.35 + Math.abs(Math.sin(t * 19)) * 0.25;
    const breath = phrase > 0.12 ? 1 : 0.06;
    const attack = t < 0.04 ? t / 0.04 : t > 0.94 ? (1 - t) / 0.06 : 1;
    return (
      Math.round(
        Math.min(
          1,
          Math.max(
            0.04,
            (Math.abs(phrase) * 0.55 + formant) * breath * attack * (0.85 + rand() * 0.15),
          ),
        ) * 100,
      ) / 100
    );
  });
}

function clock(frac: number, dur = 4.2) {
  const s = Math.floor(frac * dur);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function px(n: number) {
  return Math.max(2, Math.round(n));
}

function op(n: number) {
  return Math.round(n * 100) / 100;
}

/* --------------------------------------------------------- material → CSS */

interface Skin {
  t: Tokens;
  m: Material;
  scheme: "dark" | "light";
}

/** White gloss on light bodies, ink gloss on dark ones. */
function sheenInk(skin: Skin) {
  return skin.scheme === "light" ? "#ffffff" : skin.t.ink;
}

/**
 * Texture is the whole point of this study — each material paints its own
 * overlay stack above the flat fill. Kept as pure CSS so it maps to a Swift
 * overlay later (or gets dropped for the flat token on device).
 */
function textureLayers(skin: Skin, scale = 1): string[] {
  const { m } = skin;
  const g = m.grain * scale;
  const s = m.sheen * scale;
  const gloss = sheenInk(skin);
  switch (m.texture) {
    case "glass":
      return [
        `radial-gradient(140% 100% at 8% -18%, ${rgba(gloss, 0.13 * s)}, transparent 58%)`,
        `linear-gradient(158deg, ${rgba(gloss, 0.07 * s)} 0%, transparent 34%)`,
        `radial-gradient(90% 70% at 92% 108%, ${rgba(skin.t.accent, 0.05 * s)}, transparent 60%)`,
      ];
    case "scanline":
      return [
        `repeating-linear-gradient(0deg, ${rgba(gloss, 0.05 * g)} 0 1px, transparent 1px 3px)`,
        `radial-gradient(120% 90% at 50% -10%, ${rgba(skin.t.accent, 0.06 * s)}, transparent 62%)`,
      ];
    case "brushed":
      return [
        `repeating-linear-gradient(90deg, ${rgba(gloss, 0.028 * g)} 0 1px, ${rgba("#000000", 0.02 * g)} 1px 2px)`,
        `linear-gradient(180deg, ${rgba(gloss, 0.06 * s)}, transparent 38%)`,
      ];
    case "paper":
      return [
        `repeating-linear-gradient(45deg, ${rgba("#000000", 0.016 * g)} 0 2px, transparent 2px 4px)`,
        `repeating-linear-gradient(-45deg, ${rgba("#000000", 0.012 * g)} 0 3px, transparent 3px 6px)`,
      ];
    case "grain":
      return [
        `repeating-radial-gradient(circle at 0 0, ${rgba("#000000", 0.035 * g)} 0 1px, transparent 1px 3px)`,
        `repeating-radial-gradient(circle at 7px 5px, ${rgba(gloss, 0.02 * g)} 0 1px, transparent 1px 4px)`,
        `linear-gradient(180deg, ${rgba(gloss, 0.04 * s)}, transparent 45%)`,
      ];
    case "matte":
    default:
      return s > 0
        ? [`linear-gradient(180deg, ${rgba(gloss, 0.035 * s)}, transparent 30%)`]
        : [];
  }
}

/** Panel body: identity + ledger share one fill; no recessed card. */
function panelBackground(skin: Skin): string {
  return [...textureLayers(skin), `linear-gradient(${skin.t.panelHead}, ${skin.t.panel})`].join(
    ", ",
  );
}

/** Plate foot: different texture from the panel, gradient strength is a knob. */
function plateBackground(skin: Skin): string {
  const { t, m } = skin;
  const k = clamp01(m.plateGrad / 1.8);
  const top = rgba(t.plateTop, 1);
  const bottom = rgba(t.plateBottom, 1);
  const stop = 100 - Math.round(k * 55);
  return [
    ...textureLayers(skin, 1.15),
    `linear-gradient(180deg, ${top} 0%, ${bottom} ${stop}%)`,
  ].join(", ");
}

/** Inner bevel — top light, bottom shade. Reads as a machined edge. */
function bevelShadow(skin: Skin): string | undefined {
  const b = skin.m.bevel;
  if (b <= 0.01) return undefined;
  const gloss = sheenInk(skin);
  return [
    `inset 0 1px 0 ${rgba(gloss, 0.1 * b)}`,
    `inset 0 -1px 0 ${rgba("#000000", 0.28 * b)}`,
  ].join(", ");
}

/* ------------------------------------------------------------------- page */

const STORE_KEY = "se.micro.themes.opus.v2";

interface Draft {
  presetId: string;
  tokens: Tokens;
  material: Material;
}

type Drafts = Record<string, Draft>;

function defaultDraft(theme: ThemeDef): Draft {
  const p = theme.presets[0];
  return { presetId: p.id, tokens: { ...p.tokens }, material: { ...p.material } };
}

function defaultDrafts(): Drafts {
  return Object.fromEntries(THEMES.map((t) => [t.id, defaultDraft(t)]));
}

export function MicroThemesOpusStudyPage({ page }: { page: StudioAppPage }) {
  const [themeId, setThemeId] = useState("flight");
  const [drafts, setDrafts] = useState<Drafts>(() => defaultDrafts());
  const [mode, setMode] = useState<Mode>("speaking");
  const [pos, setPos] = useState(0.38);
  const [level, setLevel] = useState(0.62);
  const [volume, setVolume] = useState(0.8);
  const [speedIx, setSpeedIx] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [crisp, setCrisp] = useState(false);
  const [width, setWidth] = useState(430);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [openTokens, setOpenTokens] = useState(false);
  const [exported, setExported] = useState<"json" | "swift" | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<"A" | "B", Drafts | null>>({
    A: null,
    B: null,
  });

  const theme = THEME_BY_ID.get(themeId) ?? THEMES[0];
  const draft = drafts[themeId] ?? defaultDraft(theme);

  /* Restore after mount — never during render, or SSR and client disagree. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { drafts?: Drafts; slots?: typeof slots };
      if (saved.drafts) {
        setDrafts((cur) => {
          const next = { ...cur };
          for (const t of THEMES) {
            const d = saved.drafts?.[t.id];
            if (!d?.tokens || !d?.material) continue;
            next[t.id] = {
              presetId: d.presetId ?? t.presets[0].id,
              tokens: { ...next[t.id].tokens, ...d.tokens },
              material: { ...next[t.id].material, ...d.material },
            };
          }
          return next;
        });
      }
      if (saved.slots) setSlots({ A: saved.slots.A ?? null, B: saved.slots.B ?? null });
    } catch {
      /* corrupt store — fall back to designed defaults */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ drafts, slots }));
    } catch {
      /* quota / private mode — the page still works, just not sticky */
    }
  }, [drafts, slots, hydrated]);

  const phase = useAnimationPhase(animate, 1.65);
  const livePhase = hydrated ? phase : 0;
  const env = useMemo(() => speechEnvelope(96), []);
  const meta = MODES.find((m) => m.key === mode) ?? MODES[0];

  // Derive live pos/level from phase — never write them back via useEffect
  // (that + RAF setPhase was causing "Maximum update depth exceeded").
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

  const setToken = useCallback(
    (key: TokenKey, value: string) => {
      setDrafts((cur) => ({
        ...cur,
        [themeId]: { ...cur[themeId], tokens: { ...cur[themeId].tokens, [key]: value } },
      }));
    },
    [themeId],
  );

  const setMat = useCallback(
    <K extends keyof Material>(key: K, value: Material[K]) => {
      setDrafts((cur) => ({
        ...cur,
        [themeId]: { ...cur[themeId], material: { ...cur[themeId].material, [key]: value } },
      }));
    },
    [themeId],
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      const p = theme.presets.find((x) => x.id === presetId) ?? theme.presets[0];
      setDrafts((cur) => ({
        ...cur,
        [themeId]: { presetId: p.id, tokens: { ...p.tokens }, material: { ...p.material } },
      }));
    },
    [theme, themeId],
  );

  const reset = useCallback(() => applyPreset(draft.presetId), [applyPreset, draft.presetId]);

  /* "Crisp only" is a render-time override — it never eats the saved values. */
  const skin: Skin = useMemo(() => {
    const m = crisp
      ? { ...draft.material, sheen: 0, bevel: 0, glow: 0, grain: 0, plateGrad: Math.min(draft.material.plateGrad, 0.2) }
      : draft.material;
    return { t: draft.tokens, m, scheme: theme.scheme };
  }, [draft, crisp, theme.scheme]);

  const compareTheme = compareId ? THEME_BY_ID.get(compareId) : null;
  const compareSkin: Skin | null = useMemo(() => {
    if (!compareTheme) return null;
    const d = drafts[compareTheme.id];
    const m = crisp
      ? { ...d.material, sheen: 0, bevel: 0, glow: 0, grain: 0, plateGrad: Math.min(d.material.plateGrad, 0.2) }
      : d.material;
    return { t: d.tokens, m, scheme: compareTheme.scheme };
  }, [compareTheme, drafts, crisp]);

  const jsonOut = useMemo(() => exportJSON(theme, draft), [theme, draft]);
  const swiftOut = useMemo(() => exportSwift(theme, draft), [theme, draft]);

  const copy = useCallback((label: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1400);
  }, []);

  const messages =
    mode === "ready"
      ? []
      : mode === "listening" || mode === "transcribing"
        ? LEDGER.slice(0, 5)
        : LEDGER;

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />

      <section className="max-w-[1240px] space-y-12 py-8">
        {/* Thesis */}
        <div>
          <h2 className="mb-2 text-[15px] font-medium text-studio-ink-strong">
            Five materials, one chassis
          </h2>
          <p className="mb-5 max-w-[72ch] text-[13.5px] leading-relaxed text-studio-ink">
            Full Micro Deck — hand column (lanes + pad + hold-to-speak) and eye
            column (ledger + player foot). Geometry is frozen on the ledger rail
            (50pt gutter, text at 76). Themes move material: color, texture,
            lighting, chrome. If two read as the same object with a different hue,
            the study failed.
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className="rounded-lg border border-studio-rule p-3 text-left transition hover:border-studio-ink-faint"
                style={{
                  borderColor: t.id === themeId ? t.presets[0].tokens.accent : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: t.presets[0].tokens.accent }}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-studio-ink-strong">
                    {t.name}
                  </span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-studio-ink-faint">
                    {t.scheme}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-studio-ink-faint">
                  {t.thesis}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Playground */}
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">
            Playground
          </h2>
          <p className="mb-4 max-w-[72ch] text-[13px] leading-relaxed text-studio-ink-faint">
            Pick a theme, pick a material direction, then take it apart. Every knob
            is live and sticky per theme; <em>Reset</em> restores the designed
            defaults for the active preset.
          </p>

          <div className="grid gap-6 xl:grid-cols-[auto_1fr]">
            {/* Mock */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className="rounded px-2.5 py-1 font-mono text-[9.5px] font-medium tracking-wide transition"
                    style={{
                      background: m.key === mode ? skin.t.pad : "transparent",
                      color: m.key === mode ? skin.t[m.tint] : undefined,
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor:
                        m.key === mode ? rgba(skin.t[m.tint], 0.5) : "var(--studio-rule, #333)",
                    }}
                  >
                    <span className={m.key === mode ? "" : "text-studio-ink-faint"}>
                      {m.word}
                    </span>
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <div className="flex flex-wrap items-start gap-6">
                  <MicroDeckFullMock
                    tokens={skin.t}
                    mode={mode}
                    handWidth={Math.round(width * 0.82)}
                    consoleWidth={width}
                    height={Math.max(520, Math.round(560 * (draft.material.spacing || 1)))}
                  >
                    <MicroColumn
                      skin={skin}
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
                      height="100%"
                      onSeek={(v) => {
                        setAnimate(false);
                        setPos(v);
                      }}
                      onVolume={setVolume}
                      onCycleSpeed={() => setSpeedIx((i) => (i + 1) % 4)}
                      onToggleAuto={() => setAutoplay((a) => !a)}
                      onTogglePlay={() =>
                        setMode((m) =>
                          m === "speaking" ? "paused" : m === "paused" ? "speaking" : m,
                        )
                      }
                    />
                  </MicroDeckFullMock>
                  {compareSkin && compareTheme ? (
                    <div>
                      <MicroDeckFullMock
                        tokens={compareSkin.t}
                        mode={mode}
                        handWidth={Math.round(width * 0.82)}
                        consoleWidth={width}
                        height={Math.max(520, Math.round(560 * (drafts[compareTheme.id]?.material.spacing || 1)))}
                      >
                        <MicroColumn
                          skin={compareSkin}
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
                          height="100%"
                        />
                      </MicroDeckFullMock>
                      <div
                        className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.16em]"
                        style={{ color: compareSkin.t.ink4 }}
                      >
                        {compareTheme.name} · {drafts[compareTheme.id].presetId}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Knob rack — sliders pick up the active accent so the rack reads
                as part of the object being tuned */}
            <div
              className="min-w-0 space-y-4"
              style={{ accentColor: draft.tokens.accent }}
            >
              <Rack title="Theme">
                <div className="flex flex-wrap gap-1.5">
                  {THEMES.map((t) => (
                    <Pill
                      key={t.id}
                      active={t.id === themeId}
                      tint={t.presets[0].tokens.accent}
                      onClick={() => setThemeId(t.id)}
                    >
                      {t.name}
                    </Pill>
                  ))}
                </div>
              </Rack>

              <Rack title={`Material · ${theme.name}`}>
                <div className="flex flex-wrap gap-1.5">
                  {theme.presets.map((p) => (
                    <Pill
                      key={p.id}
                      active={p.id === draft.presetId}
                      tint={p.tokens.accent}
                      onClick={() => applyPreset(p.id)}
                    >
                      {p.label}
                    </Pill>
                  ))}
                </div>
                <p className="mt-2 max-w-[70ch] text-[12px] leading-snug text-studio-ink-faint">
                  {theme.presets.find((p) => p.id === draft.presetId)?.blurb}
                </p>
              </Rack>

              <Rack title="Surface">
                <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  <Select
                    label="Texture"
                    value={draft.material.texture}
                    options={["matte", "glass", "brushed", "scanline", "paper", "grain"]}
                    onChange={(v) => setMat("texture", v as Texture)}
                  />
                  <Knob
                    label="Grain"
                    value={draft.material.grain}
                    min={0}
                    max={1.2}
                    step={0.02}
                    onChange={(v) => setMat("grain", v)}
                  />
                  <Knob
                    label="Sheen"
                    value={draft.material.sheen}
                    min={0}
                    max={1.2}
                    step={0.02}
                    onChange={(v) => setMat("sheen", v)}
                  />
                  <Knob
                    label="Bevel"
                    value={draft.material.bevel}
                    min={0}
                    max={1}
                    step={0.02}
                    onChange={(v) => setMat("bevel", v)}
                  />
                  <Knob
                    label="Plate gradient"
                    value={draft.material.plateGrad}
                    min={0}
                    max={1.8}
                    step={0.05}
                    onChange={(v) => setMat("plateGrad", v)}
                  />
                  <Knob
                    label="Live glow"
                    value={draft.material.glow}
                    min={0}
                    max={1.5}
                    step={0.05}
                    onChange={(v) => setMat("glow", v)}
                  />
                </div>
              </Rack>

              <Rack title="Chrome">
                <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  <Knob
                    label="Corner radius"
                    value={draft.material.radius}
                    min={0}
                    max={26}
                    step={1}
                    onChange={(v) => setMat("radius", v)}
                    unit="pt"
                  />
                  <Knob
                    label="Bay radius"
                    value={draft.material.bayRadius}
                    min={0}
                    max={18}
                    step={1}
                    onChange={(v) => setMat("bayRadius", v)}
                    unit="pt"
                  />
                  <Knob
                    label="Chip radius"
                    value={draft.material.chipRadius}
                    min={0}
                    max={14}
                    step={1}
                    onChange={(v) => setMat("chipRadius", v)}
                    unit="pt"
                  />
                  <Knob
                    label="Border strength"
                    value={draft.material.borderAlpha}
                    min={0.15}
                    max={1.4}
                    step={0.05}
                    onChange={(v) => setMat("borderAlpha", v)}
                  />
                  <Knob
                    label="Hairline weight"
                    value={draft.material.hairline}
                    min={0.5}
                    max={2.5}
                    step={0.25}
                    onChange={(v) => setMat("hairline", v)}
                    unit="px"
                  />
                </div>
              </Rack>

              <Rack title="Type & rail">
                <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  <Select
                    label="Mono face"
                    value={draft.material.fontMono}
                    options={["mono", "typewriter", "grotesk", "serif"]}
                    onChange={(v) => setMat("fontMono", v as FontKey)}
                  />
                  <Select
                    label="Caption face"
                    value={draft.material.fontCaption}
                    options={["mono", "typewriter", "grotesk", "serif"]}
                    onChange={(v) => setMat("fontCaption", v as FontKey)}
                  />
                  <Knob
                    label="Type scale"
                    value={draft.material.typeScale}
                    min={0.85}
                    max={1.3}
                    step={0.01}
                    onChange={(v) => setMat("typeScale", v)}
                    unit="×"
                  />
                  <Knob
                    label="Ident tracking"
                    value={draft.material.identTrack}
                    min={0}
                    max={0.2}
                    step={0.01}
                    onChange={(v) => setMat("identTrack", v)}
                    unit="em"
                  />
                  <Knob
                    label="Gutter"
                    value={draft.material.gutter}
                    min={34}
                    max={74}
                    step={1}
                    onChange={(v) => setMat("gutter", v)}
                    unit="pt"
                  />
                  <Knob
                    label="Spacing scale"
                    value={draft.material.spacing}
                    min={0.75}
                    max={1.5}
                    step={0.05}
                    onChange={(v) => setMat("spacing", v)}
                    unit="×"
                  />
                  <Knob
                    label="Player height"
                    value={draft.material.lockU ? PLAYER_2U : draft.material.playerH}
                    min={120}
                    max={230}
                    step={2}
                    disabled={draft.material.lockU}
                    onChange={(v) => setMat("playerH", v)}
                    unit="pt"
                  />
                  <div className="flex items-center gap-2 py-1.5">
                    <Toggle
                      on={draft.material.lockU}
                      onClick={() => setMat("lockU", !draft.material.lockU)}
                    >
                      2U lock ({PLAYER_2U}pt)
                    </Toggle>
                  </div>
                </div>
                <div className="mt-2 font-mono text-[10px] text-studio-ink-faint">
                  text rail = 14 + {Math.round(draft.material.gutter)} + 12 ={" "}
                  <span className="text-studio-ink">
                    {Math.round(draft.material.gutter) + 26}
                  </span>
                </div>
              </Rack>

              <Rack title="Stage">
                <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                  <Knob
                    label="Column width"
                    value={width}
                    min={340}
                    max={560}
                    step={2}
                    onChange={setWidth}
                    unit="pt"
                  />
                  <Knob
                    label="Scrub position"
                    value={pos}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => {
                      setAnimate(false);
                      setPos(v);
                    }}
                  />
                  <Knob
                    label="Volume"
                    value={volume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={setVolume}
                  />
                  <Knob
                    label="Input level"
                    value={level}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={setLevel}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Toggle on={animate} onClick={() => setAnimate((a) => !a)}>
                    {animate ? "Animating" : "Frozen"}
                  </Toggle>
                  <Toggle on={crisp} onClick={() => setCrisp((c) => !c)}>
                    Crisp only
                  </Toggle>
                  <Toggle on={autoplay} onClick={() => setAutoplay((a) => !a)}>
                    Autoplay
                  </Toggle>
                  <Toggle on={compareId !== null} onClick={() => setCompareId(null)}>
                    Compare off
                  </Toggle>
                  {THEMES.filter((t) => t.id !== themeId).map((t) => (
                    <Toggle
                      key={t.id}
                      on={compareId === t.id}
                      onClick={() => setCompareId(compareId === t.id ? null : t.id)}
                    >
                      vs {t.name}
                    </Toggle>
                  ))}
                </div>
              </Rack>

              <Rack
                title="Tokens"
                aside={
                  <button
                    type="button"
                    onClick={() => setOpenTokens((o) => !o)}
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-studio-ink-faint hover:text-studio-ink"
                  >
                    {openTokens ? "Collapse" : "Expand"}
                  </button>
                }
              >
                {openTokens ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {TOKEN_GROUPS.map((g) => (
                      <div key={g.title}>
                        <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-studio-ink-faint">
                          {g.title}
                        </div>
                        {g.keys.map((k) => (
                          <ColorRow
                            key={k}
                            name={k}
                            value={draft.tokens[k]}
                            onChange={(v) => setToken(k, v)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {TOKEN_KEYS.map((k) => (
                      <span
                        key={k}
                        title={`${k} ${draft.tokens[k]}`}
                        className="h-5 w-5 rounded-[3px]"
                        style={{
                          background: draft.tokens[k],
                          border: "1px solid rgba(128,128,128,0.35)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </Rack>

              <Rack title="Snapshots & reset">
                <div className="flex flex-wrap gap-1.5">
                  {(["A", "B"] as const).map((slot) => (
                    <span key={slot} className="flex gap-1.5">
                      <Toggle on={false} onClick={() => setSlots((s) => ({ ...s, [slot]: drafts }))}>
                        Save {slot}
                      </Toggle>
                      <Toggle
                        on={false}
                        disabled={!slots[slot]}
                        onClick={() => {
                          const snap = slots[slot];
                          if (snap) setDrafts(snap);
                        }}
                      >
                        Load {slot}
                      </Toggle>
                    </span>
                  ))}
                  <Toggle on={false} onClick={reset}>
                    Reset {theme.name}
                  </Toggle>
                  <Toggle on={false} onClick={() => setDrafts(defaultDrafts())}>
                    Reset all
                  </Toggle>
                </div>
              </Rack>
            </div>
          </div>
        </div>

        {/* Strip */}
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">
            Five objects, same column
          </h2>
          <p className="mb-4 max-w-[72ch] text-[13px] leading-relaxed text-studio-ink-faint">
            Each at its current preset, same lifecycle state. The rail, the 2U foot
            and the tape clock line up across all five — only the material moves.
          </p>
          <div className="flex flex-wrap gap-4">
            {THEMES.map((t) => {
              const d = drafts[t.id];
              const s: Skin = {
                t: d.tokens,
                m: crisp
                  ? { ...d.material, sheen: 0, bevel: 0, glow: 0, grain: 0, plateGrad: 0.2 }
                  : d.material,
                scheme: t.scheme,
              };
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className="rounded-lg p-3 text-left"
                  style={{
                    background: d.tokens.page,
                    border: `1px solid ${t.id === themeId ? d.tokens.accent : rgba(d.tokens.line, 0.6)}`,
                  }}
                >
                  <div style={{ width: 320 }}>
                    <MicroColumn
                      skin={s}
                      mode={mode === "listening" ? "ready" : mode}
                      meta={meta}
                      messages={messages.slice(0, 4)}
                      pos={0.38}
                      level={0.55}
                      volume={volume}
                      speedIx={speedIx}
                      autoplay={autoplay}
                      env={env}
                      phase={0.35}
                      height={430}
                    />
                  </div>
                  <div
                    className="mt-2 flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-[0.16em]"
                    style={{ color: d.tokens.ink3 }}
                  >
                    <span style={{ color: d.tokens.ink2 }}>{t.name}</span>
                    <span style={{ color: d.tokens.ink4 }}>{d.presetId}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Export */}
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">Export</h2>
          <p className="mb-4 max-w-[72ch] text-[13px] leading-relaxed text-studio-ink-faint">
            JSON uses the <code>DeckThemePalette</code> field names verbatim, plus a{" "}
            <code>material</code> block for the parts Swift does not model yet.
            Swift emits the exact initialiser argument order from{" "}
            <code>DeckTheme.swift</code> — paste it over the matching case.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Toggle on={exported === "json"} onClick={() => setExported(exported === "json" ? null : "json")}>
              JSON
            </Toggle>
            <Toggle on={exported === "swift"} onClick={() => setExported(exported === "swift" ? null : "swift")}>
              Swift
            </Toggle>
            <Toggle on={false} onClick={() => copy("json", jsonOut)}>
              Copy JSON
            </Toggle>
            <Toggle on={false} onClick={() => copy("swift", swiftOut)}>
              Copy Swift
            </Toggle>
            {copied ? (
              <span className="self-center font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">
                copied {copied}
              </span>
            ) : null}
          </div>
          {exported ? (
            <pre
              className="max-h-[460px] overflow-auto rounded-lg p-4 font-mono text-[11px] leading-relaxed"
              style={{
                background: skin.t.page,
                border: `1px solid ${rgba(skin.t.line, 0.6)}`,
                color: skin.t.ink2,
              }}
            >
              {exported === "json" ? jsonOut : swiftOut}
            </pre>
          ) : null}
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------- micro column */

function MicroColumn({
  skin,
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
  height,
  onSeek,
  onVolume,
  onCycleSpeed,
  onToggleAuto,
  onTogglePlay,
}: {
  skin: Skin;
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
  height: number | string;
  onSeek?: (v: number) => void;
  onVolume?: (v: number) => void;
  onCycleSpeed?: () => void;
  onToggleAuto?: () => void;
  onTogglePlay?: () => void;
}) {
  const { t, m } = skin;
  const live = mode === "listening" || mode === "speaking";
  const tint = t[meta.tint];
  const gutter = Math.round(m.gutter);
  const gap = 12;
  const edge = 14;
  const rail = gutter + gap;
  const pad = (n: number) => Math.round(n * m.spacing);
  const fs = (n: number) => Math.round(n * m.typeScale * 100) / 100;
  const mono = FONTS[m.fontMono];

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        borderRadius: m.radius,
        background: panelBackground(skin),
        border: `1px solid ${live ? rgba(tint, 0.35 + m.glow * 0.3) : rgba(t.line, m.borderAlpha)}`,
        boxShadow: live && m.glow > 0.02
          ? `0 0 ${Math.round(m.glow * 26)}px ${rgba(tint, m.glow * 0.16)}`
          : bevelShadow(skin),
        height,
        fontFamily: mono,
      }}
    >
      {/* IDENTITY — panel head of the same surface */}
      <div
        className="flex items-start"
        style={{
          gap,
          paddingLeft: edge,
          paddingRight: edge,
          paddingTop: pad(12),
          paddingBottom: pad(10),
          borderBottom: `${m.hairline}px solid ${rgba(t.lineSoft, m.borderAlpha)}`,
        }}
      >
        <div
          className="tabular-nums leading-none"
          style={{
            width: gutter,
            fontSize: fs(28),
            fontWeight: m.numeralWeight,
            color: t.accent,
            letterSpacing: `${m.identTrack}em`,
            textShadow:
              m.glow > 0.4 ? `0 0 ${Math.round(m.glow * 10)}px ${rgba(t.accent, 0.4)}` : undefined,
          }}
        >
          01
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate font-semibold"
              style={{
                fontSize: fs(11),
                color: t.ink,
                letterSpacing: `${m.identTrack + 0.02}em`,
              }}
            >
              USETALKIE.COM
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: tint,
                  boxShadow: live && m.glow > 0.02 ? `0 0 ${4 + m.glow * 6}px ${tint}` : undefined,
                }}
              />
              <span
                className="font-bold"
                style={{ fontSize: fs(7), letterSpacing: "0.14em", color: tint }}
              >
                {meta.word === "READY" ? "ACTIVE LANE" : meta.word}
              </span>
            </span>
          </div>
          <div
            className="mt-1 flex gap-2"
            style={{ fontSize: fs(7.5), color: t.ink3 }}
          >
            <span>main</span>
            <span style={{ color: t.ink4 }}>6B306A13</span>
          </div>
        </div>
      </div>

      {/* LEDGER — same fill as identity; role in gutter, body on the text rail */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className="h-full overflow-hidden"
          style={{
            paddingLeft: edge,
            paddingRight: edge,
            paddingTop: pad(10),
            paddingBottom: pad(10),
          }}
        >
          {messages.length === 0 ? (
            <p
              style={{
                paddingLeft: rail,
                fontSize: fs(9),
                lineHeight: 1.65,
                color: t.ink3,
              }}
            >
              Check unmerged checkout changes
            </p>
          ) : (
            <div style={{ display: "grid", rowGap: pad(8) }}>
              {messages.map((msg, i) => (
                <div key={i} className="flex items-start" style={{ gap }}>
                  <div
                    className="shrink-0 font-bold"
                    style={{
                      width: gutter,
                      fontSize: fs(6.5),
                      letterSpacing: "0.09em",
                      color: t.ink4,
                      paddingTop: 2,
                    }}
                  >
                    {msg.role === "you" ? "YOU" : "AGENT"}
                  </div>
                  <p
                    className="min-w-0 flex-1"
                    style={{
                      fontSize: fs(9),
                      lineHeight: 1.45,
                      color: msg.role === "agent" ? t.ink2 : t.ink3,
                    }}
                  >
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PLAYER FOOT — plate texture, hairline seam, no second card */}
      <PlayerFoot
        skin={skin}
        // Strip / compare mocks are display-only: render the transport as plain
        // elements so a card can wrap them without nesting interactive nodes.
        frozen={!onTogglePlay}
        mode={mode}
        meta={meta}
        pos={pos}
        level={level}
        volume={volume}
        speedIx={speedIx}
        autoplay={autoplay}
        env={env}
        phase={phase}
        onSeek={onSeek}
        onVolume={onVolume}
        onCycleSpeed={onCycleSpeed}
        onToggleAuto={onToggleAuto}
        onTogglePlay={onTogglePlay}
      />
    </div>
  );
}

function PlayerFoot({
  skin,
  mode,
  meta,
  pos,
  level,
  volume,
  speedIx,
  autoplay,
  env,
  phase,
  frozen,
  onSeek,
  onVolume,
  onCycleSpeed,
  onToggleAuto,
  onTogglePlay,
}: {
  skin: Skin;
  mode: Mode;
  meta: (typeof MODES)[number];
  pos: number;
  level: number;
  volume: number;
  speedIx: number;
  autoplay: boolean;
  env: number[];
  phase: number;
  frozen?: boolean;
  onSeek?: (v: number) => void;
  onVolume?: (v: number) => void;
  onCycleSpeed?: () => void;
  onToggleAuto?: () => void;
  onTogglePlay?: () => void;
}) {
  const { t, m } = skin;
  const narrating = mode === "speaking" || mode === "paused";
  const live = mode === "listening";
  const working = mode === "transcribing" || mode === "submitting";
  const tint = t[meta.tint];
  const gutter = Math.round(m.gutter);
  const gap = 12;
  const edge = 14;
  const ring = Math.min(gutter, 48);
  const bandH = 48;
  const headInset = gutter + gap;
  const height = m.lockU ? PLAYER_2U : Math.round(m.playerH);
  const fs = (n: number) => Math.round(n * m.typeScale * 100) / 100;
  const restLabel = mode === "ready" ? "READY" : mode === "paused" ? "AT REST" : "NO AUDIO";
  const seekable = narrating || mode === "ready";

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height,
        background: plateBackground(skin),
        borderTop: `${m.hairline}px solid ${
          live || mode === "speaking" ? rgba(tint, 0.5) : rgba(t.lineSoft, m.borderAlpha)
        }`,
        boxShadow: bevelShadow(skin),
        paddingTop: 10,
        paddingBottom: 9,
        paddingLeft: edge,
        paddingRight: edge,
        boxSizing: "border-box",
      }}
    >
      {/* Head — TURN · status + caption, indented to the text rail */}
      <div style={{ paddingLeft: headInset }}>
        <div
          className="flex items-center gap-1.5"
          style={{
            height: 12,
            fontSize: fs(9.5),
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: mode === "ready" ? t.ink2 : tint,
          }}
        >
          <span>TURN 14</span>
          <span style={{ color: t.ink4, opacity: 0.65 }}>·</span>
          <span>{meta.word}</span>
          {mode === "speaking" ? (
            <span
              className="inline-block h-1 w-1 shrink-0 rounded-full"
              style={{
                background: t.accent,
                boxShadow: m.glow > 0.02 ? `0 0 ${3 + m.glow * 5}px ${t.accent}` : undefined,
              }}
            />
          ) : null}
        </div>
        <div
          className="truncate"
          style={{
            marginTop: 2,
            height: 20,
            fontSize: fs(12),
            lineHeight: 1.35,
            color: t.ink,
            fontFamily: FONTS[m.fontCaption],
          }}
        >
          {narrating || mode === "ready"
            ? CAPTION
            : live
              ? "Listening…"
              : working
                ? "Working…"
                : ""}
        </div>
      </div>

      <div style={{ flex: "1 1 8px", minHeight: 6 }} />

      {/* Transport band — ring in the gutter, bay same height */}
      <div>
        <div className="flex items-center" style={{ gap }}>
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: gutter, height: bandH }}
          >
            <Press
              frozen={frozen}
              onClick={onTogglePlay}
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: ring,
                height: ring,
                background: `linear-gradient(180deg, ${t.pad}, ${t.padBottom})`,
                border: `2px solid ${rgba(t.line, m.borderAlpha)}`,
                color: narrating || mode === "ready" ? t.accent : t.ink3,
                boxShadow:
                  narrating && m.glow > 0.02
                    ? `0 0 ${Math.round(m.glow * 16)}px ${rgba(t.accent, m.glow * 0.3)}, ${bevelShadow(skin) ?? "none"}`
                    : bevelShadow(skin),
              }}
            >
              {narrating ? (
                <span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    border: `2px solid ${tint}`,
                    clipPath: `inset(0 ${100 - pos * 100}% 0 0)`,
                    opacity: 0.9,
                  }}
                />
              ) : null}
              <span style={{ fontSize: ring * 0.3, position: "relative" }}>
                {mode === "speaking" ? "❚❚" : "▶"}
              </span>
            </Press>
          </div>

          <div
            className="relative min-w-0 flex-1"
            style={{
              height: bandH,
              borderRadius: m.bayRadius,
              background: t.trace,
              border: `1px solid ${rgba(t.line, m.borderAlpha)}`,
              boxShadow: `inset 0 1px 3px ${rgba("#000000", 0.25 + m.bevel * 0.25)}`,
              cursor: seekable && onSeek ? "pointer" : "default",
              overflow: "hidden",
            }}
            onClick={(e) => {
              if (!onSeek || !seekable) return;
              const r = e.currentTarget.getBoundingClientRect();
              onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
            }}
          >
            <div className="absolute inset-0 px-2 py-1.5">
              {mode === "ready" ? (
                <RestField skin={skin} label="READY" silhouette />
              ) : (
                <RadioFigure
                  skin={skin}
                  mode={mode}
                  env={env}
                  pos={pos}
                  level={level}
                  phase={phase}
                  tint={tint}
                  restLabel={restLabel}
                />
              )}
            </div>
            {narrating ? (
              <span
                className="pointer-events-none absolute top-1.5 bottom-1.5"
                style={{
                  left: `${Math.round(pos * 1000) / 10}%`,
                  width: 1.5,
                  borderRadius: 999,
                  background: mode === "paused" ? t.ink2 : tint,
                  boxShadow: m.glow > 0.02 ? `0 0 ${Math.round(m.glow * 8)}px ${tint}` : undefined,
                  transform: "translateX(-50%)",
                }}
              />
            ) : null}
          </div>
        </div>

        {/* Tape clock under the bay only */}
        {mode === "ready" || narrating ? (
          <div
            className="relative tabular-nums"
            style={{
              marginTop: 4,
              marginLeft: gutter + gap,
              fontSize: fs(9),
              color: t.ink4,
            }}
          >
            <div className="flex justify-between">
              <span>0:00</span>
              <span>0:04</span>
            </div>
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ color: narrating ? t.ink2 : t.ink3 }}
            >
              {narrating ? clock(pos) : "0:00"}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ flex: "0 0 8px", minHeight: 4, maxHeight: 10 }} />

      {/* Chips on the floor of the plate */}
      <div className="flex items-center gap-1.5" style={{ height: 22 }}>
        <Press frozen={frozen} onClick={onCycleSpeed} className="appearance-none">
          <Chip skin={skin}>
            <span style={{ fontSize: fs(10), color: t.ink3 }}>
              {["1.00×", "1.25×", "1.50×", "0.75×"][speedIx]}
            </span>
          </Chip>
        </Press>
        <Chip skin={skin}>
          <span style={{ fontSize: fs(10), color: t.ink4, opacity: 0.6 }}>VOL</span>
          <span
            className="ml-1.5 inline-block h-[3px] w-[26px] rounded-full"
            style={{ background: rgba(t.line, m.borderAlpha) }}
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
              style={{ width: `${Math.round(volume * 100)}%`, background: t.ink3 }}
            />
          </span>
        </Chip>
        <div className="flex-1" />
        <Press
          frozen={frozen}
          onClick={onToggleAuto}
          style={{
            borderRadius: m.chipRadius,
            padding: "1px 8px",
            fontSize: fs(9.5),
            fontWeight: 600,
            letterSpacing: "0.04em",
            background: autoplay ? rgba(t.amber, 0.12) : `linear-gradient(180deg, ${t.pad}, ${t.padBottom})`,
            border: `1px solid ${autoplay ? rgba(t.amber, 0.5) : rgba(t.line, m.borderAlpha)}`,
            color: autoplay ? t.amber : t.ink4,
          }}
        >
          {autoplay ? "AUTOPLAY ON" : "AUTOPLAY OFF"}
        </Press>
      </div>
    </div>
  );
}

/**
 * Transport affordance. Renders as a plain box when the mock is display-only —
 * the strip wraps whole columns in a card button, and nested interactive nodes
 * are invalid HTML.
 */
function Press({
  frozen,
  onClick,
  className,
  style,
  children,
}: {
  frozen?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (frozen) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  );
}

function Chip({ skin, children }: { skin: Skin; children: React.ReactNode }) {
  const { t, m } = skin;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5"
      style={{
        borderRadius: m.chipRadius,
        background: `linear-gradient(180deg, ${t.pad}, ${t.padBottom})`,
        border: `1px solid ${rgba(t.line, m.borderAlpha)}`,
        boxShadow: bevelShadow(skin),
      }}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ figures */

function RadioFigure({
  skin,
  mode,
  env,
  pos,
  level,
  phase,
  tint,
  restLabel,
}: {
  skin: Skin;
  mode: Mode;
  env: number[];
  pos: number;
  level: number;
  phase: number;
  tint: string;
  restLabel: string;
}) {
  switch (mode) {
    case "speaking":
    case "paused":
      return (
        <PlaybackWave
          skin={skin}
          env={env}
          pos={pos}
          tint={mode === "paused" ? skin.t.ink3 : skin.t.accent}
        />
      );
    case "listening":
      return <CaptureWave skin={skin} level={level} phase={phase} />;
    case "transcribing":
    case "submitting":
      return (
        <ActivityField
          skin={skin}
          tint={tint}
          phase={phase}
          kind={mode === "transcribing" ? "sweep" : "pulse"}
        />
      );
    default:
      return <RestField skin={skin} label={restLabel} />;
  }
}

/**
 * One meter stroke. Radius follows the material so a brutalist plate gets
 * square posts and a glass slab gets rounded strokes.
 */
function Bar({
  skin,
  height,
  color,
  opacity,
}: {
  skin: Skin;
  height: number;
  color: string;
  opacity: number;
}) {
  const r = skin.m.radius > 12 ? 2 : skin.m.radius < 3 ? 0 : 1;
  return (
    <div className="flex flex-1 items-center justify-center" style={{ height: "100%", minWidth: 0 }}>
      <div
        style={{
          width: "85%",
          maxWidth: 2,
          height,
          borderRadius: r,
          background: color,
          opacity: op(opacity),
        }}
      />
    </div>
  );
}

function PlaybackWave({
  skin,
  env,
  pos,
  tint,
}: {
  skin: Skin;
  env: number[];
  pos: number;
  tint: string;
}) {
  const n = env.length;
  const head = Math.min(n - 1, Math.floor(pos * n));
  return (
    <div className="relative flex h-full w-full items-center">
      <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
        {env.map((v, i) => {
          const played = i <= head;
          return (
            <Bar
              key={i}
              skin={skin}
              height={px(v * 28)}
              color={played ? tint : skin.t.line}
              opacity={played ? 0.95 : 0.3}
            />
          );
        })}
      </div>
    </div>
  );
}

function CaptureWave({ skin, level, phase }: { skin: Skin; level: number; phase: number }) {
  const bars = 88;
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
        <Bar
          key={i}
          skin={skin}
          height={bar.h}
          color={skin.t.accent}
          opacity={bar.hot ? 0.92 : 0.14}
        />
      ))}
    </div>
  );
}

function ActivityField({
  skin,
  tint,
  phase,
  kind,
}: {
  skin: Skin;
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
              skin={skin}
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
            skin={skin}
            height={px(3 + lobe * 24)}
            color={tint}
            opacity={op(0.18 + lobe * 0.78)}
          />
        );
      })}
    </div>
  );
}

function RestField({
  skin,
  label = "AT REST",
  silhouette = false,
}: {
  skin: Skin;
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
                skin={skin}
                height={px(2 + v * 22)}
                color={skin.t.line}
                opacity={op(0.28 + v * 0.22)}
              />
            );
          })}
        </div>
      ) : (
        <div className="mx-1 h-px w-full" style={{ background: skin.t.lineSoft }} />
      )}
      <span
        className="pointer-events-none absolute font-semibold"
        style={{
          fontSize: 8,
          letterSpacing: "0.14em",
          color: skin.t.ink4,
          background: skin.t.empty,
          padding: "2px 8px",
          borderRadius: Math.max(2, skin.m.chipRadius),
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- knob chrome */

function Rack({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-studio-rule p-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-studio-ink-faint">
          {title}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Pill({
  active,
  tint,
  onClick,
  children,
}: {
  active: boolean;
  tint: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-2.5 py-1 text-[11px] font-medium transition"
      style={{
        border: `1px solid ${active ? tint : "var(--studio-rule, #3a3a3a)"}`,
        background: active ? rgba(tint, 0.14) : "transparent",
        color: active ? tint : undefined,
      }}
    >
      <span className={active ? "" : "text-studio-ink-faint"}>{children}</span>
    </button>
  );
}

function Toggle({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-40"
      style={{
        border: "1px solid var(--studio-rule, #3a3a3a)",
        background: on ? "rgba(120,180,160,0.16)" : "transparent",
      }}
    >
      <span className={on ? "text-studio-ink-strong" : "text-studio-ink-faint"}>
        {children}
      </span>
    </button>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1 text-[11px] text-studio-ink-faint">
      <span className="w-[104px] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 disabled:opacity-40"
      />
      <span className="w-[54px] shrink-0 text-right font-mono tabular-nums">
        {step < 1 ? value.toFixed(2) : Math.round(value)}
        {unit ?? ""}
      </span>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1 text-[11px] text-studio-ink-faint">
      <span className="w-[104px] shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded border border-studio-rule bg-transparent px-1.5 py-1 font-mono text-[10px] text-studio-ink"
      >
        {options.map((o) => (
          <option key={o} value={o} style={{ color: "#111" }}>
            {o}
          </option>
        ))}
      </select>
      <span className="w-[54px] shrink-0" />
    </label>
  );
}

function ColorRow({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  // Sync only when the prop actually changes — never echo the same string
  // (avoids update loops when parent re-renders for unrelated reasons).
  useEffect(() => {
    setText((prev) => (prev === value ? prev : value));
  }, [value]);
  const safeColor = HEX_RE.test(value) ? value.toLowerCase() : "#000000";
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <input
        type="color"
        value={safeColor}
        onChange={(e) => {
          const next = e.target.value.toLowerCase();
          if (next !== value.toLowerCase()) onChange(next);
        }}
        className="h-5 w-5 shrink-0 cursor-pointer rounded border border-studio-rule bg-transparent p-0"
        aria-label={name}
      />
      <span className="w-[76px] shrink-0 font-mono text-[10px] text-studio-ink-faint">
        {name}
      </span>
      <input
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          if (HEX_RE.test(raw)) {
            const next = raw.toLowerCase();
            if (next !== value.toLowerCase()) onChange(next);
          }
        }}
        spellCheck={false}
        className="min-w-0 flex-1 rounded border border-studio-rule bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-studio-ink"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ export */

function exportJSON(theme: ThemeDef, draft: Draft): string {
  const palette: Record<string, string> = {};
  for (const k of TOKEN_KEYS) palette[k] = draft.tokens[k];
  return JSON.stringify(
    {
      id: theme.id,
      name: theme.name,
      scheme: theme.scheme,
      preset: draft.presetId,
      palette,
      material: draft.material,
    },
    null,
    2,
  );
}

function exportSwift(theme: ThemeDef, draft: Draft): string {
  const hex = (k: TokenKey) =>
    `0x${(draft.tokens[k] ?? "#000000").replace("#", "").toUpperCase()}`;
  const rows = [
    ["page", "panel", "panelHead", "cell"],
    ["trace", "line", "lineSoft"],
    ["ink", "ink2", "ink3", "ink4"],
    ["accent", "accentDim", "accentDark", "accentEdge"],
    ["amber", "plate", "plateTop", "plateBottom"],
    ["pad", "padBottom", "empty"],
    ["micTop", "micBottom"],
  ] as TokenKey[][];
  const body = rows
    .map((row) => `    ${row.map((k) => `${k}: ${hex(k)}`).join(", ")}`)
    .join(",\n");
  return [
    `// ${theme.name} — ${draft.presetId}`,
    `case .${theme.id}:`,
    `    DeckThemePalette(`,
    body.replace(/^ {4}/gm, "        "),
    `    )`,
  ].join("\n");
}

/* --------------------------------------------------------------- animation */

/**
 * Wall-clock phase. We never call setState every rAF with a new phase value —
 * that re-rendered the whole study tree and, under React 19 + Turbopack,
 * surfaced as "Maximum update depth exceeded". Instead we tick a cheap counter
 * on an interval and derive phase from performance.now() during render.
 */
function useAnimationPhase(running: boolean, speed: number) {
  const originRef = useRef<number | null>(null);
  const [, setBeat] = useState(0);

  useEffect(() => {
    if (!running) {
      originRef.current = null;
      return;
    }
    originRef.current = performance.now();
    // ~12 fps is enough for the mock figures; keeps the tree calm.
    const id = window.setInterval(() => setBeat((n) => (n + 1) % 1_000_000), 80);
    return () => window.clearInterval(id);
  }, [running, speed]);

  if (!running || originRef.current == null) return 0;
  const elapsed = (performance.now() - originRef.current) / 1000;
  return (elapsed * 0.28 * speed) % 1;
}
