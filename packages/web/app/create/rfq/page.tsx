"use client";

import Link from "next/link";
import { useState } from "react";
import type { Route } from "next";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/Tooltip";
import { OperatorAuth } from "@/components/OperatorAuth";
import { useCreateRfq } from "@/lib/hooks/useOtcWrites";
import { useSetOperator } from "@/lib/hooks/useSetOperator";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";

const TOKENS = [
  { symbol: "cUSDC", address: CUSDC_ADDRESS, decimals: 6 },
  { symbol: "cETH", address: CETH_ADDRESS, decimals: 18 },
];

const WINDOW_PRESETS = [
  { label: "30M", seconds: 30 * 60 },
  { label: "1H", seconds: 3600 },
  { label: "6H", seconds: 6 * 3600 },
  { label: "1D", seconds: 86400 },
];

export default function RfqCreatePage() {
  const { address } = useAccount();
  const { submit, step, error, intentId, txHash } = useCreateRfq();

  const [sellSymbol, setSellSymbol] = useState("cETH");
  const [buySymbol, setBuySymbol] = useState("cUSDC");
  const [sellAmount, setSellAmount] = useState("");
  const [deadline, setDeadline] = useState(3600);

  const sellTok = TOKENS.find((t) => t.symbol === sellSymbol)!;
  const buyTok = TOKENS.find((t) => t.symbol === buySymbol)!;

  // Maker authorizes sellToken — winner of the auction can't settle if this
  // is missing (revealRFQWinner reverts at _settleAtomic).
  const sellTokenAuth = useSetOperator(sellTok.address, address);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit({
      sellToken: sellTok.address,
      buyToken: buyTok.address,
      sellAmount: parseUnits(sellAmount || "0", sellTok.decimals),
      biddingDeadlineSeconds: deadline,
    });
  }

  const busy =
    step === "encrypting" || step === "signing" || step === "confirming";

  return (
    <AppShell>
      <PageHeader
        icon="hub"
        title="RFQ Auction"
        subtitle="Sealed-bid Vickrey auction with encrypted bids"
        action={
          <div className="flex border border-[--color-border] bg-[--color-surface-low] p-1">
            <Link
              href={"/create/direct" as Route}
              className="text-label-caps flex items-center gap-1.5 px-4 py-2 text-[--color-text-muted] hover:text-[--color-text]"
            >
              <span className="material-symbols-outlined text-base">
                swap_horiz
              </span>
              Direct
            </Link>
            <span className="text-label-caps flex items-center gap-1.5 bg-[--color-primary] px-4 py-2 text-[--color-primary-fg]">
              <span className="material-symbols-outlined text-base">hub</span>
              RFQ
            </span>
          </div>
        }
      />


      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-7">
          <div className="glass-card p-6">
            <SectionHeader icon="gavel" title="Open Auction" />

            <div className="mb-6">
              <OperatorAuth
                token={sellTok.address}
                account={address}
                symbol={sellTok.symbol}
                reason={`When you reveal the winning bidder, settlement debits ${sellTok.symbol} from your wallet to them. Tradi-Nox needs operator permission first — without it, reveal will revert.`}
              />
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-label-caps text-[--color-text-muted]">
                    Sell Token
                  </label>
                  <div className="relative">
                    <select
                      value={sellSymbol}
                      onChange={(e) => setSellSymbol(e.target.value)}
                      className="tradi-nox-input appearance-none pr-10"
                    >
                      {TOKENS.map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-3 text-[--color-text-muted]">
                      expand_more
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-label-caps text-[--color-text-muted]">
                    Buy Token
                  </label>
                  <div className="relative">
                    <select
                      value={buySymbol}
                      onChange={(e) => setBuySymbol(e.target.value)}
                      className="tradi-nox-input appearance-none pr-10"
                    >
                      {TOKENS.map((t) => (
                        <option key={t.symbol} value={t.symbol}>
                          {t.symbol}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-3 top-3 text-[--color-text-muted]">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-label-caps text-[--color-text-muted]">
                    Sell Amount
                  </label>
                  <span className="font-mono text-[9px] uppercase text-[--color-primary]">
                    ENCRYPTED
                  </span>
                </div>
                <div className="flex border border-[--color-border] bg-[--color-bg] focus-within:border-[--color-primary]">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent px-3 py-2 font-mono text-sm focus:outline-none"
                    data-numeric
                  />
                  <span className="grid place-items-center px-3 text-label-caps text-[--color-text-muted]">
                    {sellTok.symbol}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[--color-text-muted]">
                  Takers see the asset pair — not the size
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-label-caps text-[--color-text-muted]">
                  Bidding Window
                </label>
                <div className="flex gap-2">
                  {WINDOW_PRESETS.map((p) => (
                    <button
                      key={p.seconds}
                      type="button"
                      onClick={() => setDeadline(p.seconds)}
                      className={`text-label-caps border px-4 py-2 transition-all ${
                        deadline === p.seconds
                          ? "border-[--color-primary] bg-[--color-primary]/10 text-[--color-primary]"
                          : "border-[--color-border] text-[--color-text-muted] hover:border-[--color-primary]/40"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="border border-[--color-danger] bg-[--color-danger]/10 p-3 text-sm text-[--color-danger]">
                  {error}
                </div>
              )}

              {step === "done" && intentId !== null && (
                <div className="border border-[--color-primary] bg-[--color-primary]/10 p-3 text-sm">
                  <span className="text-[--color-primary]">
                    RFQ #{intentId.toString()} opened.
                  </span>{" "}
                  <Link
                    href={`/rfq/${intentId.toString()}` as Route}
                    className="underline"
                  >
                    View RFQ →
                  </Link>{" "}
                  ·{" "}
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Tx
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || step === "done" || !sellTokenAuth.isOperator}
                title={
                  step === "done"
                    ? "Already broadcast — see the link above to view the RFQ"
                    : !sellTokenAuth.isOperator && address
                      ? `Authorize Tradi-Nox for ${sellTok.symbol} above first`
                      : undefined
                }
                className="tradi-nox-btn-primary flex w-full items-center justify-center gap-2 py-4 text-sm"
              >
                <span
                  className={`material-symbols-outlined text-base ${
                    busy ? "animate-spin" : ""
                  }`}
                >
                  {step === "encrypting" && "enhanced_encryption"}
                  {step === "signing" && "draw"}
                  {step === "confirming" && "sync"}
                  {(step === "idle" || step === "error") && "gavel"}
                  {step === "done" && "check_circle"}
                </span>
                {step === "encrypting" && "Encrypting…"}
                {step === "signing" && "Confirm in wallet…"}
                {step === "confirming" && "Opening on-chain…"}
                {(step === "idle" || step === "error") &&
                  (!sellTokenAuth.isOperator && address
                    ? `Authorize ${sellTok.symbol} first`
                    : "Open Auction")}
                {step === "done" && "Auction opened"}
              </button>
            </form>
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-5">
          <div className="glass-card border-l-2 border-l-[--color-primary] p-6">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="material-symbols-outlined text-[--color-primary]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <p className="text-label-caps flex items-center gap-1.5 text-[--color-primary]">
                Vickrey Auction
                <HelpHint content="Nobel-winning sealed-bid auction. Highest bidder wins but pays the second-highest price. Mathematically optimal: bidders' best strategy is to bid their true valuation. No incentive to lie." />
              </p>
            </div>
            <p className="text-sm text-[--color-text]">
              Highest sealed bid wins. Winner pays{" "}
              <span className="font-mono text-[--color-primary]">
                second-highest
              </span>{" "}
              price.
            </p>
            <p className="mt-3 text-sm text-[--color-text]">
              Mathematically optimal for sellers — bidders are incentivized to
              bid their true valuation.
            </p>
          </div>

          <div className="glass-card p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[--color-border] bg-[--color-surface-low]/50 px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[--color-text-muted]">
                  code
                </span>
                <span className="text-xs text-[--color-text-secondary]">
                  Vickrey algorithm
                </span>
              </div>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[--color-text-secondary]">
                <code>{`for (uint i = 1; i < bids.length; i++) {
  ebool isHigher = Nox.gt(candidate, highest);
  second  = Nox.select(isHigher, highest, second);
  highest = Nox.select(isHigher, candidate, highest);
}
priceToPay = second;  // encrypted`}</code>
              </pre>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[--color-text-muted]">
                <span className="material-symbols-outlined text-xs text-[--color-primary]">
                  info
                </span>
                All comparisons run inside encrypted handles. Max 10 bidders.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
