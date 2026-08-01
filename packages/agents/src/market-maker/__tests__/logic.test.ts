import { describe, test, expect } from "vitest";
import {
  decideBid,
  computeBidAmount,
  type Strategy,
  type IntentEventArgs,
} from "../logic.js";

const OUR = "0xMyBot" as `0x${string}`;
const STRATEGY: Strategy = {
  pairs: {
    "cETH/cUSDC": {
      sellToken: "0xceTH" as `0x${string}`,
      buyToken: "0xcUSDC" as `0x${string}`,
      refPriceUsd: 3500,
    },
  },
  maxNotional: 50_000n * 10n ** 6n, // 50k cUSDC
  spreadBps: 30,
};

const baseEvent: IntentEventArgs = {
  id: 7n,
  maker: "0xSomeMaker" as `0x${string}`,
  sellToken: "0xceTH" as `0x${string}`,
  buyToken: "0xcUSDC" as `0x${string}`,
  mode: 1, // RFQ
};

describe("decideBid", () => {
  describe("positive cases", () => {
    test("returns bid decision when RFQ matches strategy pair", () => {
      const d = decideBid(baseEvent, OUR, STRATEGY);
      expect(d.kind).toBe("bid");
      if (d.kind === "bid") {
        expect(d.intentId).toBe(7n);
        expect(d.pairName).toBe("cETH/cUSDC");
        expect(d.refPriceUsd).toBe(3500);
      }
    });

    test("matches pair case-insensitively for sellToken", () => {
      const d = decideBid(
        { ...baseEvent, sellToken: "0xCETH" as `0x${string}` },
        OUR,
        STRATEGY,
      );
      expect(d.kind).toBe("bid");
    });

    test("matches pair case-insensitively for buyToken", () => {
      const d = decideBid(
        { ...baseEvent, buyToken: "0xCUSDC" as `0x${string}` },
        OUR,
        STRATEGY,
      );
      expect(d.kind).toBe("bid");
    });
  });

  describe("negative cases", () => {
    test("skips when id is undefined", () => {
      const d = decideBid({ ...baseEvent, id: undefined }, OUR, STRATEGY);
      expect(d).toEqual({ kind: "skip", reason: "incomplete event args" });
    });

    test("skips when sellToken is undefined", () => {
      const d = decideBid({ ...baseEvent, sellToken: undefined }, OUR, STRATEGY);
      expect(d.kind).toBe("skip");
    });

    test("skips when buyToken is undefined", () => {
      const d = decideBid({ ...baseEvent, buyToken: undefined }, OUR, STRATEGY);
      expect(d.kind).toBe("skip");
    });

    test("skips when mode is undefined", () => {
      const d = decideBid({ ...baseEvent, mode: undefined }, OUR, STRATEGY);
      expect(d.kind).toBe("skip");
    });

    test("skips Direct intents (mode=0)", () => {
      const d = decideBid({ ...baseEvent, mode: 0 }, OUR, STRATEGY);
      expect(d).toEqual({ kind: "skip", reason: "not an RFQ" });
    });

    test("skips when maker == ourAddress (avoid wash-trading)", () => {
      const d = decideBid({ ...baseEvent, maker: OUR }, OUR, STRATEGY);
      expect(d).toEqual({ kind: "skip", reason: "own RFQ" });
    });

    test("matches own-address check case-insensitively", () => {
      const d = decideBid(
        { ...baseEvent, maker: "0xMYBOT" as `0x${string}` },
        "0xmybot",
        STRATEGY,
      );
      expect(d.kind).toBe("skip");
    });

    test("skips when pair not in strategy", () => {
      const d = decideBid(
        {
          ...baseEvent,
          sellToken: "0xUNKNOWN" as `0x${string}`,
          buyToken: "0xUNKNOWN2" as `0x${string}`,
        },
        OUR,
        STRATEGY,
      );
      expect(d).toEqual({ kind: "skip", reason: "pair not in strategy" });
    });
  });

  describe("edge cases", () => {
    test("does NOT skip when maker is undefined (still bids)", () => {
      // own-RFQ guard only fires when maker is defined; missing maker on
      // event shouldn't block a strategy-matched bid.
      const d = decideBid({ ...baseEvent, maker: undefined }, OUR, STRATEGY);
      expect(d.kind).toBe("bid");
    });

    test("returns first matching pair when strategy has multiple pairs", () => {
      const multi: Strategy = {
        ...STRATEGY,
        pairs: {
          "cETH/cUSDC": STRATEGY.pairs["cETH/cUSDC"],
          "cBTC/cUSDC": {
            sellToken: "0xcBTC" as `0x${string}`,
            buyToken: "0xcUSDC" as `0x${string}`,
            refPriceUsd: 95000,
          },
        },
      };
      const d = decideBid(baseEvent, OUR, multi);
      if (d.kind === "bid") expect(d.pairName).toBe("cETH/cUSDC");
    });
  });
});

describe("computeBidAmount", () => {
  describe("positive cases", () => {
    test("applies 30 bps spread to 50k notional → 49,850e6", () => {
      const max = 50_000n * 10n ** 6n;
      // 50000 * (10000-30)/10000 = 50000 * 9970/10000 = 49850
      expect(computeBidAmount(max, 30)).toBe(49_850n * 10n ** 6n);
    });

    test("zero spread returns full max notional", () => {
      expect(computeBidAmount(1000n, 0)).toBe(1000n);
    });

    test("100% spread (10000 bps) returns 0", () => {
      expect(computeBidAmount(1000n, 10000)).toBe(0n);
    });

    test("rounds down via integer division (no fractional bigint)", () => {
      // 100 * (10000-1)/10000 = 99.99 → integer 99
      expect(computeBidAmount(100n, 1)).toBe(99n);
    });
  });

  describe("negative cases", () => {
    test("throws on negative spreadBps", () => {
      expect(() => computeBidAmount(1000n, -1)).toThrow(/out of range/);
    });

    test("throws on spreadBps > 10000", () => {
      expect(() => computeBidAmount(1000n, 10001)).toThrow(/out of range/);
    });
  });

  describe("edge cases", () => {
    test("zero maxNotional always yields zero bid", () => {
      expect(computeBidAmount(0n, 30)).toBe(0n);
    });

    test("preserves bigint precision at uint256 max", () => {
      const max = 2n ** 256n - 1n;
      // (max * 9970 / 10000) — verify no overflow / no precision loss
      const result = computeBidAmount(max, 30);
      expect(result).toBe((max * 9970n) / 10000n);
    });
  });
});
