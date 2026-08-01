"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useNoxClient, encryptUint256 } from "@/lib/nox-client";
import { executeFaucet, type FaucetStep } from "./useFaucet.logic";

export type { FaucetStep };

export function useFaucet() {
  const { address } = useAccount();
  const { ready, getClient } = useNoxClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<FaucetStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const receipt = useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  useEffect(() => {
    if (receipt.isSuccess && step === "confirming") {
      setStep("done");
    }
  }, [receipt.isSuccess, step]);

  async function mint(tokenAddress: `0x${string}`, amount: bigint) {
    return executeFaucet(
      {
        address,
        noxReady: ready,
        getClient,
        encryptAmount: encryptUint256,
        writeContractAsync: writeContractAsync as (
          args: unknown,
        ) => Promise<`0x${string}`>,
      },
      { tokenAddress, amount },
      { onStep: setStep, onError: setError, onTxHash: setTxHash },
    );
  }

  return { mint, step, error, txHash };
}
