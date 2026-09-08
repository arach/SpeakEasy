"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PageHeader } from "@/studio/PageHeader";
import { MicroDeckFullMock } from "@/studio/MicroDeckFullMock";
import type { StudioAppPage } from "@/studio/studioRegistry";

/**
 * Micro themes · Kimi — material studies for the Micro Deck lane column.
 *
 * Same ledger geometry as LaneConsoleStudy (50pt gutter, text rail at 76,
 * fused player foot, tape clock under bay, chips on floor). What changes is
 * the material each theme is made of: brushed anodized graphite (flight),
 * phosphor terminal glass (obsidian), kiln-fired stoneware (ceramic),
 * glazed porcelain (porcelain), bakelite + vacuum tube (amber). Every token
 * is editable, material presets re-seed, export matches DeckThemePalette.
 */

// ---------------------------------------------------------------------------
// Tokens — exact DeckThemePalette field names (deck/ipad/Sources/DeckTheme.swift)
// ---------------------------------------------------------------------------

const TOKEN_KEYS = [
  "page", "panel", "panelHead", "cell", "trace", "line", "lineSoft",
  "ink", "ink2", "ink3", "ink4",
  "accent", "accentDim", "accentDark", "accentEdge", "amber",
  "plate", "plateTop", "plateBottom",
  "pad", "padBottom", "empty", "micTop", "micBottom",
] as const;

type TokenKey = (typeof TOKEN_KEYS)[number];
type Palette = Record<TokenKey, string>;

const TOKEN_GROUPS: { label: string; keys: TokenKey[] }[] = [
  { label: "Chassis", keys: ["page", "panel", "panelHead", "cell", "trace", "line", "lineSoft"] },
  { label: "Ink", keys: ["ink", "ink2", "ink3", "ink4"] },
  { label: "Signal", keys: ["accent", "accentDim", "accentDark", "accentEdge", "amber"] },
  { label: "Plate", keys: ["plate", "plateTop", "plateBottom"] },
  { label: "Pad", keys: ["pad", "padBottom", "empty"] },
  { label: "Mic", keys: ["micTop", "micBottom"] },
];

// ---------------------------------------------------------------------------
// Material skin — texture + lighting descriptor layered over the token set
// ---------------------------------------------------------------------------

type TextureKind = "none" | "brushed" | "carbon" | "scanlines" | "glaze" | "grain";

interface Skin {
  name: string;
  blurb: string;
  chassisTex: TextureKind;
  plateTex: TextureKind;
  bayTex: TextureKind;
  /** Top-light sheen 0..1 (gloss). */
  sheen: number;
  /** Rim highlight strength 0..1. */
  rim: number;
  /** Texture visibility 0..1. */
  tex: number;
  /** Translucent refractive surface. */
  glass: boolean;
}

interface Preset {
  id: string;
  name: string;
  skin: Skin;
  tokens: Palette;
}

type ThemeId = "flight" | "obsidian" | "ceramic" | "porcelain" | "amber";

interface ThemeDef {
  id: ThemeId;
  name: string;
  thesis: string;
  scheme: "dark" | "light";
  presets: Preset[];
}

// ---------------------------------------------------------------------------
// Palettes — seeded from DeckTheme.swift, re-voiced per material preset
// ---------------------------------------------------------------------------

const SKIN = {
  anodized: { name: "Anodized graphite", blurb: "Brushed vertical grain, machined top light, mint LED only where live.", chassisTex: "brushed", plateTex: "brushed", bayTex: "none", sheen: 0.45, rim: 0.4, tex: 0.8, glass: false } as Skin,
  carbon: { name: "Carbon weave", blurb: "Cross-laid composite chassis, dead-matte plate, tight mint trace.", chassisTex: "carbon", plateTex: "carbon", bayTex: "none", sheen: 0.15, rim: 0.25, tex: 0.9, glass: false } as Skin,
  glassMint: { name: "Liquid glass mint", blurb: "Refractive smoked glass over the void, mint signal glowing through.", chassisTex: "glaze", plateTex: "glaze", bayTex: "none", sheen: 1, rim: 0.85, tex: 0.7, glass: true } as Skin,
  phosphor: { name: "Phosphor terminal", blurb: "CRT bench console — scanline bay, cool blue phosphor, amber standby lamp.", chassisTex: "none", plateTex: "scanlines", bayTex: "scanlines", sheen: 0.3, rim: 0.3, tex: 0.75, glass: false } as Skin,
  labSteel: { name: "Lab steel", blurb: "Bead-blasted instrument steel, engraved hairlines, chilled blue readouts.", chassisTex: "brushed", plateTex: "brushed", bayTex: "none", sheen: 0.6, rim: 0.55, tex: 0.55, glass: false } as Skin,
  glassCobalt: { name: "Liquid glass cobalt", blurb: "Deep cobalt glass laminate, signal suspended inside the pane.", chassisTex: "glaze", plateTex: "glaze", bayTex: "none", sheen: 1, rim: 0.9, tex: 0.7, glass: true } as Skin,
  stoneware: { name: "Kiln stoneware", blurb: "Fired clay body, mineral grain, iron-oxide stamp for signal.", chassisTex: "grain", plateTex: "grain", bayTex: "none", sheen: 0.2, rim: 0.2, tex: 0.8, glass: false } as Skin,
  terracotta: { name: "Terracotta glaze", blurb: "Deeper clay dip with a glossy fired rim and warm oxide accent.", chassisTex: "glaze", plateTex: "glaze", bayTex: "none", sheen: 0.7, rim: 0.45, tex: 0.6, glass: false } as Skin,
  bonePaper: { name: "Bone laminate", blurb: "Matte paper-laminate console, printed hairlines, flat daylight.", chassisTex: "none", plateTex: "none", bayTex: "none", sheen: 0.05, rim: 0.1, tex: 0, glass: false } as Skin,
  glossPorcelain: { name: "Gloss porcelain", blurb: "High-fire white glaze, refractive top light, celadon ink signal.", chassisTex: "glaze", plateTex: "glaze", bayTex: "none", sheen: 0.95, rim: 0.6, tex: 0.65, glass: false } as Skin,
  celadon: { name: "Celadon glaze", blurb: "Green-grey celadon wash over white, pooled glaze in the wells.", chassisTex: "glaze", plateTex: "glaze", bayTex: "none", sheen: 0.8, rim: 0.5, tex: 0.7, glass: false } as Skin,
  bisque: { name: "Bisque matte", blurb: "Unfired matte porcelain, chalky grain, graphite pencil hairlines.", chassisTex: "grain", plateTex: "grain", bayTex: "none", sheen: 0.1, rim: 0.15, tex: 0.6, glass: false } as Skin,
  bakelite: { name: "Bakelite tube amp", blurb: "Phenolic bakelite chassis, tube-glow signal, brass-lit hairlines.", chassisTex: "grain", plateTex: "grain", bayTex: "none", sheen: 0.3, rim: 0.35, tex: 0.85, glass: false } as Skin,
  brass: { name: "Brass instrument", blurb: "Lacquered brass plate, horizontal brushing, hot filament accent.", chassisTex: "brushed", plateTex: "brushed", bayTex: "none", sheen: 0.65, rim: 0.6, tex: 0.7, glass: false } as Skin,
  smokedGlass: { name: "Smoked glass", blurb: "Amber smoked glass over tube light, signal burning underneath.", chassisTex: "glaze", plateTex: "glaze", bayTex: "none", sheen: 1, rim: 0.8, tex: 0.65, glass: true } as Skin,
};

const THEMES: ThemeDef[] = [
  {
    id: "flight",
    name: "Flight",
    thesis: "Machined anodized graphite — brushed metal chassis, mint phosphor only where the circuit is live.",
    scheme: "dark",
    presets: [
      {
        id: "anodized", name: "Anodized graphite", skin: SKIN.anodized,
        tokens: {
          page: "#07090C", panel: "#10161B", panelHead: "#141A20", cell: "#1A222A", trace: "#06080A",
          line: "#2A333C", lineSoft: "#1A2229",
          ink: "#F1F4F6", ink2: "#A8B2BB", ink3: "#6A7580", ink4: "#4A5460",
          accent: "#5EE9C2", accentDim: "#3AB894", accentDark: "#0A1F1A", accentEdge: "#1C4F42", amber: "#E0A83F",
          plate: "#0A0E12", plateTop: "#141A20", plateBottom: "#0A0E12",
          pad: "#1A222A", padBottom: "#0F1419", empty: "#06080A", micTop: "#14A07A", micBottom: "#0A6B50",
        },
      },
      {
        id: "carbon", name: "Carbon weave", skin: SKIN.carbon,
        tokens: {
          page: "#050708", panel: "#0B0F12", panelHead: "#0F1418", cell: "#141B20", trace: "#040608",
          line: "#232C33", lineSoft: "#151C21",
          ink: "#EDF2F2", ink2: "#9AA8AC", ink3: "#5E6C72", ink4: "#414D52",
          accent: "#6FF5C8", accentDim: "#3DB18C", accentDark: "#08201A", accentEdge: "#17493C", amber: "#DDA63E",
          plate: "#080B0D", plateTop: "#10151A", plateBottom: "#07090B",
          pad: "#141B20", padBottom: "#0C1014", empty: "#040608", micTop: "#12A077", micBottom: "#09604A",
        },
      },
      {
        id: "glass-mint", name: "Liquid glass mint", skin: SKIN.glassMint,
        tokens: {
          page: "#04070A", panel: "#12201E", panelHead: "#182825", cell: "#1C2E2B", trace: "#060D0C",
          line: "#2E423E", lineSoft: "#1D2C29",
          ink: "#F0FAF7", ink2: "#A9C4BC", ink3: "#647F78", ink4: "#445A54",
          accent: "#7DF5D4", accentDim: "#45C4A2", accentDark: "#0C2620", accentEdge: "#1F5748", amber: "#E8B252",
          plate: "#0A1312", plateTop: "#16231F", plateBottom: "#080F0E",
          pad: "#1C2E2B", padBottom: "#101B19", empty: "#060D0C", micTop: "#18AC82", micBottom: "#0C6E54",
        },
      },
    ],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    thesis: "Retro-future phosphor terminal — scanline bay, cool blue CRT signal, engraved lab-steel hairlines.",
    scheme: "dark",
    presets: [
      {
        id: "phosphor", name: "Phosphor terminal", skin: SKIN.phosphor,
        tokens: {
          page: "#030405", panel: "#090B0D", panelHead: "#0D1013", cell: "#11151A", trace: "#07090B",
          line: "#252C33", lineSoft: "#181E24",
          ink: "#F1F4F6", ink2: "#B6C0C9", ink3: "#77838E", ink4: "#4D5862",
          accent: "#79B8FF", accentDim: "#4B82B8", accentDark: "#091A2A", accentEdge: "#244968", amber: "#E8B85D",
          plate: "#07090B", plateTop: "#11151A", plateBottom: "#06080A",
          pad: "#14191F", padBottom: "#0D1116", empty: "#080B0E", micTop: "#256FA8", micBottom: "#184A72",
        },
      },
      {
        id: "lab-steel", name: "Lab steel", skin: SKIN.labSteel,
        tokens: {
          page: "#05070A", panel: "#0E1218", panelHead: "#131923", cell: "#18202B", trace: "#080B10",
          line: "#2B3542", lineSoft: "#1B232E",
          ink: "#EFF3F8", ink2: "#ADB9C6", ink3: "#6E7C8C", ink4: "#4A5666",
          accent: "#86BDFC", accentDim: "#5488BE", accentDark: "#0B1D30", accentEdge: "#295075", amber: "#E2B055",
          plate: "#0A0E13", plateTop: "#151C26", plateBottom: "#090C10",
          pad: "#18202B", padBottom: "#0F151D", empty: "#080B10", micTop: "#2C78B5", micBottom: "#1B507A",
        },
      },
      {
        id: "glass-cobalt", name: "Liquid glass cobalt", skin: SKIN.glassCobalt,
        tokens: {
          page: "#02050A", panel: "#0C1622", panelHead: "#12202E", cell: "#16273A", trace: "#060C14",
          line: "#2A3E55", lineSoft: "#1A283A",
          ink: "#EDF4FC", ink2: "#A8BED6", ink3: "#647C96", ink4: "#41546A",
          accent: "#8FC4FF", accentDim: "#5A8FC8", accentDark: "#0D2136", accentEdge: "#2B567E", amber: "#EFBE62",
          plate: "#08101A", plateTop: "#14233A", plateBottom: "#070D15",
          pad: "#16273A", padBottom: "#0D1826", empty: "#060C14", micTop: "#3280C4", micBottom: "#1F5688",
        },
      },
    ],
  },
  {
    id: "ceramic",
    name: "Ceramic",
    thesis: "Kiln-fired stoneware — warm clay body with mineral grain, iron-oxide stamp as the live signal.",
    scheme: "light",
    presets: [
      {
        id: "stoneware", name: "Kiln stoneware", skin: SKIN.stoneware,
        tokens: {
          page: "#E4DDD0", panel: "#F5F1EA", panelHead: "#FAF6EE", cell: "#FFFDF8", trace: "#F4EEE2",
          line: "#D9CFB9", lineSoft: "#E2DAC7",
          ink: "#1A1612", ink2: "#3B342B", ink3: "#6B6356", ink4: "#968B79",
          accent: "#B5421C", accentDim: "#C9764F", accentDark: "#F7E9D6", accentEdge: "#E8D2B1", amber: "#B57B1B",
          plate: "#EFEEE9", plateTop: "#FAF9F5", plateBottom: "#E8E7E2",
          pad: "#FFFDF8", padBottom: "#EFEEE9", empty: "#E7E6E1", micTop: "#B5421C", micBottom: "#8F3A1C",
        },
      },
      {
        id: "terracotta", name: "Terracotta glaze", skin: SKIN.terracotta,
        tokens: {
          page: "#DFCFBA", panel: "#F3E8D7", panelHead: "#F9F0E2", cell: "#FEFAF1", trace: "#F1E4CF",
          line: "#D6C3A4", lineSoft: "#E2D2B8",
          ink: "#221510", ink2: "#4A342A", ink3: "#776154", ink4: "#A08B7A",
          accent: "#A63A18", accentDim: "#C46340", accentDark: "#F6E2CE", accentEdge: "#E4C6A2", amber: "#AC7114",
          plate: "#EDE3D3", plateTop: "#FAF2E4", plateBottom: "#E3D7C4",
          pad: "#FEFAF1", padBottom: "#EDE3D3", empty: "#E6DAC8", micTop: "#A63A18", micBottom: "#7E2E14",
        },
      },
      {
        id: "bone", name: "Bone laminate", skin: SKIN.bonePaper,
        tokens: {
          page: "#E9E4D8", panel: "#F7F3EA", panelHead: "#FBF8F0", cell: "#FFFEFB", trace: "#F5F0E4",
          line: "#CFC5B0", lineSoft: "#DFD8C6",
          ink: "#201C16", ink2: "#453F34", ink3: "#736C5E", ink4: "#9E957F",
          accent: "#8C4A1E", accentDim: "#B07A50", accentDark: "#F4E9D8", accentEdge: "#E0D0B4", amber: "#9A7018",
          plate: "#F0EBE0", plateTop: "#FAF6EC", plateBottom: "#E8E2D4",
          pad: "#FFFEFB", padBottom: "#F0EBE0", empty: "#EBE5D8", micTop: "#8C4A1E", micBottom: "#6C3A18",
        },
      },
    ],
  },
  {
    id: "porcelain",
    name: "Porcelain",
    thesis: "High-fire gloss glaze — refractive top light on white, celadon-teal signal pooled in the wells.",
    scheme: "light",
    presets: [
      {
        id: "gloss", name: "Gloss porcelain", skin: SKIN.glossPorcelain,
        tokens: {
          page: "#EEECE7", panel: "#FCFBF8", panelHead: "#F6F3ED", cell: "#FFFFFF", trace: "#F3F0E9",
          line: "#D5D0C7", lineSoft: "#E3DED5",
          ink: "#1E2328", ink2: "#4D555D", ink3: "#747C83", ink4: "#A0A5A8",
          accent: "#245A74", accentDim: "#5A8396", accentDark: "#E4EEF2", accentEdge: "#B8CFD8", amber: "#9B6B22",
          plate: "#F2F3F3", plateTop: "#FFFFFF", plateBottom: "#E6E8E8",
          pad: "#FBFCFC", padBottom: "#EDEFEF", empty: "#E5E7E7", micTop: "#2F6D85", micBottom: "#204D60",
        },
      },
      {
        id: "celadon", name: "Celadon glaze", skin: SKIN.celadon,
        tokens: {
          page: "#E4E9E2", panel: "#F6F9F4", panelHead: "#FBFCF8", cell: "#FFFFFF", trace: "#EEF3EA",
          line: "#C6D2C4", lineSoft: "#D8E0D4",
          ink: "#18201C", ink2: "#3E4C46", ink3: "#6B7A72", ink4: "#97A49A",
          accent: "#1F5C50", accentDim: "#548A7E", accentDark: "#DEEDE8", accentEdge: "#AECCC2", amber: "#8F6A1E",
          plate: "#EDF2EC", plateTop: "#FBFDF9", plateBottom: "#E0E8DE",
          pad: "#F8FBF6", padBottom: "#E7EEE4", empty: "#E2EAE0", micTop: "#276B5C", micBottom: "#1A4A40",
        },
      },
      {
        id: "bisque", name: "Bisque matte", skin: SKIN.bisque,
        tokens: {
          page: "#ECE9E2", panel: "#F8F6F1", panelHead: "#FCFAF5", cell: "#FFFEFC", trace: "#F4F1EA",
          line: "#D4CFC4", lineSoft: "#E2DED4",
          ink: "#23262B", ink2: "#4E545A", ink3: "#787E84", ink4: "#A4A8AB",
          accent: "#3E6070", accentDim: "#6E8C99", accentDark: "#E6EDF0", accentEdge: "#BCCCD4", amber: "#96701F",
          plate: "#F1F0EC", plateTop: "#FAF9F5", plateBottom: "#E7E5E0",
          pad: "#FBFAF7", padBottom: "#EDEBE6", empty: "#E7E5E0", micTop: "#477084", micBottom: "#305364",
        },
      },
    ],
  },
  {
    id: "amber",
    name: "Amber",
    thesis: "Bakelite tube amp — phenolic brown chassis, vacuum-tube filament glow, brass-lit hairlines.",
    scheme: "dark",
    presets: [
      {
        id: "bakelite", name: "Bakelite tubes", skin: SKIN.bakelite,
        tokens: {
          page: "#171209", panel: "#211A12", panelHead: "#282017", cell: "#2B2218", trace: "#1E1710",
          line: "#3D3122", lineSoft: "#332A1E",
          ink: "#F3EAD9", ink2: "#D9C9B0", ink3: "#A1937A", ink4: "#776C5B",
          accent: "#E0673A", accentDim: "#B25A3A", accentDark: "#35220F", accentEdge: "#54331F", amber: "#E0A83F",
          plate: "#1E1710", plateTop: "#2E2417", plateBottom: "#251C12",
          pad: "#2B2218", padBottom: "#21180F", empty: "#1E1710", micTop: "#C2521F", micBottom: "#93391A",
        },
      },
      {
        id: "brass", name: "Brass instrument", skin: SKIN.brass,
        tokens: {
          page: "#120D05", panel: "#1D1609", panelHead: "#271E0E", cell: "#2E2412", trace: "#181104",
          line: "#57431F", lineSoft: "#3A2D15",
          ink: "#F6EEDC", ink2: "#DCCBA6", ink3: "#A08F6C", ink4: "#74663F",
          accent: "#E8863C", accentDim: "#B96A34", accentDark: "#3A2409", accentEdge: "#6B4420", amber: "#EDB84A",
          plate: "#1C1407", plateTop: "#2E2410", plateBottom: "#211809",
          pad: "#2E2412", padBottom: "#1E1608", empty: "#181104", micTop: "#D26A24", micBottom: "#9A4A16",
        },
      },
      {
        id: "smoked", name: "Smoked glass", skin: SKIN.smokedGlass,
        tokens: {
          page: "#0E0803", panel: "#201409", panelHead: "#2A1C0E", cell: "#332313", trace: "#160E06",
          line: "#4A3420", lineSoft: "#332413",
          ink: "#F8EEDD", ink2: "#DECBAC", ink3: "#A69273", ink4: "#75634C",
          accent: "#F07A44", accentDim: "#C05E38", accentDark: "#40240F", accentEdge: "#6B3E22", amber: "#F2B94E",
          plate: "#1B1108", plateTop: "#2E1F10", plateBottom: "#221508",
          pad: "#332313", padBottom: "#211508", empty: "#160E06", micTop: "#D8622A", micBottom: "#A04418",
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Color + texture helpers (deterministic — SSR safe)
// ---------------------------------------------------------------------------

function hexRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function hexA(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${Math.round(Math.min(1, Math.max(0, a)) * 100) / 100})`;
}

/** t = 0 → a, t = 1 → b. */
function mixHex(a: string, b: string, t: number): string {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const m = ca.map((v, i) => Math.round(v + (cb[i] - v) * Math.min(1, Math.max(0, t))));
  return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Texture layers for a surface. strength/sheen are 0..1, already knob-adjusted. */
function texImage(kind: TextureKind, scheme: "dark" | "light", s: number, sheen: number): string[] {
  if (kind === "none" || s <= 0) {
    if (sheen <= 0) return [];
    return [`linear-gradient(180deg, rgba(255,255,255,${r2(sheen * (scheme === "light" ? 0.5 : 0.07))}), rgba(255,255,255,0) 30%)`];
  }
  const light = scheme === "light";
  const hi = light ? 0.5 : 0.06; // highlight alpha unit
  const lo = light ? 0.08 : 0.3; // shadow alpha unit
  switch (kind) {
    case "brushed":
      return [
        `repeating-linear-gradient(90deg, rgba(255,255,255,${r2(hi * 0.5 * s)}) 0px, rgba(255,255,255,${r2(hi * 0.5 * s)}) 1px, transparent 1px, transparent 4px)`,
        `linear-gradient(180deg, rgba(255,255,255,${r2(hi * sheen)}), rgba(255,255,255,0) 26%, rgba(0,0,0,${r2(lo * 0.5 * sheen)}) 100%)`,
      ];
    case "carbon":
      return [
        `repeating-linear-gradient(45deg, rgba(0,0,0,${r2(lo * 0.7 * s)}) 0px, rgba(0,0,0,${r2(lo * 0.7 * s)}) 2px, transparent 2px, transparent 7px)`,
        `repeating-linear-gradient(-45deg, rgba(255,255,255,${r2(hi * 0.4 * s)}) 0px, rgba(255,255,255,${r2(hi * 0.4 * s)}) 2px, transparent 2px, transparent 7px)`,
        `linear-gradient(180deg, rgba(255,255,255,${r2(hi * sheen)}), rgba(255,255,255,0) 30%)`,
      ];
    case "scanlines":
      return [
        `repeating-linear-gradient(0deg, rgba(0,0,0,${r2(0.34 * s)}) 0px, rgba(0,0,0,${r2(0.34 * s)}) 1px, transparent 1px, transparent 3px)`,
        `linear-gradient(180deg, rgba(255,255,255,${r2(hi * sheen)}), rgba(255,255,255,0) 22%)`,
      ];
    case "glaze":
      return [
        `radial-gradient(150% 110% at 22% -12%, rgba(255,255,255,${r2((light ? 0.85 : 0.16) * sheen)}), rgba(255,255,255,0) 55%)`,
        `radial-gradient(130% 120% at 88% 112%, rgba(${light ? "120,100,80" : "0,0,0"},${r2(lo * sheen)}), rgba(0,0,0,0) 52%)`,
      ];
    case "grain":
      return [
        `radial-gradient(60% 45% at 30% 25%, rgba(255,255,255,${r2(hi * 0.7 * s)}), rgba(255,255,255,0) 70%)`,
        `radial-gradient(55% 60% at 75% 65%, rgba(0,0,0,${r2(lo * 0.4 * s)}), rgba(0,0,0,0) 70%)`,
        `radial-gradient(70% 50% at 55% 92%, rgba(${light ? "140,110,80" : "255,255,255"},${r2((light ? 0.08 : hi * 0.5) * s)}), rgba(0,0,0,0) 70%)`,
      ];
    default:
      return [];
  }
}

/** Integer px for stable SSR hydration. */
function px(n: number) {
  return Math.max(2, Math.round(n));
}

/** Two-decimal opacity — avoids 0.1800000001 vs "0.18" hydrate fights. */
function op(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Global tweak knobs
// ---------------------------------------------------------------------------

interface Knobs {
  /** Outer surface + figure bay + chips corner radius. */
  radius: number;
  /** Border strength / line opacity multiplier 0..1.5. */
  border: number;
  /** Plate gradient strength 0..1. */
  plateGrad: number;
  /** Hairline weight px 0.5..2. */
  hairline: number;
  /** Type scale 0.85..1.25. */
  typeScale: number;
  /** Gutter width — default 50 (rail contract). */
  gutter: number;
  /** Lock player height to exactly 2U (156). */
  lock2U: boolean;
  /** Player height override when unlocked. */
  playerH: number;
  /** Spacing scale 0.8..1.3. */
  spacing: number;
  /** Live accent glow 0..1 (0 = crisp only). */
  glow: number;
  /** Kill all soft light + texture. */
  crisp: boolean;
}

/** Quieter defaults — product maturity over workshop texture. */
const DEFAULT_KNOBS: Knobs = {
  radius: 10, border: 0.85, plateGrad: 0.5, hairline: 1, typeScale: 1,
  gutter: 50, lock2U: true, playerH: 156, spacing: 1, glow: 0.15, crisp: false,
};

/** One key-bank row — the pad grid unit. */
const U = 78;
const PLAYER_2U = U * 2; // exactly 2U when locked

// ---------------------------------------------------------------------------
// Resolved material — palette + skin + knobs baked into style fragments
// ---------------------------------------------------------------------------

interface Mat {
  p: Palette;
  scheme: "dark" | "light";
  knobs: Knobs;
  /** Outer chassis background. */
  chassis: CSSProperties;
  /** Identity head background. */
  head: CSSProperties;
  /** Player plate background. */
  plate: CSSProperties;
  /** Figure bay background. */
  bay: CSSProperties;
  /** Chip background. */
  chipBg: string;
  /** Hard line color (border-strength applied). */
  line: string;
  lineSoft: string;
  /** Inset rim light for machined surfaces. */
  rimShadow?: string;
  /** Live glow for a signal color; undefined when crisp/glow 0. */
  glow: (color: string, amt?: number) => string | undefined;
  /** Type scale. */
  ts: (v: number) => number;
  /** Spacing scale. */
  sp: (v: number) => number;
  /** Hairline px. */
  hair: number;
  /** Player height px (2U lock applied). */
  playerH: number;
  /** Gutter width px. */
  gutter: number;
}

function resolveMat(p: Palette, skin: Skin, scheme: "dark" | "light", k: Knobs): Mat {
  const glowAmt = k.crisp ? 0 : k.glow;
  const sheen = k.crisp ? 0 : skin.sheen;
  const texS = k.crisp ? 0 : skin.tex;
  const rim = k.crisp ? 0 : skin.rim;
  const light = scheme === "light";

  const line = hexA(p.line, Math.min(1, 0.35 + k.border * 0.65));
  const lineSoft = hexA(p.lineSoft, Math.min(1, 0.35 + k.border * 0.65));

  const panelTop = mixHex(p.panel, "#FFFFFF", light ? 0.5 * sheen : 0.05 + sheen * 0.04);
  const chassisLayers = [
    ...texImage(skin.chassisTex, scheme, texS, sheen),
    skin.glass
      ? `linear-gradient(180deg, ${hexA(panelTop, 0.82)}, ${hexA(p.panel, 0.74)})`
      : `linear-gradient(180deg, ${panelTop}, ${p.panel})`,
  ];
  const headLayers = [
    ...texImage("none", scheme, 0, sheen * 0.5),
    skin.glass
      ? `linear-gradient(180deg, ${hexA(p.panelHead, 0.7)}, ${hexA(p.panelHead, 0.45)})`
      : `linear-gradient(180deg, ${mixHex(p.panelHead, "#FFFFFF", light ? 0.4 * sheen : sheen * 0.05)}, ${hexA(p.panelHead, skin.glass ? 0.6 : 0)})`,
  ];
  const plateTop = mixHex(p.plate, p.plateTop, k.plateGrad);
  const plateBottom = mixHex(p.plate, p.plateBottom, k.plateGrad);
  const plateLayers = [
    ...texImage(skin.plateTex, scheme, texS, sheen),
    skin.glass
      ? `linear-gradient(180deg, ${hexA(plateTop, 0.8)}, ${hexA(plateBottom, 0.72)})`
      : `linear-gradient(180deg, ${plateTop}, ${plateBottom})`,
  ];
  const bayLayers = [
    ...texImage(skin.bayTex, scheme, texS, sheen * 0.6),
    skin.glass ? `linear-gradient(180deg, ${hexA(p.trace, 0.7)}, ${hexA(p.trace, 0.6)})` : `linear-gradient(180deg, ${p.trace}, ${p.trace})`,
  ];

  const rimAlpha = r2(rim * (light ? 0.65 : 0.14));
  const rimShadow = rimAlpha > 0 ? `inset 0 1px 0 rgba(255,255,255,${rimAlpha})` : undefined;

  return {
    p, scheme, knobs: k,
    chassis: { backgroundColor: skin.glass ? "transparent" : p.panel, backgroundImage: chassisLayers.join(", ") },
    head: { backgroundColor: skin.glass ? "transparent" : p.panelHead, backgroundImage: headLayers.join(", ") },
    plate: { backgroundColor: skin.glass ? "transparent" : p.plate, backgroundImage: plateLayers.join(", ") },
    bay: { backgroundColor: skin.glass ? "transparent" : p.trace, backgroundImage: bayLayers.join(", ") },
    chipBg: skin.glass ? hexA(p.pad, 0.65) : p.pad,
    line, lineSoft, rimShadow,
    glow: (color, amt = 1) => {
      const a = glowAmt * amt;
      if (a <= 0.01) return undefined;
      return `0 0 ${Math.round(10 * a)}px ${hexA(color, r2(0.5 * a))}`;
    },
    ts: (v) => Math.round(v * k.typeScale * 100) / 100,
    sp: (v) => Math.round(v * k.spacing * 10) / 10,
    hair: Math.round(k.hairline * 10) / 10,
    playerH: k.lock2U ? PLAYER_2U : k.playerH,
    gutter: k.gutter,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

type Mode = "ready" | "listening" | "transcribing" | "submitting" | "speaking" | "paused";

interface ModeMeta { key: Mode; word: string; detail: string; tint: string }

function modesFor(p: Palette): ModeMeta[] {
  return [
    { key: "ready", word: "READY", detail: "LANE 02", tint: p.ink2 },
    { key: "listening", word: "LISTENING", detail: "LANE 02", tint: p.accent },
    { key: "transcribing", word: "TRANSCRIBING", detail: "ON DEVICE", tint: p.amber },
    { key: "submitting", word: "SUBMITTING", detail: "MAC", tint: p.amber },
    { key: "speaking", word: "SPEAKING", detail: "LANE 02", tint: p.accent },
    { key: "paused", word: "PAUSED", detail: "LANE 02", tint: p.ink3 },
  ];
}

const YOU = "Mock turn — walk the full lifecycle without Codex.";
const AGENT =
  "Lifecycle walkthrough complete. Listening, transcription, Mac work, and narration all lit in sequence. The radio never resized.";

/** Speech-shaped envelope: phrase humps with breaths — not a sine toy. */
function speechEnvelope(count: number, seed = 11) {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const phrase = Math.sin(t * Math.PI * 3.2);
    const formant = Math.abs(Math.sin(t * 47)) * 0.35 + Math.abs(Math.sin(t * 19)) * 0.25;
    const breath = phrase > 0.12 ? 1 : 0.06;
    const attack = t < 0.04 ? t / 0.04 : t > 0.94 ? (1 - t) / 0.06 : 1;
    return Math.round(
      Math.min(1, Math.max(0.04, (Math.abs(phrase) * 0.55 + formant) * breath * attack * (0.85 + rand() * 0.15))) * 100,
    ) / 100;
  });
}

function clock(frac: number, dur = 4.2) {
  const s = Math.floor(frac * dur);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Wall-clock phase — see MicroThemesOpusStudy for why not rAF setState. */
function useAnimationPhase(running: boolean, speed: number) {
  const originRef = useRef<number | null>(null);
  const [, setBeat] = useState(0);

  useEffect(() => {
    if (!running) {
      originRef.current = null;
      return;
    }
    originRef.current = performance.now();
    const id = window.setInterval(() => setBeat((n) => (n + 1) % 1_000_000), 80);
    return () => window.clearInterval(id);
  }, [running, speed]);

  if (!running || originRef.current == null) return 0;
  const elapsed = (performance.now() - originRef.current) / 1000;
  return (elapsed * 0.28 * speed) % 1;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function MicroThemesKimiStudyPage({ page }: { page: StudioAppPage }) {
  const [themeId, setThemeId] = useState<ThemeId>("flight");
  const [presetIx, setPresetIx] = useState<Record<ThemeId, number>>({
    flight: 0, obsidian: 0, ceramic: 0, porcelain: 0, amber: 0,
  });
  const [tokens, setTokens] = useState<Record<ThemeId, Palette>>(() =>
    Object.fromEntries(THEMES.map((t) => [t.id, t.presets[0].tokens])) as Record<ThemeId, Palette>,
  );
  const [knobs, setKnobs] = useState<Knobs>(DEFAULT_KNOBS);

  // Player state
  const [mode, setMode] = useState<Mode>("speaking");
  const [pos, setPos] = useState(0.38);
  const [level, setLevel] = useState(0.62);
  const [volume, setVolume] = useState(0.8);
  const [speedIx, setSpeedIx] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [animate, setAnimate] = useState(true);

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  const preset = theme.presets[presetIx[themeId]] ?? theme.presets[0];
  const palette = tokens[themeId];
  const modes = useMemo(() => modesFor(palette), [palette]);
  const meta = modes.find((m) => m.key === mode) ?? modes[0];
  const mat = useMemo(() => resolveMat(palette, preset.skin, theme.scheme, knobs), [palette, preset, theme, knobs]);

  const phase = useAnimationPhase(animate, 1.65);
  const env = useMemo(() => speechEnvelope(96), []);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const livePhase = hydrated ? phase : 0;

  // Derive from phase — do not write pos/level back via useEffect (update-depth loop).
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

  const messages =
    mode === "ready" || mode === "listening" || mode === "transcribing"
      ? mode === "ready"
        ? []
        : [{ role: "you" as const, text: YOU }]
      : [
          { role: "you" as const, text: YOU },
          { role: "agent" as const, text: AGENT },
        ];

  const pickPreset = (ix: number) => {
    setPresetIx((prev) => ({ ...prev, [themeId]: ix }));
    setTokens((prev) => ({ ...prev, [themeId]: theme.presets[ix].tokens }));
  };
  const setToken = (key: TokenKey, value: string) =>
    setTokens((prev) => ({ ...prev, [themeId]: { ...prev[themeId], [key]: value } }));
  const resetTheme = () => {
    setPresetIx((prev) => ({ ...prev, [themeId]: 0 }));
    setTokens((prev) => ({ ...prev, [themeId]: theme.presets[0].tokens }));
  };
  const setKnob = <K extends keyof Knobs>(key: K, value: Knobs[K]) =>
    setKnobs((prev) => ({ ...prev, [key]: value }));

  return (
    <main className="w-full px-6 py-10 lg:px-7">
      <PageHeader page={page} />

      <section className="max-w-[1100px] space-y-12 py-8">
        {/* Thesis */}
        <div>
          <h2 className="mb-2 text-[15px] font-medium text-studio-ink-strong">
            Five materials, one chassis
          </h2>
          <p className="max-w-[66ch] text-[13.5px] leading-relaxed text-studio-ink">
            Full Micro Deck surface — lanes, pad, hold-to-speak, and the ledger
            console. Geometry on the eye column stays fixed (50pt gutter, text rail
            at 76). Themes change material: texture, lighting, chrome. Signal color
            only where the circuit is live.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className="rounded-lg p-3 text-left transition"
                style={{
                  border: `1px solid ${t.id === themeId ? tokens[t.id].accent : "var(--studio-rule, #333)"}`,
                  background: tokens[t.id].page,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex gap-1">
                    {[tokens[t.id].panel, tokens[t.id].accent, tokens[t.id].amber].map((c, i) => (
                      <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c, border: "1px solid rgba(127,127,127,0.35)" }} />
                    ))}
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: tokens[t.id].ink }}>
                    {t.name}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug" style={{ color: tokens[t.id].ink3 }}>
                  {t.thesis}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Playground */}
        <div>
          <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">Playground</h2>
          <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
            Pick a theme, a material preset, and a lifecycle mode. Every knob below
            re-renders the same Micro column live; token edits persist per theme.
          </p>

          {/* Material presets */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-studio-ink-faint">Material</span>
            {theme.presets.map((pr, ix) => (
              <button
                key={pr.id}
                type="button"
                onClick={() => pickPreset(ix)}
                className="rounded px-2.5 py-1 text-[10px] font-medium tracking-wide transition"
                style={{
                  background: ix === presetIx[themeId] ? hexA(palette.accent, 0.14) : "transparent",
                  color: ix === presetIx[themeId] ? palette.accent : "var(--studio-ink-faint, #888)",
                  border: `1px solid ${ix === presetIx[themeId] ? hexA(palette.accent, 0.5) : "var(--studio-rule, #333)"}`,
                }}
              >
                {pr.name}
              </button>
            ))}
            <span className="ml-2 text-[11px] italic text-studio-ink-faint">{preset.skin.blurb}</span>
          </div>

          {/* Lifecycle */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-studio-ink-faint">Lifecycle</span>
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className="rounded px-2.5 py-1 text-[10px] font-medium tracking-wide transition"
                style={{
                  background: m.key === mode ? hexA(m.tint, 0.14) : "transparent",
                  color: m.key === mode ? m.tint : "var(--studio-ink-faint, #888)",
                  border: `1px solid ${m.key === mode ? hexA(m.tint, 0.5) : "var(--studio-rule, #333)"}`,
                }}
              >
                {m.word}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAnimate((a) => !a)}
              className="ml-2 rounded px-2.5 py-1 text-[10px] font-medium"
              style={{
                border: `1px solid ${animate ? "var(--studio-rule, #333)" : hexA(palette.accent, 0.6)}`,
                color: animate ? "var(--studio-ink-faint, #888)" : palette.accent,
                background: animate ? "transparent" : hexA(palette.accent, 0.1),
              }}
            >
              {animate ? "❚❚ Freeze" : "▶ Animate"}
            </button>
          </div>

          {/* Full Micro Deck on the theme's page backdrop */}
          <div
            className="overflow-x-auto rounded-xl p-4"
            style={{
              background: `radial-gradient(120% 90% at 50% 0%, ${mixHex(palette.page, "#FFFFFF", theme.scheme === "light" ? 0.25 : 0.04)}, ${palette.page})`,
              border: `1px solid ${mat.lineSoft}`,
            }}
          >
            <MicroDeckFullMock
              tokens={palette}
              mode={mode}
              handWidth={300}
              consoleWidth={400}
              height={Math.max(520, mat.playerH + 320)}
            >
              <LaneColumn
                m={mat}
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
                fillHeight
                onSeek={(v) => { setAnimate(false); setPos(v); }}
                onVolume={setVolume}
                onCycleSpeed={() => setSpeedIx((i) => (i + 1) % 4)}
                onToggleAuto={() => setAutoplay((a) => !a)}
                onTogglePlay={() =>
                  setMode((md) => (md === "speaking" ? "paused" : md === "paused" ? "speaking" : md))
                }
              />
            </MicroDeckFullMock>
          </div>

          {/* Global knobs */}
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-studio-ink-faint">Global knobs</span>
              <button
                type="button"
                onClick={() => setKnobs(DEFAULT_KNOBS)}
                className="rounded border border-studio-rule px-2 py-0.5 text-[10px] text-studio-ink-faint hover:text-studio-ink"
              >
                Reset knobs
              </button>
              <Toggle
                label="Crisp only"
                on={knobs.crisp}
                onChange={(v) => setKnob("crisp", v)}
                accent={palette.accent}
              />
              <Toggle
                label="2U lock"
                on={knobs.lock2U}
                onChange={(v) => setKnob("lock2U", v)}
                accent={palette.accent}
              />
            </div>
            <div className="grid max-w-[860px] grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              <Knob label="Corner radius" min={0} max={20} step={1} value={knobs.radius} onChange={(v) => setKnob("radius", v)} fmt={(v) => `${v}px`} />
              <Knob label="Border strength" min={0} max={1.5} step={0.05} value={knobs.border} onChange={(v) => setKnob("border", v)} fmt={(v) => v.toFixed(2)} />
              <Knob label="Plate gradient" min={0} max={1} step={0.05} value={knobs.plateGrad} onChange={(v) => setKnob("plateGrad", v)} fmt={(v) => v.toFixed(2)} />
              <Knob label="Hairline weight" min={0.5} max={2} step={0.1} value={knobs.hairline} onChange={(v) => setKnob("hairline", v)} fmt={(v) => `${v.toFixed(1)}px`} />
              <Knob label="Type scale" min={0.85} max={1.25} step={0.01} value={knobs.typeScale} onChange={(v) => setKnob("typeScale", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <Knob label="Gutter width" min={30} max={70} step={1} value={knobs.gutter} onChange={(v) => setKnob("gutter", v)} fmt={(v) => `${v}px`} />
              <Knob label="Player height" min={110} max={234} step={2} value={knobs.lock2U ? PLAYER_2U : knobs.playerH} onChange={(v) => { setKnob("lock2U", false); setKnob("playerH", v); }} fmt={(v) => knobs.lock2U ? `${v}px · 2U` : `${v}px`} />
              <Knob label="Spacing scale" min={0.8} max={1.3} step={0.02} value={knobs.spacing} onChange={(v) => setKnob("spacing", v)} fmt={(v) => `${Math.round(v * 100)}%`} />
              <Knob label="Live glow" min={0} max={1} step={0.05} value={knobs.glow} onChange={(v) => setKnob("glow", v)} fmt={(v) => v.toFixed(2)} />
              <Knob label="Scrub position" min={0} max={1} step={0.01} value={pos} onChange={(v) => { setAnimate(false); setPos(v); }} fmt={(v) => v.toFixed(2)} />
            </div>
          </div>
        </div>

        {/* Token editor */}
        <TokenEditor palette={palette} onChange={setToken} onReset={resetTheme} themeName={theme.name} />

        {/* Theme strip — all five at designed defaults */}
        <ThemeStrip active={themeId} onPick={setThemeId} />

        {/* Export */}
        <ExportPanel theme={theme} presetName={preset.name} palette={palette} />
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function Knob({
  label, min, max, step, value, onChange, fmt,
}: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-3 text-[11px] text-studio-ink-faint">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-current"
      />
      <span className="w-16 shrink-0 tabular-nums text-right">{fmt(value)}</span>
    </label>
  );
}

function Toggle({ label, on, onChange, accent }: { label: string; on: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="rounded px-2 py-0.5 text-[10px] font-medium"
      style={{
        border: `1px solid ${on ? hexA(accent, 0.6) : "var(--studio-rule, #333)"}`,
        color: on ? accent : "var(--studio-ink-faint, #888)",
        background: on ? hexA(accent, 0.1) : "transparent",
      }}
    >
      {label} {on ? "ON" : "OFF"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Token editor — every DeckThemePalette key, grouped
// ---------------------------------------------------------------------------

function TokenEditor({
  palette, onChange, onReset, themeName,
}: {
  palette: Palette;
  onChange: (key: TokenKey, value: string) => void;
  onReset: () => void;
  themeName: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <h2 className="text-[15px] font-medium text-studio-ink-strong">Tokens — {themeName}</h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-studio-rule px-2 py-0.5 text-[10px] text-studio-ink-faint hover:text-studio-ink"
        >
          Reset theme defaults
        </button>
      </div>
      <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
        Every <code>DeckThemePalette</code> key, grouped by role. Edits apply to the
        live mock immediately and persist per theme while you explore.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {TOKEN_GROUPS.map((g) => (
          <div key={g.label} className="rounded-lg border border-studio-rule p-3">
            <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-studio-ink-faint">
              {g.label}
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {g.keys.map((key) => (
                <TokenRow key={key} name={key} value={palette[key]} onChange={(v) => onChange(key, v)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenRow({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText((prev) => (prev === value ? prev : value));
  }, [value]);
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : "#000000";
  const commit = (raw: string) => {
    setText(raw);
    const v = (raw.startsWith("#") ? raw : `#${raw}`).toLowerCase();
    if (/^#[0-9a-fA-F]{6}$/.test(v) && v !== value.toLowerCase()) onChange(v);
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={safe}
        onChange={(e) => {
          const next = e.target.value.toLowerCase();
          if (next !== value.toLowerCase()) onChange(next);
        }}
        className="h-6 w-7 shrink-0 cursor-pointer rounded border border-studio-rule bg-transparent p-0.5"
      />
      <span className="w-[86px] shrink-0 font-mono text-[10px] text-studio-ink">{name}</span>
      <input
        type="text"
        value={text}
        onChange={(e) => commit(e.target.value)}
        spellCheck={false}
        className="w-full min-w-0 rounded border border-studio-rule bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-studio-ink-faint"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lane column — exact Micro ledger geometry, material-driven
// ---------------------------------------------------------------------------

function LaneColumn({
  m, mode, meta, messages, pos, level, volume, speedIx, autoplay, env, phase,
  fillHeight, onSeek, onVolume, onCycleSpeed, onToggleAuto, onTogglePlay,
}: {
  m: Mat;
  mode: Mode;
  meta: ModeMeta;
  messages: { role: "you" | "agent"; text: string }[];
  pos: number;
  level: number;
  volume: number;
  speedIx: number;
  autoplay: boolean;
  env: number[];
  phase: number;
  /** Fill parent (full Micro shell) instead of fixed 560. */
  fillHeight?: boolean;
  onSeek?: (v: number) => void;
  onVolume?: (v: number) => void;
  onCycleSpeed?: () => void;
  onToggleAuto?: () => void;
  onTogglePlay?: () => void;
}) {
  const p = m.p;
  const live = mode === "listening" || mode === "speaking";
  const edge = m.sp(14);
  const gap = m.sp(12);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        ...m.chassis,
        borderRadius: m.knobs.radius,
        border: `1px solid ${live ? hexA(meta.tint, 0.4) : m.line}`,
        boxShadow: [m.rimShadow, live ? m.glow(meta.tint, 0.5) : undefined].filter(Boolean).join(", ") || undefined,
        height: fillHeight ? "100%" : 560,
      }}
    >
      {/* Identity — panel head of the same surface */}
      <div
        className="flex items-start"
        style={{
          ...m.head,
          gap,
          paddingLeft: edge,
          paddingRight: edge,
          paddingTop: m.sp(12),
          paddingBottom: m.sp(10),
          borderBottom: `${m.hair}px solid ${m.lineSoft}`,
        }}
      >
        <div
          className="font-mono font-semibold leading-none tabular-nums"
          style={{
            color: p.accent,
            width: m.gutter,
            fontSize: m.ts(28),
            textShadow: live ? m.glow(p.accent, 0.6) : undefined,
          }}
        >
          02
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate font-mono font-semibold tracking-wide"
              style={{ color: p.ink, fontSize: m.ts(11) }}
            >
              USETALKIE.COM
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    mode === "listening"
                      ? `linear-gradient(180deg, ${p.micTop}, ${p.micBottom})`
                      : meta.tint,
                  boxShadow: live ? m.glow(meta.tint) ?? `0 0 6px ${meta.tint}` : undefined,
                }}
              />
              <span
                className="font-mono font-bold"
                style={{ color: meta.tint, fontSize: m.ts(7), letterSpacing: "0.14em" }}
              >
                {meta.word === "READY" ? "ACTIVE LANE" : meta.word}
              </span>
            </span>
          </div>
          <div
            className="flex gap-2 font-mono"
            style={{ color: p.ink3, fontSize: m.ts(7.5), marginTop: m.sp(4) }}
          >
            <span>main</span>
            <span style={{ color: p.ink4 }}>5A83404D</span>
          </div>
        </div>
      </div>

      {/* Ledger — role in numeral gutter, body on project-name / TURN rail */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className="min-h-0 flex-1 overflow-hidden"
          style={{ paddingLeft: edge, paddingRight: edge, paddingTop: m.sp(10), paddingBottom: m.sp(10) }}
        >
          {messages.length === 0 ? (
            <p
              className="font-mono leading-relaxed"
              style={{ color: p.ink3, paddingLeft: m.gutter + gap, fontSize: m.ts(9) }}
            >
              Check unmerged checkout changes
            </p>
          ) : (
            <div style={{ display: "grid", gap: m.sp(8) }}>
              {messages.map((msg, i) => (
                <div key={i} className="flex items-start" style={{ gap }}>
                  <div
                    className="shrink-0 font-mono font-bold"
                    style={{ width: m.gutter, color: p.ink4, fontSize: m.ts(6.5), letterSpacing: "0.09em" }}
                  >
                    {msg.role === "you" ? "YOU" : "AGENT"}
                  </div>
                  <p
                    className="min-w-0 flex-1 font-mono leading-snug"
                    style={{ color: msg.role === "agent" ? p.ink2 : p.ink3, fontSize: m.ts(9) }}
                  >
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PLAYER — plate foot of the same surface (no gap, no second card) */}
      <PlayerConsole
        m={m}
        mode={mode}
        meta={meta}
        pos={pos}
        level={level}
        volume={volume}
        speedIx={speedIx}
        autoplay={autoplay}
        env={env}
        phase={phase}
        embedded
        onSeek={onSeek}
        onVolume={onVolume}
        onCycleSpeed={onCycleSpeed}
        onToggleAuto={onToggleAuto}
        onTogglePlay={onTogglePlay}
      />
    </div>
  );
}

function PlayerConsole({
  m, mode, meta, pos, level, volume, speedIx, autoplay, env, phase = 0,
  compact, embedded, onSeek, onVolume, onCycleSpeed, onToggleAuto, onTogglePlay,
}: {
  m: Mat;
  mode: Mode;
  meta: ModeMeta;
  pos: number;
  level: number;
  volume: number;
  speedIx: number;
  autoplay: boolean;
  env: number[];
  phase?: number;
  compact?: boolean;
  embedded?: boolean;
  onSeek?: (v: number) => void;
  onVolume?: (v: number) => void;
  onCycleSpeed?: () => void;
  onToggleAuto?: () => void;
  onTogglePlay?: () => void;
}) {
  const p = m.p;
  const narrating = mode === "speaking" || mode === "paused";
  const live = mode === "listening";
  const working = mode === "transcribing" || mode === "submitting";
  const tint = meta.tint;
  // Shared rail with identity numeral / ledger roles / player ring
  const gutter = m.gutter;
  const ring = embedded ? 48 : 56;
  const gap = m.sp(embedded ? 12 : 14);
  const edge = m.sp(14);
  const headInset = gutter + gap;
  const restLabel = mode === "ready" ? "READY" : mode === "paused" ? "AT REST" : "NO AUDIO";
  const lit = live || mode === "speaking";

  // Face layout matches DeckPlayerConsole:
  // head (status·caption) · transport band (ring + figure same H) · chips on floor
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        height: m.playerH,
        ...m.plate,
        borderRadius: embedded ? 0 : Math.max(0, m.knobs.radius - 1),
        border: embedded ? undefined : `1px solid ${lit ? hexA(tint, 0.3) : m.line}`,
        borderTop: embedded ? `${m.hair}px solid ${lit ? hexA(tint, 0.4) : m.lineSoft}` : undefined,
        boxShadow: embedded ? m.rimShadow : [m.rimShadow, lit ? m.glow(tint, 0.4) : undefined].filter(Boolean).join(", ") || undefined,
        paddingTop: m.sp(embedded ? 10 : 12),
        paddingBottom: m.sp(embedded ? 9 : 11),
        paddingLeft: edge,
        paddingRight: edge,
        boxSizing: "border-box",
      }}
    >
      {/* Head — indented to figure edge (text rail) */}
      <div style={{ paddingLeft: headInset }}>
        <div
          className="flex items-center gap-1.5 font-mono"
          style={{
            height: 12,
            fontSize: m.ts(9.5),
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: mode === "ready" ? p.ink2 : tint,
          }}
        >
          <span>{mode === "ready" || narrating || working || live ? "TURN 14" : meta.detail}</span>
          <span style={{ color: p.ink4, opacity: 0.65 }}>·</span>
          <span style={{ color: mode === "ready" ? p.ink2 : tint }}>{meta.word}</span>
          {mode === "speaking" && (
            <span
              className="inline-block h-1 w-1 shrink-0 rounded-full"
              style={{ background: p.accent, boxShadow: m.glow(p.accent) }}
            />
          )}
        </div>
        <div
          className="truncate"
          style={{
            marginTop: 2,
            height: embedded ? 20 : 22,
            fontSize: m.ts(12),
            lineHeight: 1.35,
            color: p.ink,
          }}
        >
          {narrating || mode === "ready"
            ? AGENT
            : live
              ? "Listening…"
              : working
                ? "Working…"
                : ""}
        </div>
      </div>

      {/* Free space mostly above transport — ring + bay a touch lower */}
      <div style={{ flex: "1 1 8px", minHeight: 8 }} />

      {/* Transport band — ring + figure same height; tape clock under bay only */}
      <div>
        <div className="flex items-center" style={{ gap }}>
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: gutter, height: ring }}
          >
            <button
              type="button"
              onClick={onTogglePlay}
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: ring,
                height: ring,
                ...m.bay,
                border: `2px solid ${lit ? hexA(tint, 0.55) : m.line}`,
                boxShadow: lit ? m.glow(tint, 0.7) : undefined,
                color: narrating || mode === "ready" ? p.accent : p.ink3,
              }}
            >
              {narrating && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    border: `2px solid ${tint}`,
                    clipPath: `inset(0 ${100 - pos * 100}% 0 0)`,
                    opacity: 0.9,
                  }}
                />
              )}
              <span style={{ fontSize: ring * 0.3, position: "relative" }}>
                {mode === "speaking" ? "❚❚" : "▶"}
              </span>
            </button>
          </div>

          <div
            className="relative min-w-0 flex-1"
            style={{
              height: ring,
              borderRadius: Math.max(2, m.knobs.radius - 4),
              ...m.bay,
              border: `${m.hair}px solid ${m.line}`,
              cursor: narrating || mode === "ready" ? "pointer" : "default",
            }}
            onClick={(e) => {
              if (!onSeek || !(narrating || mode === "ready")) return;
              const r = e.currentTarget.getBoundingClientRect();
              onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
            }}
          >
            <div className="absolute inset-0 px-2 py-1.5">
              {mode === "ready" ? (
                <RestField m={m} label="READY" silhouette />
              ) : live || narrating || working ? (
                <RadioFigure m={m} mode={mode} env={env} pos={pos} level={level} phase={phase} tint={tint} />
              ) : (
                <RestField m={m} label={restLabel} />
              )}
            </div>
            {narrating && (
              <span
                className="pointer-events-none absolute top-1.5 bottom-1.5 w-[1.5px] rounded-full"
                style={{
                  left: `${pos * 100}%`,
                  background: mode === "paused" ? p.ink2 : tint,
                  boxShadow: mode === "paused" ? undefined : m.glow(tint),
                  transform: "translateX(-50%)",
                }}
              />
            )}
          </div>
        </div>
        {/* Tape clock under the bay: 0:00 · current · total — not under the ring */}
        {(mode === "ready" || narrating) && (
          <div
            className="relative font-mono tabular-nums"
            style={{ marginTop: 4, marginLeft: gutter + gap, fontSize: m.ts(9), color: p.ink4 }}
          >
            <div className="flex justify-between">
              <span>0:00</span>
              <span>0:04</span>
            </div>
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ color: narrating ? p.ink2 : p.ink3 }}
            >
              {narrating ? clock(pos) : "0:00"}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: "0 0 8px", minHeight: 4, maxHeight: 10 }} />

      {/* Chips on the floor of the plate */}
      <div className="flex items-center gap-1.5" style={{ height: 22 }}>
        <button type="button" onClick={onCycleSpeed} className="appearance-none">
          <Chip m={m}>
            <span className="font-mono" style={{ color: p.ink3, fontSize: m.ts(10) }}>
              {["1.00×", "1.25×", "1.50×", "0.75×"][speedIx]}
            </span>
          </Chip>
        </button>
        <Chip m={m}>
          <span className="font-mono" style={{ color: p.ink4, opacity: 0.55, fontSize: m.ts(10) }}>
            VOL
          </span>
          <span
            className="ml-1.5 inline-block h-[2.5px] w-[26px] rounded-full"
            style={{ background: m.line }}
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
            <span className="block h-full rounded-full" style={{ width: `${volume * 100}%`, background: p.ink3 }} />
          </span>
        </Chip>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggleAuto}
          className="rounded px-2 py-0.5 font-mono font-semibold tracking-wide"
          style={{
            fontSize: m.ts(9.5),
            background: autoplay ? hexA(p.amber, 0.12) : m.chipBg,
            border: `1px solid ${autoplay ? hexA(p.amber, 0.4) : m.line}`,
            color: autoplay ? p.amber : p.ink4,
            boxShadow: autoplay ? m.glow(p.amber, 0.5) : undefined,
          }}
        >
          {autoplay ? "AUTOPLAY ON" : "AUTOPLAY OFF"}
        </button>
      </div>
    </div>
  );
}

function Chip({ m, children }: { m: Mat; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5"
      style={{
        borderRadius: Math.max(2, m.knobs.radius - 6),
        background: m.chipBg,
        border: `${m.hair}px solid ${m.line}`,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Figures — bar genres parameterized by material
// ---------------------------------------------------------------------------

const BAR_RADIUS = 1;

function RadioFigure({
  m, mode, env, pos, level, phase, tint,
}: {
  m: Mat; mode: Mode; env: number[]; pos: number; level: number; phase: number; tint: string;
}) {
  switch (mode) {
    case "speaking":
    case "paused":
      return <PlaybackWave m={m} env={env} pos={pos} tint={mode === "paused" ? m.p.ink3 : m.p.accent} />;
    case "listening":
      return <CaptureWave m={m} level={level} phase={phase} />;
    case "transcribing":
    case "submitting":
      return <ActivityField m={m} tint={tint} phase={phase} kind={mode === "transcribing" ? "sweep" : "pulse"} />;
    default:
      return <RestField m={m} />;
  }
}

/** One vertical meter stroke — thin tall rectangle, not a capsule. */
function Bar({ height, color, opacity }: { height: number; color: string; opacity: number }) {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ height: "100%", minWidth: 0 }}>
      <div
        style={{
          width: "85%",
          maxWidth: 2,
          height,
          borderRadius: BAR_RADIUS,
          background: color,
          opacity: op(opacity),
        }}
      />
    </div>
  );
}

/** Playback: full silhouette of the file + played span lit + playhead. */
function PlaybackWave({ m, env, pos, tint }: { m: Mat; env: number[]; pos: number; tint: string }) {
  const n = env.length;
  const head = Math.min(n - 1, Math.floor(pos * n));
  const left = `${(Math.round(pos * 1000) / 10).toFixed(1)}%`;
  return (
    <div className="relative flex h-full w-full items-center">
      <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
        {env.map((v, i) => {
          const played = i <= head;
          return (
            <Bar key={i} height={px(v * 28)} color={played ? tint : m.line} opacity={played ? 0.95 : 0.3} />
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute top-0 bottom-0"
        style={{
          left,
          width: 1,
          background: tint,
          boxShadow: m.glow(tint) ?? `0 0 5px ${tint}`,
          opacity: 0.95,
        }}
      />
    </div>
  );
}

/** Capture: dense rectangular strokes across the full width; silence still scrolls. */
function CaptureWave({ m, level, phase }: { m: Mat; level: number; phase: number }) {
  const bars = 88;
  const drift = (Math.round(phase * 100) / 100) * Math.PI * 2;
  const heights = Array.from({ length: bars }, (_, i) => {
    const t = i / bars;
    const speech =
      Math.abs(Math.sin(t * 14 + drift * 1.7)) * 0.45 +
      Math.abs(Math.sin(t * 31 + drift * 2.3)) * 0.3 +
      Math.abs(Math.sin(t * 53 - drift)) * 0.2;
    const win = Math.sin(t * Math.PI);
    const v = level * speech * (0.55 + win * 0.45);
    return { h: px(Math.max(2, v * 28)), hot: v > 0.06 };
  });
  return (
    <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
      {heights.map((bar, i) => (
        <Bar key={i} height={bar.h} color={m.p.accent} opacity={bar.hot ? 0.92 : 0.14} />
      ))}
    </div>
  );
}

/** Working activity — sweep: sheen travels edge to edge; pulse: amplitude breathes. */
function ActivityField({
  m, tint, phase, kind,
}: {
  m: Mat; tint: string; phase: number; kind: "sweep" | "pulse";
}) {
  const bars = 80;
  const ph = Math.round(phase * 100) / 100;

  if (kind === "pulse") {
    const amp = 0.35 + Math.abs(Math.sin(ph * Math.PI * 2)) * 0.55;
    return (
      <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
        {Array.from({ length: bars }, (_, i) => {
          const t = i / bars;
          const hump = Math.sin(t * Math.PI);
          return <Bar key={i} height={px(2 + hump * amp * 26)} color={tint} opacity={op(0.25 + hump * 0.55)} />;
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
      {Array.from({ length: bars }, (_, i) => {
        const t = i / (bars - 1);
        const d = Math.min(Math.abs(t - ph), 1 - Math.abs(t - ph));
        const lobe = Math.max(0, 1 - d * 2.4);
        return <Bar key={i} height={px(3 + lobe * 24)} color={tint} opacity={op(0.18 + lobe * 0.78)} />;
      })}
    </div>
  );
}

/** Zero-state bay — same height as the transport ring. */
function RestField({ m, label = "AT REST", silhouette = false }: { m: Mat; label?: string; silhouette?: boolean }) {
  const n = 64;
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {silhouette ? (
        <div className="flex h-full w-full items-stretch" style={{ gap: 1 }}>
          {Array.from({ length: n }, (_, i) => {
            const t = i / (n - 1);
            const phrase = Math.abs(Math.sin(t * Math.PI * 3.2));
            const formant = Math.abs(Math.sin(t * 47)) * 0.35 + Math.abs(Math.sin(t * 19)) * 0.25;
            const breath = phrase > 0.12 ? 1 : 0.08;
            const v = Math.min(1, Math.max(0.06, (phrase * 0.55 + formant) * breath));
            return <Bar key={i} height={px(2 + v * 22)} color={m.line} opacity={op(0.28 + v * 0.22)} />;
          })}
        </div>
      ) : (
        <div className="mx-1 h-px w-full" style={{ background: m.lineSoft }} />
      )}
      <span
        className="pointer-events-none absolute font-mono font-semibold"
        style={{
          fontSize: 8,
          letterSpacing: "0.14em",
          color: m.p.ink4,
          background: m.p.trace,
          padding: "2px 8px",
          borderRadius: 999,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme strip — all five at designed defaults, frozen in speaking mode
// ---------------------------------------------------------------------------

function ThemeStrip({ active, onPick }: { active: ThemeId; onPick: (id: ThemeId) => void }) {
  const env = useMemo(() => speechEnvelope(72, 7), []);
  return (
    <div>
      <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">The five materials</h2>
      <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
        Same mock, same state (speaking), designed defaults. Click a card to load
        the theme into the playground.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((t) => {
          const p = t.presets[0].tokens;
          const mat = resolveMat(p, t.presets[0].skin, t.scheme, DEFAULT_KNOBS);
          const meta = modesFor(p)[4]; // speaking
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => onPick(t.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(t.id); }}
              className="cursor-pointer rounded-xl p-4 text-left transition"
              style={{
                background: p.page,
                border: `1px solid ${t.id === active ? p.accent : mat.lineSoft}`,
                boxShadow: t.id === active ? `0 0 0 1px ${hexA(p.accent, 0.5)}` : undefined,
              }}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: p.ink }}>
                  {t.name}
                </span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.12em]" style={{ color: p.ink4 }}>
                  {t.presets[0].skin.name}
                </span>
              </div>
              <div className="pointer-events-none">
                <LaneColumn
                  m={mat}
                  mode="speaking"
                  meta={meta}
                  messages={[{ role: "you", text: YOU }, { role: "agent", text: AGENT }]}
                  pos={0.42}
                  level={0.6}
                  volume={0.8}
                  speedIx={0}
                  autoplay
                  env={env}
                  phase={0.35}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export — DeckThemePalette JSON + Swift-ready hex literals
// ---------------------------------------------------------------------------

function exportJSON(p: Palette): string {
  const out: Record<string, string> = {};
  for (const k of TOKEN_KEYS) out[k] = p[k].toUpperCase();
  return JSON.stringify(out, null, 2);
}

function swiftHex(hex: string): string {
  return `0x${hex.replace("#", "").toUpperCase()}`;
}

function exportSwift(p: Palette): string {
  const g = (keys: TokenKey[]) => keys.map((k) => `${k}: ${swiftHex(p[k])}`).join(", ");
  return [
    "DeckThemePalette(",
    `    ${g(["page", "panel", "panelHead", "cell"])},`,
    `    ${g(["trace", "line", "lineSoft"])},`,
    `    ${g(["ink", "ink2", "ink3", "ink4"])},`,
    `    ${g(["accent", "accentDim", "accentDark", "accentEdge"])},`,
    `    ${g(["amber", "plate", "plateTop", "plateBottom"])},`,
    `    ${g(["pad", "padBottom", "empty"])},`,
    `    ${g(["micTop", "micBottom"])}`,
    ")",
  ].join("\n");
}

function ExportPanel({ theme, presetName, palette }: { theme: ThemeDef; presetName: string; palette: Palette }) {
  const json = exportJSON(palette);
  const swift = exportSwift(palette);
  return (
    <div>
      <h2 className="mb-1 text-[15px] font-medium text-studio-ink-strong">Export</h2>
      <p className="mb-4 max-w-[70ch] text-[13px] leading-relaxed text-studio-ink-faint">
        {theme.name} · {presetName} — current tokens as{" "}
        <code>DeckThemePalette</code>-keyed JSON, or drop-in Swift hex literals for{" "}
        <code>DeckTheme.swift</code>.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ExportBlock title="tokens.json" body={json} />
        <ExportBlock title="DeckTheme.swift palette" body={swift} />
      </div>
    </div>
  );
}

function ExportBlock({ title, body }: { title: string; body: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="overflow-hidden rounded-lg border border-studio-rule">
      <div className="flex items-center justify-between border-b border-studio-rule px-3 py-1.5">
        <span className="font-mono text-[10px] text-studio-ink-faint">{title}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-studio-rule px-2 py-0.5 text-[10px] text-studio-ink-faint hover:text-studio-ink"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[320px] overflow-auto p-3 font-mono text-[10.5px] leading-relaxed text-studio-ink">
        {body}
      </pre>
    </div>
  );
}
