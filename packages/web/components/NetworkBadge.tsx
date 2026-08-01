"use client";

import { useChainId } from "wagmi";

const CHAINS: Record<number, { name: string; short: string; ok: boolean }> = {
  11155111: { name: "Ethereum Sepolia", short: "ETH-SEP", ok: true },
  421614: { name: "Arbitrum Sepolia", short: "ARB-SEP", ok: false },
  42161: { name: "Arbitrum", short: "ARB", ok: false },
  31337: { name: "Local Anvil", short: "LOCAL", ok: false },
};

export function NetworkBadge() {
  const chainId = useChainId();
  const cfg = CHAINS[chainId];

  if (!cfg) {
    return (
      <div className="hidden items-center gap-1.5 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 md:flex">
        <span className="material-symbols-outlined text-sm text-orange-600">
          warning
        </span>
        <span className="text-xs font-medium text-orange-700">Unsupported</span>
      </div>
    );
  }

  return (
    <div
      className={`hidden items-center gap-1.5 rounded-md border px-2.5 py-1 md:flex ${
        cfg.ok
          ? "border-[--color-primary]/20 bg-[--color-primary]/5"
          : "border-[--color-border] bg-[--color-surface-low]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          cfg.ok ? "bg-[--color-primary]" : "bg-[--color-text-muted]"
        }`}
      />
      <span
        className={`text-xs font-medium ${
          cfg.ok ? "text-[--color-primary]" : "text-[--color-text-muted]"
        }`}
      >
        {cfg.short}
      </span>
    </div>
  );
}
