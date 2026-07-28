#!/usr/bin/env bun

import { join } from "node:path";

const args = Bun.argv.slice(2);
const valueFor = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const provider = valueFor("--provider");
const voice = valueFor("--voice");
const text = valueFor("--text") ?? `Hello from ${voice ?? "your selected SpeakEasy voice"}.`;
const supportedProviders = new Set(["system", "openai", "elevenlabs", "groq", "gemini"]);

if (args.includes("--help")) {
  console.log("Usage: preview-voice.ts --provider system|openai|elevenlabs|groq|gemini --voice id [--text sample]");
  process.exit(0);
}

if (!provider || !supportedProviders.has(provider) || !voice) {
  console.error("Usage: preview-voice.ts --provider system|openai|elevenlabs|groq|gemini --voice id [--text sample]");
  process.exit(2);
}

const output = `/tmp/codex-speakeasy-voice-preview-${crypto.randomUUID()}`;
const render = Bun.spawn([
  "bun",
  join(import.meta.dir, "render-audio.ts"),
  "--text", text,
  "--out", output,
  "--provider", provider,
  "--voice", voice,
  "--silent",
], { stdout: "inherit", stderr: "inherit" });
const renderCode = await render.exited;
if (renderCode !== 0) process.exit(renderCode);

const play = Bun.spawn([
  "bun",
  join(import.meta.dir, "control-player.ts"),
  "--audio", output,
  "--title", `${provider} · ${voice}`,
  "--text", text,
  "--provider", provider,
  "--interrupt",
  "--cleanup-after-playback",
], { stdout: "inherit", stderr: "inherit" });
process.exit(await play.exited);
