/**
 * MarketMaker Agent — autonomous bidder.
 *
 * Listens for RFQ creation events. For each new RFQ matching configured pair,
 * computes a strategic bid (fair price ± spread), encrypts via handle client, submits.
 *
 * Strategy parameters live in env so they can stay confidential per-deployer.
 * In a production deployment, parameters could be encrypted on-chain via handle client
 * so even ops staff can't peek.
 */
import { createViemHandleClient } from "../handle-client.js";
import { publicClient, walletClient, PRIVATE_OTC_ADDRESS, env } from "../config.js";
import { privateOtcAbi } from "../abi.js";
import { decideBid } from "./logic.js";
import { execute } from "../executor.js";
const DEFAULT_STRATEGY = {
    pairs: {
        "cETH/cUSDC": {
            sellToken: (process.env.NEXT_PUBLIC_CETH_ADDRESS ?? "0x0"),
            buyToken: (process.env.NEXT_PUBLIC_CUSDC_ADDRESS ?? "0x0"),
            refPriceUsd: 3500,
        },
    },
    maxNotional: BigInt(50_000) * BigInt(10 ** 6), // 50k cUSDC at 6 decimals
    spreadBps: 30,
};
export async function startMarketMaker() {
    if (env.WRITER_MODE === "hermes") {
        console.log("[market-maker] WRITER_MODE=hermes — writes disabled, Hermes is the writer");
        return;
    }
    console.log("[market-maker] starting", {
        address: walletClient.account.address,
        pairs: Object.keys(DEFAULT_STRATEGY.pairs),
        writerMode: env.WRITER_MODE,
    });
    const handleClient = await createViemHandleClient(walletClient);
    publicClient.watchContractEvent({
        address: PRIVATE_OTC_ADDRESS,
        abi: privateOtcAbi,
        eventName: "IntentCreated",
        onLogs: async (logs) => {
            for (const log of logs) {
                try {
                    await handleIntent(log, handleClient);
                }
                catch (err) {
                    console.error("[market-maker] handler failed", err);
                }
            }
        },
    });
}
async function handleIntent(log, handleClient) {
    const decision = decideBid(log.args, walletClient.account.address, DEFAULT_STRATEGY);
    if (decision.kind === "skip")
        return;
    console.log(`[market-maker] new RFQ #${decision.intentId} on ${decision.pairName}, evaluating bid…`);
    if (env.WRITER_MODE === "dry-run") {
        console.log(`[market-maker] DRY RUN: would bid ${decision.bidAmount} on RFQ #${decision.intentId} (${decision.pairName})`);
        return;
    }
    // Encrypt bid off-chain via handle client
    const { handle, handleProof } = await handleClient.encryptInput(decision.bidAmount, "uint256", PRIVATE_OTC_ADDRESS);
    // Submit
    const { ok, audit } = await execute({
        target: PRIVATE_OTC_ADDRESS,
        calldata: "0x", // calldata constructed by executor or passed from MCP
        functionName: "submitBid",
        intentId: decision.intentId.toString(),
        action: "submitBid",
        decision: "submit",
        reason: `Bid on ${decision.pairName} at ref price ${decision.refPriceUsd}`,
    });
    console.log(`[market-maker] bid ${ok ? "succeeded" : "failed"} on RFQ #${decision.intentId}: tx=${audit.transactionHash} pair=${decision.pairName} (routed via ${audit.routedVia}, sponsored=${audit.sponsored})`);
}
//# sourceMappingURL=index.js.map