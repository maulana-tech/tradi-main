import { describe, test, expect } from "vitest";
import { buildCoachReport, type SettledEvent } from "../logic.js";

const NOW = 1_700_000_000;
const DAY = 86_400;

function makeEvent(overrides: {
  id?: bigint;
  taker?: `0x${string}`;
  timestamp?: number;
  txHash?: `0x${string}`;
} = {}): SettledEvent {
  return {
    id: overrides.id ?? 1n,
    taker: overrides.taker ?? "0xT",
    timestamp: overrides.timestamp ?? NOW - 1000,
    txHash: overrides.txHash ?? "0xH",
  };
}

describe("buildCoachReport", () => {
  describe("positive cases", () => {
    test("counts trades within window", () => {
      const events = [
        makeEvent({ timestamp: NOW - 3 * DAY }),
        makeEvent({ timestamp: NOW - 5 * DAY }),
        makeEvent({ timestamp: NOW - DAY }),
      ];
      const r = buildCoachReport(events, NOW, 7);
      expect(r.tradeCount).toBe(3);
      expect(r.windowDays).toBe(7);
    });

    test("counts unique counterparties (case-insensitive)", () => {
      const events = [
        makeEvent({ taker: "0xAlice" }),
        makeEvent({ taker: "0xALICE" }), // same address, mixed case
        makeEvent({ taker: "0xBob" }),
      ];
      const r = buildCoachReport(events, NOW, 30);
      expect(r.uniqueCounterparties).toBe(2);
    });

    test("captures most recent trade timestamp", () => {
      const events = [
        makeEvent({ timestamp: NOW - 1000 }),
        makeEvent({ timestamp: NOW - 500 }), // most recent
        makeEvent({ timestamp: NOW - 5000 }),
      ];
      const r = buildCoachReport(events, NOW, 30);
      expect(r.mostRecentTradeAt).toBe(NOW - 500);
    });

    test("message includes window + counts for non-empty result", () => {
      const events = [makeEvent(), makeEvent({ taker: "0xBob" })];
      const r = buildCoachReport(events, NOW, 7);
      expect(r.message).toContain("7d");
      expect(r.message).toContain("2 settled trades");
      expect(r.message).toContain("2 unique counterparties");
    });

    test("singular grammar for 1 trade and 1 counterparty", () => {
      const events = [makeEvent()];
      const r = buildCoachReport(events, NOW, 7);
      expect(r.message).toContain("1 settled trade\n");
      expect(r.message).toContain("1 unique counterparty");
      expect(r.message).not.toContain("trades\n");
    });
  });

  describe("negative cases", () => {
    test("throws on zero windowDays", () => {
      expect(() => buildCoachReport([], NOW, 0)).toThrow(/positive/);
    });

    test("throws on negative windowDays", () => {
      expect(() => buildCoachReport([], NOW, -1)).toThrow(/positive/);
    });

    test("returns empty-trades message when no events in window", () => {
      const r = buildCoachReport([], NOW, 30);
      expect(r.tradeCount).toBe(0);
      expect(r.uniqueCounterparties).toBe(0);
      expect(r.mostRecentTradeAt).toBeNull();
      expect(r.message).toContain("no settled trades");
    });

    test("filters out events older than window cutoff", () => {
      const events = [
        makeEvent({ timestamp: NOW - 8 * DAY }), // outside
        makeEvent({ timestamp: NOW - 3 * DAY }), // inside
      ];
      const r = buildCoachReport(events, NOW, 7);
      expect(r.tradeCount).toBe(1);
    });
  });

  describe("edge cases", () => {
    test("event exactly at cutoff is included", () => {
      const events = [makeEvent({ timestamp: NOW - 7 * DAY })]; // exactly 7d ago
      const r = buildCoachReport(events, NOW, 7);
      expect(r.tradeCount).toBe(1);
    });

    test("empty events array yields zero report", () => {
      const r = buildCoachReport([], NOW, 30);
      expect(r.tradeCount).toBe(0);
      expect(r.message).toContain("no settled trades");
    });

    test("future-dated event still included if within window from now", () => {
      const events = [makeEvent({ timestamp: NOW + 100 })];
      const r = buildCoachReport(events, NOW, 30);
      expect(r.tradeCount).toBe(1);
    });

    test("message reminds about auditor delegation for amount breakdown", () => {
      const events = [makeEvent()];
      const r = buildCoachReport(events, NOW, 30);
      expect(r.message).toContain("auditor delegation");
    });
  });
});
