import { describe, test, expect } from "vitest";
import { cn, shortAddress } from "../utils";

describe("cn", () => {
  describe("positive cases", () => {
    test("merges multiple class strings", () => {
      expect(cn("px-2", "py-3")).toBe("px-2 py-3");
    });

    test("dedupes conflicting tailwind classes (later wins)", () => {
      expect(cn("px-2", "px-4")).toBe("px-4");
    });

    test("supports clsx conditional object syntax", () => {
      expect(cn({ "is-active": true, "is-hidden": false })).toBe("is-active");
    });

    test("flattens arrays of class fragments", () => {
      expect(cn(["px-2", ["py-3", "text-sm"]])).toBe("px-2 py-3 text-sm");
    });
  });

  describe("edge cases", () => {
    test("returns empty string when called with no args", () => {
      expect(cn()).toBe("");
    });

    test("filters out falsy entries", () => {
      expect(cn("px-2", false, null, undefined, "py-3")).toBe("px-2 py-3");
    });
  });
});

describe("shortAddress", () => {
  describe("positive cases", () => {
    test("truncates a typical 0x address with default 4 chars", () => {
      expect(shortAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(
        "0x1234...5678",
      );
    });

    test("respects custom chars parameter", () => {
      expect(
        shortAddress("0x1234567890abcdef1234567890abcdef12345678", 6),
      ).toBe("0x123456...345678");
    });
  });

  describe("negative cases", () => {
    test("returns empty string for empty input", () => {
      expect(shortAddress("")).toBe("");
    });
  });

  describe("edge cases", () => {
    test("handles short strings shorter than 2*chars+2 (overlap allowed)", () => {
      // shortAddress doesn't validate length — slice handles overlap.
      expect(shortAddress("0xABCD")).toBe("0xABCD...ABCD");
    });

    test("chars=0 has surprising slice(-0)=whole-string semantics — locked in", () => {
      // JS quirk: slice(-0) === slice(0) === full string.
      // So chars=0 actually duplicates the address suffix. Document via test
      // so a future BigInt-safe rewrite that "fixes" this would trip the test.
      expect(shortAddress("0xABCDEF", 0)).toBe("0x...0xABCDEF");
    });
  });
});
