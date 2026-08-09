import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { execute } from "../executor.js";

describe("Executor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.KEEPERHUB_MCP_URL;
    delete process.env.KEEPERHUB_API_KEY;
  });

  test("uses viem-fallback when KEEPERHUB_MCP_URL is not set", async () => {
    delete process.env.KEEPERHUB_MCP_URL;

    const result = await execute({
      target: "0x1111111111111111111111111111111111111111",
      calldata: "0x",
      functionName: "finalizeRFQ",
      intentId: "1",
      action: "finalizeRFQ",
      decision: "finalize",
      reason: "test",
    });

    expect(result.audit.routedVia).toBe("viem-fallback");
    expect(result.audit.intentId).toBe("1");
    expect(result.audit.action).toBe("finalizeRFQ");
    expect(result.audit.decision).toBe("finalize");
  }, 15000);

  test("returns audit record with all required fields", async () => {
    delete process.env.KEEPERHUB_MCP_URL;

    const result = await execute({
      target: "0x1111111111111111111111111111111111111111",
      calldata: "0x",
      functionName: "finalizeRFQ",
      intentId: "5",
      action: "finalizeRFQ",
      decision: "finalize",
      reason: "expired RFQ",
    });

    expect(result.audit).toHaveProperty("intentId", "5");
    expect(result.audit).toHaveProperty("action", "finalizeRFQ");
    expect(result.audit).toHaveProperty("decision", "finalize");
    expect(result.audit).toHaveProperty("reason", "expired RFQ");
    expect(result.audit).toHaveProperty("executionId");
    expect(result.audit).toHaveProperty("status");
    expect(result.audit).toHaveProperty("transactionHash");
    expect(result.audit).toHaveProperty("transactionLink");
    expect(result.audit).toHaveProperty("gasUsed");
    expect(result.audit).toHaveProperty("sponsored");
    expect(result.audit).toHaveProperty("createdAt");
    expect(result.audit).toHaveProperty("completedAt");
    expect(result.audit).toHaveProperty("error");
  });

  test("execution fails gracefully when viem cannot connect", async () => {
    delete process.env.KEEPERHUB_MCP_URL;

    const result = await execute({
      target: "0x1111111111111111111111111111111111111111",
      calldata: "0x",
      functionName: "finalizeRFQ",
      intentId: "1",
      action: "finalizeRFQ",
      decision: "finalize",
      reason: "test",
    });

    // Viem fallback will fail on testnet RPC but should return a structured error
    expect(result.audit.status).toBeDefined();
    expect(result.audit.completedAt).toBeTruthy();
  });
});
