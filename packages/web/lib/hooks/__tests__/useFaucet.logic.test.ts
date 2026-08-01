import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  executeFaucet,
  FAUCET_ABI,
  type FaucetDeps,
  type FaucetCallbacks,
} from "../useFaucet.logic";

const TOKEN = "0xToken" as `0x${string}`;
const USER = "0xUser" as `0x${string}`;
const TX_HASH = "0xCafeBeef" as `0x${string}`;

type DepsOverrides = Partial<FaucetDeps>;

function makeDeps(overrides: DepsOverrides = {}): FaucetDeps {
  return {
    address: USER,
    noxReady: true,
    getClient: vi.fn().mockResolvedValue({ mockClient: true }),
    encryptAmount: vi.fn().mockResolvedValue({
      handle: "0xHandle",
      proof: "0xProof",
    }),
    writeContractAsync: vi.fn().mockResolvedValue(TX_HASH),
    ...overrides,
  };
}

function makeCb() {
  return {
    onStep: vi.fn<FaucetCallbacks["onStep"]>(),
    onError: vi.fn<FaucetCallbacks["onError"]>(),
    onTxHash: vi.fn<FaucetCallbacks["onTxHash"]>(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeFaucet", () => {
  describe("positive cases", () => {
    test("emits step transitions encrypting → signing → confirming on success", async () => {
      const deps = makeDeps();
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1000n }, cb);

      expect(cb.onStep.mock.calls.map((c) => c[0])).toEqual([
        "encrypting",
        "signing",
        "confirming",
      ]);
      expect(cb.onTxHash).toHaveBeenCalledWith(TX_HASH);
    });

    test("clears prior error before starting flow", async () => {
      const cb = makeCb();
      await executeFaucet(makeDeps(), { tokenAddress: TOKEN, amount: 1n }, cb);
      expect(cb.onError).toHaveBeenCalledWith(null);
    });

    test("calls encryptAmount with the provided amount and token address", async () => {
      const deps = makeDeps();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 5_000_000n }, makeCb());

      expect(deps.encryptAmount).toHaveBeenCalledWith(
        expect.objectContaining({ mockClient: true }),
        5_000_000n,
        TOKEN,
      );
    });

    test("calls writeContractAsync with faucet ABI and encrypted args", async () => {
      const deps = makeDeps();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, makeCb());

      expect(deps.writeContractAsync).toHaveBeenCalledWith({
        address: TOKEN,
        abi: FAUCET_ABI,
        functionName: "faucet",
        args: ["0xHandle", "0xProof"],
      });
    });
  });

  describe("negative cases", () => {
    test("throws when wallet address is undefined (does NOT enter try/catch)", async () => {
      const deps = makeDeps({ address: undefined });
      const cb = makeCb();
      await expect(
        executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb),
      ).rejects.toThrow("Wallet not connected");

      // Validation throw should bypass the catch — no step or error callback.
      expect(cb.onStep).not.toHaveBeenCalled();
      expect(cb.onError).not.toHaveBeenCalled();
    });

    test("throws when Nox client not ready (validation also bypasses catch)", async () => {
      const cb = makeCb();
      await expect(
        executeFaucet(
          makeDeps({ noxReady: false }),
          { tokenAddress: TOKEN, amount: 1n },
          cb,
        ),
      ).rejects.toThrow("Nox client not ready");
      expect(cb.onStep).not.toHaveBeenCalled();
    });

    test("transitions to error step when getClient resolves to null", async () => {
      const deps = makeDeps({
        getClient: vi.fn().mockResolvedValue(null),
      });
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb);

      expect(cb.onStep).toHaveBeenCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("Nox client unavailable");
      expect(deps.encryptAmount).not.toHaveBeenCalled();
    });

    test("captures Error rejection from writeContractAsync", async () => {
      const deps = makeDeps({
        writeContractAsync: vi.fn().mockRejectedValue(new Error("user rejected")),
      });
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb);

      expect(cb.onStep).toHaveBeenLastCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("user rejected");
      expect(cb.onTxHash).not.toHaveBeenCalled();
    });

    test("stringifies non-Error rejection values", async () => {
      const deps = makeDeps({
        writeContractAsync: vi.fn().mockRejectedValue("string-error-payload"),
      });
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb);

      expect(cb.onError).toHaveBeenLastCalledWith("string-error-payload");
    });

    test("captures error when encryptAmount rejects", async () => {
      const deps = makeDeps({
        encryptAmount: vi.fn().mockRejectedValue(new Error("encryption failed")),
      });
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb);

      expect(cb.onStep).toHaveBeenLastCalledWith("error");
      expect(cb.onError).toHaveBeenLastCalledWith("encryption failed");
      expect(deps.writeContractAsync).not.toHaveBeenCalled();
    });

    test("stringifies number rejection (truthy non-Error)", async () => {
      const deps = makeDeps({
        writeContractAsync: vi.fn().mockRejectedValue(42),
      });
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb);

      expect(cb.onError).toHaveBeenLastCalledWith("42");
    });
  });

  describe("edge cases", () => {
    test("handles zero amount as legitimate input", async () => {
      const deps = makeDeps();
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 0n }, cb);
      expect(deps.encryptAmount).toHaveBeenCalledWith(
        expect.anything(),
        0n,
        TOKEN,
      );
      expect(cb.onStep).toHaveBeenLastCalledWith("confirming");
    });

    test("handles bigint amount at max uint256 boundary", async () => {
      const deps = makeDeps();
      const max = 2n ** 256n - 1n;
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: max }, makeCb());
      expect(deps.encryptAmount).toHaveBeenCalledWith(
        expect.anything(),
        max,
        TOKEN,
      );
    });

    test("does NOT emit txHash when error happens before write completes", async () => {
      const deps = makeDeps({
        writeContractAsync: vi.fn().mockRejectedValue(new Error("boom")),
      });
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb);
      expect(cb.onTxHash).not.toHaveBeenCalled();
    });

    test("error callback called with null first (clearing) then string (capturing)", async () => {
      const deps = makeDeps({
        writeContractAsync: vi.fn().mockRejectedValue(new Error("boom")),
      });
      const cb = makeCb();
      await executeFaucet(deps, { tokenAddress: TOKEN, amount: 1n }, cb);

      expect(cb.onError.mock.calls[0]).toEqual([null]);
      expect(cb.onError.mock.calls[1]).toEqual(["boom"]);
    });
  });
});
