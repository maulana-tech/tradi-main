"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

const TARGET_CHAIN = sepolia;

export function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;
  if (chainId === TARGET_CHAIN.id) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-200 bg-amber-50 px-6 py-2.5"
    >
      <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-amber-600">
            warning
          </span>
          <p className="text-sm text-amber-800">
            Wrong network — Tradi-Nox runs on {TARGET_CHAIN.name}.
          </p>
        </div>
        <button
          onClick={() => switchChain({ chainId: TARGET_CHAIN.id })}
          disabled={isPending}
          className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-200 disabled:opacity-50"
        >
          {isPending ? "Switching…" : `Switch to ${TARGET_CHAIN.name}`}
        </button>
      </div>
    </div>
  );
}
