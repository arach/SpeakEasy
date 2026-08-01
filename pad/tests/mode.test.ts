import { describe, expect, test } from "bun:test";
import { normalizePadMode, PAD_MODE_IDS, readPadMode, savePadMode } from "../src/mode.ts";

describe("Pad layouts", () => {
  test("retains every complete Studio direction", () => {
    expect(PAD_MODE_IDS).toEqual(["console", "cluster", "deck", "checklist", "pfd", "micro"]);
  });

  test("falls back to the recommended console layout", () => {
    expect(normalizePadMode("purple-console")).toBe("console");
    expect(readPadMode({ getItem: () => "pfd" })).toBe("pfd");
    expect(readPadMode({ getItem: () => { throw new Error("private mode"); } })).toBe("console");
  });

  test("persists without coupling layout to transport state", () => {
    let value = "";
    savePadMode("micro", { setItem: (_key, next) => { value = next; } });
    expect(value).toBe("micro");
  });
});
