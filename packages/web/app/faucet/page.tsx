"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PageHeader, SectionHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TokenIcon } from "@/components/TokenIcon";
import { HelpHint } from "@/components/Tooltip";
import { OperatorAuth } from "@/components/OperatorAuth";
import { useFaucet } from "@/lib/hooks/useFaucet";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";

const TOKENS = [
  {
    symbol: "cUSDC",
    address: CUSDC_ADDRESS,
    decimals: 6,
    defaultMint: "10000",
  },
  {
    symbol: "cETH",
    address: CETH_ADDRESS,
    decimals: 18,
    defaultMint: "10",
  },
];

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const { mint, step, error, txHash } = useFaucet();

  const [selected, setSelected] = useState(TOKENS[0]);
  const [amount, setAmount] = useState(TOKENS[0].defaultMint);

  async function onMint(e: React.FormEvent) {
    e.preventDefault();
    await mint(selected.address, parseUnits(amount || "0", selected.decimals));
  }

  const busy =
    step === "encrypting" || step === "signing" || step === "confirming";

  return (
    <AppShell>
      <PageHeader
        icon="water_drop"
        title="Faucet"
        subtitle="Mint confidential testnet tokens"
      />

      {!isConnected && (
        <EmptyState
          icon="account_circle_off"
          title="Connect wallet to mint"
          body="A connected wallet on Ethereum Sepolia is required"
        />
      )}

      {isConnected && address && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <OperatorAuth
            token={CUSDC_ADDRESS}
            account={address}
            symbol="cUSDC"
            compact
          />
          <OperatorAuth
            token={CETH_ADDRESS}
            account={address}
            symbol="cETH"
            compact
          />
        </div>
      )}

      {isConnected && (
        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-12 lg:col-span-7">
            <div className="rounded-lg border border-[--color-border] bg-[--color-surface] p-6">
              <SectionHeader icon="water_drop" title="Mint Confidential Tokens" />

              <form onSubmit={onMint} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[--color-foreground]">
                    Token
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TOKENS.map((t) => (
                      <button
                        key={t.symbol}
                        type="button"
                        onClick={() => {
                          setSelected(t);
                          setAmount(t.defaultMint);
                        }}
                        className={`flex items-center gap-3 rounded-lg border p-3.5 text-left transition-colors ${
                          selected.symbol === t.symbol
                            ? "border-[--color-primary] bg-[--color-primary]/5"
                            : "border-[--color-border] hover:border-[--color-primary]/30"
                        }`}
                      >
                        <TokenIcon symbol={t.symbol} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-[--color-foreground]">
                            {t.symbol}
                          </p>
                          <p className="mt-0.5 text-xs text-[--color-text-muted]">
                            {t.address.slice(0, 8)}…{t.address.slice(-6)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-[--color-foreground]">
                      Amount
                    </label>
                    <span className="flex items-center gap-1 text-xs text-[--color-primary]">
                      <span className="material-symbols-outlined text-sm">
                        lock
                      </span>
                      Encrypted on submit
                    </span>
                  </div>
                  <div className="flex rounded-lg border border-[--color-border] bg-[--color-surface] focus-within:border-[--color-primary]">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 rounded-l-lg bg-transparent px-3.5 py-2.5 text-sm focus:outline-none"
                    />
                    <span className="grid place-items-center rounded-r-lg border-l border-[--color-border] bg-[--color-surface-low] px-3.5 text-sm font-medium text-[--color-text-secondary]">
                      {selected.symbol}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {step === "done" && (
                  <div className="rounded-lg border border-[--color-primary]/20 bg-[--color-primary]/5 p-3 text-sm">
                    <span className="font-medium text-[--color-primary]">
                      Minted {amount} {selected.symbol}.
                    </span>{" "}
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[--color-primary] underline"
                    >
                      Tx
                    </a>{" "}
                    ·{" "}
                    <Link
                      href={"/portfolio" as Route}
                      className="text-[--color-primary] underline"
                    >
                      Decrypt balance →
                    </Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="tradi-nox-btn-primary w-full py-3 text-sm"
                >
                  {step === "encrypting" && "Encrypting…"}
                  {step === "signing" && "Confirm in wallet…"}
                  {step === "confirming" && "Minting on-chain…"}
                  {(step === "idle" || step === "error") &&
                    `Mint ${amount} ${selected.symbol}`}
                  {step === "done" && "Minted"}
                </button>
              </form>
            </div>
          </section>

          <aside className="col-span-12 space-y-4 lg:col-span-5">
            <div className="rounded-lg border border-[--color-border] bg-[--color-surface] p-5">
              <p className="mb-3 text-sm font-semibold text-[--color-foreground]">
                Next steps
              </p>
              <ol className="space-y-2.5 text-sm">
                <Step num="1" text="Mint balance for both tokens" />
                <Step num="2" text="Approve operator on each cToken" />
                <Step num="3" text="Create intent or RFQ" />
              </ol>
            </div>

            <div className="rounded-lg border border-[--color-border] bg-[--color-surface] p-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[--color-foreground]">
                ERC-7984
                <HelpHint content="ERC-7984 is the Confidential Fungible Token standard. Balances and amounts are stored as encrypted bytes32 handles, not plaintext." />
              </p>
              <p className="text-sm leading-relaxed text-[--color-text-secondary]">
                TradiNoxCToken implements full ERC-7984 spec: 8 transfer
                functions, operator pattern, ACL via Nox primitives.
              </p>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function Step({ num, text }: { num: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--color-primary]/10 text-xs font-semibold text-[--color-primary]">
        {num}
      </span>
      <span className="text-[--color-text-secondary]">{text}</span>
    </li>
  );
}
