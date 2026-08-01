import type { PadCommand, Phase } from "./model.ts";

export type RecordingStartOutcome = "recording" | "terminal" | "timeout";

/**
 * Bridges a fast finger release across the Mac's asynchronous lock/cue/mic
 * startup. The Pad must not send toggle/cancel while the Mac still reports a
 * busy pre-recording phase.
 */
export class RecordingStartLatch {
  #outcome?: RecordingStartOutcome;
  #sawStartup = false;
  #resolve?: (outcome: RecordingStartOutcome) => void;
  #timer?: ReturnType<typeof setTimeout>;
  #promise?: Promise<RecordingStartOutcome>;

  constructor(private readonly timeoutMilliseconds = 15_000) {}

  observe(phase: Phase): void {
    if (this.#outcome) return;
    if (["validatingLock", "cueing", "warmingUp"].includes(phase)) this.#sawStartup = true;
    if (phase === "recording") {
      this.#settle("recording");
    } else if (phase === "failed" || phase === "unlocked" || (phase === "ready" && this.#sawStartup)) {
      this.#settle("terminal");
    } else if (["transcribing", "submitting", "preparingSpeech", "speaking"].includes(phase)) {
      // Recording was completed by another input path before this Pad observed
      // it. There is nothing left for the release gesture to finish.
      this.#settle("terminal");
    }
  }

  wait(): Promise<RecordingStartOutcome> {
    if (this.#outcome) return Promise.resolve(this.#outcome);
    if (this.#promise) return this.#promise;
    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve;
      this.#timer = setTimeout(() => this.#settle("timeout"), this.timeoutMilliseconds);
    });
    return this.#promise;
  }

  cancel(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#resolve = undefined;
  }

  #settle(outcome: RecordingStartOutcome): void {
    if (this.#outcome) return;
    this.#outcome = outcome;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#resolve?.(outcome);
    this.#resolve = undefined;
  }
}

export async function finishCommandAfterRecording(
  latch: RecordingStartLatch,
  cancelled: boolean,
): Promise<PadCommand | undefined> {
  const outcome = await latch.wait();
  if (outcome === "recording") {
    return { method: cancelled ? "listening.cancel" : "listening.toggle" };
  }
  // A timeout is fail-safe: request cancellation once even if the last
  // state.changed frame was lost. A terminal phase needs no further command.
  return outcome === "timeout" ? { method: "listening.cancel" } : undefined;
}
