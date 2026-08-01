/**
 * Strategy Coach Agent — daily metadata-only analyst.
 *
 * Scans recent Settled events for the agent's address as taker. Builds a
 * coach report (counts + unique counterparties) and posts via webhook.
 * Amounts stay encrypted — full decryption breakdown requires explicit
 * auditor delegation (Nox.addViewer) which is out of scope here.
 */

import { publicClient, walletClient, PRIVATE_OTC_ADDRESS, env } from "../config.js";
import { privateOtcAbi } from "../abi.js";
import { buildCoachReport, type SettledEvent } from "./logic.js";

const DAILY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
/** How far back (in blocks) to query Settled events. ~1 block/sec on Arbitrum. */
const LOOKBACK_BLOCKS = BigInt(WINDOW_DAYS * 24 * 60 * 60);

export async function startStrategyCoach() {
  console.log("[strategy-coach] started (daily cron)");
  // Run once at startup, then on interval.
  await analyzeOnce().catch((e) => console.error("[strategy-coach]", e));
  setInterval(
    () => analyzeOnce().catch((e) => console.error("[strategy-coach]", e)),
    DAILY_MS,
  );
}

async function analyzeOnce() {
  const head = await publicClient.getBlockNumber();
  const fromBlock = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n;

  const logs = await publicClient.getContractEvents({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    eventName: "Settled",
    fromBlock,
    toBlock: head,
  });

  const events: SettledEvent[] = [];
  for (const log of logs) {
    if (!log.args.id || !log.args.taker || !log.transactionHash) continue;
    if (log.args.taker.toLowerCase() !== walletClient.account.address.toLowerCase()) {
      continue;
    }
    const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
    events.push({
      id: log.args.id,
      taker: log.args.taker,
      timestamp: Number(block.timestamp),
      txHash: log.transactionHash,
    });
  }

  const report = buildCoachReport(events, Math.floor(Date.now() / 1000), WINDOW_DAYS);
  console.log("[strategy-coach]", report.message);

  if (env.AGENT_NOTIFICATION_WEBHOOK) {
    try {
      await fetch(env.AGENT_NOTIFICATION_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: report.message }),
      });
    } catch (err) {
      console.error("[strategy-coach] webhook failed", err);
    }
  }
}
