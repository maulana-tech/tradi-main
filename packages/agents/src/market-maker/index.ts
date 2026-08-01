/**
 * MarketMaker Agent — autonomous bidder.
 *
 * Listens for RFQ creation events. For each new RFQ matching configured pair,
 * computes a strategic bid (fair price ± spread), encrypts via Nox, submits.
 *
 * Strategy parameters live in env so they can stay confidential per-deployer.
 * In a production deployment, parameters could be encrypted on-chain via Nox
 * so even ops staff can't peek.
 */

import { createViemHandleClient } from "@iexec-nox/handle";
import { publicClient, walletClient, PRIVATE_OTC_ADDRESS } from "../config.js";
import { privateOtcAbi } from "../abi.js";
import { decideBid, type Strategy, type IntentEventArgs } from "./logic.js";

const DEFAULT_STRATEGY: Strategy = {
  pairs: {
    "cETH/cUSDC": {
      sellToken: (process.env.NEXT_PUBLIC_CETH_ADDRESS ?? "0x0") as `0x${string}`,
      buyToken: (process.env.NEXT_PUBLIC_CUSDC_ADDRESS ?? "0x0") as `0x${string}`,
      refPriceUsd: 3500,
    },
  },
  maxNotional: BigInt(50_000) * BigInt(10 ** 6), // 50k cUSDC at 6 decimals
  spreadBps: 30,
};

export async function startMarketMaker() {
  console.log("[market-maker] starting", {
    address: walletClient.account.address,
    pairs: Object.keys(DEFAULT_STRATEGY.pairs),
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
        } catch (err) {
          console.error("[market-maker] handler failed", err);
        }
      }
    },
  });
}

async function handleIntent(
  log: { args: IntentEventArgs },
  handleClient: Awaited<ReturnType<typeof createViemHandleClient>>,
) {
  const decision = decideBid(
    log.args,
    walletClient.account.address,
    DEFAULT_STRATEGY,
  );
  if (decision.kind === "skip") return;

  console.log(
    `[market-maker] new RFQ #${decision.intentId} on ${decision.pairName}, evaluating bid…`,
  );

  // Encrypt bid off-chain via Nox SDK
  const { handle, handleProof } = await handleClient.encryptInput(
    decision.bidAmount,
    "uint256",
    PRIVATE_OTC_ADDRESS,
  );

  // Submit
  const txHash = await walletClient.writeContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "submitBid",
    args: [
      decision.intentId,
      handle as `0x${string}`,
      handleProof as `0x${string}`,
    ],
  });

  console.log(
    `[market-maker] bid submitted on RFQ #${decision.intentId}: tx=${txHash} pair=${decision.pairName} (encrypted amount, refPrice=$${decision.refPriceUsd})`,
  );
}
