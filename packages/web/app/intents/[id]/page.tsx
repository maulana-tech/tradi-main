"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAccount, useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { TokenIcon } from "@/components/TokenIcon";
import { NftReceipt } from "@/components/NftReceipt";
import { SkeletonCard } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { OperatorAuth } from "@/components/OperatorAuth";
import { OperatorWarning } from "@/components/OperatorWarning";
import { useIsOperator, useSetOperator } from "@/lib/hooks/useSetOperator";
import { useSettledTaker } from "@/lib/hooks/useSettledTaker";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { PRIVATE_OTC_ADDRESS, CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { useAcceptIntent, useCancelIntent } from "@/lib/hooks/useOtcWrites";
import { statusLabel, modeLabel } from "@/lib/hooks/useIntents";
import { shortAddress } from "@/lib/utils";

const TOKEN_NAMES: Record<string, { symbol: string; decimals: number }> = {
  [CUSDC_ADDRESS.toLowerCase()]: { symbol: "cUSDC", decimals: 6 },
  [CETH_ADDRESS.toLowerCase()]: { symbol: "cETH", decimals: 18 },
};

export default function IntentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const intentId = BigInt(id);

  const { address } = useAccount();
  const accept = useAcceptIntent();
  const cancel = useCancelIntent();
  const toast = useToast();
  const [bidAmount, setBidAmount] = useState("");

  // Toast tx outcomes — tx hash present in confirming, link out for transparency
  useEffect(() => {
    if (accept.step === "done" && accept.txHash) {
      toast.success("Trade settled — decrypt portfolio to see new balance", {
        href: `https://sepolia.arbiscan.io/tx/${accept.txHash}`,
      });
    } else if (accept.step === "error" && accept.error) {
      toast.error(`Settle failed: ${accept.error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accept.step, accept.txHash]);

  useEffect(() => {
    if (cancel.step === "done" && cancel.txHash) {
      toast.success("Intent cancelled", {
        href: `https://sepolia.arbiscan.io/tx/${cancel.txHash}`,
      });
    } else if (cancel.step === "error" && cancel.error) {
      toast.error(`Cancel failed: ${cancel.error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel.step, cancel.txHash]);

  const intentQuery = useReadContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "intents",
    args: [intentId],
  });

  // Derive token + maker addresses up-front (BEFORE any early return) so
  // the operator-status hooks below get a stable hook call order across
  // every render — Rules of Hooks. They tolerate undefined inputs via
  // their internal `enabled` guards.
  const intentTuple = intentQuery.data as
    | readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        number,
        number,
        `0x${string}`,
        `0x${string}`,
      ]
    | undefined;
  const intentMaker = intentTuple?.[0];
  const intentSellToken = intentTuple?.[1];
  const intentBuyToken = intentTuple?.[2];

  // Settlement requires BOTH parties' operator auth on their respective
  // sides. Read both — surface the failure mode before the user pays
  // gas for a doomed accept.
  const takerBuyAuth = useSetOperator(intentBuyToken, address);
  const makerSellAuth = useIsOperator(intentSellToken, intentMaker);
  const settledTaker = useSettledTaker(intentId);

  if (intentQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-label-caps mb-6 flex items-center gap-2 text-[--color-text-muted]">
          <span className="material-symbols-outlined animate-spin text-base text-[--color-primary]">
            sync
          </span>
          Loading intent #{id}
        </p>
        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-7">
            <SkeletonCard />
          </section>
          <aside className="col-span-12 space-y-4 lg:col-span-5">
            <SkeletonCard />
          </aside>
        </div>
      </AppShell>
    );
  }

  if (!intentQuery.data) {
    return (
      <AppShell>
        <p className="text-sm text-[--color-danger]">
          Intent not found
        </p>
      </AppShell>
    );
  }

  const v = intentQuery.data as readonly [
    `0x${string}`,
    `0x${string}`,
    `0x${string}`,
    `0x${string}`,
    `0x${string}`,
    bigint,
    number,
    number,
    `0x${string}`,
    `0x${string}`, // priceToPay (10th field, 2-step RFQ)
  ];

  const intent = {
    maker: v[0],
    sellToken: v[1],
    buyToken: v[2],
    sellAmountHandle: v[3],
    minBuyAmountHandle: v[4],
    deadline: v[5],
    status: v[6],
    mode: v[7],
    allowedTaker: v[8],
  };

  const isMaker =
    address && address.toLowerCase() === intent.maker.toLowerCase();
  const isOpen = intent.status === 0;
  const isExpired = Number(intent.deadline) <= Math.floor(Date.now() / 1000);
  const buyTok = TOKEN_NAMES[intent.buyToken.toLowerCase()];
  const sellTok = TOKEN_NAMES[intent.sellToken.toLowerCase()];
  const settleReady =
    takerBuyAuth.isOperator && makerSellAuth.isOperator !== false;

  if (intent.mode === 1) {
    return (
      <AppShell>
        <p className="text-sm text-[--color-text-muted]">
          This is an RFQ auction.{" "}
          <Link
            href={`/rfq/${id}` as Route}
            className="text-[--color-primary] underline"
          >
            Open RFQ view →
          </Link>
        </p>
      </AppShell>
    );
  }

  async function onAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!buyTok) return;
    await accept.submit(intentId, parseUnits(bidAmount || "0", buyTok.decimals));
  }

  async function onCancel() {
    await cancel.submit(intentId);
  }

  return (
    <AppShell>
      <Link
        href={"/intents" as Route}
        className="text-label-caps mb-6 inline-flex items-center gap-1.5 text-[--color-text-muted] hover:text-[--color-primary]"
      >
        <span className="material-symbols-outlined text-base">
          arrow_back
        </span>
        All Intents
      </Link>

      <PageHeader
        icon="receipt_long"
        title={`Intent #${id.padStart(4, "0")}`}
        subtitle="Direct OTC · bilateral settlement"
        badge={
            <span className="text-label-caps flex items-center gap-1.5 border border-orange-200 bg-orange-50 px-3 py-1 text-orange-700">
            <span className="material-symbols-outlined text-base">person</span>
            {modeLabel(intent.mode)}
          </span>
        }
      />


      <div className="grid grid-cols-12 gap-6">
        {/* Detail panel */}
        <section className="col-span-12 lg:col-span-7">
          <div className="glass-card p-6">
            <SectionHeader icon="article" title="Intent Details" />

            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField
                icon="flag"
                label="Status"
                value={statusLabel(intent.status)}
              />
              <DetailField
                icon="person"
                label="Maker"
                value={shortAddress(intent.maker, 6)}
                mono
              />
              <DetailField
                icon="upload"
                label="Sell Asset"
                value={
                  TOKEN_NAMES[intent.sellToken.toLowerCase()]?.symbol ??
                  shortAddress(intent.sellToken)
                }
                mono
              />
              <DetailField
                icon="download"
                label="Buy Asset"
                value={
                  TOKEN_NAMES[intent.buyToken.toLowerCase()]?.symbol ??
                  shortAddress(intent.buyToken)
                }
                mono
              />
              <DetailField
                icon="lock"
                label="Sell Amount (Encrypted)"
                value={`${intent.sellAmountHandle.slice(0, 14)}…`}
                mono
                small
              />
              <DetailField
                icon="lock"
                label="Min Buy (Encrypted)"
                value={`${intent.minBuyAmountHandle.slice(0, 14)}…`}
                mono
                small
              />
              <DetailField
                icon="schedule"
                label="Expires"
                value={new Date(
                  Number(intent.deadline) * 1000,
                ).toLocaleString()}
                small
              />
              <DetailField
                icon="group"
                label="Allowed Taker"
                value={
                  intent.allowedTaker ===
                  "0x0000000000000000000000000000000000000000"
                    ? "Open to anyone"
                    : shortAddress(intent.allowedTaker, 6)
                }
                mono
              />
            </dl>

            <div className="mt-6 flex items-center justify-center gap-3 border-t border-[--color-border] pt-6">
              <TokenIcon
                symbol={
                  TOKEN_NAMES[intent.sellToken.toLowerCase()]?.symbol ?? "?"
                }
                size="lg"
              />
              <span className="material-symbols-outlined text-2xl text-[--color-primary]">
                arrow_forward
              </span>
              <TokenIcon
                symbol={
                  TOKEN_NAMES[intent.buyToken.toLowerCase()]?.symbol ?? "?"
                }
                size="lg"
              />
            </div>
          </div>
        </section>

        {/* Action panel */}
        <aside className="col-span-12 space-y-4 lg:col-span-5">
          {isMaker && isOpen && (
            <div className="glass-card border-l-2 border-l-orange-400 p-6">
              <p className="text-label-caps mb-2 text-orange-600">
                Maker Actions
              </p>
              <p className="mb-4 text-[11px] text-[--color-text-muted]">
                You created this intent
              </p>
              <button
                onClick={onCancel}
                disabled={
                  cancel.step === "signing" || cancel.step === "confirming"
                }
                className="text-label-caps w-full border border-orange-200 bg-orange-50 px-4 py-3 text-orange-700 transition-all hover:bg-orange-100 disabled:opacity-50"
              >
                {cancel.step === "signing" && "SIGNING…"}
                {cancel.step === "confirming" && "CONFIRMING…"}
                {(cancel.step === "idle" ||
                  cancel.step === "error" ||
                  cancel.step === "done") &&
                  "CANCEL INTENT"}
              </button>
              {cancel.error && (
                <p className="mt-2 font-mono text-[10px] text-[--color-danger]">
                  {cancel.error}
                </p>
              )}
              {cancel.step === "confirming" && cancel.txHash && (
                <a
                  href={`https://sepolia.arbiscan.io/tx/${cancel.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex items-center gap-1 font-mono text-[10px] text-amber-400 underline hover:text-amber-300"
                >
                  <span className="material-symbols-outlined text-xs">
                    open_in_new
                  </span>
                  Tx broadcast — view on Arbiscan
                </a>
              )}
            </div>
          )}

          {!isMaker && isOpen && !isExpired && (
            <>
              <OperatorAuth
                token={intent.buyToken}
                account={address}
                symbol={buyTok?.symbol ?? "buy token"}
                reason={`Accept settlement pulls ${buyTok?.symbol ?? "your buy token"} from your wallet to the maker. Tradi-Nox needs operator permission on this cToken first — one-time, lasts 60 days.`}
              />
              <OperatorWarning
                token={intent.sellToken}
                holder={intent.maker}
                symbol={sellTok?.symbol ?? "sell token"}
                role="maker"
              />

              <form onSubmit={onAccept} className="glass-card space-y-4 p-6">
                <p className="text-label-caps flex items-center gap-2 text-[--color-primary]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary]" />
                  Accept + Settle
                </p>
                <p className="text-[11px] leading-relaxed text-[--color-text-muted]">
                  Submit your buy amount. Encrypted via Nox. If below the maker's
                  hidden minimum, trade settles as a no-op.
                </p>

              <div className="space-y-2">
                <label className="text-label-caps text-[--color-text-muted]">
                  Your Bid
                </label>
                <div className="flex border border-[--color-border] bg-[--color-bg] focus-within:border-[--color-primary]">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none"
                    data-numeric
                  />
                  <span className="grid place-items-center px-3 text-label-caps text-[--color-text-muted]">
                    {buyTok?.symbol ?? ""}
                  </span>
                </div>
              </div>

              {accept.error && (
                <div className="border border-[--color-danger] bg-[--color-danger]/10 p-3 text-sm text-[--color-danger]">
                  {accept.error}
                </div>
              )}

              {/* Tx broadcasting — show link as soon as we have a hash so
                  user has an escape hatch if the receipt watch hangs */}
              {accept.step === "confirming" && accept.txHash && (
                <div className="border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
                  <div className="flex items-center gap-2 text-amber-600">
                    <span className="material-symbols-outlined animate-spin text-sm">
                      sync
                    </span>
                    <span className="text-label-caps">Settling on-chain</span>
                  </div>
                  <p className="mt-1 text-[--color-text-secondary]">
                    Tx broadcasted. Status updates after Ethereum confirms.
                  </p>
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${accept.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 break-all text-amber-400 underline hover:text-amber-300"
                  >
                    <span className="material-symbols-outlined text-xs">
                      open_in_new
                    </span>
                    {accept.txHash}
                  </a>
                </div>
              )}

              {accept.step === "done" && (
                <div className="border border-[--color-primary] bg-[--color-primary]/10 p-3 text-sm">
                  <span className="text-[--color-primary]">SETTLED.</span>{" "}
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${accept.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Tx
                  </a>{" "}
                  ·{" "}
                  <Link
                    href={"/portfolio" as Route}
                    className="underline"
                  >
                    Decrypt portfolio →
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  accept.step === "encrypting" ||
                  accept.step === "signing" ||
                  accept.step === "confirming" ||
                  accept.step === "done" ||
                  !settleReady
                }
                title={
                  accept.step === "done"
                    ? "Trade settled — see the receipt below"
                    : !takerBuyAuth.isOperator
                      ? `Authorize Tradi-Nox for ${buyTok?.symbol ?? "buy token"} first`
                      : makerSellAuth.isOperator === false
                        ? `Maker hasn't authorized ${sellTok?.symbol ?? "sell token"} — settlement will revert`
                        : undefined
                }
                className="tradi-nox-btn-primary w-full py-4 text-sm"
              >
                {accept.step === "encrypting" && "Encrypting bid…"}
                {accept.step === "signing" && "Confirm in wallet…"}
                {accept.step === "confirming" && "Settling on-chain…"}
                {(accept.step === "idle" || accept.step === "error") &&
                  (!takerBuyAuth.isOperator
                    ? `Authorize ${buyTok?.symbol ?? "buy token"} first`
                    : makerSellAuth.isOperator === false
                      ? "Maker not authorized"
                      : "Accept + Settle")}
                {accept.step === "done" && "Settled"}
              </button>
              </form>
            </>
          )}

          {!isOpen && (
            <div className="glass-card p-6">
              <p className="text-sm text-[--color-text-muted]">
                Intent {statusLabel(intent.status).toLowerCase()}
              </p>
            </div>
          )}

          {(() => {
            const isSettled = intent.status === 1 || accept.step === "done";
            const isSettledTaker =
              !!address &&
              !!settledTaker.taker &&
              address.toLowerCase() === settledTaker.taker.toLowerCase();
            const canMint =
              isMaker || accept.step === "done" || isSettledTaker;
            if (!isSettled) return null;
            if (canMint) {
              return (
                <NftReceipt
                  pair={`${TOKEN_NAMES[intent.sellToken.toLowerCase()]?.symbol ?? "?"}/${TOKEN_NAMES[intent.buyToken.toLowerCase()]?.symbol ?? "?"}`}
                  intentId={id}
                  mode="Direct"
                  txHash={accept.txHash ?? undefined}
                  makerAddress={intent.maker}
                  sellHandle={intent.sellAmountHandle}
                  timestamp={Date.now()}
                />
              );
            }
            return (
              <div className="border border-[--color-border] bg-[--color-surface-low]/30 p-4">
                <p className="text-label-caps flex items-center gap-2 text-[--color-text-muted]">
                  <span className="material-symbols-outlined text-base">
                    visibility
                  </span>
                  Read-only view
                </p>
                <p className="mt-2 font-mono text-[11px] text-[--color-text-muted]">
                  This trade has settled. Only the maker or the taker who
                  filled it can mint the on-chain receipt — other observers
                  see the audit trail but not the keepsake.
                </p>
              </div>
            );
          })()}
        </aside>
      </div>
    </AppShell>
  );
}

function DetailField({
  icon,
  label,
  value,
  mono,
  small,
}: {
  icon?: string;
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <span className="material-symbols-outlined mt-0.5 text-base text-[--color-primary]/60">
          {icon}
        </span>
      )}
      <div className="flex-1">
        <dt className="text-label-caps text-[--color-text-muted]">{label}</dt>
        <dd
          className={`mt-1 ${mono ? "font-mono" : ""} ${
            small ? "text-xs" : "text-sm"
          } text-[--color-text]`}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
