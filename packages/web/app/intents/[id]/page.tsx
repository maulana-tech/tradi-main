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
import { Icon } from "@/components/Icon";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
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
        <p className="text-label-caps mb-6 flex items-center gap-2 text-[var(--color-text-muted)]">
          <Icon name="sync" className="size-4 animate-spin text-[var(--color-primary-text)]" />
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
        <p className="text-sm text-[var(--color-danger)]">
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
        <p className="text-sm text-[var(--color-text-muted)]">
          This is an RFQ auction.{" "}
          <Link
            href={`/rfq/${id}` as Route}
            className="text-[var(--color-primary)] underline"
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
        className="text-label-caps mb-6 inline-flex items-center gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
      >
        <Icon name="arrow_back" className="size-4" />
        All Intents
      </Link>

      <PageHeader
        icon="receipt_long"
        title={`Intent #${id.padStart(4, "0")}`}
        subtitle="Direct OTC · bilateral settlement"
        badge={
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-low)] px-3 text-xs font-medium text-[var(--color-text-secondary)]">
            <Icon name="person" className="size-4" />
            {modeLabel(intent.mode)}
          </span>
        }
      />


      <div className="grid grid-cols-12 gap-6">
        {/* Detail panel */}
        <section className="col-span-12 lg:col-span-7">
          <div className="surface-card p-6">
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

            <div className="mt-6 flex items-center justify-center gap-3 border-t border-[var(--color-border)] pt-6">
              <TokenIcon
                symbol={
                  TOKEN_NAMES[intent.sellToken.toLowerCase()]?.symbol ?? "?"
                }
                size="lg"
              />
              <Icon name="arrow_forward" className="size-6 text-[var(--color-primary-text)]" />
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
            <div className="surface-card p-6">
              <p className="mb-2 text-sm font-semibold text-white">
                Maker Actions
              </p>
              <p className="mb-4 text-sm text-[var(--color-text-muted)]">
                You created this intent
              </p>
              <ConfirmationDialog
                title="Cancel this intent?"
                description="This permanently closes the trade on-chain. Counterparties will no longer be able to accept it."
                confirmLabel="Cancel intent"
                onConfirm={onCancel}
                trigger={
                  <Button
                    tone="danger"
                    className="w-full"
                    loading={cancel.step === "signing" || cancel.step === "confirming"}
                    loadingLabel={cancel.step === "signing" ? "Confirm in wallet…" : "Cancelling…"}
                  >
                    Cancel intent
                  </Button>
                }
              />
              {cancel.error && (
                <p role="alert" className="mt-2 text-sm text-[var(--color-danger-text)]">
                  {cancel.error}
                </p>
              )}
              {cancel.step === "confirming" && cancel.txHash && (
                <a
                  href={`https://sepolia.arbiscan.io/tx/${cancel.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex min-h-11 items-center gap-1 text-sm text-[var(--color-warning-text)] underline"
                >
                  <Icon name="open_in_new" className="size-3.5" />
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

              <form onSubmit={onAccept} className="surface-card space-y-5 p-6">
                <p className="text-label-caps flex items-center gap-2 text-[var(--color-primary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                  Accept + Settle
                </p>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                  Submit your buy amount. Encrypted via Nox. If below the maker's
                  hidden minimum, trade settles as a no-op.
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
                hint="Your bid is encrypted before it is submitted."
                className="font-mono tabular-nums"
              />

              {accept.error && (
                <div role="alert" className="rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger-text)]">
                  {accept.error} Check the permissions above, then retry.
                </div>
              )}

              {/* Tx broadcasting — show link as soon as we have a hash so
                  user has an escape hatch if the receipt watch hangs */}
              {accept.step === "confirming" && accept.txHash && (
                <div className="rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-4 text-sm leading-relaxed text-[var(--color-warning-text)]">
                  <div className="flex items-center gap-2 text-[var(--color-warning-text)]">
                    <Icon name="sync" className="size-4 animate-spin" />
                    <span className="text-label-caps">Settling on-chain</span>
                  </div>
                  <p className="mt-1 text-[var(--color-text-secondary)]">
                    Tx broadcasted. Status updates after Ethereum confirms.
                  </p>
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${accept.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 break-all text-amber-400 underline hover:text-amber-300"
                  >
                    <Icon name="open_in_new" className="size-3.5" />
                    {accept.txHash}
                  </a>
                </div>
              )}

              {accept.step === "done" && (
                <div role="status" className="rounded-2xl border border-[var(--color-success)]/40 bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success-text)]">
                  <span className="font-semibold">Trade settled.</span>{" "}
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

              <Button
                type="submit"
                className="w-full"
                loading={accept.step === "encrypting" || accept.step === "signing" || accept.step === "confirming"}
                loadingLabel={accept.step === "encrypting" ? "Encrypting bid…" : accept.step === "signing" ? "Confirm in wallet…" : "Settling on-chain…"}
                disabled={
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
              >
                {(accept.step === "idle" || accept.step === "error") &&
                  (!takerBuyAuth.isOperator
                    ? `Authorize ${buyTok?.symbol ?? "buy token"} first`
                    : makerSellAuth.isOperator === false
                      ? "Maker not authorized"
                      : "Accept + Settle")}
                {accept.step === "done" && "Settled"}
              </Button>
              </form>
            </>
          )}

          {!isOpen && (
            <div className="surface-card p-6">
              <p className="text-sm text-[var(--color-text-muted)]">
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
              <div className="border border-[var(--color-border)] bg-[var(--color-surface-low)]/30 p-4">
                <p className="text-label-caps flex items-center gap-2 text-[var(--color-text-muted)]">
                  <Icon name="visibility" className="size-4" />
                  Read-only view
                </p>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
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
        <Icon name={icon} className="mt-0.5 size-4 text-[var(--color-primary-text)]" />
      )}
      <div className="flex-1">
        <dt className="text-label-caps text-[var(--color-text-muted)]">{label}</dt>
        <dd
          className={`mt-1 ${mono ? "font-mono" : ""} ${
            small ? "text-xs" : "text-sm"
          } text-[var(--color-text)]`}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
