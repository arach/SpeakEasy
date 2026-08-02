#!/usr/bin/env bun

import { chmod, rename, unlink } from "node:fs/promises";
import { extname } from "node:path";
import { speakeasyCommand } from "./speakeasy-runtime";

const args = Bun.argv.slice(2);

if (process.platform !== "darwin") {
  console.error("SpeakEasy narration requires macOS and its native menu-bar player.");
  process.exit(1);
}

function valueFor(...flags: string[]): string | undefined {
  const index = args.findIndex((arg) => flags.includes(arg));
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(...flags: string[]): boolean {
  return args.some((arg) => flags.includes(arg));
}

const text = valueFor("--text", "-t");
const output = valueFor("--out");
const settingsPath = valueFor("--settings");

if (!text || !output) {
  console.error("Usage: render-audio.ts --text <text> --out </absolute/file> [SpeakEasy options]");
  process.exit(2);
}

if (!output.startsWith("/")) {
  console.error("The --out path must be absolute.");
  process.exit(2);
}

let sessionWordsPerMinute: number | undefined;
if (settingsPath) {
  const settingsFile = Bun.file(settingsPath);
  if (await settingsFile.exists()) {
    const settings = await settingsFile.json() as { wordsPerMinute?: number };
    sessionWordsPerMinute = settings.wordsPerMinute;
  }
}

const explicitRate = valueFor("--rate", "-r");
const targetWordsPerMinute = explicitRate ? Number(explicitRate) : sessionWordsPerMinute;
if (
  targetWordsPerMinute !== undefined
  && (!Number.isFinite(targetWordsPerMinute) || targetWordsPerMinute < 80 || targetWordsPerMinute > 300)
) {
  console.error("Speaking rate must be between 80 and 300 words per minute.");
  process.exit(2);
}

const forwardedArgs = args.filter((arg, index) => {
  if (arg === "--settings") return false;
  if (index > 0 && args[index - 1] === "--settings") return false;
  return true;
});

if (!hasFlag("--silent", "-s")) forwardedArgs.push("--silent");
if (targetWordsPerMinute !== undefined && !hasFlag("--rate", "-r")) {
  forwardedArgs.push("--rate", String(targetWordsPerMinute));
}

let command: string[];
try {
  command = speakeasyCommand(forwardedArgs);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
const exitCode = await child.exited;
if (exitCode !== 0) process.exit(exitCode);

const audio = Bun.file(output);
if (!(await audio.exists()) || audio.size === 0) {
  console.error(`SpeakEasy did not create a non-empty audio file at ${output}.`);
  process.exit(1);
}

type AudioFormat = "aiff" | "wav" | "mp3" | "m4a" | "caf" | "flac" | "ogg";

function detectedAudioFormat(bytes: Uint8Array): AudioFormat | undefined {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  if (bytes.length >= 12 && ascii(0, 4) === "FORM") return "aiff";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (bytes.length >= 4 && ascii(0, 4) === "caff") return "caf";
  if (bytes.length >= 4 && ascii(0, 4) === "fLaC") return "flac";
  if (bytes.length >= 4 && ascii(0, 4) === "OggS") return "ogg";
  if (bytes.length >= 3 && ascii(0, 3) === "ID3") return "mp3";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") return "m4a";
  return undefined;
}

const header = new Uint8Array(await audio.slice(0, 16).arrayBuffer());
const actualFormat = detectedAudioFormat(header);
if (!actualFormat) {
  console.error("SpeakEasy created an audio file in an unrecognized format.");
  process.exit(1);
}

const requestedExtension = extname(output).slice(1).toLowerCase();
const compatibleExtensions: Record<AudioFormat, string[]> = {
  aiff: ["aif", "aifc", "aiff"],
  wav: ["wav", "wave"],
  mp3: ["mp3"],
  m4a: ["aac", "m4a", "mp4"],
  caf: ["caf"],
  flac: ["flac"],
  ogg: ["oga", "ogg"],
};
if (requestedExtension && !compatibleExtensions[actualFormat].includes(requestedExtension)) {
  console.error(
    `SpeakEasy created ${actualFormat.toUpperCase()} audio, but --out ends in .${requestedExtension}. `
    + "Use an extensionless --out path when the provider is selected automatically."
  );
  process.exit(1);
}

if (targetWordsPerMinute !== undefined) {
  const ffprobe = Bun.which("ffprobe");
  const ffmpeg = Bun.which("ffmpeg");
  if (!ffprobe || !ffmpeg) {
    console.error("Explicit words-per-minute retiming requires ffmpeg and ffprobe.");
    process.exit(1);
  }

  const words = text.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  if (words > 0) {
    const probe = Bun.spawn([
      ffprobe,
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nokey=1:noprint_wrappers=1",
      output,
    ], { stdout: "pipe", stderr: "inherit" });
    const duration = Number((await new Response(probe.stdout).text()).trim());
    const probeCode = await probe.exited;
    if (probeCode !== 0 || !Number.isFinite(duration) || duration <= 0) {
      console.error("Could not measure the generated audio duration.");
      process.exit(1);
    }

    const targetDuration = words * 60 / targetWordsPerMinute;
    const tempo = duration / targetDuration;
    if (Math.abs(tempo - 1) > 0.015) {
      const adjusted = `/tmp/codex-speakeasy-rate-${crypto.randomUUID()}.mp3`;
      const rateAdjustment = Bun.spawn([
        ffmpeg,
        "-y", "-loglevel", "error",
        "-i", output,
        "-filter:a", `atempo=${tempo.toFixed(6)}`,
        "-b:a", "128k",
        adjusted,
      ], { stdout: "inherit", stderr: "inherit" });
      const ffmpegCode = await rateAdjustment.exited;
      if (ffmpegCode !== 0) {
        await unlink(adjusted).catch(() => undefined);
        console.error("Could not apply the requested speaking rate.");
        process.exit(ffmpegCode);
      }
      await rename(adjusted, output);
    }
  }
}

await chmod(output, 0o600);

console.log(`Playable audio ready: ${output}${targetWordsPerMinute ? ` at ${targetWordsPerMinute} WPM` : ""}`);
