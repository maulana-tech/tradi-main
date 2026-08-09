import "dotenv/config";
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
  KEEPERHUB_RELAYER_URL: z.string().url().optional(),
  KEEPERHUB_GAS_SPONSORSHIP: z.string().optional().transform((val) => val !== "false"),
  KEEPERHUB_ENABLED: z.string().optional().transform((val) => val !== "false"),
  KEEPERHUB_MCP_URL: z.string().url().optional(),
  KEEPERHUB_API_KEY: z.string().optional(),
  WRITER_MODE: z.enum(["hermes", "agent", "dry-run"]).default("agent"),
});

const privateKey =
  process.env.AGENT_PRIVATE_KEY && process.env.AGENT_PRIVATE_KEY.trim().length > 0
    ? process.env.AGENT_PRIVATE_KEY
    : process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.trim().length > 0
      ? process.env.PRIVATE_KEY
      : "0x" + "a".repeat(64);

export const env = EnvSchema.parse({
  AGENT_PRIVATE_KEY: privateKey,
  ARBITRUM_SEPOLIA_RPC_URL:
    process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
  PRIVATE_OTC_ADDRESS:
    process.env.PRIVATE_OTC_ADDRESS ||
    process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS ||
    "0x" + "1".repeat(40),
  AGENT_NOTIFICATION_WEBHOOK: process.env.AGENT_NOTIFICATION_WEBHOOK,
  KEEPERHUB_RELAYER_URL: process.env.KEEPERHUB_RELAYER_URL,
  KEEPERHUB_GAS_SPONSORSHIP: process.env.KEEPERHUB_GAS_SPONSORSHIP,
  KEEPERHUB_ENABLED: process.env.KEEPERHUB_ENABLED,
  KEEPERHUB_MCP_URL: process.env.KEEPERHUB_MCP_URL,
  KEEPERHUB_API_KEY: process.env.KEEPERHUB_API_KEY,
  WRITER_MODE: (process.env.WRITER_MODE ?? "agent") as "hermes" | "agent" | "dry-run",
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
