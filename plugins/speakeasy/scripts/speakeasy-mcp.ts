#!/usr/bin/env bun

import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import {
  currentLaneSchemaVersion,
  normalizeLaneNumber,
  normalizeOptionalText,
  readLaneConfiguration,
  writeLaneConfiguration,
  type LaneTask,
} from "../skills/speakeasy/scripts/lane-config";

const SERVER_NAME = "speakeasy";
const SERVER_VERSION = "0.2.0";
const WIDGET_URI = "ui://speakeasy/lane-editor-v2.html";
const pluginRoot = join(import.meta.dir, "..");
const providers = ["system", "openai", "elevenlabs", "groq", "gemini"] as const;

type Provider = (typeof providers)[number];
type JsonRpcID = string | number | null;
type JsonRpcRequest = { id?: JsonRpcID; method?: string; params?: Record<string, any> };
type PickerTask = LaneTask & { project?: string; projectId?: string };
let taskInventory: PickerTask[] = [];

function reply(id: JsonRpcID, result: unknown) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id: JsonRpcID, code: number, message: string, data?: unknown) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } })}\n`);
}

function providerState() {
  let settings: Record<string, any> = {};
  try {
    settings = JSON.parse(Bun.file(join(homedir(), ".config", "speakeasy", "settings.json")).textSync());
  } catch {}
  const values = settings.providers ?? {};
  const available = (id: string, environmentValue?: string) =>
    Boolean(environmentValue || values[id]?.apiKey || Object.hasOwn(values, id));
  const configured = {
    system: true,
    openai: available("openai", process.env.OPENAI_API_KEY),
    elevenlabs: available("elevenlabs", process.env.ELEVENLABS_API_KEY),
    groq: available("groq", process.env.GROQ_API_KEY),
    gemini: available("gemini", process.env.GEMINI_API_KEY),
  };
  const defaults = {
    system: String(values.system?.voice || "Samantha"),
    openai: String(values.openai?.voice || "nova"),
    elevenlabs: String(values.elevenlabs?.voiceId || "EXAVITQu4vr4xnSDxMaL"),
    groq: String(values.groq?.voice || "tara"),
    gemini: String(values.gemini?.voice || "Puck"),
  };
  const voices: Record<Provider, string[]> = {
    system: [defaults.system, "Samantha", "Alex", "Daniel", "Karen", "Moira", "Tessa"],
    openai: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
    elevenlabs: [defaults.elevenlabs],
    groq: ["tara", "leah", "jess", "mia", "zoe", "leo", "dan", "zac"],
    gemini: ["Puck", "Kore", "Charon"],
  };
  return {
    configured,
    defaults,
    providers: providers.map((id) => ({
      id,
      name: id === "system" ? "macOS" : id === "elevenlabs" ? "ElevenLabs" : id[0].toUpperCase() + id.slice(1),
      configured: configured[id],
      voices: [...new Set(voices[id])],
    })),
  };
}

function normalizeTasks(value: unknown): PickerTask[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate): PickerTask[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const task = candidate as Partial<PickerTask>;
    const id = normalizeOptionalText(task.id, 256);
    const title = normalizeOptionalText(task.title, 512);
    const cwd = normalizeOptionalText(task.cwd, 4096);
    if (!id || !title || !cwd) return [];
    return [{
      id, title, cwd,
      project: normalizeOptionalText(task.project, 160),
      projectId: normalizeOptionalText(task.projectId, 256),
    }];
  });
}

async function loadLatestTaskInventory(): Promise<PickerTask[]> {
  const root = join(homedir(), ".codex", "visualizations");
  const glob = new Bun.Glob("**/speakeasy-task-inventory.json");
  let latest: { path: string; modified: number } | undefined;
  try {
    for await (const relative of glob.scan({ cwd: root, onlyFiles: true })) {
      const path = join(root, relative);
      const modified = (await stat(path)).mtimeMs;
      if (!latest || modified > latest.modified) latest = { path, modified };
    }
    if (!latest) return [];
    const source = JSON.parse(await readFile(latest.path, "utf8"));
    return normalizeTasks(Array.isArray(source) ? source : source?.tasks);
  } catch {
    return [];
  }
}

function projectOptions(tasks: PickerTask[]) {
  const projects = new Map<string, { id: string; name: string; path: string; tasks: PickerTask[] }>();
  for (const task of tasks) {
    const id = task.project ? `name:${task.project.toLowerCase()}` : task.projectId ?? task.cwd;
    const project = projects.get(id) ?? { id, name: task.project ?? basename(task.cwd), path: task.cwd, tasks: [] };
    if (!project.tasks.some((candidate) => candidate.id === task.id)) project.tasks.push(task);
    projects.set(id, project);
  }
  return [...projects.values()]
    .map((project) => ({ ...project, tasks: project.tasks.sort((a, b) => a.title.localeCompare(b.title)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function laneEditorData(requestedLane?: unknown, suppliedTasks?: unknown) {
  const supplied = normalizeTasks(suppliedTasks);
  if (supplied.length) taskInventory = supplied;
  else if (!taskInventory.length) taskInventory = await loadLatestTaskInventory();
  const configuration = await readLaneConfiguration();
  for (const lane of configuration.lanes) {
    if (!taskInventory.some((task) => task.id === lane.task.id)) taskInventory.push(lane.task);
  }
  const laneNumber = Number.isInteger(requestedLane) && Number(requestedLane) >= 1 && Number(requestedLane) <= 9
    ? Number(requestedLane)
    : configuration.activeLane ?? 1;
  const speech = providerState();
  return {
    activeLane: configuration.activeLane,
    selectedLane: laneNumber,
    lane: configuration.lanes.find((lane) => lane.number === laneNumber) ?? { number: laneNumber },
    lanes: Array.from({ length: 9 }, (_, index) =>
      configuration.lanes.find((lane) => lane.number === index + 1) ?? { number: index + 1 }),
    projects: projectOptions(taskInventory),
    configuredProviders: speech.configured,
    defaultVoices: speech.defaults,
    providers: speech.providers,
  };
}

async function saveLane(args: Record<string, unknown>) {
  const number = normalizeLaneNumber(Number(args.lane));
  const rawTask = args.task as Partial<LaneTask> | undefined;
  const id = normalizeOptionalText(rawTask?.id, 256);
  const title = normalizeOptionalText(rawTask?.title, 512);
  const cwd = normalizeOptionalText(rawTask?.cwd, 4096);
  if (!id || !title || !cwd) throw new Error("Choose an exact Codex task for this lane.");
  const provider = normalizeOptionalText(args.provider, 80)?.toLowerCase();
  const voiceID = normalizeOptionalText(args.voice, 256);
  const configuration = await readLaneConfiguration();
  const existing = configuration.lanes.find((candidate) => candidate.number === number);
  configuration.lanes = configuration.lanes.filter((candidate) => candidate.number !== number);
  configuration.lanes.push({
    number,
    task: { id, title, cwd },
    label: normalizeOptionalText(args.label, 80),
    narrationCue: normalizeOptionalText(args.narrationCue, 240),
    voiceOverride: provider && voiceID ? { provider, voiceID } : undefined,
    playbackRate: existing?.playbackRate,
  });
  configuration.lanes.sort((a, b) => a.number - b.number);
  if (args.activate !== false) configuration.activeLane = number;
  await writeLaneConfiguration({ ...configuration, schemaVersion: currentLaneSchemaVersion });
  return laneEditorData(number);
}

async function clearLane(args: Record<string, unknown>) {
  const number = normalizeLaneNumber(Number(args.lane));
  const configuration = await readLaneConfiguration();
  configuration.lanes = configuration.lanes.filter((candidate) => candidate.number !== number);
  if (configuration.activeLane === number) configuration.activeLane = undefined;
  await writeLaneConfiguration(configuration);
  return laneEditorData(number);
}

const taskSchema = {
  type: "object",
  properties: {
    id: { type: "string", minLength: 1, maxLength: 256 },
    title: { type: "string", minLength: 1, maxLength: 512 },
    cwd: { type: "string", minLength: 1, maxLength: 4096 },
    project: { type: "string", maxLength: 160 },
    projectId: { type: "string", maxLength: 256 },
  },
  required: ["id", "title", "cwd"],
  additionalProperties: false,
};
const appToolMeta = { ui: { visibility: ["app"] }, "openai/widgetAccessible": true };

const tools = [
  {
    name: "show_lane_editor",
    title: "Show SpeakEasy lane editor",
    description: "Render the SpeakEasy lane, exact-task routing, and voice editor.",
    inputSchema: {
      type: "object",
      properties: {
        lane: { type: "integer", minimum: 1, maximum: 9 },
        tasks: { type: "array", items: taskSchema, maxItems: 250 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: {
      ui: { resourceUri: WIDGET_URI },
      "openai/outputTemplate": WIDGET_URI,
      "openai/toolInvocation/invoking": "Opening lane editor…",
      "openai/toolInvocation/invoked": "Lane editor ready",
    },
  },
  {
    name: "preview_voice",
    title: "Preview a SpeakEasy voice",
    description: "Play a short provider voice sample through the native SpeakEasy player.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: providers },
        voice: { type: "string", minLength: 1, maxLength: 128 },
        text: { type: "string", minLength: 1, maxLength: 500 },
      },
      required: ["provider", "voice", "text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: { ...appToolMeta, "openai/toolInvocation/invoking": "Preparing voice…", "openai/toolInvocation/invoked": "Voice preview started" },
  },
  {
    name: "save_lane",
    title: "Save a SpeakEasy lane",
    description: "Save exact-task routing and delivery settings for one lane.",
    inputSchema: {
      type: "object",
      properties: {
        lane: { type: "integer", minimum: 1, maximum: 9 },
        task: taskSchema,
        label: { type: "string", maxLength: 80 },
        narrationCue: { type: "string", maxLength: 240 },
        provider: { type: "string", enum: providers },
        voice: { type: "string", maxLength: 256 },
        activate: { type: "boolean" },
      },
      required: ["lane", "task"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: appToolMeta,
  },
  {
    name: "clear_lane",
    title: "Clear a SpeakEasy lane",
    description: "Remove the exact-task assignment from one lane.",
    inputSchema: {
      type: "object",
      properties: { lane: { type: "integer", minimum: 1, maximum: 9 } },
      required: ["lane"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: appToolMeta,
  },
];

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "show_lane_editor") {
    const structuredContent = await laneEditorData(args.lane, args.tasks);
    return {
      structuredContent,
      content: [{ type: "text", text: `Showing SpeakEasy Lane ${structuredContent.selectedLane}.` }],
      _meta: { ui: { resourceUri: WIDGET_URI } },
    };
  }
  if (name === "save_lane") return { structuredContent: await saveLane(args), content: [] };
  if (name === "clear_lane") return { structuredContent: await clearLane(args), content: [] };
  if (name === "preview_voice") {
    const provider = String(args.provider ?? "") as Provider;
    const voice = String(args.voice ?? "").trim();
    const text = String(args.text ?? "").trim();
    if (!providers.includes(provider) || !voice || !text || voice.length > 128 || text.length > 500) {
      throw new Error("Choose a valid provider, voice, and preview phrase.");
    }
    const previewScript = join(pluginRoot, "skills", "speakeasy", "scripts", "preview-voice.ts");
    const child = Bun.spawn(["bun", previewScript, "--provider", provider, "--voice", voice, "--text", text], {
      cwd: pluginRoot, stdout: "pipe", stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim() || "Voice preview failed.");
    return { structuredContent: { provider, voice, playing: true }, content: [] };
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(request: JsonRpcRequest) {
  const id = request.id ?? null;
  if (!request.method || request.id === undefined) return;
  try {
    switch (request.method) {
      case "initialize":
        reply(id, {
          protocolVersion: request.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions: "Use show_lane_editor for visual exact-task lane configuration. Component tools save and preview without follow-up prompts.",
        });
        return;
      case "ping": reply(id, {}); return;
      case "tools/list": reply(id, { tools }); return;
      case "tools/call": reply(id, await callTool(String(request.params?.name ?? ""), request.params?.arguments ?? {})); return;
      case "resources/list":
        reply(id, { resources: [{ uri: WIDGET_URI, name: "SpeakEasy lane editor", mimeType: "text/html;profile=mcp-app" }] });
        return;
      case "resources/read":
        if (request.params?.uri !== WIDGET_URI) throw new Error("Unknown resource URI.");
        reply(id, {
          contents: [{
            uri: WIDGET_URI,
            mimeType: "text/html;profile=mcp-app",
            text: await readFile(join(pluginRoot, "assets", "lane-editor.html"), "utf8"),
            _meta: { ui: { prefersBorder: false } },
          }],
        });
        return;
      case "resources/templates/list": reply(id, { resourceTemplates: [] }); return;
      default: fail(id, -32601, `Method not found: ${request.method}`);
    }
  } catch (error) {
    fail(id, -32000, error instanceof Error ? error.message : String(error));
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", (line) => {
  if (!line.trim()) return;
  try { void handle(JSON.parse(line)); }
  catch (error) { fail(null, -32700, "Parse error", error instanceof Error ? error.message : String(error)); }
});
