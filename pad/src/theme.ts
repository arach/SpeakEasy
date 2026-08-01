// Pad theme layer. A deck theme is a Chrome-extension-style manifest:
// metadata on top, presentation under `pad_theme` (colors / css / html).
// Custom theme HTML and CSS bind to the app through Pad Theme Contract v1
// (docs/theme-contract.md): slots, interaction attributes, root state
// attributes, and design tokens.

export const PAD_THEME_CONTRACT = 1;

export const THEME_COLOR_KEYS = [
  "signal", "warning", "danger",
  "ink", "ink_2", "ink_3",
  "void", "page", "plate", "plate_2",
  "rule", "rule_strong",
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export interface PadThemeManifest {
  manifest_version: 1;
  name: string;
  version: string;
  author?: string;
  description?: string;
  pad_theme: {
    contract: typeof PAD_THEME_CONTRACT;
    scheme?: "dark" | "light";
    colors?: Partial<Record<ThemeColorKey, string>>;
    css?: string;
    html?: string;
  };
}

export interface PadTheme {
  id: string;
  name: string;
  source: "builtin" | "custom";
  scheme: "dark" | "light";
  /** Token overrides as CSS custom properties, e.g. "--signal": "#74f2ce". Empty for built-ins (their tokens ship in styles.css). */
  vars: Record<string, string>;
  css?: string;
  html?: string;
  manifest?: PadThemeManifest;
}

const MAX_NAME = 60;
const MAX_PAYLOAD = 64 * 1024;
const PAD_THEME_KEY = "speakeasy.pad.theme.v1";
const PAD_CUSTOM_THEMES_KEY = "speakeasy.pad.custom-themes.v1";

export const BUILTIN_THEMES: PadTheme[] = [
  { id: "flight", name: "Flight", source: "builtin", scheme: "dark", vars: {} },
  { id: "ceramic", name: "Ceramic", source: "builtin", scheme: "light", vars: {} },
  { id: "amber", name: "Amber", source: "builtin", scheme: "dark", vars: {} },
];


/* ------------------------------------------------------------------ */
/* Colors                                                              */
/* ------------------------------------------------------------------ */

function componentToHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

/** Accepts #rgb / #rrggbb / #rrggbbaa / rgb(a)() strings and Chrome-style [r, g, b] arrays. Returns a canonical CSS color or undefined. */
export function normalizeColor(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    if (value.length < 3 || value.length > 4) return undefined;
    if (!value.every((channel) => typeof channel === "number" && Number.isFinite(channel))) return undefined;
    return `#${componentToHex(value[0]!)}${componentToHex(value[1]!)}${componentToHex(value[2]!)}`;
  }
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (hex) {
    let body = hex[1]!.toLowerCase();
    if (body.length === 3) body = body.split("").map((c) => c + c).join("");
    return `#${body}`;
  }
  const fn = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+|\d+%)\s*)?\)$/i.exec(text);
  if (fn) {
    const [r, g, b] = [Number(fn[1]), Number(fn[2]), Number(fn[3])];
    if (r > 255 || g > 255 || b > 255) return undefined;
    if (fn[4] === undefined) return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
    return `rgba(${r}, ${g}, ${b}, ${fn[4]})`;
  }
  return undefined;
}

function rgbTriplet(color: string): [number, number, number] | undefined {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (hex) {
    const value = parseInt(hex[1]!, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const fn = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(color);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  return undefined;
}

function mix(color: string, other: [number, number, number], amount: number): string | undefined {
  const rgb = rgbTriplet(color);
  if (!rgb) return undefined;
  const channel = (index: number) => componentToHex(rgb[index]! + (other[index]! - rgb[index]!) * amount);
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/** Relative luminance approximation on sRGB, 0 (black) to 1 (white). */
export function colorLuminance(color: string): number {
  const rgb = rgbTriplet(color);
  if (!rgb) return 0;
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
}

/* ------------------------------------------------------------------ */
/* Manifest parsing                                                    */
/* ------------------------------------------------------------------ */

export type ManifestParseResult =
  | { ok: true; manifest: PadThemeManifest }
  | { ok: false; errors: string[] };

export function parseThemeManifest(input: unknown): ManifestParseResult {
  const errors: string[] = [];
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch {
      return { ok: false, errors: ["The manifest is not valid JSON."] };
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: ["The manifest must be a JSON object."] };
  }
  const raw = value as Record<string, unknown>;
  if (raw.manifest_version !== 1) errors.push('"manifest_version" must be 1.');
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) errors.push('"name" is required.');
  if (name.length > MAX_NAME) errors.push(`"name" must be ${MAX_NAME} characters or fewer.`);
  const theme = raw.pad_theme;
  if (typeof theme !== "object" || theme === null || Array.isArray(theme)) {
    errors.push('"pad_theme" must be an object with contract, colors, css, and/or html.');
  }
  const padTheme = (theme ?? {}) as Record<string, unknown>;
  if (padTheme.contract !== undefined && padTheme.contract !== PAD_THEME_CONTRACT) {
    errors.push(`"pad_theme.contract" must be ${PAD_THEME_CONTRACT}.`);
  }
  if (padTheme.scheme !== undefined && padTheme.scheme !== "dark" && padTheme.scheme !== "light") {
    errors.push('"pad_theme.scheme" must be "dark" or "light".');
  }

  const colors: Partial<Record<ThemeColorKey, string>> = {};
  const rawColors = padTheme.colors;
  if (rawColors !== undefined) {
    if (typeof rawColors !== "object" || rawColors === null || Array.isArray(rawColors)) {
      errors.push('"pad_theme.colors" must be an object of token names to colors.');
    } else {
      for (const [key, color] of Object.entries(rawColors)) {
        if (!THEME_COLOR_KEYS.includes(key as ThemeColorKey)) {
          errors.push(`Unknown color token "${key}". Valid tokens: ${THEME_COLOR_KEYS.join(", ")}.`);
          continue;
        }
        const normalized = normalizeColor(color);
        if (!normalized) {
          errors.push(`Color "${key}" must be a hex value, rgb()/rgba(), or an [r, g, b] array.`);
          continue;
        }
        colors[key as ThemeColorKey] = normalized;
      }
    }
  }
  for (const field of ["css", "html"] as const) {
    const payload = padTheme[field];
    if (payload !== undefined) {
      if (typeof payload !== "string") errors.push(`"pad_theme.${field}" must be a string.`);
      else if (payload.length > MAX_PAYLOAD) errors.push(`"pad_theme.${field}" must be 64 KB or smaller.`);
    }
  }
  for (const field of ["version", "author", "description"] as const) {
    if (raw[field] !== undefined && typeof raw[field] !== "string") errors.push(`"${field}" must be a string.`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    manifest: {
      manifest_version: 1,
      name,
      version: (raw.version as string | undefined) || "1.0.0",
      author: raw.author as string | undefined,
      description: raw.description as string | undefined,
      pad_theme: {
        contract: PAD_THEME_CONTRACT,
        scheme: padTheme.scheme as "dark" | "light" | undefined,
        colors,
        css: padTheme.css as string | undefined,
        html: padTheme.html as string | undefined,
      },
    },
  };
}

/** Derives the CSS custom-property map from a manifest's colors. Unset tokens fall back to the active base values. */
export function themeVars(colors: Partial<Record<ThemeColorKey, string>>): Record<string, string> {
  const vars: Record<string, string> = {};
  const set = (token: string, value: string | undefined) => {
    if (value) vars[token] = value;
  };
  set("--signal", colors.signal);
  set("--warning", colors.warning);
  set("--danger", colors.danger);
  set("--ink", colors.ink);
  set("--ink-2", colors.ink_2);
  set("--ink-3", colors.ink_3);
  set("--void", colors.void);
  set("--page", colors.page);
  set("--plate", colors.plate);
  set("--plate-2", colors.plate_2);
  set("--rule", colors.rule);
  set("--rule-strong", colors.rule_strong);
  if (colors.signal) {
    const rgb = rgbTriplet(colors.signal);
    if (rgb) set("--signal-rgb", rgb.join(", "));
  }
  if (colors.ink) {
    const rgb = rgbTriplet(colors.ink);
    if (rgb) {
      set("--ink-rgb", rgb.join(", "));
      if (!colors.rule) set("--rule", `rgba(${rgb.join(", ")}, 0.12)`);
      if (!colors.rule_strong) set("--rule-strong", `rgba(${rgb.join(", ")}, 0.23)`);
    }
  }
  if (colors.void) {
    if (!colors.page) set("--page", mix(colors.void, [0, 0, 0], 0.3));
    if (!colors.plate) set("--plate", mix(colors.void, rgbTriplet(colors.ink ?? "#e8f0ee") ?? [232, 240, 238], 0.05));
    if (!colors.plate_2) set("--plate-2", mix(colors.void, rgbTriplet(colors.ink ?? "#e8f0ee") ?? [232, 240, 238], 0.1));
    const voidRgb = rgbTriplet(colors.void);
    if (colors.ink && voidRgb) {
      if (!colors.ink_2) set("--ink-2", mix(colors.ink, voidRgb, 0.38));
      if (!colors.ink_3) set("--ink-3", mix(colors.ink, voidRgb, 0.6));
    }
  }
  return vars;
}

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return slug || "untitled";
}

function themeScheme(manifest: PadThemeManifest): "dark" | "light" {
  if (manifest.pad_theme.scheme) return manifest.pad_theme.scheme;
  const base = manifest.pad_theme.colors?.void ?? manifest.pad_theme.colors?.page;
  if (base) return colorLuminance(base) >= 0.5 ? "light" : "dark";
  return "dark";
}

export function manifestToTheme(manifest: PadThemeManifest, taken: ReadonlySet<string>): PadTheme {
  let id = slugify(manifest.name);
  while (taken.has(id)) id = `${slugify(manifest.name)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    name: manifest.name,
    source: "custom",
    scheme: themeScheme(manifest),
    vars: themeVars(manifest.pad_theme.colors ?? {}),
    css: manifest.pad_theme.css,
    html: manifest.pad_theme.html,
    manifest,
  };
}

/* ------------------------------------------------------------------ */
/* HTML chrome sanitization (Pad Theme Contract v1)                    */
/* ------------------------------------------------------------------ */

const BLOCKED_TAGS = ["script", "iframe", "object", "embed", "form", "link", "meta", "base"];

/**
 * String-level sanitizer for user-authored theme chrome. The threat model is a
 * local, user-installed presentation layer; this strips active content and
 * handlers so a pasted theme cannot execute script. CSS is intentionally
 * untouched (presentation-only).
 */
export function sanitizeThemeHtml(html: string): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const tag of BLOCKED_TAGS) {
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    let previous: string;
    do {
      previous = out;
      out = out.replace(paired, "");
    } while (out !== previous);
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  }
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(\s(?:href|src)\s*=\s*)("|\')?\s*(?:javascript|vbscript|data)\s*:[^"'\s>]*\2/gi, '$1"#"');
  return out;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

interface StoredCustomTheme {
  id: string;
  manifest: PadThemeManifest;
}

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;

function storedCustomThemes(storage: ReadStorage): StoredCustomTheme[] {
  try {
    const raw = storage.getItem(PAD_CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const themes: StoredCustomTheme[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const { id, manifest } = entry as { id?: unknown; manifest?: unknown };
      if (typeof id !== "string" || !id) continue;
      const result = parseThemeManifest(manifest);
      if (result.ok) themes.push({ id, manifest: result.manifest });
    }
    return themes;
  } catch {
    return [];
  }
}

export function listPadThemes(storage: ReadStorage = localStorage): PadTheme[] {
  const customs = storedCustomThemes(storage).map((stored) => ({
    ...manifestToTheme(stored.manifest, new Set()),
    id: stored.id,
  }));
  return [...BUILTIN_THEMES, ...customs];
}

export function findPadTheme(id: string, storage: ReadStorage = localStorage): PadTheme | undefined {
  return listPadThemes(storage).find((theme) => theme.id === id);
}

export function readPadTheme(storage: ReadStorage = localStorage): PadTheme {
  try {
    return findPadTheme(storage.getItem(PAD_THEME_KEY) ?? "", storage) ?? BUILTIN_THEMES[0]!;
  } catch {
    return BUILTIN_THEMES[0]!;
  }
}

export function savePadTheme(id: string, storage: WriteStorage = localStorage): void {
  try {
    storage.setItem(PAD_THEME_KEY, id);
  } catch {
    // A theme is presentation-only; private browsing storage failures should
    // never interrupt the command channel.
  }
}

export function upsertCustomTheme(
  manifest: PadThemeManifest,
  existingId: string | undefined,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): PadTheme {
  const themes = storedCustomThemes(storage);
  const index = existingId ? themes.findIndex((theme) => theme.id === existingId) : -1;
  let id: string;
  if (index >= 0) {
    id = existingId!;
  } else {
    const taken = new Set([...BUILTIN_THEMES.map((theme) => theme.id), ...themes.map((theme) => theme.id)]);
    id = manifestToTheme(manifest, taken).id;
  }
  const record: StoredCustomTheme = { id, manifest };
  if (index >= 0) themes[index] = record;
  else themes.push(record);
  try {
    storage.setItem(PAD_CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // Presentation-only; storage failures must not interrupt control.
  }
  return { ...manifestToTheme(manifest, new Set()), id };
}

export function deleteCustomTheme(id: string, storage: Pick<Storage, "getItem" | "setItem"> = localStorage): void {
  const themes = storedCustomThemes(storage).filter((theme) => theme.id !== id);
  try {
    storage.setItem(PAD_CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // Presentation-only.
  }
}

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */

const CUSTOM_STYLE_ID = "pad-custom-theme";

export function buildThemeCss(theme: PadTheme): string {
  if (theme.source !== "custom") return "";
  const declarations = Object.entries(theme.vars).map(([token, value]) => `${token}: ${value};`).join(" ");
  const base = declarations ? `:root[data-theme="${theme.id}"] { ${declarations} }` : "";
  return [base, theme.css ?? ""].filter(Boolean).join("\n");
}

export function applyPadTheme(theme: PadTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme.id;
  root.dataset.scheme = theme.scheme;
  root.dataset.contract = String(PAD_THEME_CONTRACT);
  const css = buildThemeCss(theme);
  let style = document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = CUSTOM_STYLE_ID;
    document.head.append(style);
  }
  style.textContent = css;
}

/** Accent color used for swatches in the appearance UI. */
export function themeAccent(theme: PadTheme): string {
  return theme.vars["--signal"] ?? (theme.id === "amber" ? "#ffbd58" : theme.id === "ceramic" ? "#087f68" : "#74f2ce");
}
