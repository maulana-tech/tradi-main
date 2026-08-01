"use client";

import { useEffect, useState } from "react";
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

  const [animKey, setAnimKey] = useState(0);
  const [prevValue, setPrevValue] = useState<bigint | undefined>();

  useEffect(() => {
    if (blockNumber) refetch();
  }, [blockNumber, refetch]);

  useEffect(() => {
    if (nextIntentId !== undefined && nextIntentId !== prevValue) {
      if (prevValue !== undefined) setAnimKey((k) => k + 1);
      setPrevValue(nextIntentId as bigint);
    }
  }, [nextIntentId, prevValue]);

  const total = nextIntentId ? Number(nextIntentId) : 0;

  return (
    <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="On-chain intents" value={total.toString()} animKey={animKey} live />
      <Stat label="Encryption" value="Nox TEE" />
      <Stat label="Chain" value="11155111" />
      <Stat label="Block time" value="~250ms" />
    </div>
  );
}

function Stat({
  label,
  value,
  animKey,
  live,
}: {
  label: string;
  value: string;
  animKey?: number;
  live?: boolean;
}) {
  return (
    <div className="rounded-lg bg-[--color-primary]/5 p-4 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <p className="text-xs text-[--color-text-muted]">{label}</p>
        {live && (
          <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary] pulse-soft" />
        )}
      </div>
      <p
        key={animKey}
        className="mt-1 text-xl font-bold text-[--color-primary] count-enter"
      >
        {value}
      </p>
    </div>
  );
}
