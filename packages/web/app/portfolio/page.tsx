"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import type { Hex } from "viem";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TokenIcon } from "@/components/TokenIcon";
import { Skeleton } from "@/components/Skeleton";
import { useNoxClient, decryptUint256 } from "@/lib/nox-client";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { shortAddress } from "@/lib/utils";

const TOKENS = [
  { symbol: "cUSDC", address: CUSDC_ADDRESS, decimals: 6 },
  { symbol: "cETH", address: CETH_ADDRESS, decimals: 18 },
];

const ERC7984_ABI = [
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  return (
    <AppShell>
      <PageHeader
        icon="account_balance_wallet"
        title="Portfolio"
        subtitle="Encrypted balances · decrypt to view"
      />

      {!isConnected && (
        <EmptyState
          icon="account_circle_off"
          title="Wallet not connected"
          body="Connect a wallet to view your encrypted balances"
        />
      )}

      {isConnected && address && (
        <>
          <div className="glass-card mb-6 grid grid-cols-3 gap-4 border-l-2 border-l-[--color-primary] p-4">
            <StatBlock
              icon="badge"
              label="Address"
              value={shortAddress(address, 6)}
              tone="primary"
            />
            <StatBlock
              icon="hub"
              label="Network"
              value="Ethereum Sepolia"
            />
            <StatBlock icon="lock" label="Encryption" value="Nox TEE" />
          </div>

          <div className="space-y-3">
            {TOKENS.map((t) => (
              <BalanceRow key={t.address} token={t} account={address} />
            ))}
          </div>

          <div className="mt-8 flex items-start gap-3 border border-[--color-border] bg-[--color-surface-low]/30 p-6">
            <span className="material-symbols-outlined text-[--color-primary]">
              shield
            </span>
            <div>
              <p className="text-label-caps mb-2 text-[--color-text-muted]">
                Decryption notice
              </p>
              <p className="text-xs leading-relaxed text-[--color-text-secondary]">
                Balance handles are 32-byte references to encrypted state
                stored off-chain in iExec Nox TEE. Decryption requires your
                wallet signature + ACL membership granted by the cToken
                contract. Decrypted values are computed{" "}
                <span className="text-[--color-primary]">in your browser</span>{" "}
                and never leave it.
              </p>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function StatBlock({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone?: "primary";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`material-symbols-outlined ${
          tone === "primary" ? "text-[--color-primary]" : "text-[--color-text-muted]"
        }`}
      >
        {icon}
      </span>
      <div>
        <p className="text-label-caps text-[--color-text-muted]">{label}</p>
        <p
          className={`font-mono text-sm ${
            tone === "primary" ? "text-[--color-primary]" : ""
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function BalanceRow({
  token,
  account,
}: {
  token: { symbol: string; address: `0x${string}`; decimals: number };
  account: `0x${string}`;
}) {
  const { ready, getClient } = useNoxClient();
  const [decrypted, setDecrypted] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const lastDecryptedHandle = useRef<Hex | null>(null);

  // Poll the encrypted balance handle every 12s so a settlement that
  // mutated this account's balance (e.g. RFQ reveal, Direct OTC accept)
  // gets reflected in the UI without a manual refresh. wagmi v2 sits on
  // top of TanStack Query, so refetchInterval is honored at the query
  // level and refetchOnWindowFocus picks up changes when the user comes
  // back to the tab after an action elsewhere.
  const handleQuery = useReadContract({
    address: token.address,
    abi: ERC7984_ABI,
    functionName: "confidentialBalanceOf",
    args: [account],
    query: {
      refetchInterval: 12_000,
      refetchOnWindowFocus: true,
    },
  });

  // When the on-chain handle changes (settlement happened), surface a
  // "balance changed — re-decrypt" badge so the user knows the previously
  // shown plaintext is no longer current.
  useEffect(() => {
    const current = (handleQuery.data as Hex | undefined) ?? null;
    if (
      current &&
      lastDecryptedHandle.current &&
      current !== lastDecryptedHandle.current
    ) {
      setIsStale(true);
    }
  }, [handleQuery.data]);

  async function onDecrypt() {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const client = await getClient();
      if (!client) throw new Error("Nox client unavailable");
      if (!handleQuery.data) throw new Error("Balance handle not loaded");
      const handle = handleQuery.data as Hex;
      const value = await decryptUint256(client, handle);
      setDecrypted(value);
      lastDecryptedHandle.current = handle;
      setIsStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function onRefresh() {
    handleQuery.refetch();
    setIsStale(false);
  }

  return (
    <div className="glass-card flex items-center justify-between p-4 transition-all hover:border-[--color-primary]/40">
      <div className="flex items-center gap-4">
        <TokenIcon symbol={token.symbol} size="md" />
        <div>
          <div className="flex items-center gap-2">
            <p className="font-display text-sm font-bold">{token.symbol}</p>
            {isStale && (
              <span
                className="text-label-caps animate-pulse border border-amber-700 bg-amber-950/40 px-1.5 py-0.5 text-[9px] text-amber-400"
                title="On-chain balance changed since you last decrypted"
              >
                Updated
              </span>
            )}
          </div>
          {handleQuery.data ? (
            <p className="flex items-center gap-1 font-mono text-[11px] text-[--color-text-muted]">
              <span className="material-symbols-outlined text-xs text-[--color-primary]/40">
                lock
              </span>
              {(handleQuery.data as string).slice(0, 14)}…
            </p>
          ) : (
            <Skeleton className="mt-1 h-3 w-32" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-right">
        <button
          onClick={onRefresh}
          disabled={handleQuery.isFetching}
          className="text-label-caps flex items-center gap-1 border border-[--color-border] px-2 py-1.5 text-[--color-text-muted] transition-colors hover:border-[--color-primary]/40 hover:text-[--color-primary] disabled:opacity-40"
          title="Refetch handle from chain"
        >
          <span
            className={`material-symbols-outlined text-sm ${
              handleQuery.isFetching ? "animate-spin" : ""
            }`}
          >
            refresh
          </span>
        </button>

        <div>
          {decrypted !== null && !isStale ? (
            <>
              <p
                className="flex items-center justify-end gap-2 font-mono text-lg text-[--color-primary]"
                data-numeric
              >
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  lock_open
                </span>
                {formatUnits(decrypted, token.decimals)}
              </p>
              <p className="text-label-caps text-[--color-text-muted]">
                {token.symbol} · decrypted
              </p>
            </>
          ) : (
            <button
              onClick={onDecrypt}
              disabled={!ready || loading || !handleQuery.data}
              className="text-label-caps flex items-center gap-1.5 border border-[--color-border] bg-[--color-surface-low] px-3 py-1.5 text-[--color-primary] transition-all hover:bg-[--color-primary] hover:text-[--color-primary-fg] disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-base ${
                  loading ? "animate-spin" : ""
                }`}
              >
                {loading ? "sync" : isStale ? "key" : "key"}
              </span>
              {loading
                ? "Decrypting…"
                : isStale
                  ? "Re-decrypt"
                  : "Decrypt"}
            </button>
          )}
          {error && (
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-[--color-danger]">
              <span className="material-symbols-outlined text-xs">error</span>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
