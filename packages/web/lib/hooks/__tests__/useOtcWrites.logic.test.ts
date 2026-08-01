import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  executeCreateRfq,
  executeAcceptIntent,
  executeSubmitBid,
  executeFinalizeRfq,
  executeRevealRfqWinner,
  executeCancelIntent,
  type EncryptedWriteDeps,
  type SimpleWriteDeps,
  type WriteCallbacks,
  type CreateRfqInput,
} from "../useOtcWrites.logic";

const OTC = "0xOtc" as `0x${string}`;
const SELL = "0xSell" as `0x${string}`;
const BUY = "0xBuy" as `0x${string}`;
const USER = "0xUser" as `0x${string}`;
const TX = "0xCafe" as `0x${string}`;
const FROZEN_NOW = 1_700_000_000;

function makeEncryptedDeps(
  overrides: Partial<EncryptedWriteDeps> = {},
): EncryptedWriteDeps {
  return {
    address: USER,
    noxReady: true,
    privateOtcAddress: OTC,
    getClient: vi.fn().mockResolvedValue({ mockClient: true }),
    encryptAmount: vi
      .fn()
      .mockResolvedValue({ handle: "0xH", proof: "0xP" }),
    writeContractAsync: vi.fn().mockResolvedValue(TX),
    nowSeconds: () => FROZEN_NOW,
    ...overrides,
  };
}

function makeSimpleDeps(
  overrides: Partial<SimpleWriteDeps> = {},
): SimpleWriteDeps {
  return {
    privateOtcAddress: OTC,
    writeContractAsync: vi.fn().mockResolvedValue(TX),
    ...overrides,
  };
}

function makeCb() {
  return {
    onStep: vi.fn<WriteCallbacks["onStep"]>(),
    onError: vi.fn<WriteCallbacks["onError"]>(),
    onTxHash: vi.fn<WriteCallbacks["onTxHash"]>(),
  };
}

function lastWriteCall(deps: { writeContractAsync: unknown }) {
  return (deps.writeContractAsync as ReturnType<typeof vi.fn>).mock
    .calls[0][0] as {
      address: `0x${string}`;
      functionName: string;
      args: unknown[];
    };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* -------------------------------------------------------------------------- */
/*                                executeCreateRfq                            */
/* -------------------------------------------------------------------------- */

describe("executeCreateRfq", () => {
  const baseInput: CreateRfqInput = {
    sellToken: SELL,
    buyToken: BUY,
    sellAmount: 1_000_000_000_000_000_000n,
    biddingDeadlineSeconds: 7200,
  };

  describe("positive cases", () => {
    test("emits encrypting → signing → confirming and routes to createRFQ", async () => {
      const deps = makeEncryptedDeps();
      const cb = makeCb();
      await executeCreateRfq(deps, baseInput, cb);

      expect(cb.onStep.mock.calls.map((c) => c[0])).toEqual([
        "encrypting",
        "signing",
        "confirming",
      ]);
      const call = lastWriteCall(deps);
      expect(call.functionName).toBe("createRFQ");
      expect(call.address).toBe(OTC);
      expect(cb.onTxHash).toHaveBeenCalledWith(TX);
    });

    test("encrypts the sell amount against PrivateOTC address", async () => {
      const deps = makeEncryptedDeps();
      await executeCreateRfq(deps, baseInput, makeCb());
      expect(deps.encryptAmount).toHaveBeenCalledWith(
        expect.anything(),
        baseInput.sellAmount,
        OTC,
      );
    });

    test("computes biddingDeadline from nowSeconds + offset", async () => {
      const deps = makeEncryptedDeps();
      await executeCreateRfq(deps, baseInput, makeCb());
      const call = lastWriteCall(deps);
      expect(call.args[4]).toBe(BigInt(FROZEN_NOW) + 7200n);
    });
  });

  describe("negative cases", () => {
    test("throws on missing wallet without entering try/catch", async () => {
      const cb = makeCb();
      await expect(
        executeCreateRfq(
          makeEncryptedDeps({ address: undefined }),
          baseInput,
          cb,
        ),
      ).rejects.toThrow("Wallet not connected");
      expect(cb.onStep).not.toHaveBeenCalled();
    });

    test("throws when Nox not ready", async () => {
      await expect(
        executeCreateRfq(
          makeEncryptedDeps({ noxReady: false }),
          baseInput,
          makeCb(),
        ),
      ).rejects.toThrow("Nox client not ready");
    });

    test("captures error when getClient resolves null", async () => {
      const deps = makeEncryptedDeps({
        getClient: vi.fn().mockResolvedValue(null),
      });
      const cb = makeCb();
      await executeCreateRfq(deps, baseInput, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("Nox client unavailable");
      expect(deps.writeContractAsync).not.toHaveBeenCalled();
    });

    test("captures error when encryption fails", async () => {
      const deps = makeEncryptedDeps({
        encryptAmount: vi.fn().mockRejectedValue(new Error("encrypt failed")),
      });
      const cb = makeCb();
      await executeCreateRfq(deps, baseInput, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("encrypt failed");
    });

    test("captures error when writeContractAsync fails", async () => {
      const deps = makeEncryptedDeps({
        writeContractAsync: vi
          .fn()
          .mockRejectedValue(new Error("user rejected")),
      });
      const cb = makeCb();
      await executeCreateRfq(deps, baseInput, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("user rejected");
      expect(cb.onTxHash).not.toHaveBeenCalled();
    });

    test("stringifies non-Error rejections", async () => {
      const deps = makeEncryptedDeps({
        writeContractAsync: vi.fn().mockRejectedValue("oops"),
      });
      const cb = makeCb();
      await executeCreateRfq(deps, baseInput, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("oops");
    });
  });

  describe("edge cases", () => {
    test("zero biddingDeadlineSeconds yields deadline equal to nowSeconds", async () => {
      const deps = makeEncryptedDeps();
      await executeCreateRfq(
        deps,
        { ...baseInput, biddingDeadlineSeconds: 0 },
        makeCb(),
      );
      const call = lastWriteCall(deps);
      expect(call.args[4]).toBe(BigInt(FROZEN_NOW));
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                              executeAcceptIntent                           */
/* -------------------------------------------------------------------------- */

describe("executeAcceptIntent", () => {
  describe("positive cases", () => {
    test("encrypts buyAmount and routes to acceptIntent function", async () => {
      const deps = makeEncryptedDeps();
      const cb = makeCb();
      await executeAcceptIntent(
        deps,
        { intentId: 5n, buyAmount: 3500n },
        cb,
      );

      expect(deps.encryptAmount).toHaveBeenCalledWith(
        expect.anything(),
        3500n,
        OTC,
      );
      const call = lastWriteCall(deps);
      expect(call.functionName).toBe("acceptIntent");
      expect(call.args[0]).toBe(5n);
      expect(call.args[1]).toBe("0xH");
      expect(call.args[2]).toBe("0xP");
      expect(cb.onTxHash).toHaveBeenCalledWith(TX);
    });
  });

  describe("negative cases", () => {
    test("throws on missing wallet", async () => {
      await expect(
        executeAcceptIntent(
          makeEncryptedDeps({ address: undefined }),
          { intentId: 0n, buyAmount: 0n },
          makeCb(),
        ),
      ).rejects.toThrow("Wallet not connected");
    });

    test("throws when Nox not ready", async () => {
      await expect(
        executeAcceptIntent(
          makeEncryptedDeps({ noxReady: false }),
          { intentId: 0n, buyAmount: 0n },
          makeCb(),
        ),
      ).rejects.toThrow("Nox client not ready");
    });

    test("captures error when getClient resolves null", async () => {
      const deps = makeEncryptedDeps({
        getClient: vi.fn().mockResolvedValue(null),
      });
      const cb = makeCb();
      await executeAcceptIntent(
        deps,
        { intentId: 0n, buyAmount: 0n },
        cb,
      );
      expect(cb.onError).toHaveBeenLastCalledWith("Nox client unavailable");
    });

    test("captures error from encryption", async () => {
      const deps = makeEncryptedDeps({
        encryptAmount: vi.fn().mockRejectedValue(new Error("nope")),
      });
      const cb = makeCb();
      await executeAcceptIntent(deps, { intentId: 1n, buyAmount: 1n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("nope");
    });

    test("captures error from write", async () => {
      const deps = makeEncryptedDeps({
        writeContractAsync: vi.fn().mockRejectedValue(new Error("rejected")),
      });
      const cb = makeCb();
      await executeAcceptIntent(deps, { intentId: 1n, buyAmount: 1n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("rejected");
    });

    test("stringifies non-Error", async () => {
      const deps = makeEncryptedDeps({
        writeContractAsync: vi.fn().mockRejectedValue(42),
      });
      const cb = makeCb();
      await executeAcceptIntent(deps, { intentId: 0n, buyAmount: 0n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("42");
    });
  });

  describe("edge cases", () => {
    test("zero intentId is a legitimate input (intent 0 exists)", async () => {
      const deps = makeEncryptedDeps();
      await executeAcceptIntent(
        deps,
        { intentId: 0n, buyAmount: 100n },
        makeCb(),
      );
      const call = lastWriteCall(deps);
      expect(call.args[0]).toBe(0n);
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                               executeSubmitBid                             */
/* -------------------------------------------------------------------------- */

describe("executeSubmitBid", () => {
  describe("positive cases", () => {
    test("encrypts bidAmount and routes to submitBid function", async () => {
      const deps = makeEncryptedDeps();
      const cb = makeCb();
      await executeSubmitBid(deps, { rfqId: 9n, bidAmount: 4000n }, cb);

      expect(deps.encryptAmount).toHaveBeenCalledWith(
        expect.anything(),
        4000n,
        OTC,
      );
      const call = lastWriteCall(deps);
      expect(call.functionName).toBe("submitBid");
      expect(call.args[0]).toBe(9n);
    });
  });

  describe("negative cases", () => {
    test("throws on missing wallet", async () => {
      await expect(
        executeSubmitBid(
          makeEncryptedDeps({ address: undefined }),
          { rfqId: 0n, bidAmount: 0n },
          makeCb(),
        ),
      ).rejects.toThrow("Wallet not connected");
    });

    test("throws when Nox not ready", async () => {
      await expect(
        executeSubmitBid(
          makeEncryptedDeps({ noxReady: false }),
          { rfqId: 0n, bidAmount: 0n },
          makeCb(),
        ),
      ).rejects.toThrow("Nox client not ready");
    });

    test("captures error when getClient resolves null", async () => {
      const deps = makeEncryptedDeps({
        getClient: vi.fn().mockResolvedValue(null),
      });
      const cb = makeCb();
      await executeSubmitBid(deps, { rfqId: 0n, bidAmount: 0n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("Nox client unavailable");
    });

    test("captures error from encryption", async () => {
      const deps = makeEncryptedDeps({
        encryptAmount: vi.fn().mockRejectedValue(new Error("crypto fail")),
      });
      const cb = makeCb();
      await executeSubmitBid(deps, { rfqId: 1n, bidAmount: 1n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("crypto fail");
    });

    test("captures error from write", async () => {
      const deps = makeEncryptedDeps({
        writeContractAsync: vi
          .fn()
          .mockRejectedValue(new Error("MaxBidsReached")),
      });
      const cb = makeCb();
      await executeSubmitBid(deps, { rfqId: 1n, bidAmount: 1n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("MaxBidsReached");
    });

    test("stringifies non-Error rejection", async () => {
      const deps = makeEncryptedDeps({
        writeContractAsync: vi.fn().mockRejectedValue("rpc-down"),
      });
      const cb = makeCb();
      await executeSubmitBid(deps, { rfqId: 1n, bidAmount: 1n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("rpc-down");
    });
  });

  describe("edge cases", () => {
    test("max-uint256 bidAmount passes through unchanged", async () => {
      const deps = makeEncryptedDeps();
      const max = 2n ** 256n - 1n;
      await executeSubmitBid(deps, { rfqId: 1n, bidAmount: max }, makeCb());
      expect(deps.encryptAmount).toHaveBeenCalledWith(
        expect.anything(),
        max,
        OTC,
      );
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                              executeFinalizeRfq                            */
/* -------------------------------------------------------------------------- */

describe("executeFinalizeRfq", () => {
  describe("positive cases", () => {
    test("emits signing → confirming and routes to finalizeRFQ", async () => {
      const deps = makeSimpleDeps();
      const cb = makeCb();
      await executeFinalizeRfq(deps, { rfqId: 3n }, cb);

      expect(cb.onStep.mock.calls.map((c) => c[0])).toEqual([
        "signing",
        "confirming",
      ]);
      const call = lastWriteCall(deps);
      expect(call.functionName).toBe("finalizeRFQ");
      expect(call.args[0]).toBe(3n);
      expect(cb.onTxHash).toHaveBeenCalledWith(TX);
    });

    test("clears prior error before writing", async () => {
      const cb = makeCb();
      await executeFinalizeRfq(makeSimpleDeps(), { rfqId: 0n }, cb);
      expect(cb.onError).toHaveBeenCalledWith(null);
    });
  });

  describe("negative cases", () => {
    test("captures Error from write", async () => {
      const deps = makeSimpleDeps({
        writeContractAsync: vi
          .fn()
          .mockRejectedValue(new Error("InsufficientBids")),
      });
      const cb = makeCb();
      await executeFinalizeRfq(deps, { rfqId: 0n }, cb);
      expect(cb.onStep).toHaveBeenLastCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("InsufficientBids");
      expect(cb.onTxHash).not.toHaveBeenCalled();
    });

    test("stringifies non-Error rejection", async () => {
      const deps = makeSimpleDeps({
        writeContractAsync: vi.fn().mockRejectedValue(0),
      });
      const cb = makeCb();
      await executeFinalizeRfq(deps, { rfqId: 0n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("0");
    });
  });

  describe("edge cases", () => {
    test("zero rfqId is a legitimate input", async () => {
      const deps = makeSimpleDeps();
      await executeFinalizeRfq(deps, { rfqId: 0n }, makeCb());
      const call = lastWriteCall(deps);
      expect(call.args[0]).toBe(0n);
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                          executeRevealRfqWinner                            */
/* -------------------------------------------------------------------------- */

describe("executeRevealRfqWinner", () => {
  describe("positive cases", () => {
    test("emits signing → confirming and routes to revealRFQWinner", async () => {
      const deps = makeSimpleDeps();
      const cb = makeCb();
      await executeRevealRfqWinner(deps, { rfqId: 3n, winnerIdx: 2n }, cb);

      expect(cb.onStep.mock.calls.map((c) => c[0])).toEqual([
        "signing",
        "confirming",
      ]);
      const call = lastWriteCall(deps);
      expect(call.functionName).toBe("revealRFQWinner");
      expect(call.args[0]).toBe(3n);
      expect(call.args[1]).toBe(2n);
      expect(cb.onTxHash).toHaveBeenCalledWith(TX);
    });

    test("clears prior error before writing", async () => {
      const cb = makeCb();
      await executeRevealRfqWinner(
        makeSimpleDeps(),
        { rfqId: 0n, winnerIdx: 0n },
        cb,
      );
      expect(cb.onError).toHaveBeenCalledWith(null);
    });
  });

  describe("negative cases", () => {
    test("captures Error from write (e.g. NotMaker / InvalidWinnerIndex)", async () => {
      const deps = makeSimpleDeps({
        writeContractAsync: vi
          .fn()
          .mockRejectedValue(new Error("InvalidWinnerIndex")),
      });
      const cb = makeCb();
      await executeRevealRfqWinner(deps, { rfqId: 1n, winnerIdx: 99n }, cb);
      expect(cb.onStep).toHaveBeenLastCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("InvalidWinnerIndex");
      expect(cb.onTxHash).not.toHaveBeenCalled();
    });

    test("stringifies non-Error rejection", async () => {
      const deps = makeSimpleDeps({
        writeContractAsync: vi.fn().mockRejectedValue("rpc-fail"),
      });
      const cb = makeCb();
      await executeRevealRfqWinner(deps, { rfqId: 0n, winnerIdx: 0n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("rpc-fail");
    });
  });

  describe("edge cases", () => {
    test("zero winnerIdx is a legitimate input (first bidder won)", async () => {
      const deps = makeSimpleDeps();
      await executeRevealRfqWinner(
        deps,
        { rfqId: 1n, winnerIdx: 0n },
        makeCb(),
      );
      const call = lastWriteCall(deps);
      expect(call.args[1]).toBe(0n);
    });

    test("max-uint256 winnerIdx passes through (would revert on-chain)", async () => {
      const deps = makeSimpleDeps();
      const max = 2n ** 256n - 1n;
      await executeRevealRfqWinner(
        deps,
        { rfqId: 1n, winnerIdx: max },
        makeCb(),
      );
      const call = lastWriteCall(deps);
      expect(call.args[1]).toBe(max);
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                              executeCancelIntent                           */
/* -------------------------------------------------------------------------- */

describe("executeCancelIntent", () => {
  describe("positive cases", () => {
    test("emits signing → confirming and routes to cancelIntent", async () => {
      const deps = makeSimpleDeps();
      const cb = makeCb();
      await executeCancelIntent(deps, { intentId: 7n }, cb);

      expect(cb.onStep.mock.calls.map((c) => c[0])).toEqual([
        "signing",
        "confirming",
      ]);
      const call = lastWriteCall(deps);
      expect(call.functionName).toBe("cancelIntent");
      expect(call.args[0]).toBe(7n);
      expect(cb.onTxHash).toHaveBeenCalledWith(TX);
    });

    test("clears prior error before writing", async () => {
      const cb = makeCb();
      await executeCancelIntent(makeSimpleDeps(), { intentId: 0n }, cb);
      expect(cb.onError).toHaveBeenCalledWith(null);
    });
  });

  describe("negative cases", () => {
    test("captures Error from write (e.g. NotMaker revert)", async () => {
      const deps = makeSimpleDeps({
        writeContractAsync: vi.fn().mockRejectedValue(new Error("NotMaker")),
      });
      const cb = makeCb();
      await executeCancelIntent(deps, { intentId: 0n }, cb);
      expect(cb.onStep).toHaveBeenLastCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("NotMaker");
    });

    test("stringifies non-Error rejection", async () => {
      const deps = makeSimpleDeps({
        writeContractAsync: vi.fn().mockRejectedValue({ message: "obj" }),
      });
      const cb = makeCb();
      await executeCancelIntent(deps, { intentId: 0n }, cb);
      expect(cb.onError).toHaveBeenLastCalledWith("[object Object]");
    });
  });

  describe("edge cases", () => {
    test("max-uint256 intentId passes through (sentinel-like)", async () => {
      const deps = makeSimpleDeps();
      const max = 2n ** 256n - 1n;
      await executeCancelIntent(deps, { intentId: max }, makeCb());
      const call = lastWriteCall(deps);
      expect(call.args[0]).toBe(max);
    });
  });
});
