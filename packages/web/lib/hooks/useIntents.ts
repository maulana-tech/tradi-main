"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";

export type IntentRow = {
  id: bigint;
  maker: `0x${string}`;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmountHandle: `0x${string}`;
  minBuyAmountHandle: `0x${string}`;
  deadline: bigint;
  status: 0 | 1 | 2 | 3 | 4;
  mode: 0 | 1;
  allowedTaker: `0x${string}`;
};

const STATUS_LABELS: Record<number, string> = {
  0: "Open",
  1: "Filled",
  2: "Cancelled",
  3: "Expired",
  4: "Pending Reveal",
};

const MODE_LABELS: Record<number, string> = {
  0: "Direct",
  1: "RFQ",
};

export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? "Unknown";
}

export function modeLabel(mode: number): string {
  return MODE_LABELS[mode] ?? "Unknown";
}

/** Fetches up to N most recent intents. Filters open intents on the client. */
export function useIntents(limit = 20) {
  const next = useReadContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "nextIntentId",
  });

  const total = next.data ? Number(next.data) : 0;
  const start = Math.max(0, total - limit);
  const ids = Array.from({ length: total - start }, (_, i) => BigInt(start + i));

  const result = useReadContracts({
    contracts: ids.map((id) => ({
      address: PRIVATE_OTC_ADDRESS,
      abi: privateOtcAbi,
      functionName: "intents" as const,
      args: [id] as const,
    })),
    allowFailure: true,
    query: { enabled: ids.length > 0 },
  });

  const rows: IntentRow[] = (result.data ?? [])
    .map((r, i) => {
      if (r.status !== "success") return null;
      const v = r.result as readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        number,
        number,
        `0x${string}`,
        `0x${string}` // priceToPay (10th field added for 2-step RFQ)
      ];
      return {
        id: ids[i],
        maker: v[0],
        sellToken: v[1],
        buyToken: v[2],
        sellAmountHandle: v[3],
        minBuyAmountHandle: v[4],
        deadline: v[5],
        status: v[6] as 0 | 1 | 2 | 3 | 4,
        mode: v[7] as 0 | 1,
        allowedTaker: v[8],
      };
    })
    .filter((r): r is IntentRow => r !== null)
    .reverse();

  return {
    rows,
    isLoading: next.isLoading || result.isLoading,
    error: next.error || result.error,
  };
}
