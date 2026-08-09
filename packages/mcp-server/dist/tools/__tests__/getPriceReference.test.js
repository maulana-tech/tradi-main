import { describe, test, expect, vi, beforeEach } from "vitest";
vi.mock("../../client.js", () => ({
    getEnv: vi.fn(),
    getPublicClient: vi.fn(),
}));
import { getPriceReferenceTool } from "../getPriceReference.js";
beforeEach(() => vi.clearAllMocks());
describe("getPriceReferenceTool", () => {
    test("returns price for known pair cETH/cUSDC", async () => {
        const result = await getPriceReferenceTool.handler({ base: "cETH", quote: "cUSDC" });
        const data = JSON.parse(result.content[0].text);
        expect(data.pair).toBe("cETH/cUSDC");
        expect(data.price).toBe(3500);
        expect(data.direction).toBe("direct");
    });
    test("returns reverse price for cUSDC/cETH", async () => {
        const result = await getPriceReferenceTool.handler({ base: "cUSDC", quote: "cETH" });
        const data = JSON.parse(result.content[0].text);
        expect(data.pair).toBe("cUSDC/cETH");
        expect(data.price).toBeCloseTo(1 / 3500, 10);
        expect(data.direction).toBe("direct");
    });
    test("returns 1 for unknown pair", async () => {
        const result = await getPriceReferenceTool.handler({ base: "UNKNOWN", quote: "PAIR" });
        const data = JSON.parse(result.content[0].text);
        expect(data.price).toBe(1);
        expect(data.source).toBe("static-testnet");
    });
    test("rejects empty base", async () => {
        await expect(getPriceReferenceTool.handler({ base: "", quote: "cUSDC" })).rejects.toThrow();
    });
});
//# sourceMappingURL=getPriceReference.test.js.map