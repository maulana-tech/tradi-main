/**
 * Agents entry point — orchestrates all autonomous agents.
 *
 * Compound Engineering: each agent runs continuously and compounds
 * trader's edge while preserving privacy via Nox.
 */

import "dotenv/config";

import { startMarketMaker } from "./market-maker/index.js";
import { startRfqSweeper } from "./rfq-sweeper/index.js";
import { startStrategyCoach } from "./strategy-coach/index.js";
import { startSettlementMonitor } from "./settlement-monitor/index.js";

async function main() {
  console.log("[agents] starting Compound Engineering layer");

  await Promise.all([
    startMarketMaker(),
    startRfqSweeper(),
    startStrategyCoach(),
    startSettlementMonitor(),
  ]);
}

main().catch((err) => {
  console.error("[agents] fatal", err);
  process.exit(1);
});
