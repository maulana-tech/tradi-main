"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useReadContracts } from "wagmi";
import type { Hex } from "viem";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { useNoxClient, decryptUint256 } from "@/lib/nox-client";
import { useToast } from "./Toast";

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
 * Nox decrypt via wallet signature → cached plaintext for the session.
 *
 * Intentionally separate from /portfolio (which has the full breakdown +
 * controls). This is the "always-visible HUD" that makes the dApp feel like
 * a trading desk on every page.
 */
export function BalanceWidget() {
  const { address, isConnected } = useAccount();
  const { ready: noxReady, getClient } = useNoxClient();
  const toast = useToast();
  const pathname = usePathname();
  // /portfolio already shows full balance breakdown — duplicating the floating
  // widget there would be visual noise.
  const hideOnPortfolio = pathname?.startsWith("/portfolio");

  const [revealed, setRevealed] = useState<Record<string, bigint>>({});
  const [decrypting, setDecrypting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
    if (!noxReady) {
      toast.error("Wallet not ready for decryption");
      return;
    }
    setDecrypting(true);
    try {
      const client = await getClient();
      if (!client) {
        toast.error("Nox client unavailable");
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
        className="pointer-events-auto fixed bottom-20 left-4 z-40 grid h-10 w-10 place-items-center rounded-xl border border-[--color-border] bg-[--color-surface] text-[--color-primary] shadow-lg transition hover:shadow-xl md:bottom-4 md:left-60"
        aria-label="Show balance widget"
      >
        <span className="material-symbols-outlined text-base">
          account_balance_wallet
        </span>
      </button>
    );
  }

  return (
    <aside
      role="complementary"
      aria-label="Confidential balances"
      className="pointer-events-auto fixed bottom-20 left-4 z-40 w-56 rounded-xl border border-[--color-border] bg-[--color-surface] shadow-lg md:bottom-4 md:left-60"
    >
      <header className="flex items-center justify-between border-b border-[--color-border] px-3 py-2">
        <p className="text-label-caps flex items-center gap-1.5 text-[--color-primary]">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            account_balance_wallet
          </span>
          Confidential Balance
        </p>
        <button
          onClick={() => setCollapsed(true)}
          className="text-[--color-text-muted] transition hover:text-[--color-text]"
          aria-label="Collapse"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </header>

      <ul className="divide-y divide-[--color-border]">
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
              <span className="font-mono text-[11px] text-[--color-text-secondary]">
                {tok.symbol}
              </span>
              {plain !== undefined ? (
                <span
                  className="font-mono text-xs text-[--color-primary]"
                  data-numeric
                >
                  {format(plain, tok.decimals)}
                </span>
              ) : isZeroHandle ? (
                <span className="font-mono text-[10px] text-[--color-text-muted]">
                  not minted
                </span>
              ) : !handleHex ? (
                <span className="font-mono text-[10px] text-[--color-text-muted]">
                  loading…
                </span>
              ) : (
                <span
                  className="font-mono text-[11px] tracking-wider text-[--color-text-muted]"
                  title={handleHex}
                >
                  •••••
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="flex gap-1 border-t border-[--color-border] p-2">
        <button
          onClick={handleReveal}
          disabled={decrypting || !noxReady}
          className="text-label-caps flex flex-1 items-center justify-center gap-1 border border-[--color-border] px-2 py-1.5 text-[10px] text-[--color-text-secondary] transition hover:border-[--color-primary] hover:text-[--color-primary] disabled:opacity-40"
        >
          <span
            className={`material-symbols-outlined text-xs ${decrypting ? "animate-spin" : ""}`}
          >
            {decrypting ? "sync" : Object.keys(revealed).length > 0 ? "visibility_off" : "visibility"}
          </span>
          {decrypting
            ? "DECRYPTING"
            : Object.keys(revealed).length > 0
              ? "RE-DECRYPT"
              : "REVEAL"}
        </button>
        <button
          onClick={() => {
            setRevealed({});
            balances.refetch();
          }}
          className="text-label-caps flex items-center justify-center border border-[--color-border] px-2 py-1.5 text-[--color-text-muted] transition hover:border-[--color-primary] hover:text-[--color-primary]"
          title="Refresh handles from chain"
          aria-label="Refresh balance"
        >
          <span className="material-symbols-outlined text-xs">refresh</span>
        </button>
      </footer>
    </aside>
  );
}
