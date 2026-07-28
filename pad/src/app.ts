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
import { applyPadTheme, PAD_THEME_IDS, PAD_THEME_LABELS, readPadTheme, savePadTheme, type PadTheme } from "./theme.ts";
import { applyPadMode, PAD_MODE_COPY, PAD_MODE_IDS, readPadMode, savePadMode, type PadMode } from "./mode.ts";

const mount = document.querySelector<HTMLDivElement>("#app");
if (!mount) throw new Error("SpeakEasy Pad could not find its app mount.");
const root: HTMLDivElement = mount;
const PAD_BUILD = "0726.6";

const bootstrap = consumeBootstrapFromLocation(window.location, window.history);
const transport = createTransport(bootstrap.kind === "valid" ? bootstrap.payload : undefined);

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
let deferredInstall: BeforeInstallPromptEvent | undefined;
let pttStart: Promise<boolean> | undefined;
let pressButton: HTMLElement | undefined;
let pressBounds: DOMRect | undefined;
let pttIntent: "listen" | "stopNarration" = "listen";
let recordingLatch: RecordingStartLatch | undefined;
let commandReceipt: { tone: "ok" | "error" | "pending"; title: string; detail: string } | undefined;
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
    .map((height) => `<i style="height:${Math.round(height * 100)}%"></i>`)
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
        <div class="transport-progress"><span style="width:${Math.round(playbackProgress * 100)}%"></span></div>
        <span>${formatTime(snapshot.playback.elapsedSeconds)}</span><strong>${snapshot.playback.state === "playing" ? "PLAYING RESPONSE" : esc(snapshot.playback.title || "LAST RESPONSE")}</strong><span>−${formatTime(snapshot.playback.durationSeconds - snapshot.playback.elapsedSeconds)}</span>
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
  const phase = PHASE_COPY[snapshot.phase];
  return `<section class="studio-surface micro-surface" aria-label="Micro Deck layout">
    <div class="micro-housing">
      <i class="micro-screw ms-nw"></i><i class="micro-screw ms-ne"></i><i class="micro-screw ms-sw"></i><i class="micro-screw ms-se"></i>
      <div class="micro-controls"><div class="micro-encoder" aria-hidden="true"></div><div class="micro-touch"><span>TOUCH · NARRATION VOLUME</span><i><b style="width:${Math.round((snapshot.playback.durationSeconds > 0 ? snapshot.playback.elapsedSeconds / snapshot.playback.durationSeconds : .62) * 100)}%"></b></i><small>ENCODER · REASONING</small></div><div class="micro-knob" aria-hidden="true"></div></div>
      <div class="micro-grid">${snapshot.lanes.map((item) => `<button class="micro-key" ${laneButtonAttrs(item)}><span>${item.number}</span><i aria-hidden="true"></i><small>${esc(item.label)}</small></button>`).join("")}</div>
      <div class="micro-primary"><span class="micro-joystick" aria-hidden="true"></span>${pttMarkup("micro-ptt")}<div class="micro-aux">${commandButton("system.ping", "Ping", "link")}${commandButton("listening.cancel", "Cancel", "stop", true)}</div></div>
      ${commandRailMarkup("micro-commands")}
    </div>
    <div class="micro-readout">
      <header><div><p class="eyebrow">LOCKED TASK · LANE ${lane.number}</p><h1>${esc(lane.label)}</h1></div><strong>${esc(LINK_COPY[health].label)}</strong></header>
      <div class="micro-task"><strong>${esc(snapshot.activeTaskTitle || lane.taskTitle || "No task assigned")}</strong><span>${esc(snapshot.inputDeviceName || "MAC MICROPHONE")}</span></div>
      <div class="micro-phase"><p class="eyebrow">PHASE</p><strong>${esc(phase.label)}</strong><div class="waveform micro-wave" aria-hidden="true">${waveMarkup(52)}</div></div>
      ${receiptMarkup()}
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
    return `<div class="sheet-backdrop" data-dismiss-sheet>
      <section class="sheet appearance-sheet" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
        <button class="sheet-close" type="button" data-dismiss-sheet aria-label="Close">${icons.close}</button>
        <p class="eyebrow">STUDIO CONTROL SURFACES</p>
        <h2 id="appearance-title">Choose a Pad layout</h2>
        <div class="mode-options">${PAD_MODE_IDS.map((id, index) => `<button type="button" class="mode-option" data-select-mode="${id}" data-selected="${id === mode}" aria-pressed="${id === mode}">
          <span class="mode-preview" data-preview="${id}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
          <span><strong>${(index + 1).toString().padStart(2, "0")} · ${PAD_MODE_COPY[id].label}</strong><small>${PAD_MODE_COPY[id].description}</small></span>
        </button>`).join("")}</div>
        <div class="finish-label"><p class="eyebrow">FINISH</p><span>Independent of layout</span></div>
        <div class="finish-options">${PAD_THEME_IDS.map((id) => `<button type="button" data-select-theme="${id}" data-selected="${id === theme}" aria-pressed="${id === theme}"><i data-finish="${id}"></i>${PAD_THEME_LABELS[id]}</button>`).join("")}</div>
        <p class="sheet-note">Layout and finish are saved on this device. The Mac link and active lane keep running while you switch.</p>
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
          <div><dt>AUTHORITY</dt><dd>The Mac acknowledges every command</dd></div>
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

function render(): void {
  const link = LINK_COPY[health];
  const disabled = commandDisabled();

  root.innerHTML = `
    <main class="pad" data-theme="${theme}" data-mode="${mode}" data-phase="${snapshot.phase}" data-tone="${phaseTone()}" data-link="${health}" data-notice="${noticeTone}" data-pressed="${pttPressed}" data-cancel="${pttCancelArmed}">
      <div class="fastener fastener-nw" aria-hidden="true"></div>
      <div class="fastener fastener-ne" aria-hidden="true"></div>
      <div class="fastener fastener-sw" aria-hidden="true"></div>
      <div class="fastener fastener-se" aria-hidden="true"></div>
      <header class="topbar">
        <div class="brand" aria-label="SpeakEasy Pad">
          <span class="brand-mark">SE</span>
          <span class="brand-copy"><strong>SPEAKEASY</strong><small>PAD / CONTROL SURFACE</small></span>
        </div>
        <div class="topbar-actions">
          <button class="theme-button" type="button" data-appearance aria-label="Change layout and finish. Current layout ${PAD_MODE_COPY[mode].label}, ${PAD_THEME_LABELS[theme]} finish">
            <span class="theme-swatch" aria-hidden="true"></span>${icons.theme}<span>${PAD_MODE_COPY[mode].label}</span>
          </button>
          <button class="install-button" type="button" data-install aria-label="Install SpeakEasy Pad">${icons.install}<span>INSTALL</span></button>
          <button class="link-chip" type="button" data-connection data-health="${health}" aria-label="${esc(link.label)}. ${esc(linkDetail || link.detail)}">
            ${barsMarkup(link.bars)}
            <span><strong>${esc(link.label)}</strong><small>${esc(hostName)}</small></span>
          </button>
        </div>
      </header>
      ${surfaceMarkup()}

      <footer class="status-rail">
        <span><i class="status-light"></i>${transport.mode === "demo" ? "INTERACTIVE DEMO" : sessionSecurity === "e2ee-v1" ? "SECURE PAD" : "LOCAL PAD"}</span>
        <span class="status-message" aria-live="polite">${esc(notice || snapshot.lastError || (disabled ? linkDetail : "ALL COMMANDS ACKNOWLEDGED BY MAC"))}</span>
        <span>pad.speakeasy.local:8255 · BUILD ${PAD_BUILD}</span>
      </footer>
      ${sheetMarkup()}
    </main>`;

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

async function send(
  command: PadCommand,
  pendingKey: string = command.method,
  successMessage?: string,
): Promise<boolean> {
  if (commandDisabled()) {
    commandReceipt = { tone: "error", title: "NOT SENT", detail: "The Mac link is offline." };
    showNotice("The Mac is offline. No command was sent.", "error");
    return false;
  }
  pending.add(pendingKey);
  commandReceipt = { tone: "pending", title: "SENDING", detail: command.method };
  render();
  try {
    const ack = await transport.send(command, snapshot.revision);
    if (!ack.ok) {
      commandReceipt = {
        tone: "error",
        title: "MAC REJECTED",
        detail: ack.error?.message ?? command.method,
      };
      notifyNative("error");
      showNotice(ack.error?.message ?? "The Mac rejected this command.", "error");
      return false;
    }
    commandReceipt = {
      tone: "ok",
      title: "MAC ACKNOWLEDGED",
      detail: successMessage ?? command.method,
    };
    console.info(`[SpeakEasy Pad] acknowledged ${command.method}`);
    notifyNative("acknowledged");
    if (successMessage) showNotice(successMessage);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "The command failed.";
    commandReceipt = { tone: "error", title: "NO ACK", detail: message };
    notifyNative("error");
    showNotice(message, "error");
    return false;
  } finally {
    pending.delete(pendingKey);
    render();
  }
}

async function pingMac(): Promise<void> {
  const started = performance.now();
  if (await send({ method: "system.ping" }, "system.ping", "Ping received by Mac.")) {
    const elapsed = Math.max(1, Math.round(performance.now() - started));
    commandReceipt = { tone: "ok", title: "MAC ACKNOWLEDGED", detail: `Ping · ${elapsed} ms round trip` };
    showNotice(`Mac replied in ${elapsed} ms.`);
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
      const next = button.dataset.selectTheme as PadTheme;
      if (!PAD_THEME_IDS.includes(next)) return;
      theme = next;
      savePadTheme(theme);
      applyPadTheme(theme);
      notifyNative("selection");
      render();
    });
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
        case "playback.replay": void send({ method: "playback.replay" }, "playback.replay", "Replay acknowledged by Mac."); break;
        case "lane.announce": void send({ method: "lane.announce" }, "lane.announce", "Announcement acknowledged by Mac."); break;
        case "task.revealOnMac": void send({ method: "task.revealOnMac" }, "task.revealOnMac", "Task revealed on Mac."); break;
      }
    });
  });

  root.querySelector<HTMLButtonElement>("[data-connection]")?.addEventListener("click", () => {
    connectionSheetOpen = true;
    render();
  });
  root.querySelector<HTMLButtonElement>("[data-install]")?.addEventListener("click", () => {
    installSheetOpen = true;
    render();
  });
  root.querySelectorAll<HTMLElement>("[data-dismiss-sheet]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.currentTarget !== event.target && (event.currentTarget as HTMLElement).classList.contains("sheet-backdrop")) return;
      connectionSheetOpen = false;
      installSheetOpen = false;
      appearanceSheetOpen = false;
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

window.addEventListener("pointerup", () => void finishPtt(false));
window.addEventListener("pointercancel", () => void finishPtt(true));
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
      connectionSheetOpen = false;
      installSheetOpen = false;
      appearanceSheetOpen = false;
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

transport.subscribe((event) => {
  if (event.type === "snapshot") {
    snapshot = event.snapshot;
    recordingLatch?.observe(snapshot.phase);
  }
  if (event.type === "session") {
    hostName = event.hostName;
    leaseExpiresAt = event.leaseExpiresAt;
    sessionSecurity = event.security;
  }
  if (event.type === "link") {
    health = event.health;
    linkDetail = event.detail;
  }
  if (event.type === "error") {
    notice = event.message;
    noticeTone = "error";
  }
  render();
});

render();
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
