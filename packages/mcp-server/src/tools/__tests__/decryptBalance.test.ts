import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("../../client.js", () => ({
  getPublicClient: vi.fn(),
  getHandleClient: vi.fn(),
  getWalletClient: vi.fn(),
}));

vi.mock("../../abi.js", () => ({
  erc7984Abi: [],
}));

import { decryptBalanceTool } from "../decryptBalance.js";
import {
  getPublicClient,
  getHandleClient,
  getWalletClient,
} from "../../client.js";

const mockGetPublicClient = vi.mocked(getPublicClient);
const mockGetHandleClient = vi.mocked(getHandleClient);
const mockGetWalletClient = vi.mocked(getWalletClient);

const TOKEN = "0x1111111111111111111111111111111111111111";
const AGENT = "0x2222222222222222222222222222222222222222";
const HANDLE = "0xHandleBytes32";

function setupHappyPath(opts: {
  decryptValue?: bigint;
  decryptThrows?: Error;
  readContractThrows?: Error;
} = {}) {
  const readContract = opts.readContractThrows
    ? vi.fn().mockRejectedValue(opts.readContractThrows)
    : vi.fn().mockResolvedValue(HANDLE);
  mockGetPublicClient.mockReturnValue({ readContract } as never);

  const decrypt = opts.decryptThrows
    ? vi.fn().mockRejectedValue(opts.decryptThrows)
    : vi.fn().mockResolvedValue({ value: opts.decryptValue ?? 1234567890n });
  mockGetHandleClient.mockResolvedValue({ decrypt } as never);

  mockGetWalletClient.mockReturnValue({
    account: { address: AGENT },
  } as never);

  return { readContract, decrypt };
}

function parseResult(r: { content: { text: string }[] }) {
  return JSON.parse(r.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("decryptBalanceTool.handler", () => {
  describe("positive cases", () => {
    test("returns decrypted balance as decimal string with handle and account", async () => {
      const { readContract, decrypt } = setupHappyPath({
        decryptValue: 1_000_000_000n,
      });
      const result = await decryptBalanceTool.handler({ tokenAddress: TOKEN });
      const parsed = parseResult(result);

      expect(parsed.balance).toBe("1000000000");
      expect(parsed.handle).toBe(HANDLE);
      expect(parsed.account).toBe(AGENT);
      expect(parsed.tokenAddress).toBe(TOKEN);
      expect(readContract).toHaveBeenCalledWith({
        address: TOKEN,
        abi: [],
        functionName: "confidentialBalanceOf",
        args: [AGENT],
      });
      expect(decrypt).toHaveBeenCalledWith(HANDLE);
    });

    test("returns balance='0' when decrypted value is 0n", async () => {
      setupHappyPath({ decryptValue: 0n });
      const result = await decryptBalanceTool.handler({ tokenAddress: TOKEN });
      expect(parseResult(result).balance).toBe("0");
    });
  });

  describe("negative cases", () => {
    test("rejects when tokenAddress is missing", async () => {
      await expect(
        decryptBalanceTool.handler({}),
      ).rejects.toThrow();
    });

    test("rejects non-0x-prefixed addresses", async () => {
      await expect(
        decryptBalanceTool.handler({ tokenAddress: "deadbeef" }),
      ).rejects.toThrow();
    });

    test("rejects 0x with too few hex chars", async () => {
      await expect(
        decryptBalanceTool.handler({ tokenAddress: "0xabc" }),
      ).rejects.toThrow();
    });

    test("rejects 0x with non-hex chars", async () => {
      await expect(
        decryptBalanceTool.handler({
          tokenAddress: "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
        }),
      ).rejects.toThrow();
    });

    test("propagates readContract failure (RPC down)", async () => {
      setupHappyPath({ readContractThrows: new Error("rpc unreachable") });
      await expect(
        decryptBalanceTool.handler({ tokenAddress: TOKEN }),
      ).rejects.toThrow("rpc unreachable");
    });

    test("propagates decrypt failure (e.g. caller not on ACL)", async () => {
      setupHappyPath({
        decryptThrows: new Error("not authorized"),
      });
      await expect(
        decryptBalanceTool.handler({ tokenAddress: TOKEN }),
      ).rejects.toThrow("not authorized");
    });
  });

  describe("edge cases", () => {
    test("handles uint256 max value as decimal string", async () => {
      const max = 2n ** 256n - 1n;
      setupHappyPath({ decryptValue: max });
      const result = await decryptBalanceTool.handler({ tokenAddress: TOKEN });
      expect(parseResult(result).balance).toBe(max.toString());
    });

    test("address validation accepts mixed-case hex per regex", async () => {
      setupHappyPath();
      const mixed = "0xAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCdEfAbCd";
      const result = await decryptBalanceTool.handler({ tokenAddress: mixed });
      expect(parseResult(result).tokenAddress).toBe(mixed);
    });
  });
});

describe("decryptBalanceTool metadata", () => {
  describe("positive cases", () => {
    test("exports the correct tool name", () => {
      expect(decryptBalanceTool.name).toBe("private_otc_decrypt_balance");
    });

    test("description mentions ACL caveat", () => {
      expect(decryptBalanceTool.description).toContain("ACL");
    });

    test("input schema requires tokenAddress only", () => {
      expect(decryptBalanceTool.inputSchema.required).toEqual(["tokenAddress"]);
    });
  });
});
