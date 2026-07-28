import { describe, expect, test } from "bun:test";
import { nextPadTheme, normalizePadTheme, readPadTheme, savePadTheme } from "../src/theme.ts";

describe("Pad themes", () => {
  test("cycles through the three non-purple skins", () => {
    expect(nextPadTheme("flight")).toBe("ceramic");
    expect(nextPadTheme("ceramic")).toBe("amber");
    expect(nextPadTheme("amber")).toBe("flight");
  });

  test("falls back safely when persisted theme data is unknown", () => {
    expect(normalizePadTheme("purple")).toBe("flight");
    expect(readPadTheme({ getItem: () => "ceramic" })).toBe("ceramic");
    expect(readPadTheme({ getItem: () => { throw new Error("private mode"); } })).toBe("flight");
  });

  test("persists without coupling presentation to command state", () => {
    let value = "";
    savePadTheme("amber", { setItem: (_key, next) => { value = next; } });
    expect(value).toBe("amber");
  });
});
