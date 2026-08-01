/**
 * Lazy-initialized viem clients + Nox handle client for the MCP server.
 *
 * MCP server uses its own AGENT_PRIVATE_KEY (separate from web user wallets)
 * to act on behalf of AI callers. All env vars validated at first use.
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { createViemHandleClient, type HandleClient } from "@iexec-nox/handle";

let _walletClient: ReturnType<typeof createWalletClient> | null = null;
let _publicClient: ReturnType<typeof createPublicClient> | null = null;
let _handleClient: HandleClient | null = null;

export function getEnv() {
  const key =
    process.env.AGENT_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? "";
  const rpc =
    process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
  const otc =
    process.env.PRIVATE_OTC_ADDRESS ??
    process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS ??
    "";

  if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error("AGENT_PRIVATE_KEY (or PRIVATE_KEY) missing/invalid");
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(otc)) {
    throw new Error("PRIVATE_OTC_ADDRESS missing/invalid");
  }

  return { key: key as `0x${string}`, rpc, otc: otc as `0x${string}` };
}

export function getWalletClient() {
  if (!_walletClient) {
    const { key, rpc } = getEnv();
    _walletClient = createWalletClient({
      account: privateKeyToAccount(key),
      chain: arbitrumSepolia,
      transport: http(rpc),
    });
  }
  return _walletClient;
}

export function getPublicClient() {
  if (!_publicClient) {
    const { rpc } = getEnv();
    _publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(rpc),
    });
  }
  return _publicClient;
}

export async function getHandleClient(): Promise<HandleClient> {
  if (!_handleClient) {
    _handleClient = await createViemHandleClient(getWalletClient());
  }
  return _handleClient;
}
