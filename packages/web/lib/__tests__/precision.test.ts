import { describe, test, expect } from "vitest";
import { safeUnitPrice, safeDeltaBps } from "../precision";

describe("safeUnitPrice", () => {
  describe("positive cases", () => {
    test("computes ratio for typical inputs", () => {
      expect(safeUnitPrice("3500", "1")).toBe(3500);
    });

    test("computes ratio for fractional inputs", () => {
      expect(safeUnitPrice("1.5", "0.5")).toBe(3);
    });

    test("preserves precision for typical OTC pair (cETH/cUSDC)", () => {
      const ratio = safeUnitPrice("3450.75", "1.5");
      expect(ratio).toBeCloseTo(2300.5, 10);
    });

    test("handles small decimal inputs", () => {
      expect(safeUnitPrice("0.01", "0.001")).toBe(10);
    });
  });

  describe("negative cases", () => {
    test("returns null when sell amount is empty string", () => {
      expect(safeUnitPrice("100", "")).toBeNull();
    });

    test("returns null when buy amount is empty string", () => {
      expect(safeUnitPrice("", "10")).toBeNull();
    });

    test("returns null when sell amount is non-numeric", () => {
      expect(safeUnitPrice("100", "abc")).toBeNull();
    });

    test("returns null when buy amount is non-numeric", () => {
      expect(safeUnitPrice("xyz", "10")).toBeNull();
    });

    test("returns null when sell is zero (avoid divide by zero)", () => {
      expect(safeUnitPrice("100", "0")).toBeNull();
    });

    test("returns null when sell is negative", () => {
      expect(safeUnitPrice("100", "-1")).toBeNull();
    });

    test("returns null when buy is negative", () => {
      expect(safeUnitPrice("-50", "1")).toBeNull();
    });

    test("returns null when buy is zero (degenerate 0 USD unit price)", () => {
      expect(safeUnitPrice("0", "1")).toBeNull();
    });

    test("returns null when buy amount is empty string (parses to 0)", () => {
      expect(safeUnitPrice("", "10")).toBeNull();
    });

    test("returns null when sell is NaN literal", () => {
      expect(safeUnitPrice("100", "NaN")).toBeNull();
    });

    test("returns null when sell is Infinity literal", () => {
      expect(safeUnitPrice("100", "Infinity")).toBeNull();
    });

    test("returns null when buy is Infinity literal", () => {
      expect(safeUnitPrice("Infinity", "1")).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("handles very small denominators near JS epsilon (with IEEE 754 drift)", () => {
      // 1e-300 is finite; the ratio is finite as long as it doesn't overflow.
      // IEEE 754: 1 / 1e-300 ≈ 9.999999999999999e+299 (1 ULP below true 1e300).
      // Locked in to surface the precision drift.
      const ratio = safeUnitPrice("1", "1e-300");
      expect(ratio).not.toBe(1e300);
      expect(ratio).toBeCloseTo(1e300, -290);
    });

    test("returns null when ratio overflows to Infinity", () => {
      // 1e308 / 1e-308 = Infinity in IEEE 754
      expect(safeUnitPrice("1e308", "1e-308")).toBeNull();
    });

    test("rounding error: 0.1 + 0.2 style precision is preserved as best-effort float", () => {
      // 0.3 / 0.1 in IEEE 754 = 2.9999999999999996, not 3
      const ratio = safeUnitPrice("0.3", "0.1");
      expect(ratio).not.toBe(3);
      expect(ratio).toBeCloseTo(3, 10);
    });

    test("handles whitespace-only string as NaN (Number coerces to NaN)", () => {
      // Note: Number("   ") returns 0, which we then reject as sell <= 0
      expect(safeUnitPrice("100", "   ")).toBeNull();
    });

    test("handles scientific notation inputs", () => {
      expect(safeUnitPrice("1e3", "1e1")).toBe(100);
    });

    test("rejects buy=0 + sell=0 (both edges trigger null)", () => {
      expect(safeUnitPrice("0", "0")).toBeNull();
    });
  });
});

describe("safeDeltaBps", () => {
  describe("positive cases", () => {
    test("computes 0 bps when prices match exactly", () => {
      expect(safeDeltaBps(100, 100)).toBe(0);
    });

    test("computes positive bps when your price is above fair", () => {
      // 110 vs 100 = +10% = +1000 bps
      expect(safeDeltaBps(110, 100)).toBe(1000);
    });

    test("computes negative bps when your price is below fair", () => {
      // 95 vs 100 = -5% = -500 bps
      expect(safeDeltaBps(95, 100)).toBe(-500);
    });

    test("returns 1 bps for 0.01% difference", () => {
      expect(safeDeltaBps(100.01, 100)).toBe(1);
    });

    test("handles realistic crypto pair pricing (cETH at $3500)", () => {
      // your $3535 vs fair $3500 = +1% = +100 bps
      expect(safeDeltaBps(3535, 3500)).toBe(100);
    });
  });

  describe("negative cases", () => {
    test("returns null when yourPriceUsd is NaN", () => {
      expect(safeDeltaBps(NaN, 100)).toBeNull();
    });

    test("returns null when fairPriceUsd is NaN", () => {
      expect(safeDeltaBps(100, NaN)).toBeNull();
    });

    test("returns null when yourPriceUsd is Infinity", () => {
      expect(safeDeltaBps(Infinity, 100)).toBeNull();
    });

    test("returns null when fairPriceUsd is -Infinity", () => {
      expect(safeDeltaBps(100, -Infinity)).toBeNull();
    });

    test("returns null when fairPriceUsd is 0 (avoid divide by zero)", () => {
      expect(safeDeltaBps(100, 0)).toBeNull();
    });

    test("returns null when fairPriceUsd is negative", () => {
      expect(safeDeltaBps(100, -50)).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("clamps positive overflow at +100,000 bps (+1000%)", () => {
      // 1,000,000 vs 100 = +999,900% = clamped to +100,000 bps
      expect(safeDeltaBps(1_000_000, 100)).toBe(100_000);
    });

    test("clamps negative overflow at -100,000 bps when your price negative", () => {
      // negative your price vs positive fair → clamp lower bound
      expect(safeDeltaBps(-1_000_000, 100)).toBe(-100_000);
    });

    test("rounding error: 1/3 ratio rounds to 3333 bps, not 3333.3333", () => {
      // your=4/3, fair=1 → delta = 1/3 = 3333.33... bps → Math.round → 3333
      const result = safeDeltaBps(4 / 3, 1);
      expect(result).toBe(3333);
    });

    test("rounding error: 100.005 vs 100 truncates to 0 bps (IEEE 754 drift below 0.5)", () => {
      // Mathematically (100.005 - 100) / 100 * 10000 = 0.5 → Math.round(0.5) = 1.
      // IEEE 754: 100.005 - 100 = 0.004999999999990905 → raw = 0.4999...0905
      // → Math.round → 0. This locks in the silent precision loss; if a future
      // refactor uses BigInt/string math, this test will fail and signal the
      // rounding behavior changed.
      expect(safeDeltaBps(100.005, 100)).toBe(0);
    });

    test("handles very small fair price without overflow (clamp catches it)", () => {
      // your=1, fair=1e-10 → raw delta enormous → clamped to +100,000
      expect(safeDeltaBps(1, 1e-10)).toBe(100_000);
    });

    test("preserves precision at clamp boundary +100,000 bps exactly", () => {
      // your = fair * 11 → +1000% → +100,000 bps (right at boundary, no clamp truncation)
      expect(safeDeltaBps(1100, 100)).toBe(100_000);
    });

    test("preserves precision at clamp boundary -100,000 bps exactly", () => {
      // your = -fair * 9 → -1000% → -100,000 bps
      expect(safeDeltaBps(-900, 100)).toBe(-100_000);
    });

    test("handles tiny price differences without precision loss to 0", () => {
      // 0.5 bps would Math.round to 1 (or 0 depending on direction)
      expect(safeDeltaBps(100.004, 100)).toBe(0); // 0.4 bps → 0
      expect(safeDeltaBps(100.006, 100)).toBe(1); // 0.6 bps → 1
    });
  });
});
