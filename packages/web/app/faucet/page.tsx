"use client";

import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TokenIcon } from "@/components/TokenIcon";
import { OperatorAuth } from "@/components/OperatorAuth";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { TransactionProgress, type TransactionStep } from "@/components/ui/TransactionProgress";
import { useFaucet } from "@/lib/hooks/useFaucet";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { cn } from "@/lib/utils";

const TOKENS = [
  { symbol: "cUSDC", address: CUSDC_ADDRESS, decimals: 6, defaultMint: "10000" },
  { symbol: "cETH", address: CETH_ADDRESS, decimals: 18, defaultMint: "10" },
];

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const { mint, step, error, txHash } = useFaucet();
  const [selected, setSelected] = useState(TOKENS[0]);
  const [amount, setAmount] = useState(TOKENS[0].defaultMint);
  const busy = step === "encrypting" || step === "signing" || step === "confirming";

  async function onMint(event: React.FormEvent) {
    event.preventDefault();
    await mint(selected.address, parseUnits(amount || "0", selected.decimals));
  }

  return (
    <AppShell>
      <PageHeader icon="water_drop" title="Testnet funds" subtitle="Mint confidential assets, authorize settlement, then create your first private trade." />
      {!isConnected || !address ? (
        <EmptyState icon="account_circle_off" title="Connect a wallet to request funds" body="Use the wallet action in the header and make sure you are on Ethereum Sepolia." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <StepHeading number="01" title="Mint confidential assets" description="These tokens are for the Sepolia demo only and have no real-world value." />
              <form onSubmit={onMint} className="mt-6 space-y-6">
                <fieldset>
                  <legend className="text-sm font-medium text-white">Choose a token</legend>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {TOKENS.map((token) => (
                      <button key={token.symbol} type="button" aria-pressed={selected.symbol === token.symbol} onClick={() => { setSelected(token); setAmount(token.defaultMint); }} className={cn("flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition-colors duration-150", selected.symbol === token.symbol ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-[var(--color-surface-low)] hover:border-[var(--color-border-strong)]")}>
                        <TokenIcon symbol={token.symbol} size="sm" /><span><span className="block text-sm font-semibold text-white">{token.symbol}</span><span className="mt-1 block font-mono text-xs text-[var(--color-text-muted)]">{token.address.slice(0, 6)}…{token.address.slice(-4)}</span></span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <Field label="Amount" type="number" step="any" min="0" required value={amount} onChange={(event) => setAmount(event.target.value)} suffix={selected.symbol} inputMode="decimal" hint="The amount is encrypted before it is submitted on-chain." />
                {error ? <div role="alert" aria-live="assertive" className="rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger-text)]">{error} Check your wallet and retry.</div> : null}
                {step === "done" ? (
                  <div role="status" className="rounded-2xl border border-[var(--color-success)]/40 bg-[var(--color-success-soft)] p-4 text-sm text-[var(--color-success-text)]">Minted {amount} {selected.symbol}. <a href={`https://sepolia.arbiscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">View transaction</a></div>
                ) : null}
                <Button type="submit" className="w-full" size="lg" loading={busy} loadingLabel={step === "encrypting" ? "Encrypting amount…" : step === "signing" ? "Confirm in your wallet…" : "Minting on-chain…"} disabled={step === "done"}>{step === "done" ? "Funds minted" : `Mint ${amount} ${selected.symbol}`}</Button>
              </form>
            </Card>

            <Card className="p-5 sm:p-6">
              <StepHeading number="02" title="Prepare settlement" description="Authorize each asset you plan to send in a trade. This is separate from minting." />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <OperatorAuth token={CUSDC_ADDRESS} account={address} symbol="cUSDC" compact />
                <OperatorAuth token={CETH_ADDRESS} account={address} symbol="cETH" compact />
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <StepHeading number="03" title="Start trading" description="Decrypt your new balance in Portfolio, or go straight to creating an encrypted intent." />
              <div className="ml-11 mt-5 flex flex-col gap-3 sm:flex-row"><ButtonLink href="/create">Create a trade</ButtonLink><ButtonLink href="/portfolio" tone="secondary">Open portfolio</ButtonLink></div>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5 sm:p-6"><h2 className="font-display text-lg font-medium text-white">Mint progress</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">The testnet token follows the same encrypted input flow as a trade.</p><div className="mt-6"><TransactionProgress steps={buildProgress(step)} /></div></Card>
            <Card className="p-5"><h2 className="flex items-center gap-3 text-sm font-semibold text-white"><Icon name="shield" className="size-5 text-[var(--color-primary-text)]" />Confidential token</h2><p className="mt-3 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">ERC-7984 balances and transfers use encrypted handles. The amount shown in this form becomes private after submission.</p></Card>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 shrink-0 pt-0.5 font-mono text-sm tabular-nums text-[var(--color-primary-text)]">{number}</span>
      <div><h2 className="font-display text-lg font-medium text-white">{title}</h2><p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">{description}</p></div>
    </div>
  );
}

function buildProgress(step: string): TransactionStep[] {
  const order = ["encrypting", "signing", "confirming", "done"];
  const current = order.indexOf(step);
  const stateFor = (index: number): TransactionStep["state"] => step === "error" && index === 0 ? "error" : step === "done" || current > index ? "complete" : current === index ? "active" : "pending";
  return [
    { label: "Encrypt amount", description: "Create a private Nox input.", state: stateFor(0) },
    { label: "Approve in wallet", description: "Review the mint call.", state: stateFor(1) },
    { label: "Confirm balance", description: "Wait for testnet confirmation.", state: stateFor(2) },
  ];
}
