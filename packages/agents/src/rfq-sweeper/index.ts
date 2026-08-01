/**
 * RFQ Sweeper Agent — kick off finalization for expired RFQs.
 *
 * Polls every 5 minutes. Scans last N intents for RFQs where:
 *   - mode = RFQ
 *   - status = Open (0)
 *   - block.timestamp > deadline
 *   - bids.length >= 2 (else finalize would revert)
 * Calls finalizeRFQ to freeze the auction and compute the encrypted
 * second-highest price. Final settlement requires the maker to call
 * revealRFQWinner(id, winnerIdx) — the sweeper does NOT do that step
 * because picking the winner requires off-chain decryption of bid amounts
 * (auditor flow), which the agent doesn't have keys for.
 */

import { publicClient, walletClient, PRIVATE_OTC_ADDRESS } from "../config.js";
import { privateOtcAbi } from "../abi.js";
import { decideFinalize, scanWindow, type IntentTuple } from "./logic.js";

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const SCAN_DEPTH = 50; // last 50 intents

const RFQ_BIDS_ABI = [
  {
    type: "function",
    name: "bids",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [
      { name: "taker", type: "address" },
      { name: "offeredAmount", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

export async function startRfqSweeper() {
  console.log("[rfq-sweeper] starting (interval 5m)");
  await sweep();
  setInterval(() => sweep().catch((e) => console.error("[rfq-sweeper]", e)), SWEEP_INTERVAL_MS);
}

async function sweep() {
  const next = (await publicClient.readContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "nextIntentId",
  })) as bigint;

  const { start, end } = scanWindow(next, SCAN_DEPTH);
  const now = BigInt(Math.floor(Date.now() / 1000));

  for (let id = start; id < end; id++) {
    try {
      const intent = (await publicClient.readContract({
        address: PRIVATE_OTC_ADDRESS,
        abi: privateOtcAbi,
        functionName: "intents",
        args: [id],
      })) as IntentTuple;

      // Cheap rejection first — skip RPC calls if intent is obviously not
      // finalize-eligible (saves countBids RPC calls on most intents).
      const preCheck = decideFinalize(intent, now, /* placeholder */ 2);
      if (preCheck.kind === "skip" && preCheck.reason !== "insufficient bids") {
        continue;
      }

      const bidCount = await countBids(id);
      const decision = decideFinalize(intent, now, bidCount);
      if (decision.kind === "skip") continue;

      console.log(`[rfq-sweeper] finalizing RFQ #${id} (${bidCount} bids)`);
      const txHash = await walletClient.writeContract({
        address: PRIVATE_OTC_ADDRESS,
        abi: privateOtcAbi,
        functionName: "finalizeRFQ",
        args: [id],
      });
      console.log(`[rfq-sweeper] tx=${txHash}`);
    } catch (err) {
      // Continue with next intent on per-id failure
      console.error(`[rfq-sweeper] id=${id} failed`, err instanceof Error ? err.message : err);
    }
  }
}

async function countBids(rfqId: bigint): Promise<number> {
  let count = 0;
  for (let i = 0; i < 10; i++) {
    try {
      const result = (await publicClient.readContract({
        address: PRIVATE_OTC_ADDRESS,
        abi: RFQ_BIDS_ABI,
        functionName: "bids",
        args: [rfqId, BigInt(i)],
      })) as readonly [`0x${string}`, `0x${string}`, boolean];
      if (result[2]) count++;
    } catch {
      break; // Out-of-bounds revert = no more bids
    }
  }
  return count;
}
