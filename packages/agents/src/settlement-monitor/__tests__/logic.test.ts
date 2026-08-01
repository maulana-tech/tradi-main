import { describe, test, expect } from "vitest";
import { formatSettlementNotification } from "../logic.js";

describe("formatSettlementNotification", () => {
  describe("positive cases", () => {
    test("formats id + taker + arbiscan link with all fields present", () => {
      const out = formatSettlementNotification(
        { id: 7n, taker: "0xTaker" },
        "0xCafeBeef",
      );
      expect(out.text).toBe(
        "🔒 OTC settled — intent #7 → taker 0xTaker\nhttps://sepolia.arbiscan.io/tx/0xCafeBeef",
      );
    });

    test("uses bigint id stringification (no scientific notation)", () => {
      const out = formatSettlementNotification(
        { id: 99999999999n, taker: "0xT" },
        "0xH",
      );
      expect(out.text).toContain("#99999999999");
    });
  });

  describe("negative cases", () => {
    test("renders '(unknown)' placeholder when id is missing", () => {
      const out = formatSettlementNotification(
        { taker: "0xTaker" },
        "0xH",
      );
      expect(out.text).toContain("#(unknown)");
    });

    test("renders '(unknown)' for missing taker", () => {
      const out = formatSettlementNotification({ id: 1n }, "0xH");
      expect(out.text).toContain("→ taker (unknown)");
    });

    test("renders '(no txHash)' when txHash is undefined", () => {
      const out = formatSettlementNotification(
        { id: 1n, taker: "0xT" },
        undefined,
      );
      expect(out.text).toContain("(no txHash)");
      expect(out.text).not.toContain("undefined");
    });
  });

  describe("edge cases", () => {
    test("handles id = 0n (legitimate first intent)", () => {
      const out = formatSettlementNotification(
        { id: 0n, taker: "0xT" },
        "0xH",
      );
      expect(out.text).toContain("#0");
    });
  });
});
