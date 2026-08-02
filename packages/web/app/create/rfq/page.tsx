"use client";

import Link from "next/link";
import { useState } from "react";
import type { Route } from "next";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { OperatorAuth } from "@/components/OperatorAuth";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, SelectField } from "@/components/ui/Field";
import { TransactionProgress, type TransactionStep } from "@/components/ui/TransactionProgress";
import { useCreateRfq } from "@/lib/hooks/useOtcWrites";
import { useSetOperator } from "@/lib/hooks/useSetOperator";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";

const TOKENS = [
  { symbol: "cUSDC", address: CUSDC_ADDRESS, decimals: 6 },
  { symbol: "cETH", address: CETH_ADDRESS, decimals: 18 },
];

const WINDOW_PRESETS = [
  { label: "30 minutes", short: "30M", seconds: 30 * 60 },
  { label: "1 hour", short: "1H", seconds: 3600 },
  { label: "6 hours", short: "6H", seconds: 6 * 3600 },
  { label: "1 day", short: "1D", seconds: 86400 },
];

export default function RfqCreatePage() {
  const { address } = useAccount();
  const { submit, step, error, intentId, txHash } = useCreateRfq();
  const [sellSymbol, setSellSymbol] = useState("cETH");
  const [buySymbol, setBuySymbol] = useState("cUSDC");
  const [sellAmount, setSellAmount] = useState("");
  const [deadline, setDeadline] = useState(3600);

  const sellToken = TOKENS.find((token) => token.symbol === sellSymbol)!;
  const buyToken = TOKENS.find((token) => token.symbol === buySymbol)!;
  const sellTokenAuth = useSetOperator(sellToken.address, address);
  const busy = step === "encrypting" || step === "signing" || step === "confirming";
  const selectedWindow = WINDOW_PRESETS.find((preset) => preset.seconds === deadline)?.label ?? "Custom";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit({
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: parseUnits(sellAmount || "0", sellToken.decimals),
      biddingDeadlineSeconds: deadline,
    });
  }

  return (
    <AppShell>
      <PageHeader
        icon="gavel"
        title="Open a sealed RFQ"
        subtitle="Collect encrypted bids and settle at the second-highest price."
        action={<ModeSwitch />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={onSubmit} className="space-y-6">
          <Card className="p-5 sm:p-6">
            <StepHeading number="1" title="Assets and amount" description="Bidders see the pair, while your trade size stays encrypted." />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <SelectField label="You sell" value={sellSymbol} onChange={(event) => setSellSymbol(event.target.value)}>
                {TOKENS.map((token) => <option key={token.symbol}>{token.symbol}</option>)}
              </SelectField>
              <SelectField label="You receive" value={buySymbol} onChange={(event) => setBuySymbol(event.target.value)}>
                {TOKENS.map((token) => <option key={token.symbol}>{token.symbol}</option>)}
              </SelectField>
            </div>
            <div className="mt-5">
              <Field label="Sell amount" type="number" min="0" step="any" required value={sellAmount} onChange={(event) => setSellAmount(event.target.value)} placeholder="0.00" suffix={sellToken.symbol} inputMode="decimal" hint="Encrypted before your wallet signs the RFQ transaction." />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <StepHeading number="2" title="Bidding window" description="Choose how long counterparties have to submit sealed bids." />
            <fieldset className="mt-6">
              <legend className="sr-only">Bidding window</legend>
              <div className="grid grid-cols-4 gap-2">
                {WINDOW_PRESETS.map((preset) => (
                  <button
                    key={preset.seconds}
                    type="button"
                    aria-pressed={deadline === preset.seconds}
                    onClick={() => setDeadline(preset.seconds)}
                    className={`min-h-11 rounded-full border px-3 text-sm font-semibold transition-colors duration-150 ${deadline === preset.seconds ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-white" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-white"}`}
                  >
                    {preset.short}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card className="p-5 sm:p-6">
            <StepHeading number="3" title="Prepare settlement" description="Authorize the contract before bidders commit funds." />
            <div className="mt-6">
              <OperatorAuth token={sellToken.address} account={address} symbol={sellToken.symbol} reason={`When the winning bid is revealed, atomic settlement debits ${sellToken.symbol} from your wallet. Authorize Tradi-Nox now so the winner cannot be blocked later.`} />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <StepHeading number="4" title="Review and open RFQ" description="Your wallet signs the encrypted size, then opens the bidding window on-chain." />
            <dl className="mt-6 grid gap-4 rounded-2xl bg-[var(--color-surface-low)] p-4 sm:grid-cols-2">
              <Review label="Pair" value={`${sellToken.symbol} → ${buyToken.symbol}`} />
              <Review label="Encrypted size" value={`${sellAmount || "0"} ${sellToken.symbol}`} />
              <Review label="Bidding window" value={selectedWindow} />
              <Review label="Settlement price" value="Second-highest sealed bid" />
            </dl>

            {error ? <div role="alert" aria-live="assertive" className="mt-5 rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger-text)]">{error} Review the fields and try again.</div> : null}
            {step === "done" && intentId !== null ? (
              <div role="status" className="mt-5 rounded-2xl border border-[var(--color-success)]/40 bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success-text)]">
                RFQ #{intentId.toString()} is accepting bids. <Link href={`/rfq/${intentId}` as Route} className="font-semibold underline underline-offset-4">View RFQ</Link>{" · "}<a href={`https://sepolia.arbiscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">Transaction</a>
              </div>
            ) : null}

            <Button type="submit" className="mt-5 w-full" size="lg" loading={busy} loadingLabel={step === "encrypting" ? "Encrypting size…" : step === "signing" ? "Confirm in your wallet…" : "Opening RFQ on-chain…"} disabled={step === "done" || !sellTokenAuth.isOperator}>
              {!address ? "Connect wallet to continue" : !sellTokenAuth.isOperator ? `Authorize ${sellToken.symbol} first` : "Open sealed RFQ"}
            </Button>
          </Card>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-medium text-white">Transaction progress</h2>
            <p className="mt-2 text-sm text-pretty text-[var(--color-text-secondary)]">Sensitive size data is encrypted before the wallet transaction begins.</p>
            <div className="mt-6"><TransactionProgress steps={buildProgress(step)} /></div>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-3 text-sm font-semibold text-white"><Icon name="verified" className="size-5 text-[var(--color-primary-text)]" />Vickrey pricing</h2>
            <p className="mt-3 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">The highest bidder wins but pays the second-highest bid. Bidders are encouraged to submit what the trade is really worth to them.</p>
            <details className="mt-4 border-t border-[var(--color-border)] pt-4">
              <summary className="min-h-11 content-center text-sm font-semibold text-white">How encrypted selection works</summary>
              <p className="pb-2 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">The contract compares Nox encrypted handles without revealing individual bids. RFQs are capped at 10 bidders to keep settlement gas predictable.</p>
            </details>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function ModeSwitch() {
  return (
    <div className="flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      <Link href={"/create/direct" as Route} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-[var(--color-text-secondary)]">Direct</Link>
      <Link href={"/create/rfq" as Route} aria-current="page" className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-primary)] px-4 text-sm font-semibold text-white">RFQ</Link>
    </div>
  );
}

function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex items-start gap-3"><span className="w-8 shrink-0 pt-0.5 font-mono text-sm tabular-nums text-[var(--color-primary-text)]">0{number}</span><div><h2 className="font-display text-lg font-medium text-white">{title}</h2><p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">{description}</p></div></div>;
}

function Review({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-[var(--color-text-muted)]">{label}</dt><dd className="mt-1 text-sm text-white">{value}</dd></div>;
}

function buildProgress(step: string): TransactionStep[] {
  const order = ["encrypting", "signing", "confirming", "done"];
  const current = order.indexOf(step);
  const stateFor = (index: number): TransactionStep["state"] => {
    if (step === "error" && index === 0) return "error";
    if (step === "done" || current > index) return "complete";
    if (current === index) return "active";
    return "pending";
  };
  return [
    { label: "Encrypt trade size", description: "Create the Nox encrypted handle.", state: stateFor(0) },
    { label: "Approve in wallet", description: "Review the RFQ transaction.", state: stateFor(1) },
    { label: "Open bidding", description: "Wait for on-chain confirmation.", state: stateFor(2) },
  ];
}
