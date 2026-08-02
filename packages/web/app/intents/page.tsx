"use client";

import Link from "next/link";
import type { Route } from "next";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TokenIcon } from "@/components/TokenIcon";
import { Skeleton, SkeletonRow } from "@/components/Skeleton";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge, Status } from "@/components/ui/Badge";
import { useIntents, statusLabel, type IntentRow } from "@/lib/hooks/useIntents";
import { shortAddress } from "@/lib/utils";
import { CUSDC_ADDRESS, CETH_ADDRESS } from "@/lib/wagmi";

const TOKEN_NAMES: Record<string, string> = {
  [CUSDC_ADDRESS.toLowerCase()]: "cUSDC",
  [CETH_ADDRESS.toLowerCase()]: "cETH",
};

type ModeFilter = "all" | "direct" | "rfq";
type StatusFilter = "all" | "open" | "filled" | "cancelled" | "pending";
type PairFilter = "all" | "ceth-cusdc" | "cusdc-ceth";
const PAGE_SIZE = 10;

export default function IntentsPage() {
  return <Suspense fallback={<MarketplaceSkeleton />}><Marketplace /></Suspense>;
}

function Marketplace() {
  const { address } = useAccount();
  const { rows, isLoading, error } = useIntents(60);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<ModeFilter>(() => parseValue(searchParams.get("mode"), ["all", "direct", "rfq"], "all"));
  const [status, setStatus] = useState<StatusFilter>(() => parseValue(searchParams.get("status"), ["all", "open", "filled", "cancelled", "pending"], "all"));
  const [pair, setPair] = useState<PairFilter>(() => parseValue(searchParams.get("pair"), ["all", "ceth-cusdc", "cusdc-ceth"], "all"));
  const [onlyMine, setOnlyMine] = useState(() => searchParams.get("mine") === "1");
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get("p") ?? 1) || 1));

  useEffect(() => { setPage(1); }, [mode, status, pair, onlyMine]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (mode !== "all") params.set("mode", mode);
    if (status !== "all") params.set("status", status);
    if (pair !== "all") params.set("pair", pair);
    if (onlyMine) params.set("mine", "1");
    if (page !== 1) params.set("p", String(page));
    const query = params.toString();
    router.replace(query ? `/intents?${query}` : "/intents", { scroll: false });
  }, [mode, status, pair, onlyMine, page, router]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (mode === "direct" && row.mode !== 0) return false;
    if (mode === "rfq" && row.mode !== 1) return false;
    if (status === "open" && row.status !== 0) return false;
    if (status === "filled" && row.status !== 1) return false;
    if (status === "cancelled" && row.status !== 2) return false;
    if (status === "pending" && row.status !== 4) return false;
    if (pair !== "all") {
      const pairKey = `${tokenName(row.sellToken)}-${tokenName(row.buyToken)}`.toLowerCase();
      if (pairKey !== pair) return false;
    }
    if (onlyMine && address && row.maker.toLowerCase() !== address.toLowerCase()) return false;
    return true;
  }), [rows, mode, status, pair, onlyMine, address]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeFilters = Number(mode !== "all") + Number(status !== "all") + Number(pair !== "all") + Number(onlyMine);
  const clearFilters = () => { setMode("all"); setStatus("all"); setPair("all"); setOnlyMine(false); };

  return (
    <AppShell>
      <PageHeader
        icon="grid_view"
        title="Marketplace"
        subtitle="Browse direct OTC intents and sealed RFQs without exposing private amounts."
        action={<ButtonLink href="/create"><Icon name="add" className="size-4" />Create trade</ButtonLink>}
      />

      {!isLoading && rows.length > 0 ? (
        <Card className="mb-5 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
            <FilterSelect label="Mode" value={mode} onChange={(value) => setMode(value as ModeFilter)} options={[['all','All modes'],['direct','Direct OTC'],['rfq','Sealed RFQ']]} />
            <FilterSelect label="Status" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={[['all','All statuses'],['open','Open'],['pending','Pending reveal'],['filled','Filled'],['cancelled','Cancelled']]} />
            <FilterSelect label="Pair" value={pair} onChange={(value) => setPair(value as PairFilter)} options={[['all','All pairs'],['ceth-cusdc','cETH → cUSDC'],['cusdc-ceth','cUSDC → cETH']]} />
            {address ? (
              <button type="button" aria-pressed={onlyMine} onClick={() => setOnlyMine((value) => !value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 ${onlyMine ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-white" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-white"}`}>
                My trades
              </button>
            ) : <span />}
            {activeFilters > 0 ? <Button type="button" tone="ghost" size="sm" onClick={clearFilters}><Icon name="close" className="size-4" />Clear {activeFilters}</Button> : null}
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]" aria-live="polite">Showing {filtered.length} of {rows.length} trades</p>
        </Card>
      ) : null}

      {isLoading ? <MarketplaceSkeleton bare /> : null}
      {error ? (
        <div role="alert" className="rounded-[20px] border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-5">
          <div className="flex items-start gap-3"><Icon name="error" className="mt-0.5 size-5 text-[var(--color-danger-text)]" /><div><h2 className="font-semibold text-white">Marketplace data could not load</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{error.message}</p><Button type="button" tone="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}><Icon name="refresh" className="size-4" />Retry</Button></div></div>
        </div>
      ) : null}

      {!isLoading && !error && rows.length === 0 ? (
        <EmptyState icon="inbox" title="No private trades yet" body="Create the first direct OTC intent or sealed RFQ on this network." action={<ButtonLink href="/create">Create a trade</ButtonLink>} />
      ) : null}

      {!isLoading && rows.length > 0 && filtered.length === 0 ? (
        <EmptyState icon="filter_alt_off" title="No trades match these filters" body="Clear the current filters to return to the full marketplace." action={<Button onClick={clearFilters}>Clear filters</Button>} />
      ) : null}

      {visibleRows.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-low)] text-xs text-[var(--color-text-muted)]">
                <tr><Th>Intent</Th><Th>Pair</Th><Th>Mode</Th><Th>Maker</Th><Th>Private size</Th><Th>Status</Th><Th>Expires</Th><Th><span className="sr-only">Action</span></Th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {visibleRows.map((row) => <DesktopRow key={row.id.toString()} row={row} address={address} />)}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-[var(--color-border)] md:hidden">
            {visibleRows.map((row) => <MobileCard key={row.id.toString()} row={row} address={address} />)}
          </ul>
          <Pagination page={safePage} totalPages={totalPages} setPage={setPage} count={filtered.length} />
        </Card>
      ) : null}
    </AppShell>
  );
}

function DesktopRow({ row, address }: { row: IntentRow; address?: `0x${string}` }) {
  const href = tradeHref(row);
  return (
    <tr className="transition-colors duration-150 hover:bg-[var(--color-surface-low)]">
      <Td><span className="font-mono text-sm tabular-nums text-white">#{row.id.toString()}</span></Td>
      <Td><Pair row={row} /></Td>
      <Td><Badge tone={row.mode === 1 ? "primary" : "neutral"}>{row.mode === 1 ? "Sealed RFQ" : "Direct"}</Badge></Td>
      <Td><span className="font-mono text-xs text-[var(--color-text-secondary)]">{shortAddress(row.maker)}{address?.toLowerCase() === row.maker.toLowerCase() ? " · You" : ""}</span></Td>
      <Td><span className="inline-flex items-center gap-2 font-mono text-xs text-[var(--color-text-secondary)]"><Icon name="lock" className="size-4 text-[var(--color-primary-text)]" />{row.sellAmountHandle.slice(0, 8)}…</span></Td>
      <Td><TradeStatus status={row.status} /></Td>
      <Td><RelativeTime deadline={row.deadline} /></Td>
      <Td><Link href={href} className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-white hover:text-[var(--color-primary-text)]">{row.status === 0 ? row.mode === 1 ? "Bid" : "Accept" : "View"}</Link></Td>
    </tr>
  );
}

function MobileCard({ row, address }: { row: IntentRow; address?: `0x${string}` }) {
  return (
    <li>
      <Link href={tradeHref(row)} className="block p-5">
        <div className="flex items-center justify-between gap-3"><span className="font-mono text-sm tabular-nums text-[var(--color-text-muted)]">Intent #{row.id.toString()}</span><TradeStatus status={row.status} /></div>
        <div className="mt-5"><Pair row={row} /></div>
        <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-xs text-[var(--color-text-muted)]">Maker</p><p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">{shortAddress(row.maker)}{address?.toLowerCase() === row.maker.toLowerCase() ? " · You" : ""}</p></div><div className="text-right"><p className="text-xs text-[var(--color-text-muted)]">Expires</p><RelativeTime deadline={row.deadline} /></div></div>
      </Link>
    </li>
  );
}

function Pair({ row }: { row: IntentRow }) {
  return <span className="inline-flex items-center gap-2 font-mono text-sm text-white"><TokenIcon symbol={tokenName(row.sellToken)} size="sm" />{tokenName(row.sellToken)}<Icon name="arrow_forward" className="size-4 text-[var(--color-text-muted)]" /><TokenIcon symbol={tokenName(row.buyToken)} size="sm" />{tokenName(row.buyToken)}</span>;
}

function TradeStatus({ status }: { status: number }) {
  const label = statusLabel(status);
  const tone = status === 0 ? "success" : status === 4 ? "warning" : status === 2 ? "danger" : "neutral";
  return <Status label={label} tone={tone} />;
}

function RelativeTime({ deadline }: { deadline: bigint }) {
  const seconds = Number(deadline) - Math.floor(Date.now() / 1000);
  const label = seconds <= 0 ? "Expired" : seconds < 3600 ? `${Math.max(1, Math.floor(seconds / 60))}m` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h` : `${Math.floor(seconds / 86400)}d`;
  return <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)]" title={new Date(Number(deadline) * 1000).toLocaleString()}>{label}</span>;
}

function Pagination({ page, totalPages, setPage, count }: { page: number; totalPages: number; setPage: (page: number) => void; count: number }) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
      <span className="text-sm text-[var(--color-text-muted)]">{count} result{count === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-2"><Button tone="ghost" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon name="chevron_left" className="size-4" /></Button><span className="min-w-16 text-center text-sm tabular-nums text-[var(--color-text-secondary)]" aria-live="polite">{page} / {totalPages}</span><Button tone="ghost" size="icon" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><Icon name="chevron_right" className="size-4" /></Button></div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <label className="text-sm font-medium text-white">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="tradi-nox-input mt-2 min-h-11 py-2 text-sm">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function MarketplaceSkeleton({ bare = false }: { bare?: boolean }) {
  const content = <Card className="overflow-hidden"><div className="space-y-4 p-5 md:hidden"><Skeleton className="h-5 w-24" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div><table className="hidden w-full md:table"><tbody><SkeletonRow /><SkeletonRow /><SkeletonRow /></tbody></table></Card>;
  if (bare) return content;
  return <AppShell><PageHeader icon="grid_view" title="Marketplace" subtitle="Loading private trades…" />{content}</AppShell>;
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 font-medium">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3 text-sm">{children}</td>; }
function tokenName(token: string) { return TOKEN_NAMES[token.toLowerCase()] ?? shortAddress(token); }
function tradeHref(row: IntentRow) { return (row.mode === 1 ? `/rfq/${row.id}` : `/intents/${row.id}`) as Route; }
function parseValue<T extends string>(value: string | null, values: T[], fallback: T): T { return values.includes(value as T) ? (value as T) : fallback; }
