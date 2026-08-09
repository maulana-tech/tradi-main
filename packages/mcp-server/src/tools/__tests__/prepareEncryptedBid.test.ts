import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../client.js", () => ({
  getEnv: vi.fn(),
  getPublicClient: vi.fn(),
  getWalletClient: vi.fn(),
  getHandleClient: vi.fn(),
}));

vi.mock("../../abi.js", () => ({
  privateOtcAbi: [],
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return { ...actual, encodeFunctionData: vi.fn().mockReturnValue("0xCalldata") };
});

import { prepareEncryptedBidTool } from "../prepareEncryptedBid.js";
import { getEnv, getPublicClient, getHandleClient } from "../../client.js";

const mockGetEnv = vi.mocked(getEnv);
const mockGetPublicClient = vi.mocked(getPublicClient);
const mockGetHandleClient = vi.mocked(getHandleClient);

const OTC = "0xOtc" as `0x${string}`;

function makeIntent(mode: number, status: number, deadlineOffset = 3600): readonly [
  `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`,
  bigint, number, number, `0x${string}`,
] {
  return [
    "0xMaker" as `0x${string}`,
    "0xSell" as `0x${string}`,
    "0xBuy" as `0x${string}`,
    "0xH1" as `0x${string}`,
    "0xH2" as `0x${string}`,
    BigInt(Math.floor(Date.now() / 1000) + deadlineOffset),
    status,
    mode,
    "0x0000000000000000000000000000000000000000" as `0x${string}`,
  ];
}

beforeEach(() => vi.clearAllMocks());

describe("prepareEncryptedBidTool", () => {
  test("returns encrypted calldata for valid RFQ", async () => {
    const encryptInput = vi.fn().mockResolvedValue({
      handle: "0xHandle",
      handleProof: "0xProof",
    });
    mockGetHandleClient.mockResolvedValue({ encryptInput } as never);
    mockGetPublicClient.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(makeIntent(1, 0)),
    } as never);
    mockGetEnv.mockReturnValue({ otc: OTC, key: "0x", rpc: "" } as never);

    const result = await prepareEncryptedBidTool.handler({
      intentId: "3",
      bidAmount: "1000000",
    });
    const data = JSON.parse(result.content[0].text);

    expect(data.intentId).toBe("3");
    expect(data.bidAmount).toBe("1000000");
    expect(data.handle).toBe("0xHandle");
    expect(data.calldata).toBe("0xCalldata");
    expect(data.target).toBe(OTC);
    expect(encryptInput).toHaveBeenCalledWith(1000000n, "uint256", OTC);
  });

  test("rejects non-RFQ intent", async () => {
    mockGetPublicClient.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(makeIntent(0, 0)),
    } as never);
    mockGetEnv.mockReturnValue({ otc: OTC, key: "0x", rpc: "" } as never);

    await expect(
      prepareEncryptedBidTool.handler({ intentId: "0", bidAmount: "100" }),
    ).rejects.toThrow("not an RFQ");
  });

  test("rejects non-Open intent", async () => {
    mockGetPublicClient.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(makeIntent(1, 1)),
    } as never);
    mockGetEnv.mockReturnValue({ otc: OTC, key: "0x", rpc: "" } as never);

    await expect(
      prepareEncryptedBidTool.handler({ intentId: "1", bidAmount: "100" }),
    ).rejects.toThrow("not Open");
  });

  test("rejects expired intent", async () => {
    mockGetPublicClient.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(makeIntent(1, 0, -100)),
    } as never);
    mockGetEnv.mockReturnValue({ otc: OTC, key: "0x", rpc: "" } as never);

    await expect(
      prepareEncryptedBidTool.handler({ intentId: "2", bidAmount: "100" }),
    ).rejects.toThrow("deadline has passed");
  });

  test("rejects non-numeric bidAmount", async () => {
    await expect(
      prepareEncryptedBidTool.handler({ intentId: "1", bidAmount: "abc" }),
    ).rejects.toThrow();
  });
});
