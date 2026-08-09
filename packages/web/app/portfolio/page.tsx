"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, type Hex } from "viem";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TokenIcon } from "@/components/TokenIcon";
import { Skeleton } from "@/components/Skeleton";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, Status } from "@/components/ui/Badge";
import { useHandleClient, decryptUint256 } from "@/lib/handle-client";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";
import { shortAddress } from "@/lib/utils";

const TOKENS = [
  { symbol: "cUSDC", address: CUSDC_ADDRESS, decimals: 6 },
  { symbol: "cETH", address: CETH_ADDRESS, decimals: 18 },
];

const ERC7984_ABI = [{ type: "function", name: "confidentialBalanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bytes32" }] }] as const;

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  return (
    <AppShell>
      <PageHeader icon="account_balance_wallet" title="Portfolio" subtitle="Decrypt your confidential testnet balances only when you need to see them." />
      {!isConnected || !address ? (
        <EmptyState icon="account_circle_off" title="Connect a wallet to view your portfolio" body="Use the wallet action in the header, then return here to decrypt your balances." action={<ButtonLink href="/intents" tone="secondary">Explore marketplace</ButtonLink>} />
      ) : (
        <>
          <Card className="mb-6 grid gap-px overflow-hidden bg-[var(--color-border)] sm:grid-cols-3">
            <StatBlock icon="badge" label="Wallet" value={shortAddress(address, 6)} />
            <StatBlock icon="hub" label="Network" value="Ethereum Sepolia" />
            <StatBlock icon="shield" label="Privacy" value="Encrypted state" />
          </Card>
          <section aria-labelledby="encrypted-balances">
            <div className="mb-4 flex items-end justify-between gap-4"><div><h2 id="encrypted-balances" className="font-display text-xl font-medium text-white">Encrypted balances</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Each value requires a wallet-authorized local decrypt.</p></div><Status label="Wallet authorized view" tone="primary" /></div>
            <div className="space-y-4">{TOKENS.map((token) => <BalanceCard key={token.address} token={token} account={address} />)}</div>
          </section>
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><Icon name="shield" className="mt-0.5 size-5 shrink-0 text-[var(--color-primary-text)]" /><div><h2 className="text-sm font-semibold text-white">Your decrypted value stays in this browser</h2><p className="mt-1 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">The 32-byte handle points to encrypted state. Your wallet proves access, and the readable balance is never written back on-chain.</p></div></div>
        </>
      )}
    </AppShell>
  );
}

function StatBlock({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="flex items-center gap-3 bg-[var(--color-surface)] p-5"><Icon name={icon} className="size-5 text-[var(--color-primary-text)]" /><div><p className="text-xs text-[var(--color-text-muted)]">{label}</p><p className="mt-1 text-sm font-medium text-white">{value}</p></div></div>;
}

function BalanceCard({ token, account }: { token: { symbol: string; address: `0x${string}`; decimals: number }; account: `0x${string}` }) {
  const { ready, getClient } = useHandleClient();
  const [decrypted, setDecrypted] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const lastDecryptedHandle = useRef<Hex | null>(null);
  const handleQuery = useReadContract({ address: token.address, abi: ERC7984_ABI, functionName: "confidentialBalanceOf", args: [account], query: { refetchInterval: 12_000, refetchOnWindowFocus: true } });

  useEffect(() => {
    const current = (handleQuery.data as Hex | undefined) ?? null;
    if (current && lastDecryptedHandle.current && current !== lastDecryptedHandle.current) setIsStale(true);
  }, [handleQuery.data]);

  async function decryptBalance() {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const client = await getClient();
      if (!client) throw new Error("Handle client unavailable");
      if (!handleQuery.data) throw new Error("Balance handle not loaded");
      const handle = handleQuery.data as Hex;
      const value = await decryptUint256(client, handle);
      setDecrypted(value);
      lastDecryptedHandle.current = handle;
      setIsStale(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  function refreshHandle() {
    void handleQuery.refetch();
    setIsStale(false);
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <TokenIcon symbol={token.symbol} size="md" />
          <div><div className="flex items-center gap-2"><h3 className="font-display text-lg font-medium text-white">{token.symbol}</h3>{isStale ? <Badge tone="warning">Balance changed</Badge> : null}</div>{handleQuery.data ? <p className="mt-1 flex items-center gap-2 font-mono text-xs text-[var(--color-text-muted)]"><Icon name="lock" className="size-3.5 text-[var(--color-primary-text)]" />{(handleQuery.data as string).slice(0, 14)}…</p> : <Skeleton className="mt-2 h-3 w-36" />}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <Button type="button" tone="ghost" size="icon" aria-label={`Refresh ${token.symbol} encrypted balance`} onClick={refreshHandle} disabled={handleQuery.isFetching}><Icon name="refresh" className={`size-4 ${handleQuery.isFetching ? "animate-spin" : ""}`} /></Button>
          {decrypted !== null && !isStale ? (
            <div className="min-w-0 text-right"><p className="font-mono text-xl font-medium tabular-nums text-white">{formatUnits(decrypted, token.decimals)}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{token.symbol} · decrypted</p></div>
          ) : (
            <Button type="button" tone="secondary" onClick={() => void decryptBalance()} loading={loading} loadingLabel="Decrypting…" disabled={!ready || !handleQuery.data}><Icon name="lock_open" className="size-4" />{isStale ? "Decrypt updated balance" : "Decrypt balance"}</Button>
          )}
        </div>
      </div>
      {error ? <div role="alert" className="mt-4 rounded-xl bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-text)]">{error} Check your wallet access and retry.</div> : null}
    </Card>
  );
}
