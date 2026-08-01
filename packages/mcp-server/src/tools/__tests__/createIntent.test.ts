import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../client.js", () => ({
  getEnv: vi.fn(),
  getWalletClient: vi.fn(),
  getPublicClient: vi.fn(),
  getHandleClient: vi.fn(),
}));

vi.mock("../../abi.js", () => ({
  privateOtcAbi: [],
}));

vi.mock("viem", () => ({
  decodeEventLog: vi.fn(),
}));

import { createIntentTool } from "../createIntent.js";
import {
  getEnv,
  getWalletClient,
  getPublicClient,
  getHandleClient,
} from "../../client.js";
import { decodeEventLog } from "viem";

const mockGetEnv = vi.mocked(getEnv);
const mockGetWalletClient = vi.mocked(getWalletClient);
const mockGetPublicClient = vi.mocked(getPublicClient);
const mockGetHandleClient = vi.mocked(getHandleClient);
const mockDecodeEventLog = vi.mocked(decodeEventLog);

const OTC = "0x000000000000000000000000000000000000000A" as `0x${string}`;
const SELL_TOKEN = "0x1111111111111111111111111111111111111111";
const BUY_TOKEN = "0x2222222222222222222222222222222222222222";
const ALLOWED = "0x3333333333333333333333333333333333333333";
const TX_HASH = "0xCafe";

const baseInput = {
  sellToken: SELL_TOKEN,
  buyToken: BUY_TOKEN,
  sellAmount: "1000000000000000000",
  minBuyAmount: "3500000000",
  deadlineSeconds: 3600,
};

function setupHappyPath(opts: {
  intentIdInLog?: bigint | null;
  decoderThrows?: number;
} = {}) {
  const { intentIdInLog = 7n, decoderThrows } = opts;

  mockGetEnv.mockReturnValue({ otc: OTC, key: "0x", rpc: "" } as never);

  const writeContract = vi.fn().mockResolvedValue(TX_HASH);
  mockGetWalletClient.mockReturnValue({
    writeContract,
    chain: { id: 421614 },
    account: { address: "0xAgent" },
  } as never);

  const waitForTransactionReceipt = vi.fn().mockResolvedValue({
    logs: intentIdInLog === null
      ? []
      : [
        { data: "0xa", topics: ["0xtopic"] },
        { data: "0xb", topics: ["0xtopic"] },
      ],
  });
  mockGetPublicClient.mockReturnValue({
    waitForTransactionReceipt,
  } as never);

  const encryptInput = vi
    .fn()
    .mockResolvedValueOnce({ handle: "0xSellH", handleProof: "0xSellP" })
    .mockResolvedValueOnce({ handle: "0xBuyH", handleProof: "0xBuyP" });
  mockGetHandleClient.mockResolvedValue({ encryptInput } as never);

  if (intentIdInLog !== null) {
    let callIdx = 0;
    mockDecodeEventLog.mockImplementation(() => {
      const idx = callIdx++;
      if (decoderThrows !== undefined && idx === decoderThrows) {
        throw new Error("decoder fail");
      }
      // First log = unrelated event; second = IntentCreated
      if (idx === 0) {
        return { eventName: "Other", args: { id: 99n } } as never;
      }
      return {
        eventName: "IntentCreated",
        args: { id: intentIdInLog },
      } as never;
    });
  }

  return { writeContract, encryptInput };
}

function parseResult(r: { content: { text: string }[] }) {
  return JSON.parse(r.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createIntentTool.handler", () => {
  describe("positive cases", () => {
    test("returns intentId, txHash, and arbiscan link on success", async () => {
      setupHappyPath({ intentIdInLog: 5n });
      const result = await createIntentTool.handler(baseInput);
      const parsed = parseResult(result);

      expect(parsed.ok).toBe(true);
      expect(parsed.intentId).toBe("5");
      expect(parsed.txHash).toBe(TX_HASH);
      expect(parsed.etherscan).toBe(`https://sepolia.arbiscan.io/tx/${TX_HASH}`);
    });

    test("encrypts both sellAmount and minBuyAmount as BigInts against PrivateOTC address", async () => {
      const { encryptInput } = setupHappyPath();
      await createIntentTool.handler(baseInput);
      expect(encryptInput).toHaveBeenNthCalledWith(
        1,
        1000000000000000000n,
        "uint256",
        OTC,
      );
      expect(encryptInput).toHaveBeenNthCalledWith(
        2,
        3500000000n,
        "uint256",
        OTC,
      );
    });

    test("uses provided allowedTaker when given", async () => {
      const { writeContract } = setupHappyPath();
      await createIntentTool.handler({ ...baseInput, allowedTaker: ALLOWED });
      const call = writeContract.mock.calls[0][0] as { args: unknown[] };
      expect(call.args[7]).toBe(ALLOWED);
    });

    test("defaults allowedTaker to zero address when omitted", async () => {
      const { writeContract } = setupHappyPath();
      await createIntentTool.handler(baseInput);
      const call = writeContract.mock.calls[0][0] as { args: unknown[] };
      expect(call.args[7]).toBe("0x0000000000000000000000000000000000000000");
    });

    test("computes deadline from now + deadlineSeconds (bigint)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(1700000000 * 1000));
      const { writeContract } = setupHappyPath();
      await createIntentTool.handler(baseInput);
      const call = writeContract.mock.calls[0][0] as { args: unknown[] };
      expect(call.args[6]).toBe(1700000000n + 3600n);
      vi.useRealTimers();
    });

    test("calls writeContract with createIntent function name and full arg shape", async () => {
      const { writeContract } = setupHappyPath();
      await createIntentTool.handler(baseInput);
      const call = writeContract.mock.calls[0][0] as {
        address: `0x${string}`;
        functionName: string;
        args: unknown[];
      };
      expect(call.address).toBe(OTC);
      expect(call.functionName).toBe("createIntent");
      expect(call.args[0]).toBe(SELL_TOKEN);
      expect(call.args[1]).toBe(BUY_TOKEN);
      expect(call.args[2]).toBe("0xSellH");
      expect(call.args[3]).toBe("0xSellP");
      expect(call.args[4]).toBe("0xBuyH");
      expect(call.args[5]).toBe("0xBuyP");
    });
  });

  describe("negative cases", () => {
    test("rejects when sellToken is not a 0x address", async () => {
      await expect(
        createIntentTool.handler({ ...baseInput, sellToken: "not-an-address" }),
      ).rejects.toThrow();
    });

    test("rejects when sellToken is too short", async () => {
      await expect(
        createIntentTool.handler({ ...baseInput, sellToken: "0x1234" }),
      ).rejects.toThrow();
    });

    test("rejects when buyToken is not a 0x address", async () => {
      await expect(
        createIntentTool.handler({ ...baseInput, buyToken: "0xZZZ" }),
      ).rejects.toThrow();
    });

    test("rejects when sellToken is missing", async () => {
      const { sellToken: _, ...rest } = baseInput;
      await expect(createIntentTool.handler(rest)).rejects.toThrow();
    });

    test("rejects when deadlineSeconds is zero (positive() in zod requires > 0)", async () => {
      await expect(
        createIntentTool.handler({ ...baseInput, deadlineSeconds: 0 }),
      ).rejects.toThrow();
    });

    test("rejects when deadlineSeconds is negative", async () => {
      await expect(
        createIntentTool.handler({ ...baseInput, deadlineSeconds: -100 }),
      ).rejects.toThrow();
    });

    test("rejects when sellAmount is not a string", async () => {
      await expect(
        createIntentTool.handler({ ...baseInput, sellAmount: 1000 }),
      ).rejects.toThrow();
    });

    test("returns intentId=null when no IntentCreated event in receipt logs", async () => {
      setupHappyPath({ intentIdInLog: null });
      const result = await createIntentTool.handler(baseInput);
      const parsed = parseResult(result);
      expect(parsed.intentId).toBeNull();
      expect(parsed.txHash).toBe(TX_HASH);
    });

    test("swallows decoder throw and continues to find IntentCreated", async () => {
      // First log throws, second is IntentCreated
      setupHappyPath();
      let callIdx = 0;
      mockDecodeEventLog.mockReset();
      mockDecodeEventLog.mockImplementation(() => {
        const idx = callIdx++;
        if (idx === 0) throw new Error("not our abi");
        return { eventName: "IntentCreated", args: { id: 42n } } as never;
      });
      const result = await createIntentTool.handler(baseInput);
      expect(parseResult(result).intentId).toBe("42");
    });
  });

  describe("edge cases", () => {
    test("handles zero amount strings (encryption layer accepts 0n)", async () => {
      const { encryptInput } = setupHappyPath();
      await createIntentTool.handler({
        ...baseInput,
        sellAmount: "0",
        minBuyAmount: "0",
      });
      expect(encryptInput).toHaveBeenNthCalledWith(1, 0n, "uint256", OTC);
      expect(encryptInput).toHaveBeenNthCalledWith(2, 0n, "uint256", OTC);
    });

    test("handles very large bigint string at uint256 max", async () => {
      const { encryptInput } = setupHappyPath();
      const max = (2n ** 256n - 1n).toString();
      await createIntentTool.handler({
        ...baseInput,
        sellAmount: max,
        minBuyAmount: max,
      });
      expect(encryptInput).toHaveBeenNthCalledWith(
        1,
        2n ** 256n - 1n,
        "uint256",
        OTC,
      );
    });

    test("returns intentId=null when receipt has zero logs", async () => {
      setupHappyPath({ intentIdInLog: null });
      const result = await createIntentTool.handler(baseInput);
      expect(parseResult(result).intentId).toBeNull();
    });
  });
});

describe("createIntentTool metadata", () => {
  describe("positive cases", () => {
    test("exports the correct tool name", () => {
      expect(createIntentTool.name).toBe("private_otc_create_intent");
    });

    test("input schema declares all 5 required fields", () => {
      expect(createIntentTool.inputSchema.required).toEqual([
        "sellToken",
        "buyToken",
        "sellAmount",
        "minBuyAmount",
        "deadlineSeconds",
      ]);
    });
  });
});
