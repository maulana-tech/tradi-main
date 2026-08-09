import { describe, test, expect, vi, beforeEach } from "vitest";

import { explainExecutionTool } from "../explainExecution.js";

beforeEach(() => vi.clearAllMocks());

function parseResult(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

describe("explainExecutionTool", () => {
  test("returns success summary with next steps", async () => {
    const result = await explainExecutionTool.handler({
      executionId: "direct_123",
      status: "completed",
      txHash: "0xabc",
      gasUsed: "115000",
      sponsored: true,
    });
    const data = parseResult(result);
    expect(data.isSuccess).toBe(true);
    expect(data.isTerminal).toBe(false);
    expect(data.summary).toContain("completed successfully");
    expect(data.txLink).toContain("0xabc");
    expect(data.nextSteps).toHaveLength(3);
  });

  test("returns failure summary with terminal flag", async () => {
    const result = await explainExecutionTool.handler({
      executionId: "direct_456",
      status: "failed",
      error: "execution reverted: not operator",
    });
    const data = parseResult(result);
    expect(data.isTerminal).toBe(true);
    expect(data.isSuccess).toBe(false);
    expect(data.summary).toContain("not operator");
    expect(data.nextSteps[0]).toContain("NOT retry");
  });

  test("returns in-progress summary", async () => {
    const result = await explainExecutionTool.handler({
      executionId: "direct_789",
      status: "confirming",
    });
    const data = parseResult(result);
    expect(data.isTerminal).toBe(false);
    expect(data.isSuccess).toBe(false);
    expect(data.summary).toContain("in progress");
  });

  test("rejects missing executionId", async () => {
    await expect(explainExecutionTool.handler({})).rejects.toThrow();
  });
});
