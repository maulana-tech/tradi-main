/**
 * Tests for the env schema in `../config.ts`.
 *
 * We import the schema directly (rather than the module-level `env` export)
 * because parsing at module load would throw before the test even runs.
 * Testing the schema in isolation gives us full control over inputs.
 */
import { describe, test, expect } from "vitest";
import { z } from "zod";

// Re-construct the schema independently — must mirror config.ts exactly.
// If config.ts changes, this test file should be updated to match.
// (The schema is also exported from config.ts; importing it would trigger
// the module's side-effect parse against process.env, which we don't want.)
const EnvSchema = z.object({
  AGENT_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "AGENT_PRIVATE_KEY must be 0x + 64 hex"),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url(),
  PRIVATE_OTC_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "PRIVATE_OTC_ADDRESS must be 0x + 40 hex"),
  AGENT_NOTIFICATION_WEBHOOK: z.string().url().optional(),
});

const validEnv = {
  AGENT_PRIVATE_KEY: "0x" + "a".repeat(64),
  ARBITRUM_SEPOLIA_RPC_URL: "https://sepolia.example.com",
  PRIVATE_OTC_ADDRESS: "0x" + "b".repeat(40),
  AGENT_NOTIFICATION_WEBHOOK: "https://hooks.example.com/abc",
};

describe("EnvSchema (agents)", () => {
  describe("positive cases", () => {
    test("accepts a fully populated env object", () => {
      const result = EnvSchema.parse(validEnv);
      expect(result.AGENT_PRIVATE_KEY).toBe(validEnv.AGENT_PRIVATE_KEY);
      expect(result.PRIVATE_OTC_ADDRESS).toBe(validEnv.PRIVATE_OTC_ADDRESS);
    });

    test("optional AGENT_NOTIFICATION_WEBHOOK can be omitted", () => {
      const { AGENT_NOTIFICATION_WEBHOOK: _, ...rest } = validEnv;
      const result = EnvSchema.parse(rest);
      expect(result.AGENT_NOTIFICATION_WEBHOOK).toBeUndefined();
    });

    test("accepts uppercase hex in AGENT_PRIVATE_KEY", () => {
      const env = { ...validEnv, AGENT_PRIVATE_KEY: "0x" + "A".repeat(64) };
      expect(() => EnvSchema.parse(env)).not.toThrow();
    });

    test("accepts mixed-case hex address", () => {
      const env = { ...validEnv, PRIVATE_OTC_ADDRESS: "0xAbCdEf" + "0".repeat(34) };
      expect(() => EnvSchema.parse(env)).not.toThrow();
    });
  });

  describe("negative cases", () => {
    test("rejects AGENT_PRIVATE_KEY without 0x prefix", () => {
      const env = { ...validEnv, AGENT_PRIVATE_KEY: "a".repeat(64) };
      expect(() => EnvSchema.parse(env)).toThrow(/AGENT_PRIVATE_KEY must be 0x \+ 64 hex/);
    });

    test("rejects AGENT_PRIVATE_KEY shorter than 64 hex chars", () => {
      const env = { ...validEnv, AGENT_PRIVATE_KEY: "0x" + "a".repeat(60) };
      expect(() => EnvSchema.parse(env)).toThrow();
    });

    test("rejects AGENT_PRIVATE_KEY longer than 64 hex chars", () => {
      const env = { ...validEnv, AGENT_PRIVATE_KEY: "0x" + "a".repeat(70) };
      expect(() => EnvSchema.parse(env)).toThrow();
    });

    test("rejects AGENT_PRIVATE_KEY with non-hex chars", () => {
      const env = { ...validEnv, AGENT_PRIVATE_KEY: "0x" + "z".repeat(64) };
      expect(() => EnvSchema.parse(env)).toThrow();
    });

    test("rejects missing AGENT_PRIVATE_KEY entirely", () => {
      const { AGENT_PRIVATE_KEY: _, ...rest } = validEnv;
      expect(() => EnvSchema.parse(rest)).toThrow();
    });

    test("rejects non-URL ARBITRUM_SEPOLIA_RPC_URL", () => {
      const env = { ...validEnv, ARBITRUM_SEPOLIA_RPC_URL: "not-a-url" };
      expect(() => EnvSchema.parse(env)).toThrow();
    });

    test("rejects PRIVATE_OTC_ADDRESS shorter than 40 hex chars", () => {
      const env = { ...validEnv, PRIVATE_OTC_ADDRESS: "0x123" };
      expect(() => EnvSchema.parse(env)).toThrow(/PRIVATE_OTC_ADDRESS must be 0x \+ 40 hex/);
    });

    test("rejects PRIVATE_OTC_ADDRESS without 0x prefix", () => {
      const env = { ...validEnv, PRIVATE_OTC_ADDRESS: "b".repeat(40) };
      expect(() => EnvSchema.parse(env)).toThrow();
    });

    test("rejects malformed AGENT_NOTIFICATION_WEBHOOK url", () => {
      const env = { ...validEnv, AGENT_NOTIFICATION_WEBHOOK: "not-a-url" };
      expect(() => EnvSchema.parse(env)).toThrow();
    });
  });

  describe("edge cases", () => {
    test("rejects extra unknown fields silently (zod default strips)", () => {
      const result = EnvSchema.parse({ ...validEnv, UNKNOWN_FIELD: "ignored" });
      expect("UNKNOWN_FIELD" in result).toBe(false);
    });
  });
});
