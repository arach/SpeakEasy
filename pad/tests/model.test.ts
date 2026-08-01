import { describe, expect, test } from "bun:test";
import { activeLane, DEMO_SNAPSHOT, shouldFinishListening } from "../src/model.ts";

describe("live snapshot display safety", () => {
  test("treats an empty Mac lane snapshot as unassigned instead of inventing a lane", () => {
    expect(activeLane({ ...DEMO_SNAPSHOT, activeLane: undefined, lanes: [] })).toBeUndefined();
  });

  test("only completes listening after activateAndListen was acknowledged", () => {
    expect(shouldFinishListening("listen", true)).toBe(true);
    expect(shouldFinishListening("listen", false)).toBe(false);
    expect(shouldFinishListening("stopNarration", true)).toBe(false);
  });
});
