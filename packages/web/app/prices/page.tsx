"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonRow } from "@/components/Skeleton";
import { useUniswapPrice, usePriceHistory } from "@/lib/hooks/useUniswapPrice";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function PricesPage() {
  const { price, isLoading: priceLoading } = useUniswapPrice();
  const { history, isLoading: historyLoading } = usePriceHistory();

  const isLoading = priceLoading || historyLoading;

  return (
    <AppShell>
      <PageHeader
        icon="candlestick_chart"
        title="Price Feed"
        subtitle="ETH/USDC reference price from Uniswap V3"
      />

      {isLoading ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <tbody className="divide-y divide-[--color-border]/50">
              <SkeletonRow /><SkeletonRow />
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current price card */}
          <div className="glass-card p-6">
            <div className="flex items-baseline gap-3">
              <h3 className="text-sm text-[--color-text-secondary]">ETH / USDC</h3>
              {price !== null && (
                <span className="text-3xl font-bold tabular-nums text-[--color-primary]">
                  ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-[--color-text-muted]">
              Source: Uniswap V3 ETH/USDC 0.05% pool · Updates every 15s
            </p>
          </div>

          {/* Price chart */}
          {history.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-[--color-foreground]">
                Price History (30 days)
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e2dc" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(ts) => new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e4e2dc",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(ts) => new Date(Number(ts) * 1000).toLocaleString()}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: any) => [`$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "ETH/USDC"]) as any}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#124d1c"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#124d1c" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-lg bg-[--color-primary]/5 p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-xl text-[--color-primary]">info</span>
              <div className="text-sm text-[--color-text-secondary]">
                <p className="mb-1 font-medium text-[--color-foreground]">Market Reference Only</p>
                <p>
                  This chart shows the ETH/USDC market price from Uniswap V3 as a reference.
                  Actual Tradi-Nox OTC prices are encrypted and settled via Nox TEE.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
