import { describe, expect, test } from "bun:test";
import { consumeBootstrapFromLocation, parseBootstrapFragment } from "../src/bootstrap.ts";

const now = 1_785_087_600_000;
const issued = now - 30_000;
const expires = issued + 86_400_000;
const valid = `#v=1&room=room_12345678&tid=token_12345678&iat=${issued}&exp=${expires}&ct=ticket_12345678&k=${"A".repeat(43)}`;

describe("parseBootstrapFragment", () => {
  test("accepts the reusable one-day pass shape", () => {
    const result = parseBootstrapFragment(valid, now);
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.payload.room).toBe("room_12345678");
      expect(result.payload.expiresAt - result.payload.issuedAt).toBe(86_400_000);
    }
  });

  test("rejects an expired saved link", () => {
    const result = parseBootstrapFragment(valid, expires + 1);
    expect(result).toEqual({ kind: "invalid", reason: "This connection link has expired. Scan a new code on your Mac." });
  });

  test("rejects a timestamp that attempts to extend the pass beyond one day", () => {
    const long = valid.replace(`exp=${expires}`, `exp=${issued + 86_400_001}`);
    expect(parseBootstrapFragment(long, now)).toEqual({ kind: "invalid", reason: "This connection link is valid for too long." });
  });

  test("rejects weak key material", () => {
    const weak = valid.replace(`k=${"A".repeat(43)}`, "k=short_key");
    expect(parseBootstrapFragment(weak, now)).toEqual({ kind: "invalid", reason: "This connection link has an invalid security key." });
  });
});

describe("consumeBootstrapFromLocation", () => {
  test("keeps the day-pass URL intact for a browser handoff", () => {
    const calls: unknown[][] = [];
    const location = { hash: valid, pathname: "/connect", search: "?source=qr" } as Pick<Location, "hash" | "pathname" | "search">;
    const history = {
      state: { retained: true },
      replaceState: (...args: unknown[]) => calls.push(args),
    } as unknown as Pick<History, "state" | "replaceState">;

    expect(consumeBootstrapFromLocation(location, history, now).kind).toBe("valid");
    expect(calls).toEqual([]);
  });
});
