"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { NftReceipt } from "@/components/NftReceipt";
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
        <p className="text-label-caps mb-6 flex items-center gap-2 text-[--color-text-muted]">
          <span className="material-symbols-outlined animate-spin text-base text-[--color-primary]">
            sync
          </span>
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
        <p className="text-sm text-[--color-danger]">
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
        className="text-label-caps mb-6 inline-flex items-center gap-1.5 text-[--color-text-muted] hover:text-[--color-primary]"
      >
        <span className="material-symbols-outlined text-base">
          arrow_back
        </span>
        All Intents
      </Link>

      <PageHeader
        icon="gavel"
        title={`RFQ #${id.padStart(4, "0")}`}
        subtitle={`Vickrey auction · ${sellSym} to ${buyTok?.symbol ?? "?"}`}
        badge={
          <span className="text-label-caps flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
            <span className="material-symbols-outlined text-base">hub</span>
            Public RFQ
          </span>
        }
      />


      <Countdown remaining={remaining} expired={isExpired} />

      <div className="mt-6 grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7">
          <div className="glass-card p-6">
            <SectionHeader
              icon="inventory_2"
              title="Sealed Bids"
              right={
                <p
                  className="flex items-center gap-2 text-3xl text-[--color-primary]"
                  data-numeric
                >
                  <span className="material-symbols-outlined">lock</span>
                  {bids.length}
                </p>
              }
            />


            <p className="mb-6 text-[11px] text-[--color-text-muted]">
              Amounts encrypted — only the winner and maker see the price after finalize
            </p>

            {bids.length > 0 ? (
              <ul className="space-y-2 border-t border-[--color-border] pt-4">
                {bids.map((bid, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between border border-[--color-border] bg-[--color-surface-low]/30 p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[--color-text-muted]">
                        #{(i + 1).toString().padStart(2, "0")}
                      </span>
                      <span className="font-mono text-xs">
                        {shortAddress(bid.taker, 6)}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[--color-text-muted]">
                      {bid.handle.slice(0, 14)}…[NOX]
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-[--color-border] pt-6">
                <div className="border border-dashed border-[--color-border] bg-[--color-bg]/40 p-8 text-center">
                  <span
                    className="material-symbols-outlined text-[--color-text-muted]"
                    style={{ fontSize: "1.75rem" }}
                  >
                    inbox
                  </span>
                  <p className="mt-2 text-[11px] text-[--color-text-muted]">
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

              <form onSubmit={onSubmitBid} className="glass-card space-y-4 p-6">
                <p className="text-label-caps flex items-center gap-2 text-[--color-primary]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary]" />
                  Submit Sealed Bid
                </p>
                <p className="text-[11px] leading-relaxed text-[--color-text-muted]">
                  Bid honestly — Vickrey rules guarantee you only pay the
                  second-highest price if you win
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

              {submitBid.error && (
                <div className="border border-[--color-danger] bg-[--color-danger]/10 p-3 text-sm text-[--color-danger]">
                  {submitBid.error}
                </div>
              )}

              {submitBid.step === "done" && (
                <div className="border border-[--color-primary] bg-[--color-primary]/10 p-3 text-sm">
                  <span className="text-[--color-primary]">
                    BID SUBMITTED.
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
                <span
                  className={`material-symbols-outlined text-base ${
                    submitBid.step === "encrypting" ||
                    submitBid.step === "confirming"
                      ? "animate-spin"
                      : ""
                  }`}
                >
                  {submitBid.step === "encrypting" && "enhanced_encryption"}
                  {submitBid.step === "signing" && "draw"}
                  {submitBid.step === "confirming" && "sync"}
                  {(submitBid.step === "idle" ||
                    submitBid.step === "error") &&
                    "lock"}
                  {submitBid.step === "done" && "check_circle"}
                </span>
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
            <div className="glass-card border-l-2 border-l-[--color-primary] p-6">
              <p className="text-label-caps mb-2 text-[--color-primary]">
                Step 1 of 2 · Freeze Auction
              </p>
              <p className="mb-4 text-[11px] leading-relaxed text-[--color-text-muted]">
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
                <span
                  className={`material-symbols-outlined text-base ${
                    finalize.step === "confirming" ? "animate-spin" : ""
                  }`}
                >
                  {finalize.step === "signing" && "draw"}
                  {finalize.step === "confirming" && "sync"}
                  {(finalize.step === "idle" || finalize.step === "error") &&
                    "gavel"}
                  {finalize.step === "done" && "check_circle"}
                </span>
                {finalize.step === "signing" && "Confirm in wallet…"}
                {finalize.step === "confirming" && "Running Vickrey…"}
                {(finalize.step === "idle" || finalize.step === "error") &&
                  "Compute second-price"}
                {finalize.step === "done" && "Frozen — awaiting reveal"}
              </button>
              {finalize.error && (
                <p className="mt-2 font-mono text-[10px] text-[--color-danger]">
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
                <div className="glass-card border-l-2 border-l-amber-400 p-6">
                <p className="text-label-caps mb-2 flex items-center gap-2 text-amber-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Step 2 of 2 · Reveal Winner
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-[--color-text-muted]">
                  Auction frozen. As maker, every bid handle is{" "}
                  <span className="text-amber-600">ACL-allowed</span> for your
                  wallet. Decrypt below to see plaintext amounts, then pick the
                  highest bidder.
                </p>

                {bids.length > 0 ? (
                  <>
                    <button
                      onClick={handleDecryptBids}
                      disabled={!noxReady || decrypting || allDecrypted}
                      className="text-label-caps mb-3 flex w-full items-center justify-center gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-amber-700 transition hover:bg-amber-100 disabled:opacity-40"
                    >
                      <span
                        className={`material-symbols-outlined text-base ${
                          decrypting ? "animate-spin" : ""
                        }`}
                      >
                        {decrypting
                          ? "sync"
                          : allDecrypted
                            ? "check_circle"
                            : "lock_open"}
                      </span>
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
                                ? "border-red-300 bg-red-50"
                                : isHighest
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-[--color-border] bg-[--color-surface-low]/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[10px] text-[--color-text-muted]">
                                #{(i + 1).toString().padStart(2, "0")}
                              </span>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono text-xs">
                                  {shortAddress(bid.taker, 6)}
                                </span>
                                {amount !== undefined ? (
                                  <span
                                    className={`text-[11px] ${
                                      isHighest
                                        ? "text-amber-600"
                                        : "text-[--color-text-secondary]"
                                    }`}
                                  >
                                    {buyTok
                                      ? formatUnits(amount, buyTok.decimals)
                                      : amount.toString()}{" "}
                                    {buyTok?.symbol ?? ""}
                                    {isHighest && " · highest"}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[10px] text-[--color-text-muted]">
                                    {bid.handle.slice(0, 14)}…[encrypted]
                                  </span>
                                )}
                                {bidderOk === false && (
                                  <span className="text-[10px] text-red-600">
                                    Not authorized — would revert
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => reveal.submit(rfqId, BigInt(i))}
                              disabled={
                                !allDecrypted ||
                                !settleReady ||
                                reveal.step === "signing" ||
                                reveal.step === "confirming"
                              }
                              className={`text-label-caps border px-3 py-1.5 transition disabled:opacity-40 ${
                                isHighest
                                  ? "border-amber-300 bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                              }`}
                            >
                              Pick as winner
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="font-mono text-[11px] text-[--color-text-muted]">
                    No bids on this RFQ — nothing to reveal.
                  </p>
                )}

                {reveal.step !== "idle" && (
                  <p className="text-[10px] text-[--color-text-muted]">
                    {reveal.step === "signing" && "Confirm in wallet…"}
                    {reveal.step === "confirming" && "Submitting reveal…"}
                    {reveal.step === "done" && "Winner revealed — settling"}
                    {reveal.step === "error" && (
                      <span className="text-[--color-danger]">
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
            <div className="glass-card border-l-2 border-l-amber-400 p-6">
              <p className="text-label-caps mb-2 flex items-center gap-2 text-amber-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                Awaiting Maker Reveal
              </p>
              <p className="text-[11px] leading-relaxed text-[--color-text-muted]">
                The Vickrey second-price has been computed and is encrypted
                on-chain. The maker is decrypting bid amounts off-chain to
                identify the winner. Settlement triggers automatically once
                they reveal.
              </p>
            </div>
          )}

          {!isOpen && !isPendingReveal && (
            <div className="glass-card p-6">
              <p className="text-sm text-[--color-text-muted]">
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
              <div className="border border-[--color-border] bg-[--color-surface-low]/30 p-4">
                <p className="text-label-caps flex items-center gap-2 text-[--color-text-muted]">
                  <span className="material-symbols-outlined text-base">
                    visibility
                  </span>
                  Read-only view
                </p>
                <p className="mt-2 font-mono text-[11px] text-[--color-text-muted]">
                  Auction settled. Only the maker and the winning bidder
                  can mint the on-chain receipt — other observers see the
                  audit trail only.
                </p>
              </div>
            );
          })()}

          <div className="glass-card border-l-2 border-l-[--color-primary] p-6">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="material-symbols-outlined text-[--color-primary]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <p className="text-label-caps text-[--color-primary]">
                Vickrey Pricing
              </p>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-[--color-text-muted]">
              Highest bid wins. Pays second-highest. All comparisons run inside
              encrypted handles via Nox.gt + Nox.select.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
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
      <div className="border border-orange-200 bg-orange-50 px-4 py-2 text-label-caps text-orange-700">
        Bidding window closed
      </div>
    );
  }
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return (
    <div className="glass-card flex items-center gap-4 px-4 py-3">
      <span className="text-label-caps text-[--color-text-muted]">Closes in</span>
      <span
        className="font-mono text-2xl text-[--color-primary]"
        data-numeric
      >
        {h > 0 && `${h}h `}
        {m.toString().padStart(2, "0")}m {s.toString().padStart(2, "0")}s
      </span>
      <div className="ml-auto h-2 w-2 rounded-full bg-[--color-primary] pulse-soft" />
    </div>
  );
}
