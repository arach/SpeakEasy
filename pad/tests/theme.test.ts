import { describe, expect, test } from "bun:test";
import {
  BUILTIN_THEMES,
  buildThemeCss,
  colorLuminance,
  deleteCustomTheme,
  listPadThemes,
  manifestToTheme,
  normalizeColor,
  parseThemeManifest,
  readPadTheme,
  sanitizeThemeHtml,
  savePadTheme,
  themeVars,
  upsertCustomTheme,
} from "../src/theme.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    map,
  };
}

const nightOps = {
  manifest_version: 1,
  name: "Night Ops",
  pad_theme: {
    contract: 1,
    colors: { signal: "#74f2ce", ink: "#e8f0ee", void: "#071013" },
    css: ".pad { border-radius: 0; }",
  },
};

describe("manifest parsing", () => {
  test("accepts a minimal manifest and fills defaults", () => {
    const result = parseThemeManifest(nightOps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.version).toBe("1.0.0");
      expect(result.manifest.pad_theme.colors?.signal).toBe("#74f2ce");
    }
  });

  test("accepts Chrome-style [r, g, b] colors", () => {
    const result = parseThemeManifest({
      ...nightOps,
      pad_theme: { contract: 1, colors: { signal: [116, 242, 206] } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.pad_theme.colors?.signal).toBe("#74f2ce");
  });

  test("rejects bad shapes with actionable errors", () => {
    expect(parseThemeManifest("not json")).toEqual({ ok: false, errors: ["The manifest is not valid JSON."] });
    const missing = parseThemeManifest({ manifest_version: 1, pad_theme: { contract: 1 } });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.join(" ")).toContain('"name" is required.');
    const wrongVersion = parseThemeManifest({ ...nightOps, manifest_version: 2 });
    expect(wrongVersion.ok).toBe(false);
  });

  test("rejects unknown color tokens and malformed colors", () => {
    const result = parseThemeManifest({
      ...nightOps,
      pad_theme: { contract: 1, colors: { purple_rain: "#fff", signal: "blurple" } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain('Unknown color token "purple_rain"');
      expect(result.errors.join(" ")).toContain('Color "signal"');
    }
  });

  test("rejects oversized payloads", () => {
    const result = parseThemeManifest({
      ...nightOps,
      pad_theme: { contract: 1, css: "x".repeat(64 * 1024 + 1) },
    });
    expect(result.ok).toBe(false);
  });
});

describe("token derivation", () => {
  test("derives rgb triplets and plates from a few colors", () => {
    const vars = themeVars({ signal: "#74f2ce", ink: "#e8f0ee", void: "#071013" });
    expect(vars["--signal"]).toBe("#74f2ce");
    expect(vars["--signal-rgb"]).toBe("116, 242, 206");
    expect(vars["--rule"]).toBe("rgba(232, 240, 238, 0.12)");
    expect(vars["--page"]).toBeDefined();
    expect(vars["--plate"]).toBeDefined();
    expect(vars["--ink-2"]).toBeDefined();
    expect(vars["--ink-3"]).toBeDefined();
  });

  test("leaves unset tokens to the base theme", () => {
    expect(themeVars({ signal: "#fff" })["--void"]).toBeUndefined();
  });

  test("estimates luminance for scheme detection", () => {
    expect(colorLuminance("#000000")).toBe(0);
    expect(colorLuminance("#ffffff")).toBeCloseTo(1);
    const dark = parseThemeManifest(nightOps);
    const light = parseThemeManifest({
      ...nightOps,
      pad_theme: { contract: 1, colors: { void: "#e8ecea" } },
    });
    if (!dark.ok || !light.ok) throw new Error("fixtures should parse");
    expect(manifestToTheme(dark.manifest, new Set()).scheme).toBe("dark");
    expect(manifestToTheme(light.manifest, new Set()).scheme).toBe("light");
    const forced = parseThemeManifest({
      ...nightOps,
      pad_theme: { contract: 1, scheme: "light", colors: { void: "#071013" } },
    });
    if (!forced.ok) throw new Error("fixture should parse");
    expect(manifestToTheme(forced.manifest, new Set()).scheme).toBe("light");
  });
});

describe("normalizeColor", () => {
  test("normalizes hex, rgb(), and arrays", () => {
    expect(normalizeColor("#abc")).toBe("#aabbcc");
    expect(normalizeColor("rgb(1, 2, 3)")).toBe("#010203");
    expect(normalizeColor("rgba(1, 2, 3, 0.5)")).toBe("rgba(1, 2, 3, 0.5)");
    expect(normalizeColor([255, 189, 88])).toBe("#ffbd58");
    expect(normalizeColor("blurple")).toBeUndefined();
    expect(normalizeColor([1, 2])).toBeUndefined();
  });
});

describe("custom theme storage", () => {
  test("round-trips a custom theme and selects it", () => {
    const storage = memoryStorage();
    const parsed = parseThemeManifest(nightOps);
    if (!parsed.ok) throw new Error("fixture should parse");
    const saved = upsertCustomTheme(parsed.manifest, undefined, storage);
    expect(saved.id).toBe("night-ops");
    expect(saved.vars["--signal"]).toBe("#74f2ce");
    expect(listPadThemes(storage).map((theme) => theme.id)).toEqual(["flight", "ceramic", "amber", "night-ops"]);
    savePadTheme(saved.id, storage);
    expect(readPadTheme(storage).id).toBe("night-ops");
  });

  test("edits keep the id, delete falls back to flight", () => {
    const storage = memoryStorage();
    const parsed = parseThemeManifest(nightOps);
    if (!parsed.ok) throw new Error("fixture should parse");
    const saved = upsertCustomTheme(parsed.manifest, undefined, storage);
    const renamed = upsertCustomTheme({ ...parsed.manifest, name: "Night Ops II" }, saved.id, storage);
    expect(renamed.id).toBe(saved.id);
    expect(listPadThemes(storage)).toHaveLength(4);
    savePadTheme(saved.id, storage);
    deleteCustomTheme(saved.id, storage);
    expect(readPadTheme(storage).id).toBe("flight");
  });

  test("survives corrupt or unavailable storage", () => {
    expect(listPadThemes({ getItem: () => "{corrupt" })).toHaveLength(BUILTIN_THEMES.length);
    expect(readPadTheme({ getItem: () => { throw new Error("private mode"); } }).id).toBe("flight");
    expect(readPadTheme({ getItem: () => "purple" }).id).toBe("flight");
  });
});

describe("chrome sanitization", () => {
  test("strips active content but keeps slots and svg", () => {
    const dirty = `<div data-pad-slot="surface"></div>
      <script>alert(1)</script>
      <img src="javascript:alert(1)" onerror="alert(2)">
      <a href="javascript:alert(3)" onclick="alert(4)">x</a>
      <iframe src="https://evil.example"></iframe>
      <svg viewBox="0 0 1 1"><path d="M0 0h1"/></svg>`;
    const clean = sanitizeThemeHtml(dirty);
    expect(clean).toContain('data-pad-slot="surface"');
    expect(clean).toContain("<svg");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("iframe");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
  });
});

describe("theme css injection", () => {
  test("emits token overrides plus verbatim css for customs only", () => {
    const parsed = parseThemeManifest(nightOps);
    if (!parsed.ok) throw new Error("fixture should parse");
    const theme = manifestToTheme(parsed.manifest, new Set());
    const css = buildThemeCss(theme);
    expect(css).toContain(`:root[data-theme="${theme.id}"]`);
    expect(css).toContain("--signal: #74f2ce;");
    expect(css).toContain(".pad { border-radius: 0; }");
    expect(buildThemeCss(BUILTIN_THEMES[0]!)).toBe("");
  });
});

describe("contract documentation", () => {
  test("every command the app can send is documented in the contract", async () => {
    const [appSource, contract] = await Promise.all([
      Bun.file(new URL("../src/app.ts", import.meta.url)).text(),
      Bun.file(new URL("../docs/theme-contract.md", import.meta.url)).text(),
    ]);
    const methods = new Set([...appSource.matchAll(/method: "([a-z]+\.[a-zA-Z]+)"/g)].map((match) => match[1]!));
    for (const method of methods) {
      expect(contract).toContain(`\`${method}\``);
    }
  });
});
