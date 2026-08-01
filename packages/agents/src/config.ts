/**
 * Shared agent configuration & viem clients.
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { z } from "zod";

export const EnvSchema = z.object({
  AGENT_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "AGENT_PRIVATE_KEY must be 0x + 64 hex"),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url(),
  PRIVATE_OTC_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "PRIVATE_OTC_ADDRESS must be 0x + 40 hex"),
  AGENT_NOTIFICATION_WEBHOOK: z.string().url().optional(),
});

export const env = EnvSchema.parse({
  // Allow either AGENT_PRIVATE_KEY or PRIVATE_KEY for convenience in dev
  AGENT_PRIVATE_KEY: process.env.AGENT_PRIVATE_KEY ?? process.env.PRIVATE_KEY,
  ARBITRUM_SEPOLIA_RPC_URL: process.env.ARBITRUM_SEPOLIA_RPC_URL,
  PRIVATE_OTC_ADDRESS:
    process.env.PRIVATE_OTC_ADDRESS ?? process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS,
  AGENT_NOTIFICATION_WEBHOOK: process.env.AGENT_NOTIFICATION_WEBHOOK,
});

export const account = privateKeyToAccount(env.AGENT_PRIVATE_KEY as `0x${string}`);

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(env.ARBITRUM_SEPOLIA_RPC_URL),
});

export const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(env.ARBITRUM_SEPOLIA_RPC_URL),
});

export const PRIVATE_OTC_ADDRESS = env.PRIVATE_OTC_ADDRESS as `0x${string}`;
