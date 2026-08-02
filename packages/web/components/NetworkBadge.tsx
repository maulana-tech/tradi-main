"use client";

import { useChainId } from "wagmi";
import { Status } from "./ui/Badge";

const CHAINS: Record<number, { name: string; ok: boolean }> = {
  11155111: { name: "Ethereum Sepolia", ok: true },
  421614: { name: "Arbitrum Sepolia", ok: false },
  42161: { name: "Arbitrum", ok: false },
  31337: { name: "Local Anvil", ok: false },
};

export function NetworkBadge() {
  const chainId = useChainId();
  const chain = CHAINS[chainId];
  return (
    <div className="hidden md:block" title={chain?.name ?? "Unsupported network"}>
      <Status
        label={chain?.ok ? "Sepolia" : "Wrong network"}
        tone={chain?.ok ? "success" : "warning"}
      />
    </div>
  );
}
