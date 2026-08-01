import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Module mocks — must be hoisted before importing the SUT.
vi.mock("wagmi", () => ({
  useReadContract: vi.fn(),
  useReadContracts: vi.fn(),
}));

vi.mock("@/lib/wagmi", () => ({
  PRIVATE_OTC_ADDRESS: "0x000000000000000000000000000000000000dEaD",
}));

vi.mock("@/lib/abi/privateOtc", () => ({
  privateOtcAbi: [],
}));

import { useReadContract, useReadContracts } from "wagmi";
import { useIntents, statusLabel, modeLabel } from "../useIntents";

const mockUseReadContract = vi.mocked(useReadContract);
const mockUseReadContracts = vi.mocked(useReadContracts);

// wagmi's overloaded generic signatures widen the captured call args to
// `unknown` — type the local view explicitly so .contracts is reachable.
type ReadContractsCallArgs = {
  contracts?: ReadonlyArray<{
    address?: string;
    args?: readonly unknown[];
  }>;
  query?: { enabled?: boolean };
};

function readContractsArgs(): ReadContractsCallArgs {
  return mockUseReadContracts.mock.calls[0]![0] as ReadContractsCallArgs;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("statusLabel", () => {
  describe("positive cases", () => {
    test("returns Open for status 0", () => {
      expect(statusLabel(0)).toBe("Open");
    });
    test("returns Filled for status 1", () => {
      expect(statusLabel(1)).toBe("Filled");
    });
    test("returns Cancelled for status 2", () => {
      expect(statusLabel(2)).toBe("Cancelled");
    });
    test("returns Expired for status 3", () => {
      expect(statusLabel(3)).toBe("Expired");
    });
  });

  describe("edge cases", () => {
    test("returns Unknown for out-of-range status", () => {
      expect(statusLabel(99)).toBe("Unknown");
    });
    test("returns Unknown for negative status", () => {
      expect(statusLabel(-1)).toBe("Unknown");
    });
  });
});

describe("modeLabel", () => {
  describe("positive cases", () => {
    test("returns Direct for mode 0", () => {
      expect(modeLabel(0)).toBe("Direct");
    });
    test("returns RFQ for mode 1", () => {
      expect(modeLabel(1)).toBe("RFQ");
    });
  });

  describe("edge cases", () => {
    test("returns Unknown for out-of-range mode", () => {
      expect(modeLabel(7)).toBe("Unknown");
    });
  });
});

describe("useIntents", () => {
  const ADDRESS = "0x000000000000000000000000000000000000dEaD";

  describe("positive cases", () => {
    test("returns empty rows when nextIntentId is 0", () => {
      mockUseReadContract.mockReturnValue({
        data: 0n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.rows).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test("decodes successful intent rows in reverse-chronological order", () => {
      mockUseReadContract.mockReturnValue({
        data: 2n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: [
          {
            status: "success",
            result: [
              "0xMaker0",
              "0xSell0",
              "0xBuy0",
              "0xHandle0a",
              "0xHandle0b",
              1700000000n,
              0,
              0,
              "0xAllowed0",
            ],
          },
          {
            status: "success",
            result: [
              "0xMaker1",
              "0xSell1",
              "0xBuy1",
              "0xHandle1a",
              "0xHandle1b",
              1700000100n,
              1,
              1,
              "0xAllowed1",
            ],
          },
        ],
        isLoading: false,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());

      // Reversed order: id=1 first, then id=0
      expect(result.current.rows).toHaveLength(2);
      expect(result.current.rows[0].id).toBe(1n);
      expect(result.current.rows[0].maker).toBe("0xMaker1");
      expect(result.current.rows[0].status).toBe(1);
      expect(result.current.rows[0].mode).toBe(1);
      expect(result.current.rows[1].id).toBe(0n);
      expect(result.current.rows[1].sellAmountHandle).toBe("0xHandle0a");
      expect(result.current.rows[1].deadline).toBe(1700000000n);
    });

    test("respects limit parameter — only fetches last N intents", () => {
      mockUseReadContract.mockReturnValue({
        data: 100n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderHook(() => useIntents(5));

      // The contracts argument should request ids [95..99] = 5 items
      const callArgs = readContractsArgs();
      expect(callArgs.contracts).toHaveLength(5);
      expect(callArgs.contracts![0].args![0]).toBe(95n);
      expect(callArgs.contracts![4].args![0]).toBe(99n);
    });

    test("uses default limit of 20 when not specified", () => {
      mockUseReadContract.mockReturnValue({
        data: 50n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderHook(() => useIntents());

      const callArgs = readContractsArgs();
      expect(callArgs.contracts).toHaveLength(20);
      expect(callArgs.contracts![0].args![0]).toBe(30n);
    });

    test("uses sentinel address from wagmi mock", () => {
      mockUseReadContract.mockReturnValue({
        data: 1n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderHook(() => useIntents());

      const callArgs = readContractsArgs();
      expect(callArgs.contracts![0].address).toBe(ADDRESS);
    });
  });

  describe("negative cases", () => {
    test("filters out failed reads (status != success)", () => {
      mockUseReadContract.mockReturnValue({
        data: 2n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: [
          { status: "failure", error: new Error("rpc down") },
          {
            status: "success",
            result: [
              "0xMaker1",
              "0xSell1",
              "0xBuy1",
              "0xH1a",
              "0xH1b",
              1700000100n,
              0,
              0,
              "0xAllowed1",
            ],
          },
        ],
        isLoading: false,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.rows).toHaveLength(1);
      expect(result.current.rows[0].id).toBe(1n);
    });

    test("propagates error from nextIntentId read", () => {
      const err = new Error("nextIntentId failed");
      mockUseReadContract.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: err,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.error).toBe(err);
    });

    test("propagates error from batch intents read", () => {
      const err = new Error("batch read failed");
      mockUseReadContract.mockReturnValue({
        data: 1n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: err,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.error).toBe(err);
    });

    test("isLoading true when nextIntentId still loading", () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.isLoading).toBe(true);
    });

    test("isLoading true when batch read still loading", () => {
      mockUseReadContract.mockReturnValue({
        data: 5n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("handles undefined data from useReadContracts", () => {
      mockUseReadContract.mockReturnValue({
        data: 1n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.rows).toEqual([]);
    });

    test("disables batch query when no ids exist", () => {
      mockUseReadContract.mockReturnValue({
        data: 0n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);

      renderHook(() => useIntents());

      const callArgs = readContractsArgs();
      expect(callArgs.query?.enabled).toBe(false);
    });

    test("limit larger than total fetches all available intents from index 0", () => {
      mockUseReadContract.mockReturnValue({
        data: 3n,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as never);

      renderHook(() => useIntents(100));

      const callArgs = readContractsArgs();
      expect(callArgs.contracts).toHaveLength(3);
      expect(callArgs.contracts![0].args![0]).toBe(0n);
      expect(callArgs.contracts![2].args![0]).toBe(2n);
    });

    test("nextIntentId data undefined treated as zero total", () => {
      mockUseReadContract.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as never);

      const { result } = renderHook(() => useIntents());
      expect(result.current.rows).toEqual([]);
    });
  });
});
