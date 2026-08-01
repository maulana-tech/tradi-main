import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getEnv } from "../client.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Wipe relevant vars before each test to avoid leakage from previous runs.
  delete process.env.AGENT_PRIVATE_KEY;
  delete process.env.PRIVATE_KEY;
  delete process.env.ARBITRUM_SEPOLIA_RPC_URL;
  delete process.env.PRIVATE_OTC_ADDRESS;
  delete process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

const VALID_KEY = "0x" + "a".repeat(64);
const VALID_ADDR = "0x" + "b".repeat(40);

describe("getEnv", () => {
  describe("positive cases", () => {
    test("returns parsed env when AGENT_PRIVATE_KEY + PRIVATE_OTC_ADDRESS set", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      const env = getEnv();
      expect(env.key).toBe(VALID_KEY);
      expect(env.otc).toBe(VALID_ADDR);
    });

    test("falls back to PRIVATE_KEY when AGENT_PRIVATE_KEY missing", () => {
      process.env.PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      const env = getEnv();
      expect(env.key).toBe(VALID_KEY);
    });

    test("AGENT_PRIVATE_KEY takes precedence over PRIVATE_KEY when both set", () => {
      const otherKey = "0x" + "c".repeat(64);
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_KEY = otherKey;
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      const env = getEnv();
      expect(env.key).toBe(VALID_KEY);
    });

    test("falls back to NEXT_PUBLIC_PRIVATE_OTC_ADDRESS when PRIVATE_OTC_ADDRESS missing", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS = VALID_ADDR;
      const env = getEnv();
      expect(env.otc).toBe(VALID_ADDR);
    });

    test("uses default Arbitrum Sepolia RPC when ARBITRUM_SEPOLIA_RPC_URL unset", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      const env = getEnv();
      expect(env.rpc).toBe("https://sepolia-rollup.arbitrum.io/rpc");
    });

    test("uses provided ARBITRUM_SEPOLIA_RPC_URL when set", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      process.env.ARBITRUM_SEPOLIA_RPC_URL = "https://custom-rpc.example.com";
      const env = getEnv();
      expect(env.rpc).toBe("https://custom-rpc.example.com");
    });
  });

  describe("negative cases", () => {
    test("throws when no private key set anywhere", () => {
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      expect(() => getEnv()).toThrow(/AGENT_PRIVATE_KEY/);
    });

    test("throws when AGENT_PRIVATE_KEY is malformed (no 0x prefix)", () => {
      process.env.AGENT_PRIVATE_KEY = "a".repeat(64);
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      expect(() => getEnv()).toThrow(/AGENT_PRIVATE_KEY/);
    });

    test("throws when AGENT_PRIVATE_KEY is too short", () => {
      process.env.AGENT_PRIVATE_KEY = "0x" + "a".repeat(60);
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      expect(() => getEnv()).toThrow(/AGENT_PRIVATE_KEY/);
    });

    test("throws when AGENT_PRIVATE_KEY contains non-hex chars", () => {
      process.env.AGENT_PRIVATE_KEY = "0x" + "z".repeat(64);
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      expect(() => getEnv()).toThrow(/AGENT_PRIVATE_KEY/);
    });

    test("throws when no contract address set anywhere", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      expect(() => getEnv()).toThrow(/PRIVATE_OTC_ADDRESS/);
    });

    test("throws when PRIVATE_OTC_ADDRESS is malformed (too short)", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_OTC_ADDRESS = "0xabc";
      expect(() => getEnv()).toThrow(/PRIVATE_OTC_ADDRESS/);
    });

    test("throws when PRIVATE_OTC_ADDRESS has no 0x prefix", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_OTC_ADDRESS = "b".repeat(40);
      expect(() => getEnv()).toThrow(/PRIVATE_OTC_ADDRESS/);
    });
  });

  describe("edge cases", () => {
    test("accepts uppercase hex in private key", () => {
      process.env.AGENT_PRIVATE_KEY = "0x" + "A".repeat(64);
      process.env.PRIVATE_OTC_ADDRESS = VALID_ADDR;
      expect(() => getEnv()).not.toThrow();
    });

    test("accepts mixed-case hex in address (EIP-55 checksum)", () => {
      process.env.AGENT_PRIVATE_KEY = VALID_KEY;
      process.env.PRIVATE_OTC_ADDRESS = "0xAbCdEf" + "0".repeat(34);
      expect(() => getEnv()).not.toThrow();
    });
  });
});
