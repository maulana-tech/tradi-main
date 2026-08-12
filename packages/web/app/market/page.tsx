"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/Icon";

interface MarketAsset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  marketCap: number;
  lastUpdated: string;
  chain: string;
  address: string | null;
  isCToken: boolean;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(2)}K`;
  return `$${vol.toFixed(0)}`;
}

export default function MarketPage() {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ctokens" | "underlying">("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/market");
      const data = (await res.json()) as { assets: MarketAsset[] };
      setAssets(data.assets);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const filtered = assets.filter((a) => {
    if (filter === "ctokens") return a.isCToken;
    if (filter === "underlying") return !a.isCToken;
    return true;
  });

  return (
    <AppShell>
      <PageHeader
        icon="candlestick_chart"
        title="Market"
        subtitle="Real-time prices for cTokens and underlying assets. Trade directly from the market."
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-muted)]">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={fetchPrices}
              className="flex size-10 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] hover:text-white"
            >
              <Icon name="refresh" className="size-4" />
            </button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {([["all", "All Assets"], ["ctokens", "cTokens"], ["underlying", "Underlying"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === val
                ? "bg-[var(--color-primary)] text-white"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Card key={i} className="h-20 animate-pulse p-5" />)}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-low)] text-xs text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium text-right">Price</th>
                  <th className="px-5 py-3 font-medium text-right">24h Change</th>
                  <th className="px-5 py-3 font-medium text-right">24h High</th>
                  <th className="px-5 py-3 font-medium text-right">24h Low</th>
                  <th className="px-5 py-3 font-medium text-right">Volume</th>
                  <th className="px-5 py-3 font-medium text-right">Chain</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((asset) => (
                  <tr key={`${asset.symbol}-${asset.chain}`} className="transition-colors hover:bg-[var(--color-surface-low)]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-primary-soft)]">
                          <span className="text-xs font-bold text-[var(--color-primary-text)]">
                            {asset.symbol.slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{asset.symbol}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{asset.name}</p>
                        </div>
                        {asset.isCToken && (
                          <Badge tone="primary">cToken</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-sm text-white">
                      {formatPrice(asset.price)}
                    </td>
                    <td className={`px-5 py-4 text-right font-mono text-sm ${asset.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatChange(asset.change24h)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-xs text-[var(--color-text-secondary)]">
                      {formatPrice(asset.high24h)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-xs text-[var(--color-text-secondary)]">
                      {formatPrice(asset.low24h)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-xs text-[var(--color-text-secondary)]">
                      {formatVolume(asset.volume)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-xs text-[var(--color-text-muted)]">{asset.chain}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {asset.isCToken && asset.address ? (
                        <Link
                          href={`/create/direct?sell=${asset.address}` as Route}
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary-text)] transition hover:bg-[var(--color-primary)] hover:text-white"
                        >
                          Trade
                          <Icon name="arrow_forward" className="size-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Icon name="swap_horiz" className="size-5 text-[var(--color-primary-text)]" />
            <div>
              <p className="text-sm font-semibold text-white">Direct OTC</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Set your price, trade atomically</p>
            </div>
          </div>
          <Link href="/create/direct" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-text)] hover:underline">
            Create trade <Icon name="arrow_forward" className="size-3" />
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Icon name="gavel" className="size-5 text-[var(--color-primary-text)]" />
            <div>
              <p className="text-sm font-semibold text-white">Sealed RFQ</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Vickrey auction, best price wins</p>
            </div>
          </div>
          <Link href="/create/rfq" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-text)] hover:underline">
            Open RFQ <Icon name="arrow_forward" className="size-3" />
          </Link>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Icon name="storefront" className="size-5 text-[var(--color-primary-text)]" />
            <div>
              <p className="text-sm font-semibold text-white">Strategies</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Deploy AI agents to trade for you</p>
            </div>
          </div>
          <Link href="/strategies" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary-text)] hover:underline">
            Browse <Icon name="arrow_forward" className="size-3" />
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
