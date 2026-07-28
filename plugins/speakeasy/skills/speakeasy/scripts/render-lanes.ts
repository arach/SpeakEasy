#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { displayName, readLaneConfiguration, type LaneTask } from "./lane-config";

interface PickerTask extends LaneTask {
  project?: string;
  projectId?: string;
}

interface VoiceOption {
  id: string;
  name: string;
}

interface ProviderOption {
  id: string;
  name: string;
  configured: boolean;
  voices: VoiceOption[];
  customVoice?: boolean;
}

const args = Bun.argv.slice(2);
const valueFor = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const output = valueFor("--out");
const tasksPath = valueFor("--tasks");
if (!output?.startsWith("/") || (tasksPath && !tasksPath.startsWith("/"))) {
  console.error("Usage: render-lanes.ts --out /absolute/lane-editor.html [--tasks /absolute/tasks.json]");
  process.exit(2);
}

function clean(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function loadTasks(path?: string): Promise<PickerTask[]> {
  if (!path) return [];
  const source = JSON.parse(await readFile(path, "utf8")) as unknown;
  const candidates = Array.isArray(source)
    ? source
    : source && typeof source === "object" && Array.isArray((source as { tasks?: unknown[] }).tasks)
      ? (source as { tasks: unknown[] }).tasks
      : [];
  return candidates.flatMap((candidate): PickerTask[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Partial<PickerTask>;
    const id = clean(value.id);
    const title = clean(value.title);
    const cwd = clean(value.cwd);
    return id && title && cwd
      ? [{ id, title, cwd, project: clean(value.project), projectId: clean(value.projectId) }]
      : [];
  });
}

async function systemVoices(): Promise<VoiceOption[]> {
  const preferred = ["Samantha", "Alex", "Ava (Premium)", "Daniel", "Karen", "Moira", "Tessa"];
  try {
    const process = Bun.spawn(["say", "-v", "?"], { stdout: "pipe", stderr: "ignore" });
    const source = await new Response(process.stdout).text();
    if ((await process.exited) !== 0) return preferred.map((id) => ({ id, name: id }));
    const available = source.split("\n").flatMap((line): string[] => {
      const match = line.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/);
      return match && match[2].startsWith("en_") ? [match[1].trim()] : [];
    });
    const ordered = [...preferred.filter((voice) => available.includes(voice)), ...available]
      .filter((voice, index, all) => all.indexOf(voice) === index)
      .slice(0, 24);
    return ordered.map((id) => ({ id, name: id }));
  } catch {
    return preferred.map((id) => ({ id, name: id }));
  }
}

async function providerOptions(): Promise<ProviderOption[]> {
  let settings: Record<string, any> = {};
  try {
    settings = JSON.parse(await readFile(join(homedir(), ".config", "speakeasy", "settings.json"), "utf8"));
  } catch {}
  const providers = settings.providers ?? {};
  const elevenVoice = clean(providers.elevenlabs?.voiceId) ?? "EXAVITQu4vr4xnSDxMaL";
  return [
    { id: "system", name: "macOS", configured: true, voices: await systemVoices() },
    {
      id: "openai", name: "OpenAI", configured: Boolean(providers.openai?.apiKey || process.env.OPENAI_API_KEY),
      voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) })),
    },
    {
      id: "elevenlabs", name: "ElevenLabs", configured: Boolean(providers.elevenlabs?.apiKey || process.env.ELEVENLABS_API_KEY),
      voices: [{ id: elevenVoice, name: `Configured · ${elevenVoice}` }], customVoice: true,
    },
    {
      id: "groq", name: "Groq", configured: Boolean(providers.groq?.apiKey || process.env.GROQ_API_KEY),
      voices: ["tara", "leah", "jess", "mia", "zoe", "leo", "dan", "zac"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) })),
    },
    {
      id: "gemini", name: "Gemini", configured: Boolean(providers.gemini?.apiKey || process.env.GEMINI_API_KEY),
      voices: ["Puck", "Kore", "Charon"].map((id) => ({ id, name: id })),
    },
  ];
}

const configuration = await readLaneConfiguration();
const suppliedTasks = await loadTasks(tasksPath);
const knownTasks = [...suppliedTasks];
for (const lane of configuration.lanes) {
  if (!knownTasks.some((task) => task.id === lane.task.id)) knownTasks.push(lane.task);
}
const projectsByID = new Map<string, { id: string; name: string; path: string; tasks: PickerTask[] }>();
for (const task of knownTasks) {
  const projectID = task.projectId ?? task.project ?? task.cwd;
  const project = projectsByID.get(projectID) ?? {
    id: projectID,
    name: task.project ?? (basename(task.cwd) || task.cwd),
    path: task.cwd,
    tasks: [],
  };
  if (!project.tasks.some((candidate) => candidate.id === task.id)) project.tasks.push(task);
  projectsByID.set(projectID, project);
}
const projects = [...projectsByID.values()]
  .map((project) => ({ ...project, tasks: project.tasks.sort((left, right) => left.title.localeCompare(right.title)) }))
  .sort((left, right) => left.name.localeCompare(right.name));
const lanes = Array.from({ length: 9 }, (_, index) => {
  const number = index + 1;
  const lane = configuration.lanes.find((candidate) => candidate.number === number);
  return lane
    ? { ...lane, displayName: displayName(lane), assigned: true, active: configuration.activeLane === number }
    : { number, displayName: "Unassigned", assigned: false, active: false };
});
const providers = await providerOptions();
const safeJSON = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c");

const fragment = `<style>
  #speakeasy-lane-editor { display: grid; gap: 1rem; }
  #speakeasy-lane-editor section { display: grid; gap: .625rem; border-top: 1px solid var(--border); padding-top: .875rem; }
  #speakeasy-lane-editor .viz-row > p { margin: 0; }
  #speakeasy-lane-editor [hidden] { display: none !important; }
</style>
<div id="speakeasy-lane-editor">
  <div class="card" aria-live="polite">
    <div class="viz-row">
      <div>
        <span class="form-label">Selected lane</span>
        <h3 id="lane-heading">Lane 1</h3>
        <p class="text-small" id="task-summary">Choose a task for this lane</p>
      </div>
      <div class="viz-row">
        <code id="lane-hotkey">⌥⌘1</code>
        <span class="viz-badge" id="lane-status">Unassigned</span>
      </div>
    </div>
  </div>

  <div>
    <div class="viz-row">
      <strong>Choose a lane</strong>
      <span class="text-small text-muted">Option–Command–1 through 9</span>
    </div>
    <div class="viz-grid" id="lane-grid" aria-label="Voice lanes"></div>
  </div>

  <section aria-labelledby="route-heading">
    <div>
      <span class="viz-row"><i data-lucide="route" aria-hidden="true"></i><strong id="route-heading">Route</strong></span>
      <p class="text-small text-muted">Send every turn to one exact Codex task.</p>
    </div>
    <div class="viz-controls" aria-label="Task picker">
      <label class="form-label">Project<select class="form-select" id="project-picker"></select></label>
      <label class="form-label">Task<select class="form-select" id="task-picker"></select></label>
    </div>
  </section>

  <section aria-labelledby="voice-heading">
    <div class="viz-row">
      <div>
        <span class="viz-row"><i data-lucide="audio-lines" aria-hidden="true"></i><strong id="voice-heading">Voice</strong></span>
        <p class="text-small text-muted">Give this lane its own sound, or inherit your default.</p>
      </div>
      <div class="viz-row">
        <span class="viz-badge" id="provider-readiness">Global</span>
        <button class="btn" id="preview-voice" type="button"><i data-lucide="play" aria-hidden="true"></i> Preview</button>
      </div>
    </div>
    <div class="viz-controls">
      <label class="form-label">Provider<select class="form-select" id="lane-provider"></select></label>
      <label class="form-label">Voice<select class="form-select" id="lane-voice"></select></label>
      <label class="form-label" id="custom-voice-wrap" hidden>Custom voice ID<input class="form-control" id="custom-voice" autocomplete="off" spellcheck="false"></label>
    </div>
  </section>

  <section aria-labelledby="delivery-heading">
    <div>
      <span class="viz-row"><i data-lucide="message-circle" aria-hidden="true"></i><strong id="delivery-heading">Delivery</strong></span>
      <p class="text-small text-muted">Name the lane and shape the way it narrates.</p>
    </div>
    <div class="viz-controls">
      <label class="form-label">Lane name<input class="form-control" id="lane-label" autocomplete="off" placeholder="Primary orchestrator"></label>
      <label class="form-label">Narration cue<textarea class="form-control" id="lane-cue" rows="2" placeholder="Concise, warm, and decision-oriented"></textarea></label>
    </div>
  </section>

  <div class="viz-row">
    <div class="viz-controls">
      <button class="btn btn-primary" id="save-lane" type="button"><i data-lucide="check" aria-hidden="true"></i> Save changes</button>
      <button class="btn btn-ghost" id="clear-lane" type="button"><i data-lucide="trash-2" aria-hidden="true"></i> Clear</button>
    </div>
    <p class="text-small text-muted" id="lane-feedback" aria-live="polite"></p>
  </div>
</div>
<script>
(() => {
  const root = document.getElementById("speakeasy-lane-editor");
  const lanes = ${safeJSON(lanes)};
  const projects = ${safeJSON(projects)};
  const providers = ${safeJSON(providers)};
  let selected = lanes.find((lane) => lane.active) || lanes[0];
  let selectedTask = null;
  const projectPicker = root.querySelector("#project-picker");
  const taskPicker = root.querySelector("#task-picker");
  const providerPicker = root.querySelector("#lane-provider");
  const voicePicker = root.querySelector("#lane-voice");
  const customVoiceWrap = root.querySelector("#custom-voice-wrap");
  const customVoice = root.querySelector("#custom-voice");
  const label = root.querySelector("#lane-label");
  const cue = root.querySelector("#lane-cue");
  const feedback = root.querySelector("#lane-feedback");
  const readiness = root.querySelector("#provider-readiness");
  const option = (value, text) => {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = text;
    return item;
  };
  const quote = (value) => JSON.stringify(value || "");
  const send = async (prompt, title) => {
    if (!window.openai?.sendFollowUpMessage) {
      feedback.textContent = "Open this editor inside Codex to apply changes.";
      return;
    }
    await window.openai.sendFollowUpMessage({ prompt, title });
    feedback.textContent = "Sent to the SpeakEasy agent.";
  };
  const fillProjects = () => {
    projectPicker.replaceChildren();
    if (!projects.length) projectPicker.appendChild(option("", "No Codex projects available"));
    projects.forEach((project) => projectPicker.appendChild(option(project.id, project.name)));
  };
  const fillTasks = (preferredID) => {
    taskPicker.replaceChildren();
    const project = projects.find((candidate) => candidate.id === projectPicker.value);
    (project?.tasks || []).forEach((task) => taskPicker.appendChild(option(task.id, task.title)));
    if (preferredID && (project?.tasks || []).some((task) => task.id === preferredID)) taskPicker.value = preferredID;
    selectedTask = (project?.tasks || []).find((task) => task.id === taskPicker.value) || null;
    root.querySelector("#task-summary").textContent = selectedTask
      ? (project?.name ? project.name + " · " : "") + selectedTask.title
      : "Choose a task for this lane";
  };
  const fillProviders = () => {
    providerPicker.replaceChildren(option("", "Inherit global voice"));
    providers.forEach((provider) => providerPicker.appendChild(option(
      provider.id,
      provider.name + (provider.configured ? " · Ready" : " · Needs key")
    )));
  };
  const fillVoices = (preferredVoice) => {
    voicePicker.replaceChildren();
    const provider = providers.find((candidate) => candidate.id === providerPicker.value);
    voicePicker.disabled = !provider;
    if (!provider) {
      voicePicker.appendChild(option("", "Global default"));
      customVoiceWrap.hidden = true;
      readiness.textContent = "Global";
      return;
    }
    provider.voices.forEach((voice) => voicePicker.appendChild(option(voice.id, voice.name)));
    if (preferredVoice && !provider.voices.some((voice) => voice.id === preferredVoice)) {
      voicePicker.appendChild(option(preferredVoice, preferredVoice));
    }
    if (provider.customVoice) voicePicker.appendChild(option("__custom__", "Custom voice ID…"));
    if (preferredVoice) voicePicker.value = preferredVoice;
    customVoiceWrap.hidden = voicePicker.value !== "__custom__";
    readiness.textContent = provider.configured ? "Ready" : "Needs key";
  };
  const selectMappedTask = () => {
    const task = selected.task;
    const project = task && projects.find((candidate) => candidate.tasks.some((candidateTask) => candidateTask.id === task.id));
    if (project) projectPicker.value = project.id;
    fillTasks(task?.id);
  };
  const renderDetail = () => {
    root.querySelector("#lane-heading").textContent = "Lane " + selected.number + (selected.label ? " · " + selected.label : "");
    root.querySelector("#lane-hotkey").textContent = "⌥⌘" + selected.number;
    root.querySelector("#lane-status").textContent = selected.active ? "Active" : selected.assigned ? "Assigned" : "Unassigned";
    label.value = selected.label || "";
    cue.value = selected.narrationCue || "";
    providerPicker.value = selected.voiceOverride?.provider || "";
    fillVoices(selected.voiceOverride?.voiceID || "");
    customVoice.value = "";
    selectMappedTask();
    root.querySelector("#save-lane").disabled = !selectedTask;
    root.querySelector("#clear-lane").disabled = !selected.assigned;
    root.querySelector("#preview-voice").disabled = !providerPicker.value;
  };
  fillProjects();
  fillProviders();
  const grid = root.querySelector("#lane-grid");
  lanes.forEach((lane) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn viz-tile";
    button.textContent = String(lane.number);
    button.dataset.tooltip = "⌥⌘" + lane.number + " · " + lane.displayName;
    button.setAttribute("aria-label", "Lane " + lane.number + ", " + lane.displayName);
    button.setAttribute("aria-pressed", String(lane.number === selected.number));
    button.addEventListener("click", () => {
      selected = lane;
      grid.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      renderDetail();
    });
    grid.appendChild(button);
  });
  projectPicker.addEventListener("change", () => {
    fillTasks();
    root.querySelector("#save-lane").disabled = !selectedTask;
  });
  taskPicker.addEventListener("change", () => fillTasks(taskPicker.value));
  providerPicker.addEventListener("change", () => {
    fillVoices();
    root.querySelector("#preview-voice").disabled = !providerPicker.value;
  });
  voicePicker.addEventListener("change", () => {
    customVoiceWrap.hidden = voicePicker.value !== "__custom__";
  });
  root.querySelector("#save-lane").addEventListener("click", () => {
    if (!selectedTask) return;
    const provider = providerPicker.value;
    const voice = voicePicker.value === "__custom__" ? customVoice.value.trim() : voicePicker.value;
    const voiceInstruction = provider
      ? " Set provider " + quote(provider) + " and voice " + quote(voice) + "."
      : " Inherit the global voice.";
    send(
      "Use the SpeakEasy plugin lane manager to assign Lane " + selected.number +
      " to exact task id " + quote(selectedTask.id) + ", title " + quote(selectedTask.title) +
      ", and working directory " + quote(selectedTask.cwd) + ". Set its label to " + quote(label.value.trim()) +
      " and narration cue to " + quote(cue.value.trim()) + "." + voiceInstruction +
      " Confirm the saved lane and regenerate the lane editor with the current task inventory.",
      "Save SpeakEasy Lane " + selected.number
    );
  });
  root.querySelector("#preview-voice").addEventListener("click", () => {
    const provider = providerPicker.value;
    const voice = voicePicker.value === "__custom__" ? customVoice.value.trim() : voicePicker.value;
    if (!provider || !voice) {
      feedback.textContent = "Choose a provider and voice first.";
      return;
    }
    send(
      "Use the SpeakEasy plugin voice preview for provider " + quote(provider) + " and voice " + quote(voice) +
      ". Say: " + quote("Lane " + selected.number + ". " + (label.value.trim() || selectedTask?.title || "Voice preview") + ".") + ".",
      "Preview " + provider + " voice"
    );
  });
  root.querySelector("#clear-lane").addEventListener("click", () => send(
    "Use the SpeakEasy plugin lane manager to clear Lane " + selected.number +
    ". Confirm the result and regenerate the lane editor with the current task inventory.",
    "Clear SpeakEasy Lane " + selected.number
  ));
  renderDetail();
  window.lucide?.createIcons({ attrs: { width: 16, height: 16 } });
})();
</script>`;

const target = resolve(output);
await writeFile(target, fragment, "utf8");
console.log(target);
