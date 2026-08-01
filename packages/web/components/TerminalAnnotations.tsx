"use client";

import { useEffect, useState } from "react";
import { useBlockNumber, useChainId } from "wagmi";

const CHAIN_NAMES: Record<number, string> = {
  11155111: "Ethereum Sepolia",
  421614: "Arbitrum Sepolia",
  42161: "Arbitrum Mainnet",
  31337: "Local Anvil",
};

/**
 * Live block number + chain ID — shows real-time on-chain state.
 */
export function HeroAnnotations() {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const chainId = useChainId();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const time = new Date().toISOString().split("T")[1].slice(0, 8);
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  return (
    <>
      <div className="absolute left-8 top-24 hidden text-[10px] text-[--color-text-muted]/40 md:flex md:items-center md:gap-2">
        <span className="h-1 w-1 rounded-full bg-[--color-primary] pulse-soft" />
        <span suppressHydrationWarning>
          Block {blockNumber ? blockNumber.toString() : "—"} · {chainName}
        </span>
      </div>
      <div className="absolute right-8 top-24 hidden text-[10px] text-[--color-text-muted]/40 md:flex md:items-center md:gap-2">
        <span suppressHydrationWarning>
          {time} UTC · Nox TEE active
        </span>
        <span className="h-1 w-1 rounded-full bg-[--color-primary] pulse-soft" />
      </div>
      <span className="hidden">{tick}</span>
    </>
  );
}

/**
 * Card header with live block number + chain id.
 */
export function TerminalCardHeader() {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const chainId = useChainId();
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  return (
    <div className="flex items-center justify-between bg-[--color-surface-low]/40 p-4">
      <div className="flex gap-2">
        <div className="h-2 w-2 rounded-full bg-red-500/50" />
        <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
        <div className="h-2 w-2 rounded-full bg-green-500/50 pulse-soft" />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-[--color-text-muted]">
        <span suppressHydrationWarning>
          Block {blockNumber?.toString() ?? "—"}
        </span>
        <span className="text-[--color-text-muted]">·</span>
        <span>{chainName}</span>
      </div>
    </div>
  );
}
