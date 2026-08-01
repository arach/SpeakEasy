#!/usr/bin/env bun

import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const protocolVersion = 1;
const socketPath = "/tmp/speakeasy-player.sock";
const args = Bun.argv.slice(2);

function has(flag: string): boolean {
  return args.includes(flag);
}

function valueFor(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberFor(flag: string): number | undefined {
  const raw = valueFor(flag);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`${flag} requires a number.`);
    process.exit(2);
  }
  return value;
}

type Command =
  | "enqueue"
  | "pause"
  | "resume"
  | "togglePlayback"
  | "stop"
  | "skip"
  | "seek"
  | "setVolume"
  | "setPlaybackRate"
  | "removeQueueItem"
  | "clearQueue"
  | "status";

interface Request {
  protocolVersion: number;
  requestId: string;
  command: Command;
  arguments?: Record<string, unknown>;
}

interface Response {
  protocolVersion: number;
  requestId: string;
  ok: boolean;
  snapshot?: {
    state?: string;
    currentItem?: { id?: string; title?: string } | null;
    queue?: Array<{ id?: string }>;
    [key: string]: unknown;
  };
  error?: string;
}

function selectedRequest(): Request {
  const requestId = randomUUID();
  const base = { protocolVersion, requestId };

  if (has("--pause")) return { ...base, command: "pause" };
  if (has("--resume")) return { ...base, command: "resume" };
  if (has("--toggle")) return { ...base, command: "togglePlayback" };
  if (has("--stop")) return { ...base, command: "stop" };
  if (has("--skip")) return { ...base, command: "skip" };
  if (has("--clear-queue")) return { ...base, command: "clearQueue" };
  if (has("--status")) return { ...base, command: "status" };

  const seek = numberFor("--seek");
  if (seek !== undefined) return { ...base, command: "seek", arguments: { positionSeconds: seek } };

  const volume = numberFor("--volume");
  if (volume !== undefined) return { ...base, command: "setVolume", arguments: { volume } };

  const playbackRate = numberFor("--playback-rate");
  if (playbackRate !== undefined) {
    return { ...base, command: "setPlaybackRate", arguments: { playbackRate } };
  }

  const itemId = valueFor("--remove");
  if (itemId) return { ...base, command: "removeQueueItem", arguments: { itemId } };

  const audioPath = valueFor("--audio");
  if (!audioPath?.startsWith("/")) {
    console.error("Provide an absolute --audio path or a player control flag.");
    process.exit(2);
  }

  return {
    ...base,
    command: "enqueue",
    arguments: {
      item: {
        id: randomUUID(),
        audioPath,
        title: valueFor("--title") ?? "SpeakEasy narration",
        text: valueFor("--text"),
        provider: valueFor("--provider"),
        createdAt: new Date().toISOString(),
        synthesisRateWPM: numberFor("--synthesis-rate"),
        sourceThreadId: process.env.CODEX_THREAD_ID,
      },
      priority: valueFor("--priority") ?? "normal",
      interrupt: has("--interrupt"),
      autoplay: !has("--no-autoplay"),
    },
  };
}

async function send(request: Request, timeoutMs = 5_000): Promise<Response> {
  return await new Promise((resolve, reject) => {
    let buffer = "";
    let settled = false;
    let connection: { end(): void } | undefined;

    const finish = (error?: Error, response?: Response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      connection?.end();
      if (error) reject(error);
      else if (response) resolve(response);
    };

    const timer = setTimeout(() => finish(new Error("player_timeout")), timeoutMs);
    Bun.connect({
      unix: socketPath,
      socket: {
        open(socket) {
          connection = socket;
          socket.write(`${JSON.stringify(request)}\n`);
        },
        data(_socket, chunk) {
          buffer += chunk.toString("utf8");
          const newline = buffer.indexOf("\n");
          if (newline < 0) return;
          try {
            finish(undefined, JSON.parse(buffer.slice(0, newline)) as Response);
          } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
          }
        },
        error(_socket, error) {
          finish(error);
        },
        close() {
          finish(new Error("player_closed_without_response"));
        },
      },
    }).catch((error) => finish(error instanceof Error ? error : new Error(String(error))));
  });
}

async function launchPermanentApp(): Promise<boolean> {
  const candidates = [
    "/Applications/SpeakEasy.app",
    join(homedir(), ".speakeasy", "SpeakEasy.app"),
  ];

  for (const appPath of candidates) {
    try {
      await access(appPath);
      const child = Bun.spawn(["open", "-g", appPath], { stdout: "ignore", stderr: "ignore" });
      if ((await child.exited) === 0) return true;
    } catch {
      // Try the next supported installation path.
    }
  }
  return false;
}

async function sendWithLaunch(request: Request): Promise<Response> {
  try {
    return await send(request);
  } catch {
    if (!(await launchPermanentApp())) throw new Error("permanent_player_not_installed");
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await Bun.sleep(50);
      try {
        return await send(request);
      } catch {
        // The app is still launching.
      }
    }
    throw new Error("permanent_player_did_not_start");
  }
}

if (has("--help")) {
  console.log(`Usage:
  control-player.ts --audio /absolute/file [--title title] [--text narration] [--no-autoplay]
  control-player.ts --pause|--resume|--toggle|--stop|--skip|--status
  control-player.ts --seek seconds|--volume 0...1|--playback-rate 0.5...2
  control-player.ts --remove UUID|--clear-queue`);
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.error("The permanent SpeakEasy menu-bar player is available only on macOS.");
  process.exit(1);
}

const request = selectedRequest();
try {
  const response = await sendWithLaunch(request);
  if (
    response.protocolVersion !== protocolVersion
    || response.requestId.toLowerCase() !== request.requestId.toLowerCase()
  ) {
    throw new Error("invalid_player_response");
  }
  if (!response.ok) {
    console.error(response.error ?? "SpeakEasy player rejected the command.");
    process.exit(1);
  }
  if (request.command === "status") {
    console.log(JSON.stringify(response.snapshot ?? {}, null, 2));
  } else if (!has("--quiet")) {
    const itemId = request.arguments?.item
      && typeof request.arguments.item === "object"
      && "id" in request.arguments.item
      ? String(request.arguments.item.id).toLowerCase()
      : undefined;
    const isPlayingEnqueuedItem = request.command === "enqueue"
      && response.snapshot?.state === "playing"
      && response.snapshot.currentItem?.id?.toLowerCase() === itemId;
    const confirmation: Record<Command, string> = {
      enqueue: isPlayingEnqueuedItem
        ? "Playback started in the permanent SpeakEasy player."
        : "Queued in the permanent SpeakEasy player.",
      pause: "SpeakEasy player paused.",
      resume: "SpeakEasy player resumed.",
      togglePlayback: "SpeakEasy playback toggled.",
      stop: "SpeakEasy player stopped.",
      skip: "SpeakEasy player skipped to the next item.",
      seek: "SpeakEasy playback position updated.",
      setVolume: "SpeakEasy player volume updated.",
      setPlaybackRate: "SpeakEasy player speed updated.",
      removeQueueItem: "Item removed from the SpeakEasy queue.",
      clearQueue: "SpeakEasy queue cleared.",
      status: "",
    };
    console.log(confirmation[request.command]);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (has("--debug")) console.error(error);
  if (message === "permanent_player_not_installed") {
    console.error("The permanent SpeakEasy app is not installed.");
    console.error(`Install it with: bun ${join(import.meta.dir, "speakeasy-runtime.ts")} --app`);
  } else {
    console.error(`SpeakEasy player unavailable: ${message}`);
  }
  process.exit(1);
}
