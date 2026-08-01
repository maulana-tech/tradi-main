import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  executeCreateIntent,
  parseIntentCreatedId,
  ZERO_ADDRESS,
  type CreateIntentDeps,
  type CreateIntentCallbacks,
  type CreateIntentInput,
} from "../useCreateIntent.logic";

const OTC = "0xOtc" as `0x${string}`;
const SELL = "0xSell" as `0x${string}`;
const BUY = "0xBuy" as `0x${string}`;
const USER = "0xUser" as `0x${string}`;
const TAKER = "0xTaker" as `0x${string}`;
const TX_HASH = "0xCafeBeef" as `0x${string}`;
const FROZEN_NOW = 1_700_000_000;

function makeDeps(overrides: Partial<CreateIntentDeps> = {}): CreateIntentDeps {
  return {
    address: USER,
    noxReady: true,
    privateOtcAddress: OTC,
    getClient: vi.fn().mockResolvedValue({ mockClient: true }),
    encryptAmount: vi
      .fn()
      .mockImplementationOnce(async () => ({ handle: "0xS", proof: "0xSP" }))
      .mockImplementationOnce(async () => ({ handle: "0xB", proof: "0xBP" })),
    writeContractAsync: vi.fn().mockResolvedValue(TX_HASH),
    nowSeconds: () => FROZEN_NOW,
    ...overrides,
  };
}

function makeCb() {
  return {
    onStep: vi.fn<CreateIntentCallbacks["onStep"]>(),
    onError: vi.fn<CreateIntentCallbacks["onError"]>(),
    onTxHash: vi.fn<CreateIntentCallbacks["onTxHash"]>(),
  };
}

const baseInput: CreateIntentInput = {
  sellToken: SELL,
  buyToken: BUY,
  sellAmount: 1_000_000_000_000_000_000n,
  minBuyAmount: 3_500_000_000n,
  deadlineSeconds: 3600,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeCreateIntent", () => {
  describe("positive cases", () => {
    test("step transitions encrypting → signing → confirming", async () => {
      const deps = makeDeps();
      const cb = makeCb();
      await executeCreateIntent(deps, baseInput, cb);

      expect(cb.onStep.mock.calls.map((c) => c[0])).toEqual([
        "encrypting",
        "signing",
        "confirming",
      ]);
      expect(cb.onTxHash).toHaveBeenCalledWith(TX_HASH);
    });

    test("encrypts both sell and minBuy amounts against PrivateOTC address", async () => {
      const deps = makeDeps();
      await executeCreateIntent(deps, baseInput, makeCb());

      expect(deps.encryptAmount).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        baseInput.sellAmount,
        OTC,
      );
      expect(deps.encryptAmount).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        baseInput.minBuyAmount,
        OTC,
      );
    });

    test("computes deadline as nowSeconds + deadlineSeconds (bigint)", async () => {
      const deps = makeDeps();
      await executeCreateIntent(deps, baseInput, makeCb());

      const call = (deps.writeContractAsync as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { args: unknown[] };
      const passedDeadline = call.args[6];
      expect(passedDeadline).toBe(BigInt(FROZEN_NOW) + 3600n);
    });

    test("uses ZERO_ADDRESS when allowedTaker is not provided", async () => {
      const deps = makeDeps();
      await executeCreateIntent(deps, baseInput, makeCb());

      const call = (deps.writeContractAsync as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { args: unknown[] };
      expect(call.args[7]).toBe(ZERO_ADDRESS);
    });

    test("passes allowedTaker through when provided", async () => {
      const deps = makeDeps();
      await executeCreateIntent(
        deps,
        { ...baseInput, allowedTaker: TAKER },
        makeCb(),
      );

      const call = (deps.writeContractAsync as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { args: unknown[] };
      expect(call.args[7]).toBe(TAKER);
    });

    test("calls writeContractAsync with createIntent function name and full arg shape", async () => {
      const deps = makeDeps();
      await executeCreateIntent(deps, baseInput, makeCb());

      const call = (deps.writeContractAsync as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as {
          address: `0x${string}`;
          functionName: string;
          args: unknown[];
        };
      expect(call.address).toBe(OTC);
      expect(call.functionName).toBe("createIntent");
      expect(call.args[0]).toBe(SELL);
      expect(call.args[1]).toBe(BUY);
      expect(call.args[2]).toBe("0xS");
      expect(call.args[3]).toBe("0xSP");
      expect(call.args[4]).toBe("0xB");
      expect(call.args[5]).toBe("0xBP");
    });
  });

  describe("negative cases", () => {
    test("throws when wallet address is undefined", async () => {
      const cb = makeCb();
      await expect(
        executeCreateIntent(
          makeDeps({ address: undefined }),
          baseInput,
          cb,
        ),
      ).rejects.toThrow("Wallet not connected");
      expect(cb.onStep).not.toHaveBeenCalled();
    });

    test("throws when Nox client not ready", async () => {
      const cb = makeCb();
      await expect(
        executeCreateIntent(
          makeDeps({ noxReady: false }),
          baseInput,
          cb,
        ),
      ).rejects.toThrow("Nox client not ready");
    });

    test("transitions to error step when getClient resolves to null", async () => {
      const deps = makeDeps({ getClient: vi.fn().mockResolvedValue(null) });
      const cb = makeCb();
      await executeCreateIntent(deps, baseInput, cb);

      expect(cb.onStep).toHaveBeenLastCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("Nox client unavailable");
      expect(deps.encryptAmount).not.toHaveBeenCalled();
      expect(deps.writeContractAsync).not.toHaveBeenCalled();
    });

    test("captures error from sellAmount encryption", async () => {
      const deps = makeDeps({
        encryptAmount: vi.fn().mockRejectedValue(new Error("sell encrypt failed")),
      });
      const cb = makeCb();
      await executeCreateIntent(deps, baseInput, cb);

      expect(cb.onStep).toHaveBeenLastCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("sell encrypt failed");
      expect(deps.writeContractAsync).not.toHaveBeenCalled();
    });

    test("captures error from minBuy encryption (after sell succeeds)", async () => {
      const deps = makeDeps({
        encryptAmount: vi
          .fn()
          .mockResolvedValueOnce({ handle: "0xS", proof: "0xSP" })
          .mockRejectedValueOnce(new Error("minBuy encrypt failed")),
      });
      const cb = makeCb();
      await executeCreateIntent(deps, baseInput, cb);

      expect(cb.onError).toHaveBeenLastCalledWith("minBuy encrypt failed");
      expect(deps.writeContractAsync).not.toHaveBeenCalled();
    });

    test("captures error from writeContractAsync", async () => {
      const deps = makeDeps({
        writeContractAsync: vi.fn().mockRejectedValue(new Error("user rejected")),
      });
      const cb = makeCb();
      await executeCreateIntent(deps, baseInput, cb);

      expect(cb.onError).toHaveBeenLastCalledWith("user rejected");
      expect(cb.onTxHash).not.toHaveBeenCalled();
    });

    test("stringifies non-Error rejection values", async () => {
      const deps = makeDeps({
        writeContractAsync: vi.fn().mockRejectedValue({ code: -32000 }),
      });
      const cb = makeCb();
      await executeCreateIntent(deps, baseInput, cb);

      expect(cb.onError).toHaveBeenLastCalledWith("[object Object]");
    });
  });

  describe("edge cases", () => {
    test("zero amounts are accepted (encryption layer not validation layer)", async () => {
      const deps = makeDeps();
      await executeCreateIntent(
        deps,
        { ...baseInput, sellAmount: 0n, minBuyAmount: 0n },
        makeCb(),
      );
      expect(deps.encryptAmount).toHaveBeenNthCalledWith(1, expect.anything(), 0n, OTC);
      expect(deps.encryptAmount).toHaveBeenNthCalledWith(2, expect.anything(), 0n, OTC);
    });

    test("zero deadlineSeconds yields deadline == nowSeconds", async () => {
      const deps = makeDeps();
      await executeCreateIntent(
        deps,
        { ...baseInput, deadlineSeconds: 0 },
        makeCb(),
      );
      const call = (deps.writeContractAsync as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { args: unknown[] };
      expect(call.args[6]).toBe(BigInt(FROZEN_NOW));
    });

    test("negative deadlineSeconds yields deadline before now (already-expired)", async () => {
      const deps = makeDeps();
      await executeCreateIntent(
        deps,
        { ...baseInput, deadlineSeconds: -3600 },
        makeCb(),
      );
      const call = (deps.writeContractAsync as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { args: unknown[] };
      expect(call.args[6]).toBe(BigInt(FROZEN_NOW) - 3600n);
    });
  });
});

describe("parseIntentCreatedId", () => {
  describe("positive cases", () => {
    test("returns id from first IntentCreated log", () => {
      const decode = vi
        .fn()
        .mockReturnValue({ eventName: "IntentCreated", args: { id: 7n } });
      const id = parseIntentCreatedId(
        [{ data: "0x" as `0x${string}`, topics: [] }],
        decode as never,
      );
      expect(id).toBe(7n);
    });

    test("skips non-matching events to find IntentCreated", () => {
      const decode = vi
        .fn()
        .mockReturnValueOnce({
          eventName: "OtherEvent",
          args: { id: 99n },
        })
        .mockReturnValueOnce({
          eventName: "IntentCreated",
          args: { id: 5n },
        });
      const logs = [
        { data: "0xa" as `0x${string}`, topics: [] },
        { data: "0xb" as `0x${string}`, topics: [] },
      ];
      const id = parseIntentCreatedId(logs, decode as never);
      expect(id).toBe(5n);
    });
  });

  describe("negative cases", () => {
    test("returns null when no logs present", () => {
      const decode = vi.fn();
      expect(parseIntentCreatedId([], decode as never)).toBeNull();
      expect(decode).not.toHaveBeenCalled();
    });

    test("returns null when no IntentCreated event in any log", () => {
      const decode = vi
        .fn()
        .mockReturnValue({ eventName: "Settled", args: { id: 1n } });
      const id = parseIntentCreatedId(
        [{ data: "0x" as `0x${string}`, topics: [] }],
        decode as never,
      );
      expect(id).toBeNull();
    });

    test("swallows decoder throws and continues", () => {
      const decode = vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error("not our abi");
        })
        .mockImplementationOnce(() => ({
          eventName: "IntentCreated",
          args: { id: 11n },
        }));
      const id = parseIntentCreatedId(
        [
          { data: "0xa" as `0x${string}`, topics: [] },
          { data: "0xb" as `0x${string}`, topics: [] },
        ],
        decode as never,
      );
      expect(id).toBe(11n);
    });

    test("returns null when decoder throws on every log", () => {
      const decode = vi.fn().mockImplementation(() => {
        throw new Error("never matches");
      });
      const id = parseIntentCreatedId(
        [
          { data: "0xa" as `0x${string}`, topics: [] },
          { data: "0xb" as `0x${string}`, topics: [] },
        ],
        decode as never,
      );
      expect(id).toBeNull();
    });
  });

  describe("edge cases", () => {
    test("returns null when decoder returns null (defensive against null result)", () => {
      const decode = vi.fn().mockReturnValue(null);
      const id = parseIntentCreatedId(
        [{ data: "0x" as `0x${string}`, topics: [] }],
        decode as never,
      );
      expect(id).toBeNull();
    });
  });
});
