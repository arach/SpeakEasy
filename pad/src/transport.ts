import type { BootstrapPayload } from "./bootstrap.ts";
import {
  DEMO_SNAPSHOT,
  type CommandAck,
  type CommandEnvelope,
  type LinkHealth,
  type PadCommand,
  type PadSnapshot,
  type TransportEvent,
} from "./model.ts";

export interface PadTransport {
  readonly mode: "demo" | "live";
  connect(): Promise<void>;
  disconnect(): void;
  resume?(): void;
  subscribe(listener: (event: TransportEvent) => void): () => void;
  send(command: PadCommand, baseRevision: number): Promise<CommandAck>;
}

export interface SecureTransportFactory {
  create(payload: BootstrapPayload): PadTransport;
}

declare global {
  interface Window {
    SPEAKEASY_PAD_SECURE_TRANSPORT?: SecureTransportFactory;
  }
}

function cloneSnapshot(snapshot: PadSnapshot): PadSnapshot {
  return structuredClone(snapshot);
}

interface RequestIdEntropy {
  randomUUID?: () => string;
  fillRandomValues?: (bytes: Uint8Array) => void;
  random?: () => number;
}

/**
 * Produces a UUID that Swift's `UUID` decoder accepts on every Pad origin.
 *
 * Safari intentionally withholds `crypto.randomUUID()` on an insecure HTTP
 * origin such as pad.speakeasy.local. `crypto.getRandomValues()` remains the
 * preferred fallback; Math.random is sufficient only for the non-secret
 * request correlation identifier when Web Crypto is unavailable altogether.
 */
export function makeRequestId(entropy?: RequestIdEntropy): string {
  const crypto = globalThis.crypto;
  const randomUUID = entropy ? entropy.randomUUID : crypto?.randomUUID?.bind(crypto);
  if (randomUUID) return randomUUID();

  const bytes = new Uint8Array(16);
  const fillRandomValues = entropy ? entropy.fillRandomValues : crypto?.getRandomValues?.bind(crypto);
  if (fillRandomValues) {
    fillRandomValues(bytes);
  } else {
    const random = entropy?.random ?? Math.random;
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(random() * 256);
    }
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Foundation encodes UUID strings in uppercase; browsers commonly use lowercase. */
export function requestIdKey(requestId: string): string {
  return requestId.toLowerCase();
}

function id(): string {
  return makeRequestId();
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class MockPadTransport implements PadTransport {
  readonly mode = "demo" as const;
  #snapshot = cloneSnapshot(DEMO_SNAPSHOT);
  #listeners = new Set<(event: TransportEvent) => void>();
  #timers = new Set<ReturnType<typeof setTimeout>>();

  subscribe(listener: (event: TransportEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async connect(): Promise<void> {
    this.#emit({ type: "link", health: "connecting", detail: "Opening local demonstration" });
    await delay(260);
    this.#emit({ type: "link", health: "healthy", detail: "Interactive demo · Mac state simulated" });
    this.#emit({ type: "session", hostName: "Arach’s MacBook Air", leaseExpiresAt: Date.now() + 22 * 60 * 60 * 1000, security: "demo" });
    this.#emit({ type: "snapshot", snapshot: cloneSnapshot(this.#snapshot) });
  }

  disconnect(): void {
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
    this.#emit({ type: "link", health: "offline", detail: "Demo stopped" });
  }

  async send(command: PadCommand, baseRevision: number): Promise<CommandAck> {
    const commandId = id();
    const envelope: CommandEnvelope = {
      protocolVersion: 1,
      requestId: commandId,
      sessionId: "00000000-0000-4000-8000-000000000001",
      sequence: 1,
      sentAtMilliseconds: Date.now(),
      expectedRevision: baseRevision,
      method: command.method,
      arguments: "arguments" in command ? command.arguments : undefined,
    };
    await delay(90);
    if (baseRevision > this.#snapshot.revision) {
      return {
        protocolVersion: 1,
        requestId: envelope.requestId,
        ok: false,
        stateRevision: this.#snapshot.revision,
        snapshot: cloneSnapshot(this.#snapshot),
        error: { code: "future_revision", message: "The Pad state is ahead of the Mac.", retryable: true },
      };
    }

    this.#apply(command);
    this.#snapshot.revision += 1;
    this.#emit({ type: "snapshot", snapshot: cloneSnapshot(this.#snapshot) });
    return { protocolVersion: 1, requestId: envelope.requestId, ok: true, stateRevision: this.#snapshot.revision, snapshot: cloneSnapshot(this.#snapshot) };
  }

  #apply(command: PadCommand): void {
    switch (command.method) {
      case "state.snapshot":
      case "system.ping":
        return;
      case "lane.activate":
        this.#activateLane(command.arguments.lane);
        this.#snapshot.phase = "ready";
        this.#snapshot.phaseLabel = "Ready";
        return;
      case "lane.activateAndListen":
        this.#activateLane(command.arguments.lane);
        this.#snapshot.phase = "recording";
        this.#snapshot.phaseLabel = "Listening";
        return;
      case "listening.toggle":
        if (this.#snapshot.phase === "recording") {
          this.#snapshot.phase = "transcribing";
          this.#snapshot.phaseLabel = "Transcribing";
          this.#schedule(620, () => this.#setPhase("submitting"));
          this.#schedule(1320, () => this.#setPhase("ready"));
        } else if (this.#snapshot.phase === "speaking") {
          this.#snapshot.playback.state = "idle";
          this.#snapshot.phase = "ready";
          this.#snapshot.phaseLabel = "Ready";
        } else {
          this.#snapshot.phase = "recording";
          this.#snapshot.phaseLabel = "Listening";
        }
        return;
      case "listening.cancel":
        this.#snapshot.phase = "ready";
        this.#snapshot.phaseLabel = "Ready";
        return;
      case "lane.announce":
      case "playback.replay":
        this.#snapshot.phase = "speaking";
        this.#snapshot.phaseLabel = "Speaking";
        this.#snapshot.playback.state = "playing";
        this.#snapshot.playback.audioLevel = 0.42;
        this.#snapshot.playback.elapsedSeconds = command.method === "playback.replay" ? 0 : this.#snapshot.playback.elapsedSeconds;
        this.#schedule(command.method === "playback.replay" ? 11_000 : 2600, () => {
          this.#snapshot.playback.state = "idle";
          this.#snapshot.playback.audioLevel = 0;
          this.#setPhase("ready");
        });
        return;
      case "playback.toggle":
        this.#snapshot.playback.state = this.#snapshot.playback.state === "playing" ? "paused" : "playing";
        this.#snapshot.playback.audioLevel = this.#snapshot.playback.state === "playing" ? 0.32 : 0;
        this.#snapshot.phase = this.#snapshot.playback.state === "playing" ? "speaking" : "ready";
        this.#snapshot.phaseLabel = this.#snapshot.phase === "speaking" ? "Speaking" : "Ready";
        return;
      case "playback.stop":
        this.#snapshot.playback.state = "idle";
        this.#snapshot.playback.audioLevel = 0;
        this.#snapshot.phase = "ready";
        this.#snapshot.phaseLabel = "Ready";
        return;
      case "task.revealOnMac":
        return;
    }
  }

  #activateLane(number: number): void {
    this.#snapshot.activeLane = number;
    this.#snapshot.lanes = this.#snapshot.lanes.map((lane) => ({ ...lane, isActive: lane.number === number }));
    this.#snapshot.activeTaskTitle = this.#snapshot.lanes.find((lane) => lane.number === number)?.taskTitle;
  }

  #schedule(milliseconds: number, action: () => void): void {
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      action();
    }, milliseconds);
    this.#timers.add(timer);
  }

  #setPhase(phase: PadSnapshot["phase"]): void {
    this.#snapshot.phase = phase;
    this.#snapshot.phaseLabel = phase === "submitting" ? "Waiting for Codex" : phase === "ready" ? "Ready" : phase;
    this.#snapshot.revision += 1;
    this.#emit({ type: "snapshot", snapshot: cloneSnapshot(this.#snapshot) });
  }

  #emit(event: TransportEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

export class UnavailableLiveTransport implements PadTransport {
  readonly mode = "live" as const;
  #listeners = new Set<(event: TransportEvent) => void>();

  constructor(private readonly reason: string) {}

  subscribe(listener: (event: TransportEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async connect(): Promise<void> {
    for (const listener of this.#listeners) {
      listener({ type: "snapshot", snapshot: cloneSnapshot(DEMO_SNAPSHOT) });
      listener({ type: "link", health: "offline", detail: this.reason });
      listener({ type: "error", message: this.reason });
    }
  }

  disconnect(): void {}

  async send(_command: PadCommand, baseRevision: number): Promise<CommandAck> {
    return {
      protocolVersion: 1,
      requestId: id(),
      ok: false,
      stateRevision: baseRevision,
      error: { code: "runtime_unavailable", message: this.reason, retryable: true },
    };
  }
}

export interface StoredLANSession {
  sessionId: string;
  reconnectSecret: string;
  expiresAtMilliseconds: number;
  nextSequence: number;
}

interface SessionAcceptedMessage {
  type: "session.accepted";
  protocolVersion: 1;
  security: "lan-prototype-v1" | "e2ee-v1";
  sessionId: string;
  expiresAtMilliseconds: number;
  reconnectSecret: string;
  snapshot: PadSnapshot;
}

const LAN_SESSION_KEY = "speakeasy.pad.lan-session.v1";

export function makePadSocketURL(location: Pick<Location, "protocol" | "host">): string {
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}/pad`;
}

export function socketCloseDetail(event: Pick<CloseEvent, "code" | "reason">): string {
  const reason = event.reason.trim();
  return `Connection closed · ${event.code}${reason ? ` · ${reason}` : ""}`;
}

export type ReconnectDecision =
  | { retry: true; delayMilliseconds: number }
  | { retry: false; reason: "manual" | "authentication" | "expired" | "exhausted" };

export function reconnectDecision(options: {
  closeCode: number;
  manual: boolean;
  expiresAtMilliseconds: number;
  nowMilliseconds: number;
  attempt: number;
  random?: number;
}): ReconnectDecision {
  if (options.manual) return { retry: false, reason: "manual" };
  if (options.closeCode === 4001 || options.closeCode === 4003) return { retry: false, reason: "authentication" };
  if (options.expiresAtMilliseconds <= options.nowMilliseconds) return { retry: false, reason: "expired" };
  if (options.attempt >= 6) return { retry: false, reason: "exhausted" };
  const base = Math.min(8_000, 400 * 2 ** options.attempt);
  const jitter = 0.8 + 0.4 * (options.random ?? Math.random());
  return { retry: true, delayMilliseconds: Math.round(base * jitter) };
}

export function makeLANBootstrapMessage(payload: BootstrapPayload, deviceName = "SpeakEasy Pad") {
  return {
    type: "bootstrap.redeem" as const,
    protocolVersion: 1 as const,
    tokenId: payload.tokenId,
    room: payload.room,
    secret: payload.secret,
    deviceName,
  };
}

export function makeLANResumeMessage(session: StoredLANSession, deviceName = "SpeakEasy Pad") {
  return {
    type: "session.resume" as const,
    protocolVersion: 1 as const,
    sessionId: session.sessionId,
    reconnectSecret: session.reconnectSecret,
    deviceName,
  };
}

export function makeCommandEnvelope(
  command: PadCommand,
  sessionId: string,
  sequence: number,
  expectedRevision: number,
  requestId = id(),
  sentAtMilliseconds = Date.now(),
): CommandEnvelope {
  return {
    protocolVersion: 1,
    requestId,
    sessionId,
    sequence,
    sentAtMilliseconds,
    expectedRevision,
    method: command.method,
    arguments: "arguments" in command ? command.arguments : undefined,
  };
}

export function claimNextSequence(session: StoredLANSession): { sequence: number; updatedSession: StoredLANSession } {
  const sequence = Math.max(1, Math.floor(session.nextSequence || 1));
  return { sequence, updatedSession: { ...session, nextSequence: sequence + 1 } };
}

function readStoredLANSession(): StoredLANSession | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(LAN_SESSION_KEY) ?? "null") as StoredLANSession | null;
    if (!value || value.expiresAtMilliseconds <= Date.now()) {
      localStorage.removeItem(LAN_SESSION_KEY);
      return undefined;
    }
    return { ...value, nextSequence: Math.max(1, Math.floor(value.nextSequence || 1)) };
  } catch {
    localStorage.removeItem(LAN_SESSION_KEY);
    return undefined;
  }
}

export class LANPadTransport implements PadTransport {
  readonly mode = "live" as const;
  #socket?: WebSocket;
  #listeners = new Set<(event: TransportEvent) => void>();
  #pending = new Map<string, { resolve: (response: CommandAck) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  #session?: StoredLANSession;
  #manualDisconnect = false;
  #authenticated = false;
  #reconnectAttempt = 0;
  #reconnectTimer?: ReturnType<typeof setTimeout>;
  #connectionPromise?: Promise<void>;

  constructor(private readonly bootstrap?: BootstrapPayload, session = readStoredLANSession()) {
    // An explicit QR/day-pass always wins over stale storage from an older
    // session. After acceptance, reconnects use the returned session secret.
    this.#session = bootstrap ? undefined : session;
  }

  subscribe(listener: (event: TransportEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  connect(): Promise<void> {
    this.#manualDisconnect = false;
    return this.#openSocket();
  }

  resume(): void {
    if (this.#manualDisconnect || this.#authenticated || this.#connectionPromise) return;
    if (!this.#session || this.#session.expiresAtMilliseconds <= Date.now()) {
      localStorage.removeItem(LAN_SESSION_KEY);
      return;
    }
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
    // Returning to the foreground is explicit fresh evidence that the user
    // wants the Pad live; grant another bounded reconnect window.
    this.#reconnectAttempt = 0;
    this.#scheduleReconnect(1006, 0);
  }

  #openSocket(): Promise<void> {
    if (this.#connectionPromise) return this.#connectionPromise;
    const socketURL = makePadSocketURL(globalThis.location);
    this.#emit({ type: "link", health: "connecting", detail: `Finding ${globalThis.location.host}` });
    const attempt = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(socketURL);
      this.#socket = socket;
      this.#authenticated = false;
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error(`The Mac did not answer at ${globalThis.location.host}.`));
      }, 8_000);
      socket.addEventListener("open", () => {
        if (this.bootstrap && !this.#authenticated && !this.#session) {
          socket.send(JSON.stringify(makeLANBootstrapMessage(
            this.bootstrap,
            navigator.userAgent.includes("iPad") ? "iPad" : "SpeakEasy Pad",
          )));
        } else if (this.#session) {
          socket.send(JSON.stringify(makeLANResumeMessage(
            this.#session,
            navigator.userAgent.includes("iPad") ? "iPad" : "SpeakEasy Pad",
          )));
        } else {
          clearTimeout(timeout);
          reject(new Error("Scan a fresh SpeakEasy Pad code on your Mac."));
        }
      });
      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as SessionAcceptedMessage | CommandAck | { type: "state.changed"; snapshot: PadSnapshot } | { type: "error"; message: string };
          if ("type" in message && message.type === "session.accepted") {
            clearTimeout(timeout);
            this.#acceptSession(message);
            resolve();
          } else if ("type" in message && message.type === "state.changed") {
            this.#emit({ type: "snapshot", snapshot: message.snapshot });
          } else if ("requestId" in message) {
            this.#receiveResponse(message);
          } else if ("type" in message && message.type === "error") {
            this.#emit({ type: "error", message: message.message });
            this.#rejectPending(new Error(`The Mac rejected the command: ${message.message}`));
          }
        } catch {
          this.#emit({ type: "error", message: "The Mac sent an unreadable Pad message." });
        }
      });
      socket.addEventListener("close", (event) => {
        clearTimeout(timeout);
        if (this.#socket === socket) this.#socket = undefined;
        this.#authenticated = false;
        const detail = socketCloseDetail(event);
        console.warn(`[SpeakEasy Pad] ${detail}`);
        this.#emit({ type: "link", health: "offline", detail });
        this.#rejectPending(new Error("The Mac connection closed before acknowledging the command."));
        this.#scheduleReconnect(event.code);
      });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        this.#emit({ type: "link", health: "offline", detail: "Mac unavailable on the local network" });
        reject(new Error(`Could not connect to ${globalThis.location.host}.`));
      });
    });
    const wrapped = attempt.finally(() => {
      if (this.#connectionPromise === wrapped) this.#connectionPromise = undefined;
    });
    this.#connectionPromise = wrapped;
    return wrapped;
  }

  disconnect(): void {
    this.#manualDisconnect = true;
    this.#authenticated = false;
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
    this.#socket?.close(1000, "Pad closed");
    this.#socket = undefined;
  }

  send(command: PadCommand, baseRevision: number): Promise<CommandAck> {
    if (!this.#socket || this.#socket.readyState !== WebSocket.OPEN || !this.#session) {
      return Promise.reject(new Error("The Pad is not connected to the Mac."));
    }
    const requestId = id();
    const pendingKey = requestIdKey(requestId);
    const { sequence, updatedSession } = claimNextSequence(this.#session);
    this.#session = updatedSession;
    // Persist before sending: a reload after the socket write may skip a
    // number, but can never replay one the Mac may already have accepted.
    localStorage.setItem(LAN_SESSION_KEY, JSON.stringify(this.#session));
    const envelope = makeCommandEnvelope(command, this.#session.sessionId, sequence, baseRevision, requestId);
    this.#socket.send(JSON.stringify(envelope));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(pendingKey);
        reject(new Error("The Mac did not acknowledge this command."));
      }, 5_000);
      this.#pending.set(pendingKey, { resolve, reject, timer });
    });
  }

  #acceptSession(message: SessionAcceptedMessage): void {
    const nextSequence = this.#session?.sessionId === message.sessionId ? this.#session.nextSequence : 1;
    this.#session = {
      sessionId: message.sessionId,
      reconnectSecret: message.reconnectSecret,
      expiresAtMilliseconds: message.expiresAtMilliseconds,
      nextSequence,
    };
    localStorage.setItem(LAN_SESSION_KEY, JSON.stringify(this.#session));
    this.#authenticated = true;
    this.#reconnectAttempt = 0;
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
    this.#emit({ type: "session", hostName: "SpeakEasy Mac", leaseExpiresAt: message.expiresAtMilliseconds, security: message.security });
    this.#emit({ type: "snapshot", snapshot: message.snapshot });
    this.#emit({ type: "link", health: "healthy", detail: message.security === "lan-prototype-v1" ? "Trusted-LAN pilot · daily lease" : "End-to-end encrypted · daily lease" });
  }

  #receiveResponse(response: CommandAck): void {
    const key = requestIdKey(response.requestId);
    const pending = this.#pending.get(key);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.#pending.delete(key);
    if (response.snapshot) this.#emit({ type: "snapshot", snapshot: response.snapshot });
    pending.resolve(response);
  }

  #rejectPending(error: Error): void {
    for (const item of this.#pending.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.#pending.clear();
  }

  #scheduleReconnect(closeCode: number, forcedDelay?: number): void {
    if (this.#reconnectTimer || !this.#session) return;
    const decision = reconnectDecision({
      closeCode,
      manual: this.#manualDisconnect,
      expiresAtMilliseconds: this.#session.expiresAtMilliseconds,
      nowMilliseconds: Date.now(),
      attempt: this.#reconnectAttempt,
    });
    if (!decision.retry) {
      if (decision.reason === "authentication" || decision.reason === "expired") {
        localStorage.removeItem(LAN_SESSION_KEY);
        this.#session = undefined;
      }
      const detail = decision.reason === "authentication"
        ? "Pad session expired or was revoked"
        : decision.reason === "expired"
          ? "Daily Pad lease expired"
          : decision.reason === "exhausted"
            ? "Reconnect paused · return to the Pad to try again"
            : "Pad disconnected";
      this.#emit({ type: "link", health: "offline", detail });
      return;
    }
    const delayMilliseconds = forcedDelay ?? decision.delayMilliseconds;
    this.#reconnectAttempt += 1;
    this.#emit({
      type: "link",
      health: "connecting",
      detail: `Reconnecting in ${(delayMilliseconds / 1_000).toFixed(1)}s · attempt ${this.#reconnectAttempt}/6`,
    });
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      void this.#openSocket().catch(() => undefined);
    }, delayMilliseconds);
  }

  #emit(event: TransportEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}

export function createTransport(
  bootstrap: BootstrapPayload | undefined,
  secureFactory: SecureTransportFactory | undefined = globalThis.window?.SPEAKEASY_PAD_SECURE_TRANSPORT,
): PadTransport {
  if (bootstrap && globalThis.isSecureContext && secureFactory) return secureFactory.create(bootstrap);
  if (bootstrap) return new LANPadTransport(bootstrap);
  if (typeof localStorage !== "undefined" && readStoredLANSession()) return new LANPadTransport();
  if (globalThis.location?.hostname === "localhost" || globalThis.location?.hostname === "127.0.0.1") return new MockPadTransport();
  return new UnavailableLiveTransport("Scan a fresh SpeakEasy Pad code on your Mac.");
}

export function linkAllowsCommands(health: LinkHealth): boolean {
  return health === "healthy" || health === "suspect";
}
