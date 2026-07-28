import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("advertises the non-conversational lane mapping component", async () => {
  const pluginRoot = join(import.meta.dir, "..");
  const config = await Bun.file(join(pluginRoot, ".mcp.json")).json();
  const server = config.mcpServers.speakeasy;
  expect(server.cwd).toBe(".");
  const child = Bun.spawn([server.command, ...server.args], {
    cwd: join(pluginRoot, server.cwd),
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const requests = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "show_lane_editor", arguments: { lane: 1 } } },
    { jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "ui://speakeasy/lane-editor-v2.html" } },
  ];
  child.stdin.write(requests.map((request) => JSON.stringify(request)).join("\n") + "\n");
  child.stdin.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(exitCode, stderr).toBe(0);
  const responses = stdout.trim().split("\n").map((line) => JSON.parse(line));
  const resultFor = (id: number) => responses.find((response) => response.id === id)?.result;

  expect(resultFor(1).serverInfo.name).toBe("speakeasy");
  expect(resultFor(2).tools.map((tool: { name: string }) => tool.name)).toEqual([
    "show_lane_editor", "preview_voice", "save_lane", "clear_lane",
  ]);
  for (const tool of resultFor(2).tools.slice(1)) expect(tool._meta.ui.visibility).toEqual(["app"]);
  expect(resultFor(3).structuredContent.selectedLane).toBe(1);
  expect(Array.isArray(resultFor(3).structuredContent.projects)).toBe(true);
  expect(resultFor(4).contents[0].mimeType).toBe("text/html;profile=mcp-app");
  expect(resultFor(4).contents[0].text).toContain("window.openai?.callTool");
  expect(resultFor(4).contents[0].text).toContain('role="listbox"');
  expect(resultFor(4).contents[0].text).toContain('callTool("save_lane"');
  expect(resultFor(4).contents[0].text).not.toContain("sendFollowUpMessage");
  expect(resultFor(4).contents[0].text).not.toContain("<select");
});

test("saves and clears exact-task lane mappings through app-only tools", async () => {
  const directory = await mkdtemp(join(tmpdir(), "speakeasy-mcp-"));
  const lanesPath = join(directory, "lanes.json");
  await writeFile(lanesPath, `${JSON.stringify({
    schemaVersion: 1,
    activeLane: 2,
    lanes: [{
      number: 2,
      task: { id: "old-thread", title: "Old task", cwd: "/tmp/project" },
      playbackRate: 1.5,
    }],
  })}\n`);
  const pluginRoot = join(import.meta.dir, "..");
  const config = await Bun.file(join(pluginRoot, ".mcp.json")).json();
  const server = config.mcpServers.speakeasy;
  const child = Bun.spawn([server.command, ...server.args], {
    cwd: join(pluginRoot, server.cwd),
    env: { ...process.env, SPEAKEASY_LANES_PATH: lanesPath },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const reader = child.stdout.getReader();
  const decoder = new TextDecoder();
  const queued: any[] = [];
  let buffered = "";
  const receive = async (id: number): Promise<any> => {
    while (true) {
      const queuedIndex = queued.findIndex((message) => message.id === id);
      if (queuedIndex >= 0) return queued.splice(queuedIndex, 1)[0];
      const chunk = await reader.read();
      if (chunk.done) throw new Error(`MCP server closed before response ${id}.`);
      buffered += decoder.decode(chunk.value, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      queued.push(...lines.filter(Boolean).map((line) => JSON.parse(line)));
    }
  };
  const send = async (id: number, method: string, params: Record<string, unknown>) => {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return receive(id);
  };

  try {
    await send(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    const task = { id: "thread-2", title: "Second task", cwd: "/tmp/project", project: "Project" };
    const shown = await send(2, "tools/call", { name: "show_lane_editor", arguments: { lane: 2, tasks: [task] } });
    const shownTasks = shown.result.structuredContent.projects.flatMap((project: any) => project.tasks);
    expect(shownTasks.some((candidate: any) => candidate.id === task.id)).toBe(true);
    const saved = await send(3, "tools/call", {
      name: "save_lane",
      arguments: { lane: 2, task, label: "Second lane", narrationCue: "Direct", provider: "system", voice: "Samantha", activate: true },
    });
    expect(saved.result.structuredContent.activeLane).toBe(2);
    expect(saved.result.structuredContent.lane.label).toBe("Second lane");
    const file = JSON.parse(await readFile(lanesPath, "utf8"));
    expect(file.lanes[0].task.id).toBe(task.id);
    expect(file.lanes[0].playbackRate).toBe(1.5);
    const cleared = await send(4, "tools/call", { name: "clear_lane", arguments: { lane: 2 } });
    expect(cleared.result.structuredContent.lane).toEqual({ number: 2 });
  } finally {
    child.stdin.end();
    await child.exited;
    await rm(directory, { recursive: true, force: true });
  }
});
