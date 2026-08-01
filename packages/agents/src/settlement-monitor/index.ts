/**
 * Settlement Monitor Agent — post-trade verifier.
 *
 * Listens for Settled events. For demo: posts a Slack/Discord-style webhook
 * with txHash + parties (amounts stay encrypted).
 */

import { publicClient, PRIVATE_OTC_ADDRESS, env } from "../config.js";
import { privateOtcAbi } from "../abi.js";
import { formatSettlementNotification } from "./logic.js";

export async function startSettlementMonitor() {
  console.log("[settlement-monitor] starting");

  publicClient.watchContractEvent({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    eventName: "Settled",
    onLogs: async (logs) => {
      for (const log of logs) {
        const id = log.args.id;
        const taker = log.args.taker;
        const txHash = log.transactionHash;

        const message = formatSettlementNotification(
          { id, taker },
          txHash ?? undefined,
        );

        if (env.AGENT_NOTIFICATION_WEBHOOK) {
          try {
            await fetch(env.AGENT_NOTIFICATION_WEBHOOK, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(message),
            });
            console.log(`[settlement-monitor] notified for #${id}`);
          } catch (err) {
            console.error("[settlement-monitor] webhook failed", err);
          }
        } else {
          console.log("[settlement-monitor]", message.text);
        }
      }
    },
  });
}
