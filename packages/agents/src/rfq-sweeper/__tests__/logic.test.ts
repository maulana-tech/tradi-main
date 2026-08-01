import { describe, test, expect } from "vitest";
import { decideFinalize, scanWindow, type IntentTuple } from "../logic.js";

const NOW = 1_700_000_000n;

function makeIntent(overrides: {
  deadline?: bigint;
  status?: number;
  mode?: number;
} = {}): IntentTuple {
  return [
    "0xMaker",
    "0xSell",
    "0xBuy",
    "0xH1",
    "0xH2",
    overrides.deadline ?? NOW - 100n, // expired by default
    overrides.status ?? 0, // Open by default
    overrides.mode ?? 1, // RFQ by default
    "0xAllowed",
  ] as IntentTuple;
}

describe("decideFinalize", () => {
  describe("positive cases", () => {
    test("finalize when status=Open, mode=RFQ, deadline passed, 2+ bids", () => {
      const d = decideFinalize(makeIntent(), NOW, 2);
      expect(d).toEqual({ kind: "finalize" });
    });

    test("finalize works for any bid count >= 2 (up to MAX_BIDS_PER_RFQ)", () => {
      expect(decideFinalize(makeIntent(), NOW, 10)).toEqual({ kind: "finalize" });
    });
  });

  describe("negative cases", () => {
    test("skip when status is Filled (1)", () => {
      const d = decideFinalize(makeIntent({ status: 1 }), NOW, 5);
      expect(d).toEqual({ kind: "skip", reason: "not open" });
    });

    test("skip when status is Cancelled (2)", () => {
      const d = decideFinalize(makeIntent({ status: 2 }), NOW, 5);
      expect(d.kind).toBe("skip");
    });

    test("skip when mode is Direct (0)", () => {
      const d = decideFinalize(makeIntent({ mode: 0 }), NOW, 5);
      expect(d).toEqual({ kind: "skip", reason: "not RFQ" });
    });

    test("skip when deadline still in future", () => {
      const d = decideFinalize(makeIntent({ deadline: NOW + 100n }), NOW, 5);
      expect(d).toEqual({ kind: "skip", reason: "bidding still active" });
    });

    test("skip when bidCount = 1 (would revert InsufficientBids)", () => {
      const d = decideFinalize(makeIntent(), NOW, 1);
      expect(d).toEqual({ kind: "skip", reason: "insufficient bids" });
    });

    test("skip when bidCount = 0", () => {
      expect(decideFinalize(makeIntent(), NOW, 0).kind).toBe("skip");
    });
  });

  describe("edge cases", () => {
    test("skip at exact deadline boundary (deadline >= now is strict-open)", () => {
      // The contract uses `block.timestamp <= deadline` for "still active",
      // so the agent should match: deadline >= now → still active.
      const d = decideFinalize(makeIntent({ deadline: NOW }), NOW, 5);
      expect(d).toEqual({ kind: "skip", reason: "bidding still active" });
    });

    test("finalize when deadline is exactly 1 second past", () => {
      const d = decideFinalize(makeIntent({ deadline: NOW - 1n }), NOW, 2);
      expect(d).toEqual({ kind: "finalize" });
    });
  });
});

describe("scanWindow", () => {
  describe("positive cases", () => {
    test("returns last N intents for nextIntentId > scanDepth", () => {
      expect(scanWindow(100n, 50)).toEqual({ start: 50n, end: 100n });
    });

    test("returns [0, end) when nextIntentId <= scanDepth", () => {
      expect(scanWindow(30n, 50)).toEqual({ start: 0n, end: 30n });
    });
  });

  describe("negative cases", () => {
    test("throws on zero scanDepth", () => {
      expect(() => scanWindow(100n, 0)).toThrow(/positive/);
    });

    test("throws on negative scanDepth", () => {
      expect(() => scanWindow(100n, -1)).toThrow(/positive/);
    });
  });

  describe("edge cases", () => {
    test("nextIntentId = 0 returns empty window", () => {
      expect(scanWindow(0n, 50)).toEqual({ start: 0n, end: 0n });
    });

    test("nextIntentId == scanDepth boundary returns full range from 0", () => {
      expect(scanWindow(50n, 50)).toEqual({ start: 0n, end: 50n });
    });

    test("nextIntentId = scanDepth + 1 keeps a window of exactly scanDepth", () => {
      expect(scanWindow(51n, 50)).toEqual({ start: 1n, end: 51n });
    });
  });
});
