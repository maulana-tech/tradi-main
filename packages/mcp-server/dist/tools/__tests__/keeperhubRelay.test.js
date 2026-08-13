import { describe, test, expect, vi } from "vitest";
vi.mock("../../client.js", () => ({
    getEnv: () => ({ otc: "0x1111111111111111111111111111111111111111" }),
    getWalletClient: () => ({
        account: { address: "0x2222222222222222222222222222222222222222" },
    }),
}));
import { keeperhubRelayTool } from "../keeperhubRelay.js";
describe("keeperhubRelayTool", () => {
    test("returns valid JSON structure with sponsorship details", async () => {
        const result = await keeperhubRelayTool.handler({
            target: "0x1111111111111111111111111111111111111111",
            functionName: "finalizeRFQ",
            sponsorship: true,
        });
        expect(result.content).toHaveLength(1);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.ok).toBe(true);
        expect(parsed.routedVia).toBe("keeperhub-relay");
        expect(parsed.sponsored).toBe(true);
        expect(parsed.functionName).toBe("finalizeRFQ");
    });
});
//# sourceMappingURL=keeperhubRelay.test.js.map