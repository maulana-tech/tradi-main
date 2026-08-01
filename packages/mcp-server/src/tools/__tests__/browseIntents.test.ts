import { describe, test, expect, vi, beforeEach } from "vitest";

// Module mocks — must precede SUT import.
vi.mock("../../client.js", () => ({
  getEnv: vi.fn(),
  getPublicClient: vi.fn(),
}));

vi.mock("../../abi.js", () => ({
  privateOtcAbi: [],
}));

import { browseIntentsTool } from "../browseIntents.js";
import { getEnv, getPublicClient } from "../../client.js";

const mockGetEnv = vi.mocked(getEnv);
const mockGetPublicClient = vi.mocked(getPublicClient);

const OTC = "0xOtc" as `0x${string}`;

type IntentTuple = readonly [
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  bigint,
  number, // status
  number, // mode
  `0x${string}`,
];

function makeIntent(overrides: Partial<{
  maker: `0x${string}`;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  deadline: bigint;
  status: number;
  mode: number;
  allowed: `0x${string}`;
}> = {}): IntentTuple {
  return [
    overrides.maker ?? "0xMaker",
    overrides.sellToken ?? "0xSell",
    overrides.buyToken ?? "0xBuy",
    "0xH1",
    "0xH2",
    overrides.deadline ?? 1700000000n,
    overrides.status ?? 0,
    overrides.mode ?? 0,
    overrides.allowed ?? "0xAllowed",
  ] as IntentTuple;
}

function setupClient(opts: {
  nextIntentId: bigint;
  intents?: IntentTuple[];
  intentsThrows?: number[]; // indices that should throw
}) {
  const readContract = vi.fn().mockImplementation(async (params: {
    functionName: string;
    args?: readonly unknown[];
  }) => {
    if (params.functionName === "nextIntentId") return opts.nextIntentId;
    if (params.functionName === "intents") {
      const i = Number(params.args![0] as bigint);
      if (opts.intentsThrows?.includes(i)) {
        throw new Error(`intent ${i} unreadable`);
      }
      const total = Number(opts.nextIntentId);
      const start = total - (opts.intents?.length ?? 0);
      const offset = i - start;
      return opts.intents?.[offset] ?? makeIntent();
    }
    throw new Error(`unexpected call: ${params.functionName}`);
  });
  mockGetPublicClient.mockReturnValue({ readContract } as never);
  mockGetEnv.mockReturnValue({ otc: OTC, key: "0x", rpc: "" } as never);
  return readContract;
}

function parseRows(result: { content: { text: string }[] }) {
  return JSON.parse(result.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("browseIntentsTool.handler", () => {
  describe("positive cases", () => {
    test("returns all open intents when no filters are applied", async () => {
      setupClient({
        nextIntentId: 2n,
        intents: [makeIntent({ status: 0 }), makeIntent({ status: 0 })],
      });
      const result = await browseIntentsTool.handler({});
      const rows = parseRows(result);
      expect(rows).toHaveLength(2);
      expect(rows[0].status).toBe("Open");
    });

    test("returns rows in reverse-chronological order (newest first)", async () => {
      setupClient({
        nextIntentId: 2n,
        intents: [
          makeIntent({ status: 0, maker: "0xMakerA" }),
          makeIntent({ status: 0, maker: "0xMakerB" }),
        ],
      });
      const rows = parseRows(await browseIntentsTool.handler({}));
      // intent[1] (newer) should come first
      expect(rows[0].id).toBe("1");
      expect(rows[1].id).toBe("0");
    });

    test("filters by sellToken (case-insensitive)", async () => {
      setupClient({
        nextIntentId: 2n,
        intents: [
          makeIntent({ status: 0, sellToken: "0xAAAA" }),
          makeIntent({ status: 0, sellToken: "0xBBBB" }),
        ],
      });
      const rows = parseRows(
        await browseIntentsTool.handler({ sellToken: "0xaaaa" }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].sellToken).toBe("0xAAAA");
    });

    test("filters by buyToken (case-insensitive)", async () => {
      setupClient({
        nextIntentId: 2n,
        intents: [
          makeIntent({ status: 0, buyToken: "0xCcCc" }),
          makeIntent({ status: 0, buyToken: "0xDdDd" }),
        ],
      });
      const rows = parseRows(
        await browseIntentsTool.handler({ buyToken: "0xcccc" }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].buyToken).toBe("0xCcCc");
    });

    test("filters by mode=direct (mode 0 only)", async () => {
      setupClient({
        nextIntentId: 2n,
        intents: [
          makeIntent({ status: 0, mode: 0 }),
          makeIntent({ status: 0, mode: 1 }),
        ],
      });
      const rows = parseRows(
        await browseIntentsTool.handler({ mode: "direct" }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].mode).toBe("Direct");
    });

    test("filters by mode=rfq (mode 1 only)", async () => {
      setupClient({
        nextIntentId: 2n,
        intents: [
          makeIntent({ status: 0, mode: 0 }),
          makeIntent({ status: 0, mode: 1 }),
        ],
      });
      const rows = parseRows(
        await browseIntentsTool.handler({ mode: "rfq" }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].mode).toBe("RFQ");
    });

    test("mode=all returns both Direct and RFQ open intents", async () => {
      setupClient({
        nextIntentId: 2n,
        intents: [
          makeIntent({ status: 0, mode: 0 }),
          makeIntent({ status: 0, mode: 1 }),
        ],
      });
      const rows = parseRows(
        await browseIntentsTool.handler({ mode: "all" }),
      );
      expect(rows).toHaveLength(2);
    });

    test("respects custom limit parameter", async () => {
      const readContract = setupClient({
        nextIntentId: 100n,
        intents: Array(5).fill(null).map(() => makeIntent({ status: 0 })),
      });
      await browseIntentsTool.handler({ limit: 5 });

      // Verify it asked for ids 95..99 only
      const intentReads = readContract.mock.calls.filter(
        (c) => c[0].functionName === "intents",
      );
      expect(intentReads).toHaveLength(5);
      expect(intentReads[0][0].args[0]).toBe(95n);
      expect(intentReads[4][0].args[0]).toBe(99n);
    });
  });

  describe("negative cases", () => {
    test("rejects when limit is below 1 via zod", async () => {
      setupClient({ nextIntentId: 0n });
      await expect(
        browseIntentsTool.handler({ limit: 0 }),
      ).rejects.toThrow();
    });

    test("rejects when limit exceeds 50 via zod", async () => {
      setupClient({ nextIntentId: 0n });
      await expect(
        browseIntentsTool.handler({ limit: 51 }),
      ).rejects.toThrow();
    });

    test("rejects when mode is not one of direct/rfq/all", async () => {
      setupClient({ nextIntentId: 0n });
      await expect(
        browseIntentsTool.handler({ mode: "invalid" }),
      ).rejects.toThrow();
    });

    test("filters out non-Open status (Filled/Cancelled/Expired)", async () => {
      setupClient({
        nextIntentId: 4n,
        intents: [
          makeIntent({ status: 0 }), // Open ✓
          makeIntent({ status: 1 }), // Filled — filtered
          makeIntent({ status: 2 }), // Cancelled — filtered
          makeIntent({ status: 3 }), // Expired — filtered
        ],
      });
      const rows = parseRows(await browseIntentsTool.handler({}));
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("Open");
    });

    test("swallows readContract throw on individual intent and continues", async () => {
      setupClient({
        nextIntentId: 3n,
        intents: [
          makeIntent({ status: 0 }),
          makeIntent({ status: 0 }), // index 1 throws
          makeIntent({ status: 0 }),
        ],
        intentsThrows: [1],
      });
      const rows = parseRows(await browseIntentsTool.handler({}));
      expect(rows).toHaveLength(2); // 1 was skipped silently
    });
  });

  describe("edge cases", () => {
    test("returns empty array when nextIntentId is 0", async () => {
      setupClient({ nextIntentId: 0n });
      const rows = parseRows(await browseIntentsTool.handler({}));
      expect(rows).toEqual([]);
    });

    test("uses default limit of 20 when not specified", async () => {
      const readContract = setupClient({
        nextIntentId: 100n,
        intents: Array(20).fill(null).map(() => makeIntent({ status: 0 })),
      });
      await browseIntentsTool.handler({});
      const intentReads = readContract.mock.calls.filter(
        (c) => c[0].functionName === "intents",
      );
      expect(intentReads).toHaveLength(20);
      expect(intentReads[0][0].args[0]).toBe(80n);
    });

    test("limit >= total fetches all available from index 0", async () => {
      const readContract = setupClient({
        nextIntentId: 3n,
        intents: Array(3).fill(null).map(() => makeIntent({ status: 0 })),
      });
      await browseIntentsTool.handler({ limit: 50 });
      const intentReads = readContract.mock.calls.filter(
        (c) => c[0].functionName === "intents",
      );
      expect(intentReads).toHaveLength(3);
      expect(intentReads[0][0].args[0]).toBe(0n);
    });

    test("mode is omitted when it equals 'all' but no intents exist", async () => {
      setupClient({ nextIntentId: 0n });
      const rows = parseRows(
        await browseIntentsTool.handler({ mode: "all" }),
      );
      expect(rows).toEqual([]);
    });

    test("falls back to 'Unknown' when status enum is out of range", async () => {
      // Direct mode (so passes mode filter), status=99 (so out of range and would
      // normally be filtered as != Open). Shouldn't happen on-chain, but defensively
      // tested. To exercise the ?? branch we'd need to bypass the Open filter; use
      // a mode that bypasses but still hits the row push by setting status to 0 first
      // and tampering after — easier path: feed a row with mode out of range too.
      // We test the unknown-mode + open-status path which still passes filters.
      setupClient({
        nextIntentId: 1n,
        intents: [makeIntent({ status: 0, mode: 99 })],
      });
      const rows = parseRows(
        await browseIntentsTool.handler({ mode: "all" }),
      );
      // mode=99 ≠ 0 (direct) and ≠ 1 (rfq), so the mode filter (which only
      // explicitly excludes wrong values) lets it through under "all", and the
      // ?? "Unknown" fallback for the label kicks in.
      expect(rows).toHaveLength(1);
      expect(rows[0].mode).toBe("Unknown");
    });

    test("returns shaped row metadata (id, maker, deadline as number)", async () => {
      setupClient({
        nextIntentId: 1n,
        intents: [
          makeIntent({ status: 0, maker: "0xAlice", deadline: 1234567890n }),
        ],
      });
      const rows = parseRows(await browseIntentsTool.handler({}));
      expect(rows[0]).toMatchObject({
        id: "0",
        maker: "0xAlice",
        deadline: 1234567890,
        mode: "Direct",
        status: "Open",
      });
    });
  });
});

describe("browseIntentsTool metadata", () => {
  describe("positive cases", () => {
    test("exports correct tool name and description shape", () => {
      expect(browseIntentsTool.name).toBe("private_otc_browse_intents");
      expect(browseIntentsTool.description).toContain("OTC intents");
    });

    test("input schema declares all four optional filter fields", () => {
      const props = browseIntentsTool.inputSchema.properties;
      expect(props).toHaveProperty("sellToken");
      expect(props).toHaveProperty("buyToken");
      expect(props).toHaveProperty("mode");
      expect(props).toHaveProperty("limit");
    });
  });
});
