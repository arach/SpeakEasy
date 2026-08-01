import "./styles.css";
import { consumeBootstrapFromLocation, type BootstrapResult } from "./bootstrap.ts";
import {
  activeLane,
  DEMO_SNAPSHOT,
  formatTime,
  isLaneAssigned,
  LINK_COPY,
  PHASE_COPY,
  shouldFinishListening,
  waveform,
  type LinkHealth,
  type PadCommand,
  type PadSnapshot,
} from "./model.ts";
import { createTransport, linkAllowsCommands, type PadTransport } from "./transport.ts";
import { finishCommandAfterRecording, RecordingStartLatch } from "./ptt.ts";
import {
  applyPadTheme,
  deleteCustomTheme,
  findPadTheme,
  listPadThemes,
  parseThemeManifest,
  readPadTheme,
  sanitizeThemeHtml,
  savePadTheme,
  themeAccent,
  upsertCustomTheme,
  type PadTheme,
} from "./theme.ts";
import { applyPadMode, PAD_MODE_COPY, PAD_MODE_IDS, readPadMode, savePadMode, type PadMode } from "./mode.ts";

const mount = document.querySelector<HTMLDivElement>("#app");
if (!mount) throw new Error("SpeakEasy Pad could not find its app mount.");
const root: HTMLDivElement = mount;
const PAD_BUILD = "0726.6";

const bootstrap = consumeBootstrapFromLocation(window.location, window.history);
const transport = createTransport(bootstrap.kind === "valid" ? bootstrap.payload : undefined);
// The bundled clip is rendered through HudsonUIAudio's ElevenLabs provider.
const demoAudio = transport.mode === "demo" ? new Audio("/demo-response.m4a") : undefined;
if (demoAudio) {
  demoAudio.preload = "auto";
  demoAudio.setAttribute("playsinline", "");
}

let snapshot: PadSnapshot = structuredClone(DEMO_SNAPSHOT);
let hostName = "SpeakEasy Mac";
let leaseExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
let sessionSecurity: "demo" | "lan-prototype-v1" | "e2ee-v1" = transport.mode === "demo" ? "demo" : "lan-prototype-v1";
let health: LinkHealth = "connecting";
let linkDetail = "Opening Mac control channel";
let notice = bootstrap.kind === "invalid" ? bootstrap.reason : "";
let noticeTone: "info" | "error" = bootstrap.kind === "invalid" ? "error" : "info";
let pending = new Set<string>();
let pttPressed = false;
let pttCancelArmed = false;
let pttFinishPending = false;
let connectionSheetOpen = false;
let installSheetOpen = false;
let appearanceSheetOpen = false;
let appearanceSheetView: "browse" | "editor" = "browse";
let editorThemeId: string | undefined;
let editorText = "";
let editorErrors: string[] = [];
let themeDeleteArmed = false;
let deferredInstall: BeforeInstallPromptEvent | undefined;
let pttStart: Promise<boolean> | undefined;
let pressButton: HTMLElement | undefined;
let pressBounds: DOMRect | undefined;
let pttIntent: "listen" | "stopNarration" = "listen";
let recordingLatch: RecordingStartLatch | undefined;
let volumeDragging = false;
let commandReceipt: { tone: "ok" | "error" | "pending"; title: string; detail: string } | undefined;
let lastAckLatencyMs: number | undefined;
let lastSnapshotReceivedAt = Date.now();
let acknowledgedCommandCount = 0;
type ActivityTone = "info" | "ok" | "pending" | "error" | "voice";
type ActivityEntry = { id: number; at: number; tone: ActivityTone; title: string; detail: string };
const activityStartedAt = Date.now();
let activitySequence = 3;
let activityLog: ActivityEntry[] = [
  {
    id: 3,
    at: activityStartedAt,
    tone: "ok",
    title: "LANE SELECTED",
    detail: `02 · ${DEMO_SNAPSHOT.lanes.find((lane) => lane.number === DEMO_SNAPSHOT.activeLane)?.label ?? "READY"}`,
  },
  {
    id: 2,
    at: activityStartedAt - 6_000,
    tone: "info",
    title: "TASK CONTEXT",
    detail: DEMO_SNAPSHOT.activeTaskTitle ?? "No task assigned",
  },
  {
    id: 1,
    at: activityStartedAt - 14_000,
    tone: "voice",
    title: "LAST RESPONSE",
    detail: `${formatTime(DEMO_SNAPSHOT.playback.elapsedSeconds)} / ${formatTime(DEMO_SNAPSHOT.playback.durationSeconds)} · ${DEMO_SNAPSHOT.playback.queueCount} queued`,
  },
];
let theme: PadTheme = readPadTheme();
let mode: PadMode = readPadMode();
applyPadTheme(theme);
applyPadMode(mode);

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        speakeasyNative?: { postMessage(message: { kind: string }): void };
      };
    };
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const icons: Record<string, string> = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8v-5m0 5h5M5.4 6.8A8 8 0 1 1 4 14"/></svg>',
  announce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13V9h4l7-4v12l-7-4H4ZM18 9a4 4 0 0 1 0 6"/></svg>',
  mac: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></svg>',
  install: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10-6.5Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5h2.8v13H8zM13.2 5.5H16v13h-2.8z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  theme: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/></svg>',
};

function notifyNative(kind: "acknowledged" | "error" | "selection"): void {
  window.webkit?.messageHandlers?.speakeasyNative?.postMessage({ kind });
}

function esc(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function phaseTone(): string {
  if (snapshot.phase === "recording") return "live";
  if (snapshot.phase === "failed") return "alarm";
  if (["warmingUp", "transcribing", "submitting"].includes(snapshot.phase)) return "work";
  if (snapshot.phase === "speaking") return "speak";
  return "idle";
}

function phaseActivityTone(): ActivityTone {
  if (snapshot.phase === "failed") return "error";
  if (["warmingUp", "transcribing", "submitting", "preparingSpeech"].includes(snapshot.phase)) return "pending";
  if (["recording", "speaking"].includes(snapshot.phase)) return "voice";
  return "ok";
}

const COMMAND_ACTIVITY_LABELS: Record<PadCommand["method"], string> = {
  "state.snapshot": "Refresh Mac state",
  "system.hello": "Open Mac session",
  "system.ping": "Ping Mac",
  "lane.activate": "Change active lane",
  "lane.activateAndListen": "Open microphone",
  "listening.toggle": "Finish utterance",
  "listening.cancel": "Cancel utterance",
  "lane.announce": "Announce active lane",
  "playback.toggle": "Toggle narration",
  "playback.stop": "Stop narration",
  "playback.replay": "Replay response",
  "task.revealOnMac": "Reveal task on Mac",
};

const PHASE_ACTIVITY_DETAIL: Record<PadSnapshot["phase"], string> = {
  unlocked: "No Codex task is locked",
  validatingLock: "Mac is validating the task lock",
  cueing: "Lane cue requested on Mac",
  ready: "Voice turn complete",
  warmingUp: "Mac audio capture is opening",
  recording: "Mac audio capture is active",
  transcribing: "Captured audio handed to ASR",
  submitting: "Transcript handed to Codex",
  preparingSpeech: "Response handed to narration",
  speaking: "Narration playback is active",
  failed: "Voice turn failed",
};

function addActivity(title: string, detail: string, tone: ActivityTone = "info"): void {
  const current = activityLog[0];
  if (current?.title === title && current.detail === detail && current.tone === tone) return;
  activitySequence += 1;
  activityLog.unshift({ id: activitySequence, at: Date.now(), tone, title, detail });
  activityLog = activityLog.slice(0, 8);
}

function activityTime(at: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(at));
}

function activityMarkup(): string {
  return `<section class="micro-activity" aria-labelledby="micro-activity-title">
    <header>
      <div><p class="eyebrow" id="micro-activity-title">AGENT TRACE</p><strong>${activityLog.length.toString().padStart(2, "0")} EVENT BUFFER</strong></div>
      <span>NEWEST FIRST</span>
    </header>
    <ol>${activityLog.map((entry) => `<li data-tone="${entry.tone}">
      <time datetime="${new Date(entry.at).toISOString()}">${activityTime(entry.at)}</time>
      <b aria-hidden="true">${entry.id.toString().padStart(2, "0")}</b>
      <span><strong>${esc(entry.title)}</strong><small>${esc(entry.detail)}</small></span>
    </li>`).join("")}</ol>
  </section>`;
}

function routeLabel(): string {
  if (sessionSecurity === "e2ee-v1") return "E2EE";
  if (sessionSecurity === "lan-prototype-v1") return "TRUSTED LAN";
  return "SIMULATED";
}

function snapshotAgeLabel(): string {
  const age = Math.max(0, Date.now() - lastSnapshotReceivedAt);
  if (age < 1_000) return "<1 SEC";
  if (age < 60_000) return `${Math.floor(age / 1_000)} SEC`;
  return `${Math.floor(age / 60_000)} MIN`;
}

function microQualityMarkup(): string {
  return `<dl class="micro-quality" aria-label="Session quality">
    <div><dt>ACK RTT</dt><dd>${lastAckLatencyMs === undefined ? "NOT MEASURED" : `${lastAckLatencyMs} MS`}</dd></div>
    <div><dt>STATE AGE</dt><dd data-quality-state-age>${snapshotAgeLabel()}</dd></div>
    <div><dt>ROUTE</dt><dd>${routeLabel()}</dd></div>
    <div><dt>ACKS</dt><dd>${acknowledgedCommandCount.toString().padStart(2, "0")}</dd></div>
  </dl>`;
}

function microConfirmationMarkup(): string {
  const lane = activeLaneOrFallback();
  const confirmation = commandReceipt ?? {
    tone: "idle" as const,
    title: `READY ON LANE ${lane.number.toString().padStart(2, "0")}`,
    detail: transport.mode === "demo"
      ? "Hudson TTS via ElevenLabs ready · Replay plays on this device."
      : "Command channel quiet · Mac remains authoritative.",
  };
  return `<div class="micro-confirmation" data-tone="${confirmation.tone}" role="status" aria-live="polite">
    <div><p class="eyebrow">COMMAND CONFIRMATION</p><strong>${esc(confirmation.title)}</strong></div>
    <span>${esc(confirmation.detail)}</span>
  </div>`;
}

function microAudioMarkup(): string {
  const playback = snapshot.playback;
  const progress = playback.durationSeconds > 0
    ? Math.max(0, Math.min(1, playback.elapsedSeconds / playback.durationSeconds))
    : 0;
  const volume = playback.volume === undefined ? "—" : `${Math.round(Math.max(0, Math.min(1, playback.volume)) * 100)}%`;
  const rate = playback.playbackRate === undefined ? "—" : `${playback.playbackRate.toFixed(2)}×`;
  const autoplay = playback.autoplayEnabled === undefined ? "—" : playback.autoplayEnabled ? "ON" : "OFF";
  const outputLevel = Math.round(Math.max(0, Math.min(1, playback.audioLevel ?? 0)) * 100);
  const inputName = transport.mode === "demo" ? "Hudson Voice · ElevenLabs" : snapshot.inputDeviceName || "MAC MICROPHONE";
  const inputRoute = transport.mode === "demo" ? "PLAYS ON THIS DEVICE" : "CAPTURED ON MAC";
  const volumePercent = playback.volume === undefined ? 0 : Math.round(Math.max(0, Math.min(1, playback.volume)) * 100);
  const volumeLocked = transport.mode !== "demo" || playback.volume === undefined;
  const volumeHint = transport.mode === "demo"
    ? "Adjust demo narration volume"
    : "Narration volume is controlled on the Mac";
  return `<section class="micro-audio" data-tone="${phaseTone()}" aria-labelledby="micro-audio-title">
    <header class="micro-audio-head">
      <p class="eyebrow" id="micro-audio-title">AUDIO SETTINGS</p>
      <span>${esc(playback.state.toUpperCase())}</span>
    </header>
    <div class="micro-audio-input">
      <div><p>${transport.mode === "demo" ? "HUDSON TTS" : "INPUT SOURCE"}</p><strong>${esc(inputName)}</strong></div>
      <span>${inputRoute}</span>
    </div>
    <dl class="micro-audio-params">
      <div><dt>VOLUME</dt><dd>${volume}</dd></div>
      <div><dt>SPEED</dt><dd>${rate}</dd></div>
      <div><dt>AUTOPLAY</dt><dd>${autoplay}</dd></div>
      <div><dt>QUEUE</dt><dd>${playback.queueCount.toString().padStart(2, "0")}</dd></div>
    </dl>
    <div class="micro-audio-transport">
      <div class="micro-audio-title-row">${playbackToggleMarkup("micro-tape-toggle")}<b>NARRATION</b><span>${esc(playback.title || "NO RESPONSE LOADED")}</span></div>
      <div class="micro-audio-bar" aria-hidden="true"><i style="width:${Math.round(progress * 100)}%"></i></div>
      <div class="micro-audio-times"><span>${formatTime(playback.elapsedSeconds)}</span><span>${formatTime(playback.durationSeconds)}</span></div>
    </div>
    <div class="micro-output-meter"><span>OUTPUT LEVEL</span><i aria-hidden="true"><b style="width:${outputLevel}%"></b></i><strong>${outputLevel.toString().padStart(2, "0")}%</strong></div>
    <div class="micro-audio-volume">
      <span>NARRATION VOLUME</span>
      <input type="range" min="0" max="100" step="1" value="${volumePercent}" style="--fill:${volumePercent}%" data-demo-volume ${volumeLocked ? "disabled" : ""} aria-label="Narration volume" title="${volumeHint}" />
      <strong data-demo-volume-value>${playback.volume === undefined ? "—" : `${volumePercent}%`}</strong>
    </div>
  </section>`;
}

function leaseRemaining(): string {
  const milliseconds = Math.max(0, leaseExpiresAt - Date.now());
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function commandDisabled(): boolean {
  return !linkAllowsCommands(health);
}

function laneMarkup(): string {
  if (snapshot.lanes.length === 0) {
    return `<div class="empty-lanes" role="status"><strong>NO LANES RECEIVED</strong><span>Configure a voice lane on your Mac.</span></div>`;
  }
  return snapshot.lanes.map((lane) => {
    const active = lane.number === snapshot.activeLane;
    const assigned = isLaneAssigned(lane);
    return `
      <button class="lane-key" type="button" data-lane="${lane.number}" data-active="${active}" data-empty="${!assigned}"
        aria-pressed="${active}" ${assigned && lane.canActivate && !commandDisabled() ? "" : "disabled"}
        aria-label="Lane ${lane.number}, ${esc(lane.label)}${active ? ", active" : ""}${assigned ? "" : ", unassigned"}">
        <span class="key-well" aria-hidden="true"></span>
        <span class="lane-light" aria-hidden="true"></span>
        <span class="lane-number">${lane.number.toString().padStart(2, "0")}</span>
        <span class="lane-name">${esc(lane.label)}</span>
        <span class="lane-task">${assigned ? esc(lane.taskTitle) : "UNASSIGNED"}</span>
        <span class="lane-state">${active ? "ACTIVE" : assigned ? "READY" : "EMPTY"}</span>
      </button>`;
  }).join("");
}

function barsMarkup(count: number): string {
  return `<span class="signal-bars" aria-hidden="true">${[1, 2, 3, 4]
    .map((bar) => `<i style="height:${5 + bar * 2}px" data-on="${bar <= count}"></i>`)
    .join("")}</span>`;
}

function waveMarkup(count = 41): string {
  return waveform(snapshot.phase, count)
    .map((height, index) => `<i style="height:${Math.round(height * 100)}%;--i:${index}"></i>`)
    .join("");
}

function commandButton(method: string, label: string, icon: string, danger = false): string {
  const busy = pending.has(method);
  return `<button type="button" class="rail-button" data-command="${method}" data-danger="${danger}" ${commandDisabled() || busy ? "disabled" : ""}>
    <span class="rail-icon">${icons[icon]}</span>
    <span>${esc(label)}</span>
    ${busy ? '<span class="button-pending" aria-hidden="true"></span>' : ""}
  </button>`;
}

function activeLaneOrFallback() {
  return activeLane(snapshot) ?? {
    number: 0,
    label: "No lanes",
    taskTitle: "Configure a lane on your Mac",
    isActive: false,
    canActivate: false,
  };
}

function playbackToggleMarkup(extraClass = ""): string {
  const playing = snapshot.playback.state === "playing";
  const busy = pending.has("playback.toggle");
  const label = playing ? "Pause narration" : "Play narration";
  return `<button class="tape-toggle ${extraClass}" type="button" data-command="playback.toggle" data-playing="${playing}"
    ${commandDisabled() || busy ? "disabled" : ""} aria-label="${label}" aria-pressed="${playing}" title="${label}">
    ${playing ? icons.pause : icons.play}
    ${busy ? '<span class="button-pending" aria-hidden="true"></span>' : ""}
  </button>`;
}

function pttMarkup(extraClass = ""): string {
  const lane = activeLaneOrFallback();
  const phase = PHASE_COPY[snapshot.phase];
  const phaseHint = snapshot.phase === "failed" && snapshot.lastError ? snapshot.lastError : phase.hint;
  const speaking = snapshot.phase === "speaking";
  const pttLabel = speaking ? "STOP NARRATION" : phase.action;
  const pttIcon = speaking ? icons.stop : icons.mic;
  const disabled = commandDisabled() || !lane.canActivate || pending.has("ptt") || pttFinishPending;
  return `<button class="ptt ${extraClass}" type="button" data-ptt ${disabled ? "disabled" : ""}
    aria-label="${esc(pttLabel)}" aria-describedby="ptt-hint">
    <span class="ptt-well" aria-hidden="true"></span>
    <span class="ptt-icon">${pttIcon}</span>
    <span class="ptt-copy"><strong>${esc(pttCancelArmed ? "RELEASE TO CANCEL" : pttLabel)}</strong><small id="ptt-hint">${esc(pttCancelArmed ? "Move back over the control to send" : phaseHint)}</small></span>
    <span class="ptt-key">SPACE</span>
  </button>`;
}

function commandRailMarkup(extraClass = ""): string {
  return `<nav class="command-rail ${extraClass}" aria-label="SpeakEasy commands">
    ${commandButton("system.ping", "Ping Mac", "link")}
    ${commandButton("listening.cancel", "Cancel", "stop", true)}
    ${commandButton("playback.replay", "Replay", "replay")}
    ${commandButton("lane.announce", "Announce", "announce")}
    ${commandButton("task.revealOnMac", "Open on Mac", "mac")}
  </nav>`;
}

function laneButtonAttrs(lane: PadSnapshot["lanes"][number]): string {
  const active = lane.number === snapshot.activeLane;
  const assigned = isLaneAssigned(lane);
  const enabled = assigned && lane.canActivate && !commandDisabled();
  return `type="button" data-lane="${lane.number}" data-active="${active}" data-empty="${!assigned}" aria-pressed="${active}" ${enabled ? "" : "disabled"} aria-label="Lane ${lane.number}, ${esc(lane.label)}${active ? ", active" : ""}${assigned ? "" : ", unassigned"}"`;
}

function consoleSurfaceMarkup(): string {
  const lane = activeLaneOrFallback();
  const phase = PHASE_COPY[snapshot.phase];
  const playbackProgress = snapshot.playback.durationSeconds > 0
    ? snapshot.playback.elapsedSeconds / snapshot.playback.durationSeconds
    : 0;
  return `<div class="instrument-frame console-surface">
    <aside class="lane-bank" aria-labelledby="lanes-label">
      <div class="section-heading">
        <div><p class="eyebrow" id="lanes-label">LANE ASSIGNMENTS</p><p class="section-sub">MAC AUTHORITY / ${snapshot.lanes.filter(isLaneAssigned).length} ARMED</p></div>
        <span class="bank-index">01—09</span>
      </div>
      <div class="lane-grid" data-disabled="${commandDisabled()}">${laneMarkup()}</div>
      <div class="bank-footer"><span>SELECT</span><i></i><span>HOLD MIC TO SPEAK</span></div>
    </aside>

    <section class="mission" aria-labelledby="active-task-title">
      <header class="mission-header">
        <div class="mission-id"><span class="active-index">${lane.number.toString().padStart(2, "0")}</span><div><p class="eyebrow">ACTIVE LANE</p><h1>${esc(lane.label)}</h1></div></div>
        <div class="lease"><span class="eyebrow">DAILY LEASE</span><strong>${leaseRemaining()}</strong></div>
      </header>
      <div class="task-lock">
        <div class="lock-rule"><span></span><b>EXACT TASK LOCK</b><span></span></div>
        <h2 id="active-task-title">${esc(snapshot.activeTaskTitle || lane.taskTitle || "No task assigned")}</h2>
        <div class="task-meta"><span>${esc(snapshot.inputDeviceName || "MAC MICROPHONE")}</span><i></i><span>${snapshot.playback.queueCount} QUEUED</span><i></i><span>${sessionSecurity === "lan-prototype-v1" ? "LAN PILOT" : sessionSecurity === "e2ee-v1" ? "E2EE" : "DEMO"}</span></div>
      </div>
      ${receiptMarkup()}
      <div class="stage" aria-live="polite">
        <div class="phase-line"><span class="phase-dot"></span><strong>${esc(phase.label)}</strong><span>REV ${snapshot.revision}</span></div>
        <div class="waveform" aria-hidden="true">${waveMarkup()}</div>
        ${pttMarkup()}
      </div>
      <div class="transport-tape">
        ${playbackToggleMarkup()}
        <span class="tape-time">${formatTime(snapshot.playback.elapsedSeconds)}</span>
        <div class="transport-progress"><span style="width:${Math.round(playbackProgress * 100)}%"></span></div>
        <strong>${snapshot.playback.state === "playing" ? "PLAYING RESPONSE" : esc(snapshot.playback.title || "LAST RESPONSE")}</strong>
        <span class="tape-time">−${formatTime(snapshot.playback.durationSeconds - snapshot.playback.elapsedSeconds)}</span>
      </div>
      ${commandRailMarkup()}
    </section>
  </div>`;
}

function clusterSurfaceMarkup(): string {
  const lane = activeLaneOrFallback();
  const phase = PHASE_COPY[snapshot.phase];
  const link = LINK_COPY[health];
  const ticks = Array.from({ length: 36 }, (_, index) => `<i style="transform:rotate(${index * 10}deg)" data-major="${index % 4 === 0}"></i>`).join("");
  return `<section class="studio-surface cluster-surface" aria-label="Cluster layout">
    <aside class="cluster-flank">
      <div><p class="eyebrow">LINK</p><strong class="cluster-signal">${esc(link.label)}</strong><small>${esc(hostName)}</small></div>
      <div><p class="eyebrow">INPUT</p><strong>${esc(snapshot.inputDeviceName || "MAC MICROPHONE")}</strong></div>
      <div><p class="eyebrow">REVISION</p><strong>r${snapshot.revision}</strong></div>
    </aside>
    <div class="cluster-center">
      <div class="cluster-gauge">
        <span class="cluster-ring cluster-ring-outer"></span><span class="cluster-ring cluster-ring-inner"></span><div class="cluster-ticks">${ticks}</div>
        <div class="cluster-core">
          <p class="cluster-phase">${esc(phase.label)}</p>
          <div class="cluster-title"><span>${lane.number.toString().padStart(2, "0")}</span><h1>${esc(lane.label)}</h1></div>
          <p class="cluster-task">${esc(snapshot.activeTaskTitle || lane.taskTitle || "No task assigned")}</p>
          <div class="waveform cluster-wave" aria-hidden="true">${waveMarkup(34)}</div>
          ${pttMarkup("cluster-ptt")}
        </div>
      </div>
    </div>
    <aside class="cluster-flank cluster-flank-right">
      <div><p class="eyebrow">PLAYBACK</p><strong>${esc(snapshot.playback.state.toUpperCase())}</strong><small>${snapshot.playback.queueCount} queued</small></div>
      ${receiptMarkup()}
      ${commandRailMarkup("cluster-commands")}
    </aside>
    <nav class="cluster-selector" aria-label="Lane selector">${snapshot.lanes.map((item) => `<button class="cluster-gear" ${laneButtonAttrs(item)}><span>${item.number}</span><small>${esc(item.label)}</small></button>`).join("")}</nav>
  </section>`;
}

function deckSurfaceMarkup(): string {
  const lane = activeLaneOrFallback();
  const phase = PHASE_COPY[snapshot.phase];
  return `<section class="studio-surface deck-surface" aria-label="Flight Deck layout">
    <header class="deck-header"><div><p class="eyebrow">LOCKED TASK · LANE ${lane.number.toString().padStart(2, "0")}</p><div><h1>${esc(lane.label)}</h1><span>${esc(snapshot.activeTaskTitle || lane.taskTitle || "No task assigned")}</span></div></div><strong>${esc(phase.label)}</strong></header>
    <div class="deck-quadrant">${snapshot.lanes.map((item) => {
      const active = item.number === snapshot.activeLane;
      const lever = active ? 14 : 38 + ((item.number * 11) % 48);
      return `<button class="deck-strip" ${laneButtonAttrs(item)}><span class="deck-number">${item.number}</span><span class="deck-track"><i style="top:${lever}%"></i></span><span class="deck-name">${esc(item.label)}</span><b aria-hidden="true"></b></button>`;
    }).join("")}</div>
    <div class="deck-action-bar">${commandButton("system.ping", "Ping Mac", "link")}${commandButton("listening.cancel", "Cancel", "stop", true)}${pttMarkup("deck-ptt")}${commandButton("playback.replay", "Replay", "replay")}${commandButton("lane.announce", "Announce", "announce")}${commandButton("task.revealOnMac", "On Mac", "mac")}</div>
    <div class="deck-tape"><span>COMMAND RECEIPT</span><strong>${esc(commandReceipt?.detail || "All controls acknowledged by Mac")}</strong><span>r${snapshot.revision}</span></div>
  </section>`;
}

function checklistSurfaceMarkup(): string {
  const lane = activeLaneOrFallback();
  const phase = PHASE_COPY[snapshot.phase];
  const link = LINK_COPY[health];
  return `<section class="studio-surface checklist-surface" aria-label="Checklist layout">
    <aside class="check-ledger"><header><span>LANE · TASK · STATE</span><span>${snapshot.lanes.filter(isLaneAssigned).length} / 9 ARMED</span></header><div>${snapshot.lanes.map((item) => `<button class="check-row" ${laneButtonAttrs(item)}><span>${item.number.toString().padStart(2, "0")}</span><span><strong>${esc(item.label)}</strong><small>${isLaneAssigned(item) ? esc(item.taskTitle) : "No task locked"}</small></span><b>${item.number === snapshot.activeLane ? "ACTIVE" : isLaneAssigned(item) ? "ARMED" : "EMPTY"}</b></button>`).join("")}</div></aside>
    <div class="check-main">
      <header><div><p class="eyebrow">ACTIVE LANE</p><h1>${lane.number.toString().padStart(2, "0")} · ${esc(lane.label)}</h1></div><div><p class="eyebrow">LINK</p><strong>${esc(link.label)}</strong><small>${esc(hostName)} · r${snapshot.revision}</small></div></header>
      <dl class="check-fields"><div><dt>TASK</dt><dd>${esc(snapshot.activeTaskTitle || lane.taskTitle || "No task assigned")}</dd></div><div><dt>INPUT</dt><dd>${esc(snapshot.inputDeviceName || "Mac microphone")}</dd></div><div><dt>LEASE</dt><dd>${leaseRemaining()}</dd></div><div><dt>PHASE</dt><dd>${esc(phase.label)}</dd></div></dl>
      <div class="check-stage"><div class="waveform check-wave" aria-hidden="true">${waveMarkup(72)}</div>${pttMarkup("check-ptt")}${receiptMarkup()}</div>
      ${commandRailMarkup("check-commands")}
    </div>
  </section>`;
}

function pfdSurfaceMarkup(): string {
  const lane = activeLaneOrFallback();
  const phase = PHASE_COPY[snapshot.phase];
  const link = LINK_COPY[health];
  const linkSteps = ["HEALTHY", "SUSPECT", "DEGRADED", "OFFLINE"];
  const currentStep = health === "healthy" ? "HEALTHY" : health.toUpperCase();
  const playback = snapshot.playback.durationSeconds > 0 ? snapshot.playback.elapsedSeconds / snapshot.playback.durationSeconds : 0;
  return `<section class="studio-surface pfd-surface" aria-label="Glass PFD layout">
    <aside class="pfd-tape pfd-link"><p class="eyebrow">LINK</p><div>${linkSteps.map((step) => `<span data-active="${step === currentStep}">${step}<i></i></span>`).join("")}</div><button type="button" data-connection>${barsMarkup(link.bars)}<small>${esc(hostName)}</small></button></aside>
    <div class="pfd-center">
      <header><span><b>LOCKED</b>${esc(snapshot.activeTaskTitle || lane.taskTitle || "No task assigned")}</span><small>r${snapshot.revision}</small></header>
      <div class="pfd-field"><p>${esc(phase.label)}</p><h1><span>${lane.number.toString().padStart(2, "0")}</span>${esc(lane.label)}</h1><div class="waveform pfd-wave" aria-hidden="true">${waveMarkup(86)}</div><div class="pfd-meta"><span><b>INPUT</b>${esc(snapshot.inputDeviceName || "MAC MICROPHONE")}</span><span><b>QUEUE</b>${snapshot.playback.queueCount}</span><span><b>LEASE</b>${leaseRemaining()}</span></div>${pttMarkup("pfd-ptt")}</div>
      <nav class="pfd-bezel" aria-label="Lane selector">${snapshot.lanes.map((item) => `<button ${laneButtonAttrs(item)}><strong>${item.number}</strong><small>${esc(item.label)}</small></button>`).join("")}</nav>
    </div>
    <aside class="pfd-tape pfd-playback"><p class="eyebrow">NARRATION</p><div class="pfd-scale"><span>0:00</span><i style="top:${Math.round(playback * 100)}%"></i><span>${formatTime(snapshot.playback.durationSeconds)}</span></div>${commandRailMarkup("pfd-commands")}</aside>
  </section>`;
}

function microSurfaceMarkup(): string {
  const lane = activeLaneOrFallback();
  const routeHost = transport.mode === "demo" ? "LOCAL DEMO" : hostName;
  const routeDetail = transport.mode === "demo"
    ? "AUDIO ON THIS DEVICE · NO MAC LINK"
    : `${routeLabel()} · ${leaseRemaining()} LEASE`;
  return `<section class="studio-surface micro-surface" aria-label="Micro Deck layout">
    <div class="micro-housing">
      <i class="micro-screw ms-nw"></i><i class="micro-screw ms-ne"></i><i class="micro-screw ms-sw"></i><i class="micro-screw ms-se"></i>
      <div class="micro-controls"><div class="micro-encoder" aria-hidden="true"></div><div class="micro-touch"><span>TOUCH · NARRATION VOLUME</span><i><b style="width:${Math.round((snapshot.playback.durationSeconds > 0 ? snapshot.playback.elapsedSeconds / snapshot.playback.durationSeconds : .62) * 100)}%"></b></i><small>ENCODER · REASONING</small></div><div class="micro-knob" aria-hidden="true"></div></div>
      <div class="micro-grid">${snapshot.lanes.map((item) => `<button class="micro-key" ${laneButtonAttrs(item)}><span>${item.number}</span><i aria-hidden="true"></i><small>${esc(item.label)}</small></button>`).join("")}</div>
      <div class="micro-primary"><span class="micro-joystick" aria-hidden="true"></span>${pttMarkup("micro-ptt")}<div class="micro-aux">${commandButton("system.ping", "Ping", "link")}${commandButton("listening.cancel", "Cancel", "stop", true)}</div></div>
      ${commandRailMarkup("micro-commands")}
    </div>
    <div class="micro-readout">
      <header>
        <div class="micro-lane-lock"><span>${lane.number.toString().padStart(2, "0")}</span><div><p class="eyebrow">ACTIVE LANE</p><h1>${esc(lane.label)}</h1></div></div>
        <div class="micro-link-state" data-health="${health}"><span><strong>${esc(routeHost)}</strong><small>${esc(routeDetail)}</small></span></div>
      </header>
      <article class="micro-task" aria-labelledby="micro-task-title">
        <div class="micro-task-head"><p class="eyebrow">TASK LOCK</p><span>REV ${snapshot.revision}</span></div>
        <strong id="micro-task-title">${esc(snapshot.activeTaskTitle || lane.taskTitle || "No task assigned")}</strong>
      </article>
      ${microAudioMarkup()}
      ${microQualityMarkup()}
      ${activityMarkup()}
      ${microConfirmationMarkup()}
    </div>
  </section>`;
}

function surfaceMarkup(): string {
  switch (mode) {
    case "cluster": return clusterSurfaceMarkup();
    case "deck": return deckSurfaceMarkup();
    case "checklist": return checklistSurfaceMarkup();
    case "pfd": return pfdSurfaceMarkup();
    case "micro": return microSurfaceMarkup();
    default: return consoleSurfaceMarkup();
  }
}

function receiptMarkup(): string {
  if (!commandReceipt) {
    return `<div class="command-receipt" data-tone="idle"><strong>COMMAND CHANNEL</strong><span>Tap Ping Mac to verify the full control path.</span></div>`;
  }
  return `<div class="command-receipt" data-tone="${commandReceipt.tone}" role="status" aria-live="assertive">
    <strong>${esc(commandReceipt.title)}</strong><span>${esc(commandReceipt.detail)}</span>
  </div>`;
}

function sheetMarkup(): string {
  if (!connectionSheetOpen && !installSheetOpen && !appearanceSheetOpen) return "";
  if (appearanceSheetOpen) {
    if (appearanceSheetView === "editor") return themeEditorMarkup();
    const themes = listPadThemes();
    return `<div class="sheet-backdrop" data-dismiss-sheet>
      <section class="sheet appearance-sheet" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
        <button class="sheet-close" type="button" data-dismiss-sheet aria-label="Close">${icons.close}</button>
        <p class="eyebrow">STUDIO CONTROL SURFACES</p>
        <h2 id="appearance-title">Choose a Pad layout</h2>
        <div class="mode-options">${PAD_MODE_IDS.map((id, index) => `<button type="button" class="mode-option" data-select-mode="${id}" data-selected="${id === mode}" aria-pressed="${id === mode}">
          <span class="mode-preview" data-preview="${id}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          <span><strong>${(index + 1).toString().padStart(2, "0")} · ${PAD_MODE_COPY[id].label}</strong><small>${PAD_MODE_COPY[id].description}</small></span>
        </button>`).join("")}</div>
        <div class="finish-label"><p class="eyebrow">DECK THEME</p><span>Manifest · Contract v1</span></div>
        <div class="finish-options">${themes.map((item) => `<button type="button" data-select-theme="${item.id}" data-selected="${item.id === theme.id}" aria-pressed="${item.id === theme.id}"><i style="background:${themeAccent(item)}"></i>${esc(item.name)}</button>`).join("")}
          <button type="button" class="finish-new" data-new-theme><i aria-hidden="true">+</i>NEW DECK THEME</button>
        </div>
        ${theme.source === "custom" ? `<div class="theme-edit-row">
          <span>CUSTOM · ${esc(theme.name)}</span>
          <button type="button" data-edit-theme="${theme.id}">EDIT MANIFEST</button>
          <button type="button" class="theme-delete" data-delete-theme data-armed="${themeDeleteArmed}">${themeDeleteArmed ? "CONFIRM DELETE" : "DELETE"}</button>
        </div>` : ""}
        <p class="sheet-note">Deck themes are Chrome-style manifests — colors, CSS, and HTML chrome bound through Pad Theme Contract v1 (docs/theme-contract.md). Saved on this device; the Mac link keeps running while you switch.</p>
      </section>
    </div>`;
  }
  if (connectionSheetOpen) {
    const copy = LINK_COPY[health];
    return `<div class="sheet-backdrop" data-dismiss-sheet>
      <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="connection-title">
        <button class="sheet-close" type="button" data-dismiss-sheet aria-label="Close">${icons.close}</button>
        <p class="eyebrow">COMPANION LINK</p>
        <h2 id="connection-title">${esc(hostName)}</h2>
        <div class="link-readout" data-health="${health}">
          ${barsMarkup(copy.bars)}
          <div><strong>${esc(copy.label)}</strong><span>${esc(linkDetail || copy.detail)}</span></div>
        </div>
        <dl class="session-facts">
          <div><dt>PAIRING</dt><dd>${transport.mode === "demo" ? "Demonstration" : "Approved iPad"}</dd></div>
          <div><dt>LEASE</dt><dd>${leaseRemaining()} remaining</dd></div>
          <div><dt>ROUTE</dt><dd>${sessionSecurity === "demo" ? "In-browser simulator" : sessionSecurity === "lan-prototype-v1" ? "Trusted-LAN pilot · plaintext" : "End-to-end encrypted"}</dd></div>
          <div><dt>AUTHORITY</dt><dd>${transport.mode === "demo" ? "Browser demo state · no Mac connected" : "The Mac acknowledges every command"}</dd></div>
        </dl>
        <p class="sheet-note">Connection health and pairing trust are separate. If the route drops, this Pad keeps no command queued.</p>
      </section>
    </div>`;
  }
  return `<div class="sheet-backdrop" data-dismiss-sheet>
    <section class="sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <button class="sheet-close" type="button" data-dismiss-sheet aria-label="Close">${icons.close}</button>
      <p class="eyebrow">FULL-SCREEN CONTROL SURFACE</p>
      <h2 id="install-title">Add SpeakEasy Pad to Home Screen</h2>
      <ol>
        <li><span>01</span>Open this page in Safari.</li>
        <li><span>02</span>Tap Share, then “Add to Home Screen.”</li>
        <li><span>03</span>Launch SpeakEasy from the new icon.</li>
      </ol>
      ${deferredInstall ? '<button type="button" class="sheet-primary" data-install-now>INSTALL NOW</button>' : ""}
      <p class="sheet-note">Installed mode removes the browser toolbar and keeps the Pad focused on your active lanes.</p>
    </section>
  </div>`;
}

const THEME_STARTER_MANIFEST = `{
  "manifest_version": 1,
  "name": "My Deck",
  "version": "1.0.0",
  "author": "",
  "description": "",
  "pad_theme": {
    "contract": 1,
    "colors": {
      "signal": "#74f2ce",
      "ink": "#e8f0ee",
      "void": "#071013"
    },
    "css": "/* Extra rules, e.g. .pad[data-theme=\\"my-deck\\"] .ptt { border-radius: 0; } */",
    "html": "<!-- Optional chrome. Mount regions with data-pad-slot=\\"topbar|surface|status|sheets\\". -->"
  }
}`;

function themeEditorMarkup(): string {
  const title = editorThemeId ? `Edit “${esc(findPadTheme(editorThemeId)?.name ?? "deck theme")}”` : "New deck theme";
  return `<div class="sheet-backdrop" data-dismiss-sheet>
    <section class="sheet appearance-sheet theme-editor" role="dialog" aria-modal="true" aria-labelledby="theme-editor-title">
      <button class="sheet-close" type="button" data-dismiss-sheet aria-label="Close">${icons.close}</button>
      <p class="eyebrow">PAD THEME CONTRACT v1</p>
      <h2 id="theme-editor-title">${title}</h2>
      <p class="sheet-note">A deck theme is a Chrome-style manifest: metadata, <b>colors</b> (design tokens), <b>css</b>, and <b>html</b> chrome with <b>data-pad-slot</b> mounts. Full contract: docs/theme-contract.md.</p>
      <textarea class="theme-manifest" data-theme-manifest spellcheck="false" autocomplete="off" aria-label="Theme manifest JSON">${esc(editorText)}</textarea>
      ${editorErrors.length > 0 ? `<ul class="theme-editor-errors" role="alert">${editorErrors.map((error) => `<li>${esc(error)}</li>`).join("")}</ul>` : ""}
      <div class="theme-editor-actions">
        <button type="button" class="sheet-primary" data-theme-save>SAVE THEME</button>
        <button type="button" class="sheet-secondary" data-theme-template>STARTER TEMPLATE</button>
        <button type="button" class="sheet-secondary" data-theme-back>BACK</button>
      </div>
    </section>
  </div>`;
}

function fastenersMarkup(): string {
  return `<div class="fastener fastener-nw" aria-hidden="true"></div>
    <div class="fastener fastener-ne" aria-hidden="true"></div>
    <div class="fastener fastener-sw" aria-hidden="true"></div>
    <div class="fastener fastener-se" aria-hidden="true"></div>`;
}

function topbarMarkup(): string {
  const link = LINK_COPY[health];
  return `<header class="topbar">
    <div class="brand" aria-label="SpeakEasy Pad">
      <span class="brand-mark">SE</span>
      <span class="brand-copy"><strong>SPEAKEASY</strong><small>PAD / CONTROL SURFACE</small></span>
    </div>
    <div class="topbar-actions">
      <button class="theme-button" type="button" data-appearance aria-label="Change layout and deck theme. Current layout ${PAD_MODE_COPY[mode].label}, ${esc(theme.name)} theme">
        <span class="theme-swatch" aria-hidden="true"></span>${icons.theme}<span>${PAD_MODE_COPY[mode].label}</span>
      </button>
      <button class="install-button" type="button" data-install aria-label="Install SpeakEasy Pad">${icons.install}<span>INSTALL</span></button>
      <button class="link-chip" type="button" data-connection data-health="${health}" aria-label="${esc(link.label)}. ${esc(linkDetail || link.detail)}">
        ${mode === "micro" ? `<span class="link-measure">${health === "offline" ? "OFF" : lastAckLatencyMs === undefined ? "— MS" : `${lastAckLatencyMs} MS`}</span>` : barsMarkup(link.bars)}
        <span><strong>${transport.mode === "demo" ? "LOCAL DEMO" : mode === "micro" ? "COMMAND RTT" : esc(link.label)}</strong><small>${transport.mode === "demo" ? "AUDIO ON THIS DEVICE" : esc(hostName)}</small></span>
      </button>
    </div>
  </header>`;
}

function statusRailMarkup(): string {
  const disabled = commandDisabled();
  return `<footer class="status-rail">
    <span><i class="status-light"></i>${transport.mode === "demo" ? "INTERACTIVE DEMO" : sessionSecurity === "e2ee-v1" ? "SECURE PAD" : "LOCAL PAD"}</span>
    <span class="status-message" aria-live="polite">${esc(notice || snapshot.lastError || (disabled ? linkDetail : transport.mode === "demo" ? "HUDSON TTS · ELEVENLABS · MAC COMMANDS ARE SIMULATED" : "ALL COMMANDS ACKNOWLEDGED BY MAC"))}</span>
    <span>pad.speakeasy.local:8255 · BUILD ${PAD_BUILD}</span>
  </footer>`;
}

function padStateAttributes(): string {
  return `data-theme="${theme.id}" data-scheme="${theme.scheme}" data-contract="1" data-mode="${mode}" data-phase="${snapshot.phase}" data-tone="${phaseTone()}" data-link="${health}" data-notice="${noticeTone}" data-pressed="${pttPressed}" data-cancel="${pttCancelArmed}"`;
}

function render(): void {
  const regions: Array<[string, string]> = [
    ["topbar", topbarMarkup()],
    ["surface", surfaceMarkup()],
    ["status", statusRailMarkup()],
    ["sheets", sheetMarkup()],
  ];
  const chrome = theme.html ? sanitizeThemeHtml(theme.html) : "";
  const shellHtml = chrome
    ? `<main class="pad" ${padStateAttributes()}>${fastenersMarkup()}<div class="pad-chrome">${chrome}</div><div class="pad-fallback"></div></main>`
    : `<main class="pad" ${padStateAttributes()}>${fastenersMarkup()}<div data-pad-slot="topbar"></div><div data-pad-slot="surface"></div><div data-pad-slot="status"></div><div data-pad-slot="sheets"></div></main>`;

  const template = document.createElement("template");
  template.innerHTML = shellHtml;
  const shell = template.content;
  const fallback = shell.querySelector(".pad-fallback");
  for (const [name, markup] of regions) {
    const slot = shell.querySelector(`[data-pad-slot="${name}"]`);
    if (slot) slot.outerHTML = markup;
    else fallback?.insertAdjacentHTML("beforeend", markup);
  }
  root.replaceChildren(shell);

  bindEvents();
}

function showNotice(message: string, tone: "info" | "error" = "info"): void {
  notice = message;
  noticeTone = tone;
  render();
  window.setTimeout(() => {
    if (notice === message) {
      notice = "";
      render();
    }
  }, 3200);
}

function syncDemoAudioSnapshot(): void {
  if (!demoAudio) return;
  if (Number.isFinite(demoAudio.duration) && demoAudio.duration > 0) {
    snapshot.playback.durationSeconds = demoAudio.duration;
  }
  snapshot.playback.elapsedSeconds = Math.min(
    snapshot.playback.durationSeconds,
    Math.max(0, demoAudio.currentTime),
  );
}

function applyDemoAudioCommand(command: PadCommand): void {
  if (!demoAudio) return;
  demoAudio.volume = Math.max(0, Math.min(1, snapshot.playback.volume ?? 0.8));
  demoAudio.playbackRate = Math.max(0.5, Math.min(2, snapshot.playback.playbackRate ?? 1));

  switch (command.method) {
    case "playback.replay":
      demoAudio.currentTime = 0;
      void demoAudio.play().catch((error) => {
        const reason = error instanceof Error ? error.message : "The browser blocked audio playback.";
        commandReceipt = { tone: "error", title: "AUDIO DID NOT START", detail: reason };
        addActivity("AUDIO ERROR", reason, "error");
        showNotice("Demo audio did not start. Tap Replay once more.", "error");
      });
      return;
    case "playback.toggle":
      if (demoAudio.paused) {
        void demoAudio.play().catch(() => showNotice("Demo audio did not start. Tap Replay once more.", "error"));
      } else {
        demoAudio.pause();
      }
      return;
    case "playback.stop":
    case "lane.activateAndListen":
      demoAudio.pause();
      return;
    default:
      return;
  }
}

async function send(
  command: PadCommand,
  pendingKey: string = command.method,
  successMessage?: string,
): Promise<boolean> {
  const activityLabel = COMMAND_ACTIVITY_LABELS[command.method];
  const laneDetail = "arguments" in command && command.arguments?.lane
    ? `${activityLabel} · lane ${command.arguments.lane.toString().padStart(2, "0")}`
    : activityLabel;
  if (commandDisabled()) {
    commandReceipt = { tone: "error", title: "NOT SENT", detail: "The Mac link is offline." };
    addActivity("NOT SENT", `${laneDetail} · Mac offline`, "error");
    showNotice("The Mac is offline. No command was sent.", "error");
    return false;
  }
  // This runs before the first await so a Replay click retains the browser's
  // trusted user gesture and is allowed to start audio on iPadOS/Safari.
  applyDemoAudioCommand(command);
  pending.add(pendingKey);
  commandReceipt = { tone: "pending", title: "SENDING", detail: laneDetail };
  addActivity("COMMAND SENT", laneDetail, "pending");
  render();
  const commandStartedAt = performance.now();
  try {
    const ack = await transport.send(command, snapshot.revision);
    lastAckLatencyMs = Math.max(1, Math.round(performance.now() - commandStartedAt));
    if (!ack.ok) {
      commandReceipt = {
        tone: "error",
        title: "MAC REJECTED",
        detail: ack.error?.message ?? command.method,
      };
      addActivity("MAC REJECTED", ack.error?.message ?? laneDetail, "error");
      notifyNative("error");
      showNotice(ack.error?.message ?? "The Mac rejected this command.", "error");
      return false;
    }
    const authority = transport.mode === "demo" ? "DEMO" : "MAC";
    commandReceipt = {
      tone: "ok",
      title: `${authority} ACKNOWLEDGED`,
      detail: successMessage ?? laneDetail,
    };
    acknowledgedCommandCount += 1;
    addActivity("ACKNOWLEDGED", successMessage ?? laneDetail, "ok");
    console.info(`[SpeakEasy Pad] acknowledged ${command.method}`);
    notifyNative("acknowledged");
    if (successMessage) showNotice(successMessage);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The command failed.";
    commandReceipt = { tone: "error", title: "NO ACK", detail: message };
    addActivity("NO ACK", `${laneDetail} · ${message}`, "error");
    notifyNative("error");
    showNotice(message, "error");
    return false;
  } finally {
    pending.delete(pendingKey);
    render();
  }
}

async function pingMac(): Promise<void> {
  const target = transport.mode === "demo" ? "local demo" : "Mac";
  if (await send({ method: "system.ping" }, "system.ping", `Ping received by ${target}.`)) {
    const elapsed = lastAckLatencyMs ?? 0;
    commandReceipt = { tone: "ok", title: transport.mode === "demo" ? "DEMO ACKNOWLEDGED" : "MAC ACKNOWLEDGED", detail: `Ping · ${elapsed} ms round trip` };
    showNotice(`${transport.mode === "demo" ? "Local demo" : "Mac"} replied in ${elapsed} ms.`);
  }
}

function startPtt(button: HTMLElement): void {
  if (pttPressed || pttFinishPending || pending.has("ptt") || commandDisabled()) return;
  pttPressed = true;
  pttCancelArmed = false;
  pressButton = button;
  pressBounds = button.getBoundingClientRect();
  render();

  if (snapshot.phase === "speaking") {
    pttIntent = "stopNarration";
    pttStart = send({ method: "playback.stop" }, "ptt");
    return;
  }
  pttIntent = "listen";
  recordingLatch?.cancel();
  recordingLatch = new RecordingStartLatch();
  recordingLatch.observe(snapshot.phase);
  const lane = activeLane(snapshot);
  if (!lane?.canActivate) {
    pttPressed = false;
    pressBounds = undefined;
    recordingLatch.cancel();
    recordingLatch = undefined;
    showNotice("Configure and activate a lane on your Mac first.", "error");
    return;
  }
  pttStart = send({ method: "lane.activateAndListen", arguments: { lane: snapshot.activeLane ?? lane.number } }, "ptt");
}

async function finishPtt(cancelled: boolean): Promise<void> {
  if (!pttPressed) return;
  pttPressed = false;
  const shouldCancel = cancelled || pttCancelArmed;
  pttCancelArmed = false;
  if (pttIntent === "listen") pttFinishPending = true;
  render();
  const didStart = await pttStart;
  pttStart = undefined;
  pressBounds = undefined;
  if (!shouldFinishListening(pttIntent, didStart ?? false)) {
    recordingLatch?.cancel();
    recordingLatch = undefined;
    pttFinishPending = false;
    render();
    return;
  }

  const latch = recordingLatch;
  try {
    const command = latch ? await finishCommandAfterRecording(latch, shouldCancel) : undefined;
    if (command) await send(command, "ptt");
  } finally {
    latch?.cancel();
    recordingLatch = undefined;
    pttFinishPending = false;
    render();
  }
}

function closeSheets(): void {
  connectionSheetOpen = false;
  installSheetOpen = false;
  appearanceSheetOpen = false;
  appearanceSheetView = "browse";
  editorErrors = [];
  themeDeleteArmed = false;
}

function bindEvents(): void {
  root.querySelectorAll<HTMLButtonElement>("[data-lane]").forEach((button) => {
    button.addEventListener("click", () => {
      const laneId = Number(button.dataset.lane);
      if (Number.isInteger(laneId)) {
        void send(
          { method: "lane.activate", arguments: { lane: laneId } },
          `lane-${laneId}`,
          `Lane ${laneId} acknowledged · checking its task on Mac.`,
        );
      }
    });
  });

  root.querySelector<HTMLButtonElement>("[data-appearance]")?.addEventListener("click", () => {
    appearanceSheetOpen = true;
    render();
  });
  root.querySelectorAll<HTMLButtonElement>("[data-select-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.selectMode as PadMode;
      if (!PAD_MODE_IDS.includes(next)) return;
      mode = next;
      savePadMode(mode);
      applyPadMode(mode);
      notifyNative("selection");
      render();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-select-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = findPadTheme(button.dataset.selectTheme ?? "");
      if (!next) return;
      theme = next;
      savePadTheme(theme.id);
      applyPadTheme(theme);
      themeDeleteArmed = false;
      notifyNative("selection");
      render();
    });
  });
  root.querySelector<HTMLButtonElement>("[data-new-theme]")?.addEventListener("click", () => {
    appearanceSheetView = "editor";
    editorThemeId = undefined;
    editorText = THEME_STARTER_MANIFEST;
    editorErrors = [];
    render();
  });
  root.querySelector<HTMLButtonElement>("[data-edit-theme]")?.addEventListener("click", (event) => {
    const target = findPadTheme((event.currentTarget as HTMLButtonElement).dataset.editTheme ?? "");
    if (!target?.manifest) return;
    appearanceSheetView = "editor";
    editorThemeId = target.id;
    editorText = JSON.stringify(target.manifest, null, 2);
    editorErrors = [];
    render();
  });
  root.querySelector<HTMLButtonElement>("[data-delete-theme]")?.addEventListener("click", () => {
    if (theme.source !== "custom") return;
    if (!themeDeleteArmed) {
      themeDeleteArmed = true;
      render();
      return;
    }
    themeDeleteArmed = false;
    deleteCustomTheme(theme.id);
    theme = readPadTheme({ getItem: () => null });
    savePadTheme(theme.id);
    applyPadTheme(theme);
    notifyNative("selection");
    render();
  });
  root.querySelector<HTMLTextAreaElement>("[data-theme-manifest]")?.addEventListener("input", (event) => {
    editorText = (event.currentTarget as HTMLTextAreaElement).value;
  });
  root.querySelector<HTMLButtonElement>("[data-theme-template]")?.addEventListener("click", () => {
    editorText = THEME_STARTER_MANIFEST;
    editorErrors = [];
    render();
  });
  root.querySelector<HTMLButtonElement>("[data-theme-back]")?.addEventListener("click", () => {
    appearanceSheetView = "browse";
    editorErrors = [];
    render();
  });
  root.querySelector<HTMLButtonElement>("[data-theme-save]")?.addEventListener("click", () => {
    const result = parseThemeManifest(editorText);
    if (!result.ok) {
      editorErrors = result.errors;
      render();
      return;
    }
    const saved = upsertCustomTheme(result.manifest, editorThemeId);
    theme = saved;
    savePadTheme(theme.id);
    applyPadTheme(theme);
    appearanceSheetView = "browse";
    editorErrors = [];
    themeDeleteArmed = false;
    notifyNative("selection");
    showNotice(`Deck theme “${saved.name}” saved.`);
  });

  const ptt = root.querySelector<HTMLButtonElement>("[data-ptt]");
  ptt?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    ptt.setPointerCapture?.(event.pointerId);
    startPtt(ptt);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      switch (button.dataset.command) {
        case "system.ping": void pingMac(); break;
        case "listening.cancel": void send({ method: "listening.cancel" }, "listening.cancel", "Recording cancelled."); break;
        case "playback.replay": void send(
          { method: "playback.replay" },
          "playback.replay",
          transport.mode === "demo" ? "Hudson Voice · ElevenLabs response playing here." : "Replay started on Mac.",
        ); break;
        case "playback.toggle": void send(
          { method: "playback.toggle" },
          "playback.toggle",
          snapshot.playback.state === "playing" ? "Narration paused." : "Narration playing.",
        ); break;
        case "lane.announce": void send({ method: "lane.announce" }, "lane.announce", "Announcement acknowledged by Mac."); break;
        case "task.revealOnMac": void send({ method: "task.revealOnMac" }, "task.revealOnMac", "Task revealed on Mac."); break;
      }
    });
  });

  root.querySelector<HTMLButtonElement>("[data-connection]")?.addEventListener("click", () => {
    connectionSheetOpen = true;
    render();
  });

  const volumeSlider = root.querySelector<HTMLInputElement>("[data-demo-volume]");
  volumeSlider?.addEventListener("pointerdown", () => {
    volumeDragging = true;
  });
  volumeSlider?.addEventListener("input", () => {
    const value = Math.max(0, Math.min(100, Number(volumeSlider.value))) / 100;
    snapshot.playback.volume = value;
    if (demoAudio) demoAudio.volume = value;
    volumeSlider.style.setProperty("--fill", `${Math.round(value * 100)}%`);
    const readout = root.querySelector<HTMLElement>("[data-demo-volume-value]");
    if (readout) readout.textContent = `${Math.round(value * 100)}%`;
  });
  root.querySelector<HTMLButtonElement>("[data-install]")?.addEventListener("click", () => {
    installSheetOpen = true;
    render();
  });
  root.querySelectorAll<HTMLElement>("[data-dismiss-sheet]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.currentTarget !== event.target && (event.currentTarget as HTMLElement).classList.contains("sheet-backdrop")) return;
      closeSheets();
      render();
    });
  });
  root.querySelector<HTMLButtonElement>("[data-install-now]")?.addEventListener("click", async () => {
    await deferredInstall?.prompt();
    deferredInstall = undefined;
    installSheetOpen = false;
    render();
  });
}

window.addEventListener("pointerup", () => {
  volumeDragging = false;
  void finishPtt(false);
});
window.addEventListener("pointercancel", () => {
  volumeDragging = false;
  void finishPtt(true);
});
window.addEventListener("pointermove", (event) => {
  if (!pttPressed || !pressBounds) return;
  const outside = event.clientX < pressBounds.left - 24
    || event.clientX > pressBounds.right + 24
    || event.clientY < pressBounds.top - 24
    || event.clientY > pressBounds.bottom + 24;
  if (outside !== pttCancelArmed) {
    pttCancelArmed = outside;
    render();
  }
});
window.addEventListener("blur", () => void finishPtt(true));
window.addEventListener("keydown", (event) => {
  if ((event.code === "Space" || event.code === "Enter") && !event.repeat && !connectionSheetOpen && !installSheetOpen && !appearanceSheetOpen && document.activeElement?.tagName !== "BUTTON") {
    event.preventDefault();
    startPtt(pressButton ?? root);
  }
  if (event.key === "Escape") {
    if (connectionSheetOpen || installSheetOpen || appearanceSheetOpen) {
      closeSheets();
      render();
    } else if (pttPressed) void finishPtt(true);
  }
});
window.addEventListener("keyup", (event) => {
  if ((event.code === "Space" || event.code === "Enter") && pttPressed) {
    event.preventDefault();
    void finishPtt(false);
  }
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event as BeforeInstallPromptEvent;
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") transport.resume?.();
});
window.addEventListener("pageshow", () => transport.resume?.());

demoAudio?.addEventListener("loadedmetadata", () => {
  syncDemoAudioSnapshot();
  render();
});
demoAudio?.addEventListener("timeupdate", () => {
  syncDemoAudioSnapshot();
  if (!volumeDragging) render();
});
demoAudio?.addEventListener("play", () => {
  syncDemoAudioSnapshot();
  snapshot.playback.state = "playing";
  render();
});
demoAudio?.addEventListener("pause", () => {
  syncDemoAudioSnapshot();
  if (!demoAudio.ended && snapshot.playback.state === "playing") snapshot.playback.state = "paused";
  render();
});
demoAudio?.addEventListener("ended", () => {
  syncDemoAudioSnapshot();
  snapshot.playback.state = "idle";
  snapshot.playback.audioLevel = 0;
  if (snapshot.phase === "speaking") snapshot.phase = "ready";
  render();
});

transport.subscribe((event) => {
  if (event.type === "snapshot") {
    const previousPhase = snapshot.phase;
    const previousLane = snapshot.activeLane;
    snapshot = event.snapshot;
    syncDemoAudioSnapshot();
    lastSnapshotReceivedAt = Date.now();
    recordingLatch?.observe(snapshot.phase);
    if (snapshot.activeLane !== previousLane) {
      const lane = activeLane(snapshot);
      addActivity("LANE ACTIVE", `${snapshot.activeLane?.toString().padStart(2, "0") ?? "--"} · ${lane?.label ?? "Unassigned"}`, "ok");
    }
    if (snapshot.phase !== previousPhase) {
      const phase = PHASE_COPY[snapshot.phase];
      addActivity(phase.label, snapshot.lastError || PHASE_ACTIVITY_DETAIL[snapshot.phase], phaseActivityTone());
    }
  }
  if (event.type === "session") {
    hostName = event.hostName;
    leaseExpiresAt = event.leaseExpiresAt;
    sessionSecurity = event.security;
    addActivity("SESSION OPENED", `${event.hostName} · ${event.security === "demo" ? "simulated route" : "Mac authority"}`, "ok");
  }
  if (event.type === "link") {
    const previousHealth = health;
    health = event.health;
    linkDetail = event.detail;
    if (event.health !== previousHealth) addActivity("ROUTE CHANGE", `${LINK_COPY[event.health].label} · ${event.detail}`, event.health === "offline" ? "error" : event.health === "healthy" ? "ok" : "pending");
  }
  if (event.type === "error") {
    notice = event.message;
    noticeTone = "error";
    addActivity("TRANSPORT ERROR", event.message, "error");
  }
  render();
});

render();
window.setInterval(() => {
  const qualityAge = root.querySelector<HTMLElement>("[data-quality-state-age]");
  if (qualityAge) qualityAge.textContent = snapshotAgeLabel();
}, 1_000);
void transport.connect().catch((error) => {
  health = "offline";
  linkDetail = "Mac unavailable on the local network";
  notice = error instanceof Error ? error.message : "Could not connect to the Mac.";
  noticeTone = "error";
  render();
});

if ("serviceWorker" in navigator && window.location.protocol !== "http:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}

void bootstrap;
