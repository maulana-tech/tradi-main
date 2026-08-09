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
import { readRfqStateTool } from "../readRfqState.js";
import { getEnv, getPublicClient } from "../../client.js";
const mockGetEnv = vi.mocked(getEnv);
const mockGetPublicClient = vi.mocked(getPublicClient);
const OTC = "0xOtc";
function makeIntent(overrides = {}) {
    return [
        overrides.maker ?? "0xMaker",
        overrides.sellToken ?? "0xSell",
        overrides.buyToken ?? "0xBuy",
        "0xH1",
        "0xH2",
        overrides.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
        overrides.status ?? 0,
        overrides.mode ?? 1,
        overrides.allowedTaker ?? "0x0000000000000000000000000000000000000000",
    ];
}
function setupClient(opts) {
    const readContract = vi.fn().mockImplementation(async (params) => {
        if (params.functionName === "intents")
            return opts.intent;
        if (params.functionName === "bids") {
            const idx = Number(params.args[1]);
            if (idx >= (opts.bidCount ?? 0))
                throw new Error("out of bounds");
            return ["0xBidder", "0xBidHandle", true];
        }
        throw new Error(`unexpected: ${params.functionName}`);
    });
    mockGetPublicClient.mockReturnValue({ readContract });
    mockGetEnv.mockReturnValue({ otc: OTC, key: "0x", rpc: "" });
}
function parseResult(result) {
    return JSON.parse(result.content[0].text);
}
beforeEach(() => vi.clearAllMocks());
describe("readRfqStateTool", () => {
    test("returns full RFQ state with bid count", async () => {
        setupClient({ intent: makeIntent({ mode: 1, status: 0 }), bidCount: 3 });
        const result = await readRfqStateTool.handler({ intentId: "5" });
        const data = parseResult(result);
        expect(data.intentId).toBe("5");
        expect(data.mode).toBe("RFQ");
        expect(data.status).toBe("Open");
        expect(data.bidCount).toBe(3);
        expect(data.canBid).toBe(true);
    });
    test("returns null bidCount for Direct intents", async () => {
        setupClient({ intent: makeIntent({ mode: 0, status: 0 }) });
        const result = await readRfqStateTool.handler({ intentId: "0" });
        const data = parseResult(result);
        expect(data.mode).toBe("Direct");
        expect(data.bidCount).toBeNull();
    });
    test("sets canFinalize=true when expired with >=2 bids", async () => {
        const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 100);
        setupClient({ intent: makeIntent({ mode: 1, status: 0, deadline: pastDeadline }), bidCount: 2 });
        const result = await readRfqStateTool.handler({ intentId: "1" });
        const data = parseResult(result);
        expect(data.canFinalize).toBe(true);
        expect(data.isExpired).toBe(true);
    });
    test("sets canReveal=true when PendingReveal", async () => {
        setupClient({ intent: makeIntent({ mode: 1, status: 4 }) });
        const result = await readRfqStateTool.handler({ intentId: "2" });
        const data = parseResult(result);
        expect(data.canReveal).toBe(true);
        expect(data.status).toBe("PendingReveal");
    });
    test("rejects invalid intentId", async () => {
        await expect(readRfqStateTool.handler({ intentId: "abc" })).rejects.toThrow();
    });
});
//# sourceMappingURL=readRfqState.test.js.map