import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { executeViaKeeperHub } from "../keeperhub-executor.js";
import { privateOtcAbi } from "../abi.js";
import { walletClient } from "../config.js";

describe("KeeperHubExecutor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("returns viem-fallback when relayer is not configured or disabled", async () => {
    const mockAddress = "0x1111111111111111111111111111111111111111" as const;
    const mockAccount = { address: "0x2222222222222222222222222222222222222222" as const };

    const writeSpy = vi.spyOn(walletClient, "writeContract").mockResolvedValue(
      "0x" + "c".repeat(64) as `0x${string}`
    );

    const result = await executeViaKeeperHub({
      address: mockAddress,
      abi: privateOtcAbi,
      functionName: "finalizeRFQ",
      args: [1n],
      account: mockAccount,
    });

    expect(writeSpy).toHaveBeenCalledOnce();
    expect(result.audit.routedVia).toBe("viem-fallback");
    expect(result.audit.sponsored).toBe(false);
    expect(result.txHash).toBe("0x" + "c".repeat(64));
  });

  test("relays transaction via KeeperHub when relayer URL is configured", async () => {
    const mockAddress = "0x1111111111111111111111111111111111111111" as const;
    const mockAccount = { address: "0x2222222222222222222222222222222222222222" as const };

    process.env.KEEPERHUB_ENABLED = "true";
    process.env.KEEPERHUB_RELAYER_URL = "https://relay.keeperhub.mock";
    process.env.KEEPERHUB_GAS_SPONSORSHIP = "true";

    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const urlStr = String(input);
      if (urlStr.includes("relay.keeperhub.mock")) {
        return new Response(
          JSON.stringify({
            txHash: "0x" + "d".repeat(64),
            gasUsed: "112,000 gas",
            simulationSuccess: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(input, init);
    });

    const result = await executeViaKeeperHub({
      address: mockAddress,
      abi: privateOtcAbi,
      functionName: "finalizeRFQ",
      args: [1n],
      account: mockAccount,
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.audit.routedVia).toBe("keeperhub");
    expect(result.audit.sponsored).toBe(true);
    expect(result.txHash).toBe("0x" + "d".repeat(64));

    delete process.env.KEEPERHUB_RELAYER_URL;
  });
});
