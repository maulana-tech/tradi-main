"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { NftReceipt } from "@/components/NftReceipt";
import { Icon } from "@/components/Icon";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SkeletonCard } from "@/components/Skeleton";
import { OperatorAuth } from "@/components/OperatorAuth";
import { useSetOperator } from "@/lib/hooks/useSetOperator";
import { useSettledTaker } from "@/lib/hooks/useSettledTaker";
import { privateOtcAbi } from "@/lib/abi/privateOtc";
import { PRIVATE_OTC_ADDRESS, CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { parseAbi } from "viem";
import {
  useSubmitBid,
  useFinalizeRfq,
  useRevealRfqWinner,
} from "@/lib/hooks/useOtcWrites";
import { statusLabel } from "@/lib/hooks/useIntents";
import { shortAddress } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { useNoxClient, decryptUint256 } from "@/lib/nox-client";
import { formatUnits } from "viem";

const TOKEN_NAMES: Record<string, { symbol: string; decimals: number }> = {
  [CUSDC_ADDRESS.toLowerCase()]: { symbol: "cUSDC", decimals: 6 },
  [CETH_ADDRESS.toLowerCase()]: { symbol: "cETH", decimals: 18 },
};

const RFQ_BIDS_ABI = [
  {
    type: "function",
    name: "bids",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
    outputs: [
      { name: "taker", type: "address" },
      { name: "offeredAmount", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

const IS_OPERATOR_ABI = parseAbi([
  "function isOperator(address holder, address spender) view returns (bool)",
]);

export default function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const rfqId = BigInt(id);

  const { address } = useAccount();
  const submitBid = useSubmitBid();
  const finalize = useFinalizeRfq();
  const reveal = useRevealRfqWinner();
  const toast = useToast();

  // Surface tx outcomes via toasts AND refetch on-chain state so UI reflects
  // status transitions (Open → PendingReveal → Filled) without a page reload.
  useEffect(() => {
    if (reveal.step === "done" && reveal.txHash) {
      toast.success("Winner revealed — settlement complete", {
        href: `https://sepolia.arbiscan.io/tx/${reveal.txHash}`,
      });
      intentQuery.refetch();
    } else if (reveal.step === "error" && reveal.error) {
      toast.error(`Reveal failed: ${reveal.error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal.step, reveal.txHash]);

  useEffect(() => {
    if (finalize.step === "done" && finalize.txHash) {
      toast.success("Auction frozen — awaiting maker reveal", {
        href: `https://sepolia.arbiscan.io/tx/${finalize.txHash}`,
      });
      intentQuery.refetch();
    } else if (finalize.step === "error" && finalize.error) {
      toast.error(`Finalize failed: ${finalize.error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalize.step, finalize.txHash]);

  useEffect(() => {
    if (submitBid.step === "done" && submitBid.txHash) {
      toast.success("Sealed bid submitted", {
        href: `https://sepolia.arbiscan.io/tx/${submitBid.txHash}`,
      });
      bidsQuery.refetch();
    } else if (submitBid.step === "error" && submitBid.error) {
      toast.error(`Bid failed: ${submitBid.error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitBid.step, submitBid.txHash]);

  const [bidAmount, setBidAmount] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  // Maker-only bid decryption state. After finalizeRFQ, every bid handle is
  // ACL-allowed for the maker via Nox.allow — we can pull plaintext amounts
  // through the same handle client used for encryption.
  const { ready: noxReady, getClient } = useNoxClient();
  const [decrypted, setDecrypted] = useState<Record<number, bigint>>({});
  const [decrypting, setDecrypting] = useState(false);

  async function handleDecryptBids() {
    if (decrypting) return;
    setDecrypting(true);
    try {
      const client = await getClient();
      if (!client) {
        toast.error("Nox client unavailable");
        return;
      }
      const out: Record<number, bigint> = {};
      for (let i = 0; i < bids.length; i++) {
        try {
          out[i] = await decryptUint256(client, bids[i].handle);
        } catch (err) {
          toast.error(
            `Bid #${i + 1} decryption failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
      setDecrypted(out);
      const total = Object.keys(out).length;
      if (total > 0) {
        toast.success(`Decrypted ${total} bid${total === 1 ? "" : "s"}`);
      }
    } finally {
      setDecrypting(false);
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const intentQuery = useReadContract({
    address: PRIVATE_OTC_ADDRESS,
    abi: privateOtcAbi,
    functionName: "intents",
    args: [rfqId],
  });

  const bidsQuery = useReadContracts({
    contracts: Array.from({ length: 10 }, (_, i) => ({
      address: PRIVATE_OTC_ADDRESS,
      abi: RFQ_BIDS_ABI,
      functionName: "bids" as const,
      args: [rfqId, BigInt(i)] as const,
    })),
    allowFailure: true,
  });

  const bids = (bidsQuery.data ?? [])
    .filter((r) => r.status === "success")
    .map((r) => r.result as readonly [`0x${string}`, `0x${string}`, boolean])
    .map((v) => ({ taker: v[0], handle: v[1], active: v[2] }));

  // Per-bidder: has each bidder authorized PrivateOTC as operator on the
  // buyToken? If not, picking them in revealRFQWinner reverts at
  // _settleAtomic with "TradiNoxCToken: not operator". Maker can't fix this
  // for the bidder — they have to choose an authorized one.
  const buyTokenForRead = ((intentQuery.data as
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
    | undefined)?.[2]) as `0x${string}` | undefined;
  const bidderAuthQuery = useReadContracts({
    contracts: bids.map((b) => ({
      address: buyTokenForRead,
      abi: IS_OPERATOR_ABI,
      functionName: "isOperator" as const,
      args: [b.taker, PRIVATE_OTC_ADDRESS] as const,
    })),
    allowFailure: true,
    query: {
      enabled: !!buyTokenForRead && bids.length > 0,
      refetchInterval: 30_000,
    },
  });
  const bidderAuthorized: (boolean | undefined)[] = bids.map((_, i) => {
    const r = bidderAuthQuery.data?.[i];
    if (!r || r.status !== "success") return undefined;
    return r.result as boolean;
  });

  // Maker reveal needs maker's sellToken authorization. Read up-front
  // (Rules of Hooks: hook order must be stable across renders, can't
  // sit after the early-return loading branch). The hook tolerates
  // undefined inputs via its internal `enabled` guard.
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
  const intentMakerForRead = intentTuple?.[0];
  const intentSellTokenForRead = intentTuple?.[1];
  const isMakerForRead =
    address &&
    intentMakerForRead &&
    address.toLowerCase() === intentMakerForRead.toLowerCase();
  const makerSellAuth = useSetOperator(
    intentSellTokenForRead,
    isMakerForRead ? address : undefined,
  );
  const settledTaker = useSettledTaker(rfqId);

  if (intentQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-label-caps mb-6 flex items-center gap-2 text-[var(--color-text-muted)]">
          <Icon name="sync" className="size-4 animate-spin text-[var(--color-primary-text)]" />
          Loading RFQ #{id}
        </p>
        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-7">
            <SkeletonCard />
          </section>
          <aside className="col-span-12 space-y-4 lg:col-span-5">
            <SkeletonCard />
            <SkeletonCard />
          </aside>
        </div>
      </AppShell>
    );
  }

  if (!intentQuery.data) {
    return (
      <AppShell>
        <p className="text-sm text-[var(--color-danger)]">
          RFQ not found
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
    `0x${string}`, // priceToPay
  ];

  const rfq = {
    maker: v[0],
    sellToken: v[1],
    buyToken: v[2],
    deadline: v[5],
    status: v[6],
  };

  const isOpen = rfq.status === 0;
  const isPendingReveal = rfq.status === 4;
  const isExpired = Number(rfq.deadline) <= now;
  const isMaker = address && address.toLowerCase() === rfq.maker.toLowerCase();
  const buyTok = TOKEN_NAMES[rfq.buyToken.toLowerCase()];
  const sellTok = TOKEN_NAMES[rfq.sellToken.toLowerCase()];
  const sellSym = sellTok?.symbol ?? shortAddress(rfq.sellToken);

  const remaining = Number(rfq.deadline) - now;

  async function onSubmitBid(e: React.FormEvent) {
    e.preventDefault();
    if (!buyTok) return;
    await submitBid.submit(
      rfqId,
      parseUnits(bidAmount || "0", buyTok.decimals),
    );
  }

  return (
    <AppShell>
      <Link
        href={"/intents" as Route}
        className="text-label-caps mb-6 inline-flex items-center gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
      >
        <Icon name="arrow_back" className="size-4" />
        All Intents
      </Link>

      <PageHeader
        icon="gavel"
        title={`RFQ #${id.padStart(4, "0")}`}
        subtitle={`Vickrey auction · ${sellSym} to ${buyTok?.symbol ?? "?"}`}
        badge={
          <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] px-3 text-xs font-medium text-[var(--color-primary-text)]">
            <Icon name="hub" className="size-4" />
            Public RFQ
          </span>
        }
      />


      <Countdown remaining={remaining} expired={isExpired} />

      <div className="mt-6 grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7">
          <div className="surface-card p-6">
            <SectionHeader
              icon="inventory_2"
              title="Sealed Bids"
              right={
                <p
                  className="flex items-center gap-2 text-3xl text-[var(--color-primary)]"
                  data-numeric
                >
                  <Icon name="lock" className="size-5" />
                  {bids.length}
                </p>
              }
            />


            <p className="mb-6 text-sm text-[var(--color-text-muted)]">
              Amounts encrypted — only the winner and maker see the price after finalize
            </p>

            {bids.length > 0 ? (
              <ul className="space-y-2 border-t border-[var(--color-border)] pt-4">
                {bids.map((bid, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between border border-[var(--color-border)] bg-[var(--color-surface-low)]/30 p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">
                        #{(i + 1).toString().padStart(2, "0")}
                      </span>
                      <span className="font-mono text-xs">
                        {shortAddress(bid.taker, 6)}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[var(--color-text-muted)]">
                      {bid.handle.slice(0, 14)}…[NOX]
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-[var(--color-border)] pt-6">
                <div className="py-8 text-center">
                  <Icon name="inbox" className="mx-auto size-7 text-[var(--color-text-muted)]" />
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                    {isOpen && !isExpired
                      ? "No bids yet — be the first to seal a bid"
                      : "No bids received"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-5">
          {!isMaker && isOpen && !isExpired && (
            <>
              <OperatorAuth
                token={rfq.buyToken}
                account={address}
                symbol={buyTok?.symbol ?? "buy token"}
                reason={`If you win this Vickrey auction, settlement pulls ${buyTok?.symbol ?? "your buy token"} from your wallet to the maker. Tradi-Nox needs operator permission on this cToken first — one-time, lasts 60 days.`}
              />

              <form onSubmit={onSubmitBid} className="surface-card space-y-5 p-6">
                <p className="text-label-caps flex items-center gap-2 text-[var(--color-primary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                  Submit Sealed Bid
                </p>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                  Bid honestly — Vickrey rules guarantee you only pay the
                  second-highest price if you win
                </p>

              <Field
                label="Your bid"
                type="number"
                step="any"
                min="0"
                required
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                suffix={buyTok?.symbol ?? ""}
                hint="Your bid remains sealed until the auction is finalized."
                className="font-mono tabular-nums"
              />

              {submitBid.error && (
                <div role="alert" className="rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger-text)]">
                  {submitBid.error} Check your wallet and retry.
                </div>
              )}

              {submitBid.step === "done" && (
                <div role="status" className="rounded-2xl border border-[var(--color-success)]/40 bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success-text)]">
                  <span className="font-semibold">
                    Bid submitted.
                  </span>{" "}
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${submitBid.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Tx →
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  submitBid.step === "encrypting" ||
                  submitBid.step === "signing" ||
                  submitBid.step === "confirming" ||
                  submitBid.step === "done"
                }
                title={
                  submitBid.step === "done"
                    ? "Bid already submitted — wait for auction to close"
                    : undefined
                }
                className="tradi-nox-btn-primary flex w-full items-center justify-center gap-2 py-4 text-sm"
              >
                <Icon name={actionIcon(submitBid.step, "lock")} className={`size-4 ${submitBid.step === "encrypting" || submitBid.step === "confirming" ? "animate-spin" : ""}`} />
                {submitBid.step === "encrypting" && "Encrypting bid…"}
                {submitBid.step === "signing" && "Confirm in wallet…"}
                {submitBid.step === "confirming" && "Submitting…"}
                {(submitBid.step === "idle" || submitBid.step === "error") &&
                  "Submit Sealed Bid"}
                {submitBid.step === "done" && "Bid submitted"}
              </button>
              </form>
            </>
          )}

          {isOpen && isExpired && bids.length >= 2 && (
            <div className="surface-card border-l-2 border-l-[var(--color-primary)] p-6">
              <p className="text-label-caps mb-2 text-[var(--color-primary)]">
                Step 1 of 2 · Freeze Auction
              </p>
              <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
                Bidding closed. Compute the encrypted second-price via Vickrey,
                then reveal the winning bid in step 2.
              </p>
              <button
                onClick={() => finalize.submit(rfqId)}
                disabled={
                  finalize.step === "signing" || finalize.step === "confirming"
                }
                className="tradi-nox-btn-primary flex w-full items-center justify-center gap-2 py-4 text-sm"
              >
                <Icon name={actionIcon(finalize.step, "gavel")} className={`size-4 ${finalize.step === "confirming" ? "animate-spin" : ""}`} />
                {finalize.step === "signing" && "Confirm in wallet…"}
                {finalize.step === "confirming" && "Running Vickrey…"}
                {(finalize.step === "idle" || finalize.step === "error") &&
                  "Compute second-price"}
                {finalize.step === "done" && "Frozen — awaiting reveal"}
              </button>
              {finalize.error && (
                <p role="alert" className="mt-2 text-sm text-[var(--color-danger-text)]">
                  {finalize.error}
                </p>
              )}
            </div>
          )}

          {/* Step 2 — maker-only reveal panel */}
          {isPendingReveal && isMaker && (() => {
            const decryptedCount = Object.keys(decrypted).length;
            const allDecrypted =
              bids.length > 0 && decryptedCount === bids.length;
            const highestIdx = allDecrypted
              ? bids
                  .map((_, i) => i)
                  .reduce((best, i) =>
                    (decrypted[i] ?? 0n) > (decrypted[best] ?? 0n) ? i : best,
                  )
              : -1;

            return (
              <>
                <OperatorAuth
                  token={rfq.sellToken}
                  account={address}
                  symbol={sellSym}
                  reason={`Reveal settlement debits ${sellSym} from your wallet to the winning bidder. Tradi-Nox needs operator permission first.`}
                />
                <div className="surface-card border-l-2 border-l-amber-400 p-6">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-warning-text)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Step 2 of 2 · Reveal Winner
                </p>
                <p className="mb-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
                  Auction frozen. As maker, every bid handle is{" "}
                  <span className="text-[var(--color-warning-text)]">ACL-allowed</span> for your
                  wallet. Decrypt below to see plaintext amounts, then pick the
                  highest bidder.
                </p>

                {bids.length > 0 ? (
                  <>
                    <button
                      onClick={handleDecryptBids}
                      disabled={!noxReady || decrypting || allDecrypted}
                      className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-3 text-sm font-semibold text-[var(--color-warning-text)] transition-colors duration-150 hover:border-[var(--color-warning)] disabled:opacity-40"
                    >
                      <Icon name={decrypting ? "sync" : allDecrypted ? "check_circle" : "lock_open"} className={`size-4 ${decrypting ? "animate-spin" : ""}`} />
                      {decrypting
                        ? "Decrypting…"
                        : allDecrypted
                          ? `${decryptedCount} bids decrypted`
                          : !noxReady
                            ? "Wallet not ready"
                            : `Decrypt ${bids.length} bid${bids.length === 1 ? "" : "s"} via Nox`}
                    </button>

                    <ul className="mb-4 space-y-2">
                      {bids.map((bid, i) => {
                        const amount = decrypted[i];
                        const isHighest = i === highestIdx;
                        const bidderOk = bidderAuthorized[i];
                        const settleReady =
                          bidderOk === true && makerSellAuth.isOperator;
                        return (
                          <li
                            key={i}
                            className={`flex items-center justify-between border p-3 transition ${
                              bidderOk === false
                                ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]"
                                : isHighest
                                  ? "border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]"
                                  : "border-[var(--color-border)] bg-[var(--color-surface-low)]/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs text-[var(--color-text-muted)]">
                                #{(i + 1).toString().padStart(2, "0")}
                              </span>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono text-xs">
                                  {shortAddress(bid.taker, 6)}
                                </span>
                                {amount !== undefined ? (
                                  <span
                                    className={`text-xs ${
                                      isHighest
                                        ? "text-[var(--color-warning-text)]"
                                        : "text-[var(--color-text-secondary)]"
                                    }`}
                                  >
                                    {buyTok
                                      ? formatUnits(amount, buyTok.decimals)
                                      : amount.toString()}{" "}
                                    {buyTok?.symbol ?? ""}
                                    {isHighest && " · highest"}
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-[var(--color-text-muted)]">
                                    {bid.handle.slice(0, 14)}…[encrypted]
                                  </span>
                                )}
                                {bidderOk === false && (
                                  <span className="text-xs text-[var(--color-danger-text)]">
                                    Not authorized — would revert
                                  </span>
                                )}
                              </div>
                            </div>
                            <ConfirmationDialog
                              title={`Set bidder ${i + 1} as the winner?`}
                              description="This reveals the winning bid and starts atomic settlement. The selection cannot be changed after confirmation."
                              confirmLabel="Reveal and settle"
                              confirmTone="primary"
                              onConfirm={() => reveal.submit(rfqId, BigInt(i))}
                              trigger={
                                <Button
                                  size="sm"
                                  tone={isHighest ? "primary" : "secondary"}
                                  disabled={
                                    !allDecrypted ||
                                    !settleReady ||
                                    reveal.step === "signing" ||
                                    reveal.step === "confirming"
                                  }
                                >
                                  Pick as winner
                                </Button>
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No bids on this RFQ — nothing to reveal.
                  </p>
                )}

                {reveal.step !== "idle" && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {reveal.step === "signing" && "Confirm in wallet…"}
                    {reveal.step === "confirming" && "Submitting reveal…"}
                    {reveal.step === "done" && "Winner revealed — settling"}
                    {reveal.step === "error" && (
                      <span className="text-[var(--color-danger)]">
                        {reveal.error}
                      </span>
                    )}
                  </p>
                )}
                </div>
              </>
            );
          })()}

          {/* Non-maker view of PendingReveal — informational */}
          {isPendingReveal && !isMaker && (
            <div className="surface-card border-l-2 border-l-amber-400 p-6">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-warning-text)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Awaiting Maker Reveal
              </p>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                The Vickrey second-price has been computed and is encrypted
                on-chain. The maker is decrypting bid amounts off-chain to
                identify the winner. Settlement triggers automatically once
                they reveal.
              </p>
            </div>
          )}

          {!isOpen && !isPendingReveal && (
            <div className="surface-card p-6">
              <p className="text-sm text-[var(--color-text-muted)]">
                RFQ {statusLabel(rfq.status).toLowerCase()}
              </p>
            </div>
          )}

          {(() => {
            const isSettled = rfq.status === 1 || reveal.step === "done";
            const isWinner =
              !!address &&
              !!settledTaker.taker &&
              address.toLowerCase() === settledTaker.taker.toLowerCase();
            const canMint = isMaker || reveal.step === "done" || isWinner;
            if (!isSettled) return null;
            if (canMint) {
              return (
                <NftReceipt
                  pair={`${sellSym}/${buyTok?.symbol ?? "?"}`}
                  intentId={id}
                  mode="RFQ"
                  txHash={reveal.txHash ?? finalize.txHash ?? undefined}
                  makerAddress={rfq.maker}
                  timestamp={Date.now()}
                />
              );
            }
            return (
              <div className="border border-[var(--color-border)] bg-[var(--color-surface-low)]/30 p-4">
                <p className="text-label-caps flex items-center gap-2 text-[var(--color-text-muted)]">
                  <Icon name="visibility" className="size-4" />
                  Read-only view
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Auction settled. Only the maker and the winning bidder
                  can mint the on-chain receipt — other observers see the
                  audit trail only.
                </p>
              </div>
            );
          })()}

          <div className="surface-card border-l-2 border-l-[var(--color-primary)] p-6">
            <div className="mb-3 flex items-center gap-3">
              <Icon name="verified" className="size-5 text-[var(--color-primary-text)]" />
              <p className="text-label-caps text-[var(--color-primary)]">
                Vickrey Pricing
              </p>
            </div>
            <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
              Highest bid wins. Pays second-highest. All comparisons run inside
              encrypted handles via Nox.gt + Nox.select.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function actionIcon(step: string, idleIcon: string) {
  if (step === "encrypting") return "enhanced_encryption";
  if (step === "signing") return "draw";
  if (step === "confirming") return "sync";
  if (step === "done") return "check_circle";
  return idleIcon;
}

function Countdown({
  remaining,
  expired,
}: {
  remaining: number;
  expired: boolean;
}) {
  if (expired) {
    return (
      <div className="rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-4 py-3 text-sm font-medium text-[var(--color-warning-text)]">
        Bidding window closed
      </div>
    );
  }
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return (
    <div className="surface-card flex items-center gap-4 px-4 py-3">
      <span className="text-label-caps text-[var(--color-text-muted)]">Closes in</span>
      <span
        className="font-mono text-2xl tabular-nums text-white"
        data-numeric
      >
        {h > 0 && `${h}h `}
        {m.toString().padStart(2, "0")}m {s.toString().padStart(2, "0")}s
      </span>
      <div className="ml-auto h-2 w-2 rounded-full bg-[var(--color-primary)]" />
    </div>
  );
}
