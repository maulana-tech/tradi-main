"use client";

/**
 * Authorize the PrivateOTC contract as an operator on an ERC-7984 cToken
 * for the connected wallet. Required before any settlement that pulls
 * tokens FROM that wallet — the cToken's `confidentialTransferFrom`
 * checks `_operators[from][OTC] > block.timestamp` and reverts with
 * "TradiNoxCToken: not operator" if missing.
 *
 * Expiry is fixed at +60 days so a single authorization survives the
 * full demo lifecycle without re-prompting the user.
 */

import { useEffect, useState } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi } from "viem";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";

export type OperatorStep =
  | "idle"
  | "signing"
  | "confirming"
  | "done"
  | "error";

const cTokenAbi = parseAbi([
  "function setOperator(address operator, uint48 until)",
  "function isOperator(address holder, address spender) view returns (bool)",
]);

const SIXTY_DAYS_SECONDS = 60 * 24 * 60 * 60;

export function useSetOperator(
  token: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
) {
  const [step, setStep] = useState<OperatorStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const isOperatorQuery = useReadContract({
    address: token,
    abi: cTokenAbi,
    functionName: "isOperator",
    args: account ? [account, PRIVATE_OTC_ADDRESS] : undefined,
    query: {
      enabled: !!token && !!account,
      refetchInterval: 15_000,
    },
  });

  const { writeContractAsync } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  // Surface tx outcome — flip to done / error when receipt resolves.
  useEffect(() => {
    if (receipt.data && step === "confirming") {
      if (receipt.data.status === "reverted") {
        setStep("error");
        setError("Transaction reverted on-chain");
      } else {
        setStep("done");
        // Refetch isOperator so UI flips immediately.
        isOperatorQuery.refetch();
      }
    } else if (receipt.isError && step === "confirming") {
      setStep("error");
      setError(
        receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.data, receipt.isError, step]);

  async function authorize() {
    if (!token) {
      setError("Token address missing");
      return;
    }
    setStep("signing");
    setError(null);
    try {
      // uint48 in the ABI surfaces as `number` in viem's typegen; the value
      // (now seconds + 60d ≈ 1.7e9 + 5.2e6) fits well within Number safe int.
      const expiry = Math.floor(Date.now() / 1000) + SIXTY_DAYS_SECONDS;
      const hash = await writeContractAsync({
        address: token,
        abi: cTokenAbi,
        functionName: "setOperator",
        args: [PRIVATE_OTC_ADDRESS, expiry],
      });
      setTxHash(hash);
      setStep("confirming");
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
  }

  return {
    isOperator: (isOperatorQuery.data as boolean | undefined) ?? false,
    isLoading: isOperatorQuery.isLoading,
    refetch: isOperatorQuery.refetch,
    authorize,
    step,
    error,
    txHash,
  };
}

/**
 * Read-only variant: check whether `holder` has authorized PrivateOTC as
 * operator on `token`. Used to surface counterparty status (maker's
 * sell-side authorization on the accept page; bidders' buy-side
 * authorization on the RFQ reveal panel) without offering a write path.
 *
 * Returns `undefined` while loading so callers can distinguish "unknown"
 * from "definitely false".
 */
export function useIsOperator(
  token: `0x${string}` | undefined,
  holder: `0x${string}` | undefined,
) {
  const query = useReadContract({
    address: token,
    abi: cTokenAbi,
    functionName: "isOperator",
    args: holder ? [holder, PRIVATE_OTC_ADDRESS] : undefined,
    query: {
      enabled: !!token && !!holder,
      // Slower than useSetOperator (15s) — counterparty changes happen
      // out-of-band, polling tighter just wastes RPC.
      refetchInterval: 30_000,
    },
  });
  return {
    isOperator: query.data as boolean | undefined,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
