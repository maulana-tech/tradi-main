"use client";

import { useEffect } from "react";
import { useReadContract, useBlockNumber } from "wagmi";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";

export function LiveStats() {
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const { data: nextIntentId, refetch } = useReadContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "nextIntentId",
  });

  useEffect(() => {
    if (blockNumber) void refetch();
  }, [blockNumber, refetch]);

  const total = nextIntentId ? Number(nextIntentId) : 0;

  return (
    <dl className="mt-12 grid min-w-0 max-w-2xl grid-cols-1 gap-5 border-t border-[var(--color-border)] pt-6 sm:grid-cols-3 sm:gap-6">
      <Stat label="On-chain intents" value={total.toString()} />
      <Stat label="Privacy layer" value="Nox TEE" />
      <Stat label="Network" value="Sepolia" />
    </dl>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-medium tabular-nums text-white sm:text-base">{value}</dd>
    </div>
  );
}
