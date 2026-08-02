"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Status } from "@/components/ui/Badge";
import { useUniswapPrice, usePriceHistory } from "@/lib/hooks/useUniswapPrice";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const tooltipStyle = { background: "#17171b", border: "1px solid #3a3a43", borderRadius: 16, color: "#f7f7f8", fontSize: 12 };

export default function PricesPage() {
  const { price, isLoading: priceLoading } = useUniswapPrice();
  const { history, isLoading: historyLoading } = usePriceHistory();
  const isLoading = priceLoading || historyLoading;

  return (
    <AppShell>
      <PageHeader icon="candlestick_chart" title="Prices" subtitle="A public ETH/USDC reference beside your private OTC execution." />
      {isLoading ? <PriceSkeleton /> : price === null && history.length === 0 ? (
        <div role="alert" className="rounded-[20px] border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-6">
          <div className="flex items-start gap-3"><Icon name="error" className="mt-0.5 size-5 text-[var(--color-danger-text)]" /><div><h2 className="font-display text-lg font-medium text-white">Reference price unavailable</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">The Uniswap pool could not be read on the current connection.</p><Button tone="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}><Icon name="refresh" className="size-4" />Retry</Button></div></div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div><p className="text-sm font-medium text-[var(--color-text-secondary)]">ETH / USDC</p>{price !== null ? <p className="mt-2 font-mono text-4xl font-medium tabular-nums text-white sm:text-5xl">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p> : <p className="mt-2 text-lg text-[var(--color-text-muted)]">Current quote unavailable</p>}</div>
              <Status label="Uniswap V3 reference" tone="success" />
            </div>
            <p className="mt-5 text-sm text-pretty text-[var(--color-text-muted)]">Public market reference from the ETH/USDC 0.05% pool. The live quote refreshes every 15 seconds.</p>
          </Card>

          {history.length > 0 ? (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="font-display text-xl font-medium text-white">30-day reference history</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">A public benchmark for evaluating private quotes.</p></div><p className="text-sm text-[var(--color-text-muted)]">{history.length} sampled blocks</p></div>
              <div role="img" aria-label="Line chart of ETH to USDC reference prices for the past 30 days" className="mt-8 h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#29292f" />
                    <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{ fill: "#85858f", fontSize: 12 }} tickFormatter={(timestamp) => new Date(timestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                    <YAxis axisLine={false} tickLine={false} width={64} domain={["auto", "auto"]} tick={{ fill: "#85858f", fontSize: 12 }} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(timestamp) => new Date(Number(timestamp) * 1000).toLocaleString()} formatter={(value) => [`$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "ETH/USDC"]} />
                    <Line type="monotone" dataKey="price" stroke="#8d7dff" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#f7f7f8", stroke: "#482bff" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-4 text-sm text-pretty text-[var(--color-text-secondary)]">The chart is a reference only. Tradi-Nox trade amounts and accepted prices remain encrypted until settlement.</p>
            </Card>
          ) : (
            <EmptyState icon="candlestick_chart" title="No historical samples" body="The current quote is available, but historical pool reads returned no samples." action={<ButtonLink href="/intents" tone="secondary">View private trades</ButtonLink>} />
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><Icon name="info" className="mt-0.5 size-5 shrink-0 text-[var(--color-primary-text)]" /><div><h2 className="text-sm font-semibold text-white">Market reference only</h2><p className="mt-1 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">OTC execution can differ from the public pool. Review the encrypted trade terms and your wallet transaction before settling.</p></div></div>
        </div>
      )}
    </AppShell>
  );
}

function PriceSkeleton() {
  return <div className="space-y-6"><Card className="p-6"><Skeleton className="h-4 w-28" /><Skeleton className="mt-4 h-12 w-56" /><Skeleton className="mt-5 h-4 w-full max-w-xl" /></Card><Card className="p-6"><Skeleton className="h-6 w-52" /><Skeleton className="mt-8 h-80 w-full" /></Card></div>;
}
