"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useReadContracts } from "wagmi";
import type { Hex } from "viem";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { useHandleClient, decryptUint256 } from "@/lib/handle-client";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

const ERC7984_BAL_ABI = [
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

type Token = { symbol: string; address: `0x${string}`; decimals: number };

const TOKENS: Token[] = [
  { symbol: "cUSDC", address: CUSDC_ADDRESS, decimals: 6 },
  { symbol: "cETH", address: CETH_ADDRESS, decimals: 18 },
];

/**
 * Floating balance widget — collapsible bottom-left panel showing decrypted
 * cToken balances. Default state: encrypted handles (••••). Click "Reveal" →
 * Decrypt via wallet signature → cached plaintext for the session.
 *
 * Intentionally separate from /portfolio (which has the full breakdown +
 * controls). This is the "always-visible HUD" that makes the dApp feel like
 * a trading desk on every page.
 */
export function BalanceWidget() {
  const { address, isConnected } = useAccount();
  const { ready: handleReady, getClient } = useHandleClient();
  const toast = useToast();
  const pathname = usePathname();
  // /portfolio already shows full balance breakdown — duplicating the floating
  // widget there would be visual noise.
  const hideOnPortfolio = pathname?.startsWith("/portfolio");

  const [revealed, setRevealed] = useState<Record<string, bigint>>({});
  const [decrypting, setDecrypting] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const balances = useReadContracts({
    contracts: TOKENS.map((t) => ({
      address: t.address,
      abi: ERC7984_BAL_ABI,
      functionName: "confidentialBalanceOf" as const,
      args: [address ?? "0x0000000000000000000000000000000000000000"] as const,
    })),
    allowFailure: true,
    query: { enabled: isConnected && Boolean(address) },
  });

  // Re-mask whenever the handle changes (i.e. after a tx that mutated balance).
  useEffect(() => {
    setRevealed({});
  }, [balances.dataUpdatedAt]);

  if (!isConnected || !address) return null;
  if (hideOnPortfolio) return null;

  async function handleReveal() {
    if (decrypting) return;
    if (!handleReady) {
      toast.error("Wallet not ready for decryption");
      return;
    }
    setDecrypting(true);
    try {
      const client = await getClient();
      if (!client) {
        toast.error("Handle client unavailable");
        return;
      }

      const out: Record<string, bigint> = {};
      for (let i = 0; i < TOKENS.length; i++) {
        const handle = balances.data?.[i];
        if (handle?.status !== "success") continue;
        const handleHex = handle.result as Hex;
        if (!handleHex || handleHex === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          out[TOKENS[i].symbol] = 0n;
          continue;
        }
        try {
          out[TOKENS[i].symbol] = await decryptUint256(client, handleHex);
        } catch {
          // Skip silently — toast would be too noisy for HUD
        }
      }
      setRevealed(out);
    } finally {
      setDecrypting(false);
    }
  }

  function format(amount: bigint, decimals: number): string {
    const whole = amount / 10n ** BigInt(decimals);
    const wholeStr = whole.toLocaleString("en-US");
    return wholeStr;
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        type="button"
        className="pointer-events-auto fixed bottom-4 left-4 z-30 hidden size-11 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary-text)] shadow-lg transition-colors duration-150 hover:border-[var(--color-primary)] md:grid lg:left-[272px]"
        aria-label="Show balance widget"
      >
        <Icon name="account_balance_wallet" className="size-[18px]" />
      </button>
    );
  }

  return (
    <aside
      role="complementary"
      aria-label="Confidential balances"
      className="pointer-events-auto fixed bottom-4 left-4 z-30 hidden w-64 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg md:block lg:left-[304px]"
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-white">
          <Icon name="account_balance_wallet" className="size-4 text-[var(--color-primary-text)]" />
          Confidential Balance
        </p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="grid size-11 place-items-center rounded-full text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-surface-raised)] hover:text-white"
          aria-label="Collapse"
        >
          <Icon name="close" className="size-4" />
        </button>
      </header>

      <ul className="divide-y divide-[var(--color-border)]">
        {TOKENS.map((tok, i) => {
          const handle = balances.data?.[i];
          const handleHex =
            handle?.status === "success" ? (handle.result as Hex) : null;
          const plain = revealed[tok.symbol];
          const isZeroHandle =
            handleHex ===
            "0x0000000000000000000000000000000000000000000000000000000000000000";

          return (
            <li key={tok.symbol} className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                {tok.symbol}
              </span>
              {plain !== undefined ? (
                <span
                  className="font-mono text-xs tabular-nums text-white"
                  data-numeric
                >
                  {format(plain, tok.decimals)}
                </span>
              ) : isZeroHandle ? (
                <span className="text-xs text-[var(--color-text-muted)]">
                  not minted
                </span>
              ) : !handleHex ? (
                <span className="text-xs text-[var(--color-text-muted)]">
                  loading…
                </span>
              ) : (
                <span
                  className="font-mono text-xs text-[var(--color-text-muted)]"
                  title={handleHex}
                >
                  •••••
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="flex gap-1 border-t border-[var(--color-border)] p-2">
        <button
          type="button"
          onClick={handleReveal}
          disabled={decrypting || !handleReady}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors duration-150 hover:border-[var(--color-primary)] hover:text-white disabled:opacity-40"
        >
          <Icon name={decrypting ? "sync" : Object.keys(revealed).length > 0 ? "visibility_off" : "visibility"} className={`size-4 ${decrypting ? "animate-spin" : ""}`} />
          {decrypting
              ? "Decrypting"
            : Object.keys(revealed).length > 0
              ? "Decrypt again"
              : "Reveal"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRevealed({});
            balances.refetch();
          }}
          className="grid size-11 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors duration-150 hover:border-[var(--color-primary)] hover:text-white"
          title="Refresh handles from chain"
          aria-label="Refresh balance"
        >
          <Icon name="refresh" className="size-4" />
        </button>
      </footer>
    </aside>
  );
}
