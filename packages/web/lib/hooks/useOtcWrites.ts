"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { decodeEventLog } from "viem";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";
import { useNoxClient, encryptUint256 } from "@/lib/nox-client";
import {
  executeCreateRfq,
  executeAcceptIntent,
  executeSubmitBid,
  executeFinalizeRfq,
  executeRevealRfqWinner,
  executeCancelIntent,
  type CreateRfqInput,
  type WriteStep,
} from "./useOtcWrites.logic";
import { parseIntentCreatedId } from "./useCreateIntent.logic";

export type { CreateRfqInput, WriteStep };

type WriteState = {
  step: WriteStep;
  error: string | null;
  txHash: `0x${string}` | null;
};

const initial: WriteState = { step: "idle", error: null, txHash: null };

function makeStateAdapter(
  setState: (next: WriteState | ((prev: WriteState) => WriteState)) => void,
) {
  return {
    onStep: (step: WriteStep) =>
      setState((s: WriteState) => ({ ...s, step })),
    onError: (msg: string | null) =>
      setState((s: WriteState) => ({ ...s, error: msg })),
    onTxHash: (txHash: `0x${string}`) =>
      setState((s: WriteState) => ({ ...s, txHash })),
  };
}

/* -------------------------------------------------------------------------- */
/*                                createRFQ                                   */
/* -------------------------------------------------------------------------- */

export function useCreateRfq() {
  const { address } = useAccount();
  const { ready, getClient } = useNoxClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WriteState>(initial);
  const [intentId, setIntentId] = useState<bigint | null>(null);

  const receipt = useWaitForTransactionReceipt({
    hash: state.txHash ?? undefined,
  });

  async function submit(input: CreateRfqInput) {
    return executeCreateRfq(
      {
        address,
        noxReady: ready,
        privateOtcAddress: PRIVATE_OTC_ADDRESS,
        getClient,
        encryptAmount: encryptUint256,
        writeContractAsync: writeContractAsync as (
          args: unknown,
        ) => Promise<`0x${string}`>,
        nowSeconds: () => Math.floor(Date.now() / 1000),
      },
      input,
      makeStateAdapter(setState),
    );
  }

  useEffect(() => {
    if (receipt.data && state.step === "confirming") {
      if (receipt.data.status === "reverted") {
        setState((s) => ({
          ...s,
          step: "error",
          error: "Transaction reverted on-chain — check Arbiscan for details",
        }));
        return;
      }
      const id = parseIntentCreatedId(
        receipt.data.logs as never,
        decodeEventLog as never,
      );
      if (id !== null) {
        setIntentId(id);
        setState((s) => ({ ...s, step: "done" }));
      }
    } else if (receipt.isError && state.step === "confirming") {
      setState((s) => ({
        ...s,
        step: "error",
        error: receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      }));
    }
  }, [receipt.data, receipt.isError, receipt.error, state.step]);

  return { submit, ...state, intentId };
}

/* -------------------------------------------------------------------------- */
/*                                acceptIntent                                */
/* -------------------------------------------------------------------------- */

export function useAcceptIntent() {
  const { address } = useAccount();
  const { ready, getClient } = useNoxClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WriteState>(initial);
  const receipt = useWaitForTransactionReceipt({
    hash: state.txHash ?? undefined,
  });

  async function submit(intentId: bigint, buyAmount: bigint) {
    return executeAcceptIntent(
      {
        address,
        noxReady: ready,
        privateOtcAddress: PRIVATE_OTC_ADDRESS,
        getClient,
        encryptAmount: encryptUint256,
        writeContractAsync: writeContractAsync as (
          args: unknown,
        ) => Promise<`0x${string}`>,
        nowSeconds: () => Math.floor(Date.now() / 1000),
      },
      { intentId, buyAmount },
      makeStateAdapter(setState),
    );
  }

  useEffect(() => {
    if (receipt.data && state.step === "confirming") {
      if (receipt.data.status === "reverted") {
        setState((s) => ({
          ...s,
          step: "error",
          error: "Transaction reverted on-chain — check Arbiscan for details",
        }));
      } else {
        setState((s) => ({ ...s, step: "done" }));
      }
    } else if (receipt.isError && state.step === "confirming") {
      setState((s) => ({
        ...s,
        step: "error",
        error: receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      }));
    }
  }, [receipt.data, receipt.isError, receipt.error, state.step]);

  return { submit, ...state };
}

/* -------------------------------------------------------------------------- */
/*                                submitBid                                   */
/* -------------------------------------------------------------------------- */

export function useSubmitBid() {
  const { address } = useAccount();
  const { ready, getClient } = useNoxClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WriteState>(initial);
  const receipt = useWaitForTransactionReceipt({
    hash: state.txHash ?? undefined,
  });

  async function submit(rfqId: bigint, bidAmount: bigint) {
    return executeSubmitBid(
      {
        address,
        noxReady: ready,
        privateOtcAddress: PRIVATE_OTC_ADDRESS,
        getClient,
        encryptAmount: encryptUint256,
        writeContractAsync: writeContractAsync as (
          args: unknown,
        ) => Promise<`0x${string}`>,
        nowSeconds: () => Math.floor(Date.now() / 1000),
      },
      { rfqId, bidAmount },
      makeStateAdapter(setState),
    );
  }

  useEffect(() => {
    if (receipt.data && state.step === "confirming") {
      if (receipt.data.status === "reverted") {
        setState((s) => ({
          ...s,
          step: "error",
          error: "Transaction reverted on-chain — check Arbiscan for details",
        }));
      } else {
        setState((s) => ({ ...s, step: "done" }));
      }
    } else if (receipt.isError && state.step === "confirming") {
      setState((s) => ({
        ...s,
        step: "error",
        error: receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      }));
    }
  }, [receipt.data, receipt.isError, receipt.error, state.step]);

  return { submit, ...state };
}

/* -------------------------------------------------------------------------- */
/*                                finalizeRFQ                                 */
/* -------------------------------------------------------------------------- */

export function useFinalizeRfq() {
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WriteState>(initial);
  const receipt = useWaitForTransactionReceipt({
    hash: state.txHash ?? undefined,
  });

  async function submit(rfqId: bigint) {
    return executeFinalizeRfq(
      {
        privateOtcAddress: PRIVATE_OTC_ADDRESS,
        writeContractAsync: writeContractAsync as (
          args: unknown,
        ) => Promise<`0x${string}`>,
      },
      { rfqId },
      makeStateAdapter(setState),
    );
  }

  useEffect(() => {
    if (receipt.data && state.step === "confirming") {
      if (receipt.data.status === "reverted") {
        setState((s) => ({
          ...s,
          step: "error",
          error: "Transaction reverted on-chain — check Arbiscan for details",
        }));
      } else {
        setState((s) => ({ ...s, step: "done" }));
      }
    } else if (receipt.isError && state.step === "confirming") {
      setState((s) => ({
        ...s,
        step: "error",
        error: receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      }));
    }
  }, [receipt.data, receipt.isError, receipt.error, state.step]);

  return { submit, ...state };
}

/* -------------------------------------------------------------------------- */
/*                              revealRFQWinner                               */
/* -------------------------------------------------------------------------- */

/// Step 2 of the RFQ flow. Maker decrypts bid amounts off-chain (auditor
/// flow via `Nox.allow`), determines the actual highest bidder, then calls
/// this with the chosen bid index to settle.
export function useRevealRfqWinner() {
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WriteState>(initial);
  const receipt = useWaitForTransactionReceipt({
    hash: state.txHash ?? undefined,
  });

  async function submit(rfqId: bigint, winnerIdx: bigint) {
    return executeRevealRfqWinner(
      {
        privateOtcAddress: PRIVATE_OTC_ADDRESS,
        writeContractAsync: writeContractAsync as (
          args: unknown,
        ) => Promise<`0x${string}`>,
      },
      { rfqId, winnerIdx },
      makeStateAdapter(setState),
    );
  }

  useEffect(() => {
    if (receipt.data && state.step === "confirming") {
      if (receipt.data.status === "reverted") {
        setState((s) => ({
          ...s,
          step: "error",
          error: "Transaction reverted on-chain — check Arbiscan for details",
        }));
      } else {
        setState((s) => ({ ...s, step: "done" }));
      }
    } else if (receipt.isError && state.step === "confirming") {
      setState((s) => ({
        ...s,
        step: "error",
        error: receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      }));
    }
  }, [receipt.data, receipt.isError, receipt.error, state.step]);

  return { submit, ...state };
}

/* -------------------------------------------------------------------------- */
/*                                cancelIntent                                */
/* -------------------------------------------------------------------------- */

export function useCancelIntent() {
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<WriteState>(initial);
  const receipt = useWaitForTransactionReceipt({
    hash: state.txHash ?? undefined,
  });

  async function submit(intentId: bigint) {
    return executeCancelIntent(
      {
        privateOtcAddress: PRIVATE_OTC_ADDRESS,
        writeContractAsync: writeContractAsync as (
          args: unknown,
        ) => Promise<`0x${string}`>,
      },
      { intentId },
      makeStateAdapter(setState),
    );
  }

  useEffect(() => {
    if (receipt.data && state.step === "confirming") {
      if (receipt.data.status === "reverted") {
        setState((s) => ({
          ...s,
          step: "error",
          error: "Transaction reverted on-chain — check Arbiscan for details",
        }));
      } else {
        setState((s) => ({ ...s, step: "done" }));
      }
    } else if (receipt.isError && state.step === "confirming") {
      setState((s) => ({
        ...s,
        step: "error",
        error: receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      }));
    }
  }, [receipt.data, receipt.isError, receipt.error, state.step]);

  return { submit, ...state };
}
