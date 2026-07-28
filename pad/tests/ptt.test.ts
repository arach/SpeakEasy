import { describe, expect, test } from "bun:test";
import { finishCommandAfterRecording, RecordingStartLatch } from "../src/ptt.ts";

describe("fast push-to-talk release", () => {
  test("holds immediate release across validatingLock until recording", async () => {
    const latch = new RecordingStartLatch(100);
    latch.observe("validatingLock");
    let resolved = false;
    const command = finishCommandAfterRecording(latch, false).then((value) => {
      resolved = true;
      return value;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
    latch.observe("recording");
    expect(await command).toEqual({ method: "listening.toggle" });
  });

  test("holds immediate slide-cancel across validatingLock until recording", async () => {
    const latch = new RecordingStartLatch(100);
    latch.observe("validatingLock");
    const command = finishCommandAfterRecording(latch, true);

    latch.observe("cueing");
    await Promise.resolve();
    latch.observe("warmingUp");
    await Promise.resolve();
    latch.observe("recording");
    expect(await command).toEqual({ method: "listening.cancel" });
  });

  test("fails safe to cancellation when recording evidence times out", async () => {
    const latch = new RecordingStartLatch(2);
    latch.observe("validatingLock");
    expect(await finishCommandAfterRecording(latch, false)).toEqual({ method: "listening.cancel" });
  });
});
