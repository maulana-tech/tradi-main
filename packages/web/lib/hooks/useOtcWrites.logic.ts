/**
 * Pure async logic for the 5 OTC write hooks (createRfq, acceptIntent,
 * submitBid, finalizeRfq, cancelIntent). Each hook in useOtcWrites.ts is a
 * thin React wrapper around the corresponding executeXxx() here.
 */
import type { Hex } from "viem";
import type { HandleClient } from "@iexec-nox/handle";
import { privateOtcAbi } from "@/lib/abi/privateOtc";

export type WriteStep =
  | "idle"
  | "encrypting"
  | "signing"
  | "confirming"
  | "done"
  | "error";

export type WriteCallbacks = {
  onStep: (step: WriteStep) => void;
  onError: (msg: string | null) => void;
  onTxHash: (hash: `0x${string}`) => void;
};

/** Deps required by hooks that need wallet + Nox + write. */
export type EncryptedWriteDeps = {
  address: `0x${string}` | undefined;
  noxReady: boolean;
  privateOtcAddress: `0x${string}`;
  getClient: () => Promise<HandleClient | null>;
  encryptAmount: (
    client: HandleClient,
    amount: bigint,
    contract: `0x${string}`,
  ) => Promise<{ handle: Hex; proof: Hex }>;
  writeContractAsync: (args: unknown) => Promise<`0x${string}`>;
  nowSeconds: () => number;
};

/** Deps for hooks that only write (no encryption / wallet validation). */
export type SimpleWriteDeps = {
  privateOtcAddress: `0x${string}`;
  writeContractAsync: (args: unknown) => Promise<`0x${string}`>;
};

/* -------------------------------------------------------------------------- */
/*                                  createRfq                                 */
/* -------------------------------------------------------------------------- */

export type CreateRfqInput = {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount: bigint;
  biddingDeadlineSeconds: number;
};

export async function executeCreateRfq(
  deps: EncryptedWriteDeps,
  input: CreateRfqInput,
  cb: WriteCallbacks,
): Promise<void> {
  if (!deps.address) throw new Error("Wallet not connected");
  if (!deps.noxReady) throw new Error("Nox client not ready");
  cb.onError(null);

  try {
    cb.onStep("encrypting");
    const client = await deps.getClient();
    if (!client) throw new Error("Nox client unavailable");

    const sell = await deps.encryptAmount(
      client,
      input.sellAmount,
      deps.privateOtcAddress,
    );

    cb.onStep("signing");
    const deadline =
      BigInt(deps.nowSeconds()) + BigInt(input.biddingDeadlineSeconds);

    const hash = await deps.writeContractAsync({
      address: deps.privateOtcAddress,
      abi: privateOtcAbi,
      functionName: "createRFQ",
      args: [
        input.sellToken,
        input.buyToken,
        sell.handle as `0x${string}`,
        sell.proof,
        deadline,
      ],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}

/* -------------------------------------------------------------------------- */
/*                               acceptIntent                                 */
/* -------------------------------------------------------------------------- */

export async function executeAcceptIntent(
  deps: EncryptedWriteDeps,
  input: { intentId: bigint; buyAmount: bigint },
  cb: WriteCallbacks,
): Promise<void> {
  if (!deps.address) throw new Error("Wallet not connected");
  if (!deps.noxReady) throw new Error("Nox client not ready");
  cb.onError(null);

  try {
    cb.onStep("encrypting");
    const client = await deps.getClient();
    if (!client) throw new Error("Nox client unavailable");

    const buy = await deps.encryptAmount(
      client,
      input.buyAmount,
      deps.privateOtcAddress,
    );

    cb.onStep("signing");
    const hash = await deps.writeContractAsync({
      address: deps.privateOtcAddress,
      abi: privateOtcAbi,
      functionName: "acceptIntent",
      args: [input.intentId, buy.handle as `0x${string}`, buy.proof],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}

/* -------------------------------------------------------------------------- */
/*                                 submitBid                                  */
/* -------------------------------------------------------------------------- */

export async function executeSubmitBid(
  deps: EncryptedWriteDeps,
  input: { rfqId: bigint; bidAmount: bigint },
  cb: WriteCallbacks,
): Promise<void> {
  if (!deps.address) throw new Error("Wallet not connected");
  if (!deps.noxReady) throw new Error("Nox client not ready");
  cb.onError(null);

  try {
    cb.onStep("encrypting");
    const client = await deps.getClient();
    if (!client) throw new Error("Nox client unavailable");

    const bid = await deps.encryptAmount(
      client,
      input.bidAmount,
      deps.privateOtcAddress,
    );

    cb.onStep("signing");
    const hash = await deps.writeContractAsync({
      address: deps.privateOtcAddress,
      abi: privateOtcAbi,
      functionName: "submitBid",
      args: [input.rfqId, bid.handle as `0x${string}`, bid.proof],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}

/* -------------------------------------------------------------------------- */
/*                               finalizeRfq                                  */
/* -------------------------------------------------------------------------- */

export async function executeFinalizeRfq(
  deps: SimpleWriteDeps,
  input: { rfqId: bigint },
  cb: WriteCallbacks,
): Promise<void> {
  cb.onStep("signing");
  cb.onError(null);
  try {
    const hash = await deps.writeContractAsync({
      address: deps.privateOtcAddress,
      abi: privateOtcAbi,
      functionName: "finalizeRFQ",
      args: [input.rfqId],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}

/* -------------------------------------------------------------------------- */
/*                            revealRFQWinner                                 */
/* -------------------------------------------------------------------------- */

/// Step 2 of 2-step RFQ flow. Maker passes the index of the bid they
/// determined to be the highest (via off-chain Nox decryption). Settlement
/// runs at the encrypted second-highest price.
export async function executeRevealRfqWinner(
  deps: SimpleWriteDeps,
  input: { rfqId: bigint; winnerIdx: bigint },
  cb: WriteCallbacks,
): Promise<void> {
  cb.onStep("signing");
  cb.onError(null);
  try {
    const hash = await deps.writeContractAsync({
      address: deps.privateOtcAddress,
      abi: privateOtcAbi,
      functionName: "revealRFQWinner",
      args: [input.rfqId, input.winnerIdx],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}

/* -------------------------------------------------------------------------- */
/*                              cancelIntent                                  */
/* -------------------------------------------------------------------------- */

export async function executeCancelIntent(
  deps: SimpleWriteDeps,
  input: { intentId: bigint },
  cb: WriteCallbacks,
): Promise<void> {
  cb.onStep("signing");
  cb.onError(null);
  try {
    const hash = await deps.writeContractAsync({
      address: deps.privateOtcAddress,
      abi: privateOtcAbi,
      functionName: "cancelIntent",
      args: [input.intentId],
    });
    cb.onTxHash(hash);
    cb.onStep("confirming");
  } catch (err) {
    cb.onStep("error");
    cb.onError(err instanceof Error ? err.message : String(err));
  }
}
