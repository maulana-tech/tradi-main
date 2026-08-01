/**
 * Pure async logic for the faucet flow, extracted from useFaucet for testability.
 *
 * The React hook ({@link ./useFaucet}) is a thin wrapper that wires wagmi/Nox
 * deps and React state setters into this function. Tests against this module
 * cover every branch (positive/negative/edge) without needing a React renderer.
 */
import type { Hex } from "viem";
import type { HandleClient } from "@iexec-nox/handle";

export const FAUCET_ABI = [
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountHandle", type: "bytes32" },
      { name: "amountProof", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export type FaucetStep =
  | "idle"
  | "encrypting"
  | "signing"
  | "confirming"
  | "done"
  | "error";

export type FaucetDeps = {
  address: `0x${string}` | undefined;
  noxReady: boolean;
  getClient: () => Promise<HandleClient | null>;
  encryptAmount: (
    client: HandleClient,
    amount: bigint,
    contract: `0x${string}`,
  ) => Promise<{ handle: Hex; proof: Hex }>;
  writeContractAsync: (args: unknown) => Promise<`0x${string}`>;
};

export type FaucetCallbacks = {
  onStep: (step: FaucetStep) => void;
  onError: (msg: string | null) => void;
  onTxHash: (hash: `0x${string}`) => void;
};

export async function executeFaucet(
  deps: FaucetDeps,
  args: { tokenAddress: `0x${string}`; amount: bigint },
  cb: FaucetCallbacks,
): Promise<void> {
  if (!deps.address) throw new Error("Wallet not connected");
  if (!deps.noxReady) throw new Error("Nox client not ready");
  cb.onError(null);

  try {
    cb.onStep("encrypting");
    const client = await deps.getClient();
    if (!client) throw new Error("Nox client unavailable");

    const enc = await deps.encryptAmount(client, args.amount, args.tokenAddress);

    cb.onStep("signing");
    const hash = await deps.writeContractAsync({
      address: args.tokenAddress,
      abi: FAUCET_ABI,
      functionName: "faucet",
      args: [enc.handle as `0x${string}`, enc.proof],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}
