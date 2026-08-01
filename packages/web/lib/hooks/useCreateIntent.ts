"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { decodeEventLog } from "viem";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";
import { useNoxClient, encryptUint256 } from "@/lib/nox-client";
import {
  executeCreateIntent,
  parseIntentCreatedId,
  type CreateIntentInput,
  type CreateIntentStep,
} from "./useCreateIntent.logic";

export type { CreateIntentInput, CreateIntentStep };

export function useCreateIntent() {
  const { address } = useAccount();
  const { ready, getClient } = useNoxClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<CreateIntentStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [intentId, setIntentId] = useState<bigint | null>(null);

  const receipt = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  async function submit(input: CreateIntentInput) {
    return executeCreateIntent(
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
      { onStep: setStep, onError: setError, onTxHash: setTxHash },
    );
  }

  useEffect(() => {
    if (receipt.data && step === "confirming") {
      const id = parseIntentCreatedId(
        receipt.data.logs as never,
        decodeEventLog as never,
      );
      if (id !== null) {
        setIntentId(id);
        setStep("done");
      }
    }
  }, [receipt.data, step]);

  return { submit, step, error, txHash, intentId, receipt };
}
