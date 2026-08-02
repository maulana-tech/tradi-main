"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Icon } from "./Icon";
import { Button } from "./ui/Button";

const TARGET_CHAIN = sepolia;

export function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  if (!isConnected || chainId === TARGET_CHAIN.id) return null;
  return (
    <div role="alert" className="border-b border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><Icon name="warning" className="size-5 shrink-0 text-[var(--color-warning-text)]" /><p className="text-sm text-white">Switch to {TARGET_CHAIN.name} to continue. Your current network is unsupported.</p></div>
        <Button type="button" tone="secondary" size="sm" className="shrink-0" onClick={() => switchChain({ chainId: TARGET_CHAIN.id })} loading={isPending} loadingLabel="Switching…">Switch network</Button>
      </div>
    </div>
  );
}
