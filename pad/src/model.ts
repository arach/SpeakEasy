export type Phase =
  | "unlocked"
  | "validatingLock"
  | "cueing"
  | "ready"
  | "warmingUp"
  | "recording"
  | "transcribing"
  | "submitting"
  | "preparingSpeech"
  | "speaking"
  | "failed";

export type LinkHealth = "connecting" | "healthy" | "suspect" | "degraded" | "offline";

export interface Lane {
  number: number;
  label: string;
  taskTitle: string;
  isActive: boolean;
  canActivate: boolean;
}

export interface PlaybackState {
  state: string;
  title?: string;
  elapsedSeconds: number;
  durationSeconds: number;
  queueCount: number;
}

export interface PadSnapshot {
  revision: number;
  generatedAtMilliseconds: number;
  phase: Phase;
  phaseLabel: string;
  activeLane?: number;
  activeTaskTitle?: string;
  inputDeviceName?: string;
  lastError?: string;
  lanes: Lane[];
  playback: PlaybackState;
  capabilities: string[];
}

export interface PadCommandArguments {
  lane?: number;
  clientName?: string;
  clientVersion?: string;
  supportedProtocolVersions?: number[];
}

export type PadCommand =
  | { method: "state.snapshot" }
  | { method: "system.hello"; arguments?: PadCommandArguments }
  | { method: "system.ping" }
  | { method: "lane.activate"; arguments: { lane: number } }
  | { method: "lane.activateAndListen"; arguments: { lane: number } }
  | { method: "listening.toggle" }
  | { method: "listening.cancel" }
  | { method: "lane.announce" }
  | { method: "playback.toggle" }
  | { method: "playback.stop" }
  | { method: "playback.replay" }
  | { method: "task.revealOnMac" };

export interface CommandEnvelope {
  protocolVersion: 1;
  requestId: string;
  sessionId: string;
  sequence: number;
  sentAtMilliseconds: number;
  expectedRevision?: number;
  method: PadCommand["method"];
  arguments?: PadCommandArguments;
}

export interface CommandAck {
  protocolVersion: 1;
  requestId: string;
  ok: boolean;
  stateRevision: number;
  snapshot?: PadSnapshot;
  error?: { code: string; message: string; retryable: boolean };
}

export type TransportEvent =
  | { type: "link"; health: LinkHealth; detail: string }
  | { type: "session"; hostName: string; leaseExpiresAt: number; security: "demo" | "lan-prototype-v1" | "e2ee-v1" }
  | { type: "snapshot"; snapshot: PadSnapshot }
  | { type: "error"; message: string };

export const PHASE_COPY: Record<Phase, { label: string; action: string; hint: string }> = {
  unlocked: { label: "UNLOCKED", action: "CHOOSE A TASK", hint: "Lock a Codex task on the Mac" },
  validatingLock: { label: "CHECKING TASK", action: "STAND BY", hint: "The Mac is validating the lock" },
  cueing: { label: "CONFIRMING", action: "STAND BY", hint: "Playing the lane cue" },
  ready: { label: "READY", action: "HOLD TO SPEAK", hint: "Release to send" },
  warmingUp: { label: "ARMING", action: "ARMING MIC", hint: "Mac is opening the input" },
  recording: { label: "RECORDING", action: "RELEASE TO SEND", hint: "Slide off to cancel" },
  transcribing: { label: "TRANSCRIBING", action: "TRANSCRIBING", hint: "Mac is resolving the audio" },
  submitting: { label: "SUBMITTING", action: "SUBMITTING", hint: "Handing the turn to Codex" },
  preparingSpeech: { label: "PREPARING", action: "PREPARING VOICE", hint: "The Mac is generating narration" },
  speaking: { label: "NARRATING", action: "STOP NARRATION", hint: "Playing the latest response" },
  failed: { label: "FAILED", action: "RETRY", hint: "The last command did not reach Codex" },
};

export const LINK_COPY: Record<LinkHealth, { label: string; detail: string; bars: number }> = {
  connecting: { label: "CONNECTING", detail: "Opening Mac control channel", bars: 1 },
  healthy: { label: "LINK OK", detail: "Mac-authoritative control channel", bars: 4 },
  suspect: { label: "SUSPECT", detail: "One timeout · checking route", bars: 3 },
  degraded: { label: "DEGRADED", detail: "Trying to reach your Mac", bars: 1 },
  offline: { label: "OFFLINE", detail: "Commands are unavailable", bars: 0 },
};

export function isLaneAssigned(lane: Lane): boolean {
  return lane.taskTitle.trim().length > 0;
}

export function activeLane(snapshot: PadSnapshot): Lane | undefined {
  return snapshot.lanes.find((lane) => lane.number === snapshot.activeLane) ?? snapshot.lanes[0];
}

export function shouldFinishListening(intent: "listen" | "stopNarration", didStart: boolean): boolean {
  return intent === "listen" && didStart;
}

const now = Date.now();

export const DEMO_SNAPSHOT: PadSnapshot = {
  revision: 4172,
  generatedAtMilliseconds: now,
  activeLane: 2,
  phase: "ready",
  phaseLabel: "Ready",
  activeTaskTitle: "Secure companion transport",
  inputDeviceName: "MacBook Air Microphone",
  lanes: [
    { number: 1, label: "SpeakEasy", taskTitle: "Build the iPad command pad", isActive: false, canActivate: true },
    { number: 2, label: "Hudson", taskTitle: "Secure companion transport", isActive: true, canActivate: true },
    { number: 3, label: "Talkie", taskTitle: "Nearby Mac approval UX", isActive: false, canActivate: true },
    { number: 4, label: "Vox", taskTitle: "Cue latency budget", isActive: false, canActivate: true },
    { number: 5, label: "Release", taskTitle: "Notarization and release", isActive: false, canActivate: true },
    { number: 6, label: "Research", taskTitle: "LAN trust and reconnect", isActive: false, canActivate: true },
    { number: 7, label: "Site", taskTitle: "Docs information design", isActive: false, canActivate: true },
    { number: 8, label: "Inbox", taskTitle: "Triage the agent queue", isActive: false, canActivate: true },
    { number: 9, label: "Scratch", taskTitle: "", isActive: false, canActivate: false },
  ],
  playback: { state: "paused", title: "Latest Codex response", elapsedSeconds: 38, durationSeconds: 91, queueCount: 0 },
  capabilities: [
    "system.hello", "state.snapshot", "lane.activateAndListen", "lane.activate", "listening.toggle",
    "listening.cancel", "lane.announce", "playback.toggle", "playback.stop", "playback.replay", "task.revealOnMac",
  ],
};

export function waveform(phase: Phase, count = 41): number[] {
  const active = phase === "recording" || phase === "speaking";
  return Array.from({ length: count }, (_, index) => {
    if (!active) return 0.08 + ((index * 7) % 3) * 0.015;
    const envelope = Math.sin(Math.PI * (index / count)) ** 0.7;
    const detail = 0.56 + 0.27 * Math.sin(index * 0.9) + 0.17 * Math.sin(index * 2.31 + 0.4);
    return Math.max(0.08, Math.min(1, envelope * detail));
  });
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.max(0, Math.round(seconds - minutes * 60)).toString().padStart(2, "0")}`;
}
