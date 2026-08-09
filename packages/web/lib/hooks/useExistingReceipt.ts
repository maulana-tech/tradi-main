"use client";

/**
 * Check whether a given wallet has already minted a TradiReceipt NFT
 * for a given intent. Used to make the mint button idempotent — once
 * a participant has minted, the button hides and we surface a "view
 * NFT" link instead of letting them mint duplicates.
 *
 * Reads `ReceiptMinted(uint256 indexed tokenId, uint256 indexed
 * intentId, address indexed minter, uint8 mode)` event log from the
 * TradiReceipt contract.
 */

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { TRADI_NOX_RECEIPT_ADDRESS } from "@/lib/wagmi";

const RECEIPT_MINTED_EVENT = parseAbiItem(
  "event ReceiptMinted(uint256 indexed tokenId, uint256 indexed intentId, address indexed minter, uint8 mode)",
);

// Just below TradiReceipt deploy block on Ethereum Sepolia. Single
// getLogs window covers all mint history; cheap because the indexed
// topics narrow the result to at most a handful per (intentId, minter).
const SCAN_FROM_BLOCK = 264_500_000n;

export function useExistingReceipt(
  intentId: bigint | undefined,
  minter: `0x${string}` | undefined,
) {
  const client = usePublicClient();
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Increment to force a re-scan after a fresh mint commits.
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (
      !client ||
      intentId === undefined ||
      !minter ||
      TRADI_NOX_RECEIPT_ADDRESS === "0x0"
    ) {
      setTokenId(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const logs = await client.getLogs({
          address: TRADI_NOX_RECEIPT_ADDRESS,
          event: RECEIPT_MINTED_EVENT,
          args: { intentId, minter },
          fromBlock: SCAN_FROM_BLOCK,
          toBlock: "latest",
        });
        if (cancelled) return;
        const last = logs[logs.length - 1];
        setTokenId(last?.args?.tokenId ?? null);
      } catch {
        if (!cancelled) setTokenId(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, intentId, minter, refreshNonce]);

  return {
    tokenId,
    alreadyMinted: tokenId !== null,
    isLoading,
    refresh: () => setRefreshNonce((n) => n + 1),
  };
}
