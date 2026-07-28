export interface BootstrapPayload {
  version: 1;
  room: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
  clientTicket: string;
  secret: string;
}

export type BootstrapResult =
  | { kind: "none" }
  | { kind: "valid"; payload: BootstrapPayload }
  | { kind: "invalid"; reason: string };

const SAFE_TOKEN = /^[A-Za-z0-9_-]{8,256}$/;
const MAX_BOOTSTRAP_LIFETIME_SECONDS = 24 * 60 * 60;
const CLOCK_SKEW_SECONDS = 5 * 60;

function parseTimestampMilliseconds(value: string | null): number | undefined {
  if (!value || !/^\d{10,13}$/.test(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return undefined;
  return value.length === 13 ? parsed : parsed * 1000;
}

function decodedByteLength(value: string): number {
  const remainder = value.length % 4;
  const padding = remainder === 0 ? 0 : 4 - remainder;
  return Math.floor(((value.length + padding) * 3) / 4) - padding;
}

export function parseBootstrapFragment(fragment: string, nowMilliseconds = Date.now()): BootstrapResult {
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!raw) return { kind: "none" };

  const params = new URLSearchParams(raw);
  const markers = ["v", "room", "tid", "iat", "exp", "ct", "k"];
  if (!markers.some((key) => params.has(key))) return { kind: "none" };

  if (params.get("v") !== "1") return { kind: "invalid", reason: "This connection link uses an unsupported version." };

  const room = params.get("room") ?? "";
  const tokenId = params.get("tid") ?? "";
  const clientTicket = params.get("ct") ?? "";
  const secret = params.get("k") ?? "";
  const issuedAt = parseTimestampMilliseconds(params.get("iat"));
  const expiresAt = parseTimestampMilliseconds(params.get("exp"));

  if (!SAFE_TOKEN.test(room) || !SAFE_TOKEN.test(tokenId) || !SAFE_TOKEN.test(clientTicket)) {
    return { kind: "invalid", reason: "This connection link is incomplete." };
  }
  if (!SAFE_TOKEN.test(secret) || decodedByteLength(secret) < 32) {
    return { kind: "invalid", reason: "This connection link has an invalid security key." };
  }
  if (issuedAt === undefined || expiresAt === undefined || expiresAt <= issuedAt) {
    return { kind: "invalid", reason: "This connection link has invalid timestamps." };
  }
  if (expiresAt - issuedAt > MAX_BOOTSTRAP_LIFETIME_SECONDS * 1000) {
    return { kind: "invalid", reason: "This connection link is valid for too long." };
  }

  if (nowMilliseconds > expiresAt) return { kind: "invalid", reason: "This connection link has expired. Scan a new code on your Mac." };
  if (issuedAt > nowMilliseconds + CLOCK_SKEW_SECONDS * 1000) {
    return { kind: "invalid", reason: "This connection link was issued in the future." };
  }

  return {
    kind: "valid",
    payload: {
      version: 1,
      room,
      tokenId,
      issuedAt,
      expiresAt,
      clientTicket,
      secret,
    },
  };
}

export function consumeBootstrapFromLocation(
  locationLike: Pick<Location, "hash" | "pathname" | "search">,
  _historyLike: Pick<History, "state" | "replaceState">,
  nowMilliseconds = Date.now(),
): BootstrapResult {
  // Keep the day-pass fragment in the visible URL so iPad's Code Scanner can
  // hand the exact link to Safari or another browser session.
  return parseBootstrapFragment(locationLike.hash, nowMilliseconds);
}
