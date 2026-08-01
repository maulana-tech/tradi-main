"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { CopyButton } from "./CopyButton";
import { CornerBrackets } from "./CornerBrackets";
import { useReceiptMint } from "@/lib/hooks/useReceiptMint";
import { useExistingReceipt } from "@/lib/hooks/useExistingReceipt";
import { TRADI_NOX_RECEIPT_ADDRESS } from "@/lib/wagmi";
import { generateReceiptSvg } from "@/lib/receipt-svg";

type State =
  | { kind: "idle" }
  | { kind: "generating-image" }
  | {
      kind: "ok";
      dataUrl: string;
      fingerprint: string;
    }
  | { kind: "error"; message: string };

export interface NftReceiptProps {
  pair: string;
  intentId: string;
  mode: "Direct" | "RFQ";
  /** Tx hash from settle event */
  txHash?: string;
  blockNumber?: string;
  timestamp?: number;
  makerAddress?: string;
  /** Encrypted handle for sell amount — used as visual signature */
  sellHandle?: string;
}

export function NftReceipt(props: NftReceiptProps) {
  const { address } = useAccount();
  const [state, setState] = useState<State>({ kind: "idle" });
  // True when the user has clicked MINT and we want to fire the on-chain
  // tx as soon as the image (success or failure) has rendered. Triggering
  // mint inline after `setState` would race the React commit — MetaMask
  // would pop up before the image paints. Watching this flag in a
  // useEffect ordered AFTER the image render guarantees the visual lands
  // first, then the wallet prompt.
  const [pendingMint, setPendingMint] = useState(false);
  const mint = useReceiptMint();
  const existing = useExistingReceipt(BigInt(props.intentId), address);

  useEffect(() => {
    if (mint.step === "done" && mint.tokenId !== null) {
      existing.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint.step, mint.tokenId]);

  // Fire the on-chain mint AFTER the image-generation phase resolves
  // (either ok or error) and the image render has committed. The
  // `state.kind !== "generating-image"` guard ensures we don't fire
  // while still loading; pendingMint is the user-intent flag.
  useEffect(() => {
    if (!pendingMint) return;
    if (state.kind === "generating-image") return;
    setPendingMint(false);
    void mint.submit({
      intentId: BigInt(props.intentId),
      mode: props.mode,
      settleTxHash: (props.txHash as `0x${string}` | undefined) ?? null,
      pair: props.pair,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMint, state.kind]);

  // Single-click flow: generate SVG receipt, mark the user as wanting
  // a mint, then let the effect above launch the wallet prompt only
  // after the image has painted.
  function mintReceipt() {
    if (
      existing.alreadyMinted ||
      pendingMint ||
      mint.step === "signing" ||
      mint.step === "confirming"
    ) {
      return;
    }
    setState({ kind: "generating-image" });
    setPendingMint(true);
    try {
      const receipt = generateReceiptSvg(props);
      setState({ kind: "ok", ...receipt });
    } catch (err) {
      setState({
        kind: "error",
        message: `SVG generation failed: ${err instanceof Error ? err.message : String(err)} — proceeding with on-chain mint anyway.`,
      });
    }
    // pendingMint is true → effect above runs once state.kind !== "generating-image"
  }

  function download() {
    if (state.kind !== "ok") return;
    const a = document.createElement("a");
    a.href = state.dataUrl;
    a.download = `tradi-nox-receipt-${state.fingerprint}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function shareTwitter() {
    if (state.kind !== "ok") return;
      const text = encodeURIComponent(
      `Just executed a confidential OTC trade on @iEx_ec Nox via Tradi-Nox.

🔒 Receipt: ${state.fingerprint}
📊 Pair: ${props.pair}
🎯 Mode: ${props.mode}

#iExecVibeCoding`,
    );
    const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent("https://private-otc.vercel.app")}`;
    window.open(url, "_blank");
  }

  const onchainTokenId = mint.tokenId ?? existing.tokenId;
  const isMinting =
    state.kind === "generating-image" ||
    mint.step === "signing" ||
    mint.step === "confirming";
  const showButton = !existing.alreadyMinted && state.kind !== "ok";

  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-surface] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[--color-primary]">
            <span className="material-symbols-outlined text-base">
              token
            </span>
            NFT Receipt
          </p>
          <p className="mt-0.5 text-xs text-[--color-text-muted]">
            Procedural SVG + ERC-721
          </p>
        </div>

        {existing.alreadyMinted && onchainTokenId !== null && (
          <a
            href={`https://sepolia.arbiscan.io/token/${TRADI_NOX_RECEIPT_ADDRESS}?a=${onchainTokenId.toString()}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-[--color-primary]/20 bg-[--color-primary]/5 px-2.5 py-1 text-xs font-medium text-[--color-primary] hover:bg-[--color-primary]/10"
          >
            <span className="material-symbols-outlined text-sm">
              check_circle
            </span>
            Minted #{onchainTokenId.toString()}
          </a>
        )}

        {showButton && (
          <button
            onClick={mintReceipt}
            disabled={isMinting || existing.isLoading}
            className="tradi-nox-btn-secondary text-xs"
          >
            {state.kind === "generating-image" && "Generating…"}
            {mint.step === "signing" && "Confirm in wallet…"}
            {mint.step === "confirming" && "Minting…"}
            {!isMinting && "Mint Receipt"}
          </button>
        )}
      </div>

      {existing.alreadyMinted && state.kind !== "ok" && (
        <p className="mt-3 font-mono text-[11px] text-[--color-text-muted]">
          You already minted Receipt #{onchainTokenId?.toString()} for this
          trade. View on Arbiscan or in your wallet — duplicates are blocked.
        </p>
      )}

      {state.kind === "ok" && (
        <div className="mt-4 space-y-3 border-t border-[--color-border] pt-4">
          {/* Image with overlays */}
          <div className="relative overflow-hidden rounded-lg border border-[--color-border]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.dataUrl}
              alt="Tradi-Nox NFT receipt"
              className="w-full"
            />

            {/* Top-left: fingerprint */}
            <div className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-[--color-primary]">
              {state.fingerprint}
            </div>

            {/* Top-right: mode badge */}
            <div className="absolute right-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-[--color-primary]">
              {props.mode === "RFQ" ? "RFQ" : "Direct"}
            </div>

            {/* Bottom-left: pair */}
            <div className="absolute bottom-3 left-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-[--color-primary]">
              {props.pair}
            </div>

            {/* Bottom-right: NOX_TEE */}
            <div className="absolute bottom-3 right-3 rounded bg-white/90 px-2 py-1 text-xs font-medium text-[--color-primary]">
              Nox TEE
            </div>
          </div>

          {/* On-chain mint status */}
          <OnchainStatus
            mint={mint}
            existingTokenId={existing.tokenId}
          />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-[--color-border] bg-[--color-surface-low] p-3">
            <MetadataRow label="Fingerprint" value={state.fingerprint} mono />
            <MetadataRow
              label="Mode"
              value={props.mode === "RFQ" ? "Vickrey Auction" : "Bilateral"}
            />
            {props.txHash && (
              <MetadataRow
                label="Settle tx"
                value={`${props.txHash.slice(0, 10)}…${props.txHash.slice(-6)}`}
                mono
                copyValue={props.txHash}
              />
            )}
            {props.blockNumber && (
              <MetadataRow label="Block" value={props.blockNumber} mono />
            )}
            {props.makerAddress && (
              <MetadataRow
                label="Maker"
                value={`${props.makerAddress.slice(0, 6)}…${props.makerAddress.slice(-4)}`}
                mono
                copyValue={props.makerAddress}
              />
            )}
            {props.timestamp && (
              <MetadataRow
                label="Settled"
                value={new Date(props.timestamp).toLocaleString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
                })}
              />
            )}
            {props.sellHandle && (
              <MetadataRow
                label="Handle"
                value={`${props.sellHandle.slice(0, 10)}…`}
                mono
                copyValue={props.sellHandle}
              />
            )}
            <MetadataRow label="Network" value="Arb Sepolia" mono />
          </div>

          {/* Download / share */}
          <div className="flex gap-2">
            <button
              onClick={download}
              className="tradi-nox-btn-secondary flex flex-1 items-center justify-center gap-1.5 text-xs"
            >
              <span className="material-symbols-outlined text-base">
                download
              </span>
              DOWNLOAD JPG
            </button>
            <button
              onClick={shareTwitter}
              className="text-label-caps flex items-center gap-1.5 border border-[--color-border] px-3 py-2 transition-all hover:border-[--color-primary] hover:text-[--color-primary]"
              title="Share to X / Twitter"
            >
              <span className="material-symbols-outlined text-base">share</span>
              SHARE
            </button>
          </div>

          <details className="border border-[--color-border] bg-[--color-bg]/40 p-3">
            <summary className="text-label-caps cursor-pointer text-[--color-text-muted] hover:text-[--color-primary]">
              <span className="ml-2">SVG source</span>
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[--color-text-secondary]">
              {`Procedural SVG generated client-side.\nFingerprint: ${state.fingerprint}\nNo external API calls.`}
            </pre>
          </details>
        </div>
      )}

      {state.kind === "error" && !isMinting && (
        <p className="mt-3 flex items-center gap-1 font-mono text-[11px] text-amber-400">
          <span className="material-symbols-outlined text-xs">info</span>
          {state.message}
        </p>
      )}
    </div>
  );
}

function OnchainStatus({
  mint,
  existingTokenId,
}: {
  mint: ReturnType<typeof useReceiptMint>;
  existingTokenId: bigint | null;
}) {
  const tokenId = mint.tokenId ?? existingTokenId;
  if (mint.step === "signing") {
    return (
      <p className="font-mono text-[10px] text-amber-300">
        → confirm transaction in wallet to commit on-chain receipt…
      </p>
    );
  }
  if (mint.step === "confirming") {
    return (
      <p className="flex items-center gap-2 font-mono text-[10px] text-amber-300">
        <span className="material-symbols-outlined animate-spin text-xs">
          sync
        </span>
        Minting on-chain — Ethereum Sepolia confirming…
        {mint.txHash && (
          <a
            href={`https://sepolia.arbiscan.io/tx/${mint.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-[--color-primary] underline"
          >
            tx →
          </a>
        )}
      </p>
    );
  }
  if (mint.step === "done" && tokenId !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-[--color-primary]">
        <span className="material-symbols-outlined text-xs">verified</span>
        Minted Receipt NFT
        <a
          href={`https://sepolia.arbiscan.io/token/${TRADI_NOX_RECEIPT_ADDRESS}?a=${tokenId.toString()}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-[--color-primary]/80"
        >
          #{tokenId.toString()} on Arbiscan
        </a>
        {mint.txHash && (
          <a
            href={`https://sepolia.arbiscan.io/tx/${mint.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[--color-primary]/80"
          >
            tx
          </a>
        )}
      </div>
    );
  }
  if (mint.step === "error") {
    return (
      <p className="font-mono text-[10px] text-[--color-danger]">
        On-chain mint failed: {mint.error}
      </p>
    );
  }
  return null;
}

function MetadataRow({
  label,
  value,
  mono,
  copyValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string;
}) {
  return (
    <div>
      <p className="text-label-caps text-[--color-text-muted]">{label}</p>
      <div
        className={`mt-0.5 flex items-center gap-1.5 ${mono ? "font-mono" : ""} text-xs text-[--color-text]`}
      >
        <span>{value}</span>
        {copyValue && <CopyButton value={copyValue} size="sm" />}
      </div>
    </div>
  );
}
