"use client";

/**
 * Read the `Settled(uint256 indexed id, address indexed taker)` event log
 * for a given intent ID and return the taker address. Used to gate
 * post-trade artifacts (NFT receipt, share card) to actual participants
 * — the maker is known from the Intent struct, but the taker (and RFQ
 * winner) only surfaces in the Settled event.
 *
 * Range starts just before the latest contract deploy on Ethereum Sepolia
 * to keep the topic-filtered query within typical RPC range limits while
 * covering the entire demo lifecycle. Adjust the constant if the contract
 * is redeployed below this block.
 */

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";

const SETTLED_EVENT = parseAbiItem(
  "event Settled(uint256 indexed id, address indexed taker)",
);

// Just below the latest Deploy.s.sol broadcast — single getLogs window
// covers everything from contract birth to now. ~1.5M blocks ≈ ~4 days
// of Ethereum Sepolia at boot, which is what our demo spans.
const SCAN_FROM_BLOCK = 263_500_000n;

export function useSettledTaker(intentId: bigint | undefined) {
  const client = usePublicClient();
  const [taker, setTaker] = useState<`0x${string}` | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!client || intentId === undefined) {
      setTaker(undefined);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const logs = await client.getLogs({
          address: PRIVATE_OTC_ADDRESS,
          event: SETTLED_EVENT,
          args: { id: intentId },
          fromBlock: SCAN_FROM_BLOCK,
          toBlock: "latest",
        });
        if (cancelled) return;
        const last = logs[logs.length - 1];
        setTaker(last?.args?.taker as `0x${string}` | undefined);
      } catch {
        // Silent — receipt gating falls back to maker-or-just-acted check.
        if (!cancelled) setTaker(undefined);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, intentId]);

  return { taker, isLoading };
}
