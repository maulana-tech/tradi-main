/**
 * Diagnose RFQ state — read on-chain status of recent intents to understand
 * why finalizeRFQ / revealRFQWinner are failing.
 */

import "dotenv/config";
import { createPublicClient, http, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";

const PRIVATE_OTC = (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS ??
  "0x5b2C0c83e41bF9ef072d742096C49DFDB814CEB4") as `0x${string}`;

const otcAbi = parseAbi([
  "function intents(uint256) view returns (address maker, address sellToken, address buyToken, bytes32 sellAmount, bytes32 minBuyAmount, uint64 deadline, uint8 status, uint8 mode, address allowedTaker)",
  "function bids(uint256, uint256) view returns (address taker, bytes32 offeredAmount, bool active)",
  "function nextIntentId() view returns (uint256)",
]);

const STATUS_NAMES = ["Open", "Filled", "Cancelled", "Expired", "PendingReveal"];
const MODE_NAMES = ["Direct", "RFQ"];

async function main() {
  const rpc =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ??
    "https://sepolia-rollup.arbitrum.io/rpc";
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(rpc),
  });

  const next = await publicClient.readContract({
    address: PRIVATE_OTC,
    abi: otcAbi,
    functionName: "nextIntentId",
  });
  console.log(`nextIntentId = ${next}\n`);

  // Inspect last 12 intents
  const start = next > 12n ? next - 12n : 0n;
  const now = Math.floor(Date.now() / 1000);

  for (let i = start; i < next; i++) {
    const intent = (await publicClient.readContract({
      address: PRIVATE_OTC,
      abi: otcAbi,
      functionName: "intents",
      args: [i],
    })) as readonly [
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      bigint,
      number,
      number,
      `0x${string}`,
    ];

    const [maker, _sellTok, _buyTok, _sell, _min, deadline, status, mode] = intent;
    const deadlineSec = Number(deadline);
    const past = deadlineSec <= now;
    const overdue = past ? `${Math.round((now - deadlineSec) / 60)}min ago` : `in ${Math.round((deadlineSec - now) / 60)}min`;

    let bidCount = 0;
    if (mode === 1) {
      // RFQ — count bids by reading until revert
      while (true) {
        try {
          await publicClient.readContract({
            address: PRIVATE_OTC,
            abi: otcAbi,
            functionName: "bids",
            args: [i, BigInt(bidCount)],
          });
          bidCount++;
          if (bidCount > 12) break;
        } catch {
          break;
        }
      }
    }

    console.log(
      `#${String(i).padStart(2)} ${MODE_NAMES[mode]?.padEnd(6)} ${STATUS_NAMES[status]?.padEnd(14)} maker=${maker.slice(0, 8)}… deadline ${overdue}${mode === 1 ? `  bids=${bidCount}` : ""}`,
    );
  }
}

main().catch((err) => {
  console.error("[diagnose-rfq] failed:", err);
  process.exit(1);
});
