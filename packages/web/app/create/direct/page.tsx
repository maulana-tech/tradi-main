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
import { useCreateIntent } from "@/lib/hooks/useCreateIntent";
import { useSetOperator } from "@/lib/hooks/useSetOperator";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";

const TOKENS = [
  { symbol: "cUSDC", address: CUSDC_ADDRESS, decimals: 6 },
  { symbol: "cETH", address: CETH_ADDRESS, decimals: 18 },
];

const DEADLINE_PRESETS = [
  { label: "1 hour", short: "1H", seconds: 3600 },
  { label: "6 hours", short: "6H", seconds: 6 * 3600 },
  { label: "1 day", short: "1D", seconds: 86400 },
  { label: "1 week", short: "1W", seconds: 7 * 86400 },
];

export default function DirectOtcPage() {
  const { address } = useAccount();
  const { submit, step, error, intentId, txHash } = useCreateIntent();
  const [sellSymbol, setSellSymbol] = useState("cETH");
  const [buySymbol, setBuySymbol] = useState("cUSDC");
  const [sellAmount, setSellAmount] = useState("");
  const [minBuyAmount, setMinBuyAmount] = useState("");
  const [deadline, setDeadline] = useState(3600);
  const [allowedTaker, setAllowedTaker] = useState("");

  const sellToken = TOKENS.find((token) => token.symbol === sellSymbol)!;
  const buyToken = TOKENS.find((token) => token.symbol === buySymbol)!;
  const sellTokenAuth = useSetOperator(sellToken.address, address);
  const busy = step === "encrypting" || step === "signing" || step === "confirming";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submit({
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: parseUnits(sellAmount || "0", sellToken.decimals),
      minBuyAmount: parseUnits(minBuyAmount || "0", buyToken.decimals),
      deadlineSeconds: deadline,
      allowedTaker: allowedTaker ? (allowedTaker as `0x${string}`) : undefined,
    });
  }

  function swapAssets() {
    setSellSymbol(buySymbol);
    setBuySymbol(sellSymbol);
    setSellAmount(minBuyAmount);
    setMinBuyAmount(sellAmount);
  }

  const transactionSteps = buildProgress(step);
  const selectedDeadline = DEADLINE_PRESETS.find((preset) => preset.seconds === deadline)?.label ?? "Custom";

  return (
    <AppShell>
      <PageHeader
        icon="lock"
        title="Create a direct OTC trade"
        subtitle="Set a private minimum and let the first qualifying counterparty settle."
        action={<ModeSwitch active="direct" />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={onSubmit} className="space-y-6">
          <Card className="p-5 sm:p-6">
            <StepHeading number="1" title="Assets and amount" description="Choose what leaves your wallet and the minimum you want back." />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <SelectField label="You sell" value={sellSymbol} onChange={(event) => setSellSymbol(event.target.value)}>
                {TOKENS.map((token) => <option key={token.symbol}>{token.symbol}</option>)}
              </SelectField>
              <Field label="Sell amount" type="number" min="0" step="any" required value={sellAmount} onChange={(event) => setSellAmount(event.target.value)} placeholder="0.00" suffix={sellToken.symbol} inputMode="decimal" />
            </div>

            <div className="my-4 flex justify-center">
              <Button type="button" tone="ghost" size="icon" aria-label="Swap sell and buy assets" onClick={swapAssets}>
                <Icon name="swap_vert" className="size-5" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="You receive" value={buySymbol} onChange={(event) => setBuySymbol(event.target.value)}>
                {TOKENS.map((token) => <option key={token.symbol}>{token.symbol}</option>)}
              </SelectField>
              <Field label="Minimum received" type="number" min="0" step="any" required value={minBuyAmount} onChange={(event) => setMinBuyAmount(event.target.value)} placeholder="0.00" suffix={buyToken.symbol} inputMode="decimal" hint="Encrypted before the transaction is signed." />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <StepHeading number="2" title="Privacy and deadline" description="Limit who can fill the trade and how long it stays open." />
            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-white">Trade expires in</legend>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {DEADLINE_PRESETS.map((preset) => (
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
            <div className="mt-5">
              <Field label="Allowed taker (optional)" type="text" value={allowedTaker} onChange={(event) => setAllowedTaker(event.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" hint="Leave empty for anyone, or enter one wallet address." />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <StepHeading number="3" title="Prepare settlement" description="Authorize the contract to transfer the sell asset only when this trade settles." />
            <div className="mt-6">
              <OperatorAuth token={sellToken.address} account={address} symbol={sellToken.symbol} reason={`Atomic settlement debits ${sellToken.symbol} from your wallet and transfers it to the taker. This permission is required before the intent can be created.`} />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <StepHeading number="4" title="Review and submit" description="Your wallet will first sign the encrypted payload, then broadcast the transaction." />
            <dl className="mt-6 grid gap-4 rounded-2xl bg-[var(--color-surface-low)] p-4 sm:grid-cols-2">
              <Review label="Trade" value={`${sellAmount || "0"} ${sellToken.symbol} → at least ${minBuyAmount || "0"} ${buyToken.symbol}`} />
              <Review label="Deadline" value={selectedDeadline} />
              <Review label="Counterparty" value={allowedTaker || "Open to anyone"} mono={Boolean(allowedTaker)} />
              <Review label="Private terms" value="Amount and minimum encrypted" />
            </dl>

            {error ? <div role="alert" aria-live="assertive" className="mt-5 rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger-text)]">{error} Review the fields and try again.</div> : null}
            {step === "done" && intentId !== null ? (
              <div role="status" className="mt-5 rounded-2xl border border-[var(--color-success)]/40 bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success-text)]">
                Intent #{intentId.toString()} is live. <a href={`https://sepolia.arbiscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">View transaction</a>
              </div>
            ) : null}

            <Button type="submit" className="mt-5 w-full" size="lg" loading={busy} loadingLabel={step === "encrypting" ? "Encrypting terms…" : step === "signing" ? "Confirm in your wallet…" : "Confirming on-chain…"} disabled={step === "done" || !sellTokenAuth.isOperator}>
              {!address ? "Connect wallet to continue" : !sellTokenAuth.isOperator ? `Authorize ${sellToken.symbol} first` : "Create encrypted intent"}
            </Button>
          </Card>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5 sm:p-6">
            <h2 className="font-display text-lg font-medium text-white">Transaction progress</h2>
            <p className="mt-2 text-sm text-pretty text-[var(--color-text-secondary)]">You stay in control through encryption, wallet approval, and confirmation.</p>
            <div className="mt-6"><TransactionProgress steps={transactionSteps} /></div>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-3 text-sm font-semibold text-white"><Icon name="visibility_off" className="size-5 text-[var(--color-primary-text)]" />Private minimum</h2>
            <p className="mt-3 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">Your minimum is never published as plain text. A below-threshold response resolves without revealing why it did not transfer value.</p>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function ModeSwitch({ active }: { active: "direct" | "rfq" }) {
  return (
    <div className="flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      <Link href={"/create/direct" as Route} aria-current={active === "direct" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${active === "direct" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}>Direct</Link>
      <Link href={"/create/rfq" as Route} aria-current={active === "rfq" ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${active === "rfq" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}>RFQ</Link>
    </div>
  );
}

function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 shrink-0 pt-0.5 font-mono text-sm tabular-nums text-[var(--color-primary-text)]">0{number}</span>
      <div><h2 className="font-display text-lg font-medium text-white">{title}</h2><p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">{description}</p></div>
    </div>
  );
}

function Review({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-[var(--color-text-muted)]">{label}</dt><dd className={`mt-1 break-words text-sm text-white ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}

function buildProgress(step: string): TransactionStep[] {
  const order = ["encrypting", "signing", "confirming", "done"];
  const current = order.indexOf(step);
  const stateFor = (index: number): TransactionStep["state"] => {
    if (step === "error" && index === Math.max(current, 0)) return "error";
    if (step === "done" || current > index) return "complete";
    if (current === index) return "active";
    return "pending";
  };
  return [
    { label: "Encrypt private terms", description: "Prepared locally through the encryption gateway.", state: stateFor(0) },
    { label: "Approve in wallet", description: "Review the exact contract interaction.", state: stateFor(1) },
    { label: "Confirm on-chain", description: "Wait for the intent event.", state: stateFor(2) },
  ];
}
