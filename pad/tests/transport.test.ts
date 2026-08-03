import { describe, expect, test } from "bun:test";
import type { PadSnapshot } from "../src/model.ts";
import { claimNextSequence, forgetStoredLANSession, MockPadTransport, linkAllowsCommands, makeCommandEnvelope, makeLANBootstrapMessage, makePadSocketURL, makeRequestId, reconnectDecision, requestIdKey, socketCloseDetail } from "../src/transport.ts";

describe("MockPadTransport", () => {
  test("acknowledges lane activation with a newer authoritative snapshot", async () => {
    const transport = new MockPadTransport();
    let snapshot: PadSnapshot | undefined;
    transport.subscribe((event) => {
      if (event.type === "snapshot") snapshot = event.snapshot;
    });
    await transport.connect();
    const before = snapshot!;
    const ack = await transport.send({ method: "lane.activate", arguments: { lane: 5 } }, before.revision);
    expect(ack.ok).toBe(true);
    expect(snapshot!.activeLane).toBe(5);
    expect(snapshot!.revision).toBeGreaterThan(before.revision);
    transport.disconnect();
  });

  test("moves a held microphone into transcribing only after release", async () => {
    const transport = new MockPadTransport();
    let snapshot: PadSnapshot | undefined;
    transport.subscribe((event) => {
      if (event.type === "snapshot") snapshot = event.snapshot;
    });
    await transport.connect();
    await transport.send({ method: "lane.activateAndListen", arguments: { lane: 2 } }, snapshot!.revision);
    expect(snapshot!.phase).toBe("recording");
    await transport.send({ method: "listening.toggle" }, snapshot!.revision);
    expect(snapshot!.phase).toBe("transcribing");
    transport.disconnect();
  });
});

describe("linkAllowsCommands", () => {
  test("refuses commands without usable route evidence", () => {
    expect(linkAllowsCommands("healthy")).toBe(true);
    expect(linkAllowsCommands("suspect")).toBe(true);
    expect(linkAllowsCommands("degraded")).toBe(false);
    expect(linkAllowsCommands("offline")).toBe(false);
  });
});

describe("pairing cleanup", () => {
  test("removes only the resumable LAN session", () => {
    const removed: string[] = [];
    forgetStoredLANSession({ removeItem: (key) => removed.push(key) });
    expect(removed).toEqual(["speakeasy.pad.lan-session.v1"]);
  });
});

describe("Swift wire compatibility", () => {
  test("generates a Swift-decodable UUID when insecure Safari hides randomUUID", () => {
    let nextByte = 0;
    const requestId = makeRequestId({
      fillRandomValues(bytes) {
        for (let index = 0; index < bytes.length; index += 1) bytes[index] = nextByte++;
      },
    });

    expect(requestId).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("matches Foundation's uppercase UUID acknowledgement to the browser request", () => {
    const browserRequestId = "2f2ea40a-7471-4cd8-9ead-6549396fc564";
    const foundationResponseId = "2F2EA40A-7471-4CD8-9EAD-6549396FC564";
    expect(requestIdKey(foundationResponseId)).toBe(requestIdKey(browserRequestId));
  });

  test("follows the exact host and fallback port that served the Pad", () => {
    expect(makePadSocketURL({ protocol: "http:", host: "pad.speakeasy.local:8255" } as Location)).toBe("ws://pad.speakeasy.local:8255/pad");
    expect(makePadSocketURL({ protocol: "http:", host: "192.168.1.42:49321" } as Location)).toBe("ws://192.168.1.42:49321/pad");
    expect(makePadSocketURL({ protocol: "https:", host: "pad.speakeasy.app" } as Location)).toBe("wss://pad.speakeasy.app/pad");
  });

  test("includes WebSocket close evidence without exposing session material", () => {
    expect(socketCloseDetail({ code: 1008, reason: "invalid session" } as CloseEvent)).toBe("Connection closed · 1008 · invalid session");
    expect(socketCloseDetail({ code: 1006, reason: "" } as CloseEvent)).toBe("Connection closed · 1006");
  });

  test("retries an unexpected close with bounded exponential backoff", () => {
    expect(reconnectDecision({
      closeCode: 1006,
      manual: false,
      expiresAtMilliseconds: 20_000,
      nowMilliseconds: 10_000,
      attempt: 0,
      random: 0.5,
    })).toEqual({ retry: true, delayMilliseconds: 400 });
    expect(reconnectDecision({
      closeCode: 1006,
      manual: false,
      expiresAtMilliseconds: 20_000,
      nowMilliseconds: 10_000,
      attempt: 5,
      random: 0.5,
    })).toEqual({ retry: true, delayMilliseconds: 8_000 });
  });

  test("stops reconnecting after auth failure, expiry, or the bounded attempt window", () => {
    const common = { manual: false, expiresAtMilliseconds: 20_000, nowMilliseconds: 10_000, random: 0.5 };
    expect(reconnectDecision({ ...common, closeCode: 4003, attempt: 0 })).toEqual({ retry: false, reason: "authentication" });
    expect(reconnectDecision({ ...common, closeCode: 4001, attempt: 0 })).toEqual({ retry: false, reason: "authentication" });
    expect(reconnectDecision({ ...common, closeCode: 1006, expiresAtMilliseconds: 9_999, attempt: 0 })).toEqual({ retry: false, reason: "expired" });
    expect(reconnectDecision({ ...common, closeCode: 1006, attempt: 6 })).toEqual({ retry: false, reason: "exhausted" });
    expect(reconnectDecision({ ...common, closeCode: 1006, manual: true, attempt: 0 })).toEqual({ retry: false, reason: "manual" });
  });

  test("emits the exact LAN redemption field names", () => {
    expect(makeLANBootstrapMessage({
      version: 1,
      room: "room_12345678",
      tokenId: "5f2ea40a-7471-4cd8-9ead-6549396fc564",
      issuedAt: 1_785_087_570_000,
      expiresAt: 1_785_088_170_000,
      clientTicket: "ticket_12345678",
      secret: "A".repeat(43),
    }, "Arach’s iPad")).toEqual({
      type: "bootstrap.redeem",
      protocolVersion: 1,
      tokenId: "5f2ea40a-7471-4cd8-9ead-6549396fc564",
      room: "room_12345678",
      secret: "A".repeat(43),
      deviceName: "Arach’s iPad",
    });
  });

  test("emits the exact versioned command request shape", () => {
    expect(makeCommandEnvelope(
      { method: "lane.activate", arguments: { lane: 5 } },
      "1f2ea40a-7471-4cd8-9ead-6549396fc564",
      7,
      42,
      "2f2ea40a-7471-4cd8-9ead-6549396fc564",
      1_785_087_600_000,
    )).toEqual({
      protocolVersion: 1,
      requestId: "2f2ea40a-7471-4cd8-9ead-6549396fc564",
      sessionId: "1f2ea40a-7471-4cd8-9ead-6549396fc564",
      sequence: 7,
      sentAtMilliseconds: 1_785_087_600_000,
      expectedRevision: 42,
      method: "lane.activate",
      arguments: { lane: 5 },
    });
  });

  test("advances a resumable session counter before the next command", () => {
    const session = {
      sessionId: "1f2ea40a-7471-4cd8-9ead-6549396fc564",
      reconnectSecret: "B".repeat(43),
      expiresAtMilliseconds: 1_785_174_000_000,
      nextSequence: 8,
    };
    const claimed = claimNextSequence(session);
    expect(claimed.sequence).toBe(8);
    expect(claimed.updatedSession.nextSequence).toBe(9);
    expect(session.nextSequence).toBe(8);
  });
});
