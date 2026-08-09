"use client";

/**
 * Mint an on-chain TradiReceipt NFT for a settled OTC trade. Wraps
 * `TradiReceipt.mint(intentId, mode, settleTxHash, pair)` plus the usual
 * tx lifecycle (signing → confirming → done) and exposes the resulting
 * tokenId by parsing the ReceiptMinted event.
 *
 * Mint is open at the contract level — frontend gates UX to actual
 * trade participants via useSettledTaker / isMaker checks before
 * calling submit().
 */

import { useEffect, useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog, parseAbi, stringToHex, padHex } from "viem";
import { TRADI_NOX_RECEIPT_ADDRESS } from "@/lib/wagmi";

export const tradiReceiptAbi = parseAbi([
  "function mint(uint256 intentId, uint8 mode, bytes32 settleTxHash, bytes32 pair) returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event ReceiptMinted(uint256 indexed tokenId, uint256 indexed intentId, address indexed minter, uint8 mode)",
]);

export type ReceiptMintStep =
  | "idle"
  | "signing"
  | "confirming"
  | "done"
  | "error";

export interface MintInput {
  intentId: bigint;
  mode: "Direct" | "RFQ";
  /** 0x-prefixed tx hash from the settle transaction. Optional — pass null if unknown. */
  settleTxHash?: `0x${string}` | null;
  /** Display label for the trading pair, e.g. "cETH/cUSDC". Stored as bytes32 onchain. */
  pair: string;
}

const ZERO_BYTES32 = padHex("0x", { size: 32 });

function packPair(pair: string): `0x${string}` {
  // bytes32 is 32 raw bytes — utf-8 of "cETH/cUSDC" easily fits.
  // Truncate longer labels rather than reverting in the contract.
  const hex = stringToHex(pair, { size: 32 });
  return hex;
}

export function useReceiptMint() {
  const [step, setStep] = useState<ReceiptMintStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [tokenId, setTokenId] = useState<bigint | null>(null);

  const { writeContractAsync } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  useEffect(() => {
    if (!receipt.data || step !== "confirming") return;
    if (receipt.data.status === "reverted") {
      setStep("error");
      setError("Transaction reverted on-chain");
      return;
    }
    // Find ReceiptMinted log → extract tokenId.
    for (const log of receipt.data.logs) {
      try {
        const decoded = decodeEventLog({
          abi: tradiReceiptAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "ReceiptMinted") {
          setTokenId(decoded.args.tokenId as bigint);
          break;
        }
      } catch {
        // not our event, keep scanning
      }
    }
    setStep("done");
  }, [receipt.data, step]);

  useEffect(() => {
    if (receipt.isError && step === "confirming") {
      setStep("error");
      setError(
        receipt.error?.message?.split("\n")[0] ?? "Receipt fetch failed",
      );
    }
  }, [receipt.isError, receipt.error, step]);

  async function submit(input: MintInput) {
    if (TRADI_NOX_RECEIPT_ADDRESS === "0x0") {
      setStep("error");
      setError("TradiReceipt contract address not configured");
      return;
    }
    setStep("signing");
    setError(null);
    setTokenId(null);
    try {
      const modeEnum = input.mode === "Direct" ? 0 : 1;
      const hash = await writeContractAsync({
        address: TRADI_NOX_RECEIPT_ADDRESS,
        abi: tradiReceiptAbi,
        functionName: "mint",
        args: [
          input.intentId,
          modeEnum,
          (input.settleTxHash as `0x${string}`) ?? ZERO_BYTES32,
          packPair(input.pair),
        ],
      });
      setTxHash(hash);
      setStep("confirming");
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
  }

  return { submit, step, error, txHash, tokenId };
}
