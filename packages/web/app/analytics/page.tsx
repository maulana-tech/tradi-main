"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/Icon";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const CHART_COLORS = ["#8d7dff", "#482bff", "#a1a1aa", "#5c5c66"];
const tooltipStyle = { background: "#17171b", border: "1px solid #3a3a43", borderRadius: 16, color: "#f7f7f8", fontSize: 12 };

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();
  return (
    <AppShell>
      <PageHeader icon="analytics" title="Analytics" subtitle="A readable view of on-chain intent activity and settlement outcomes." />
      {isLoading ? <AnalyticsSkeleton /> : !data ? (
        <div role="alert" className="rounded-[20px] border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-6"><div className="flex items-start gap-3"><Icon name="error" className="mt-0.5 size-5 text-[var(--color-danger-text)]" /><div><h2 className="font-display text-lg font-medium text-white">Analytics could not load</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">The current RPC connection did not return complete intent data.</p><Button tone="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}><Icon name="refresh" className="size-4" />Retry</Button></div></div></div>
      ) : data.totalIntents === 0 ? (
        <EmptyState icon="analytics" title="No analytics yet" body="Create the first intent to start the on-chain activity dashboard." action={<ButtonLink href="/create">Create a trade</ButtonLink>} />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="analytics-summary">
            <h2 id="analytics-summary" className="sr-only">Analytics summary</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total intents" value={data.totalIntents} detail="All execution modes" />
              <StatCard label="Unique makers" value={data.uniqueMakers} detail="Distinct wallets" />
              <StatCard label="Settlement rate" value={`${data.settlementRate}%`} detail={`${data.filled} filled`} />
              <StatCard label="Open trades" value={data.open} detail={`${data.pendingReveal} pending reveal`} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-xl font-medium text-white">Intent outcomes</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Open, filled, cancelled, and expired intents.</p>
              <div role="img" aria-label={`Donut chart: ${data.open} open, ${data.filled} filled, ${data.cancelled} cancelled, ${data.expired} expired intents`} className="mt-5 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={[{ name: "Open", value: data.open }, { name: "Filled", value: data.filled }, { name: "Cancelled", value: data.cancelled }, { name: "Expired", value: data.expired }].filter((item) => item.value > 0)} cx="50%" cy="45%" innerRadius={52} outerRadius={82} paddingAngle={3} dataKey="value">{CHART_COLORS.map((color) => <Cell key={color} fill={color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} /></PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-sm text-pretty text-[var(--color-text-secondary)]">{data.settlementRate}% of all intents have settled successfully. {data.open} remain available for counterparties.</p>
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-xl font-medium text-white">Execution modes</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Direct OTC compared with sealed RFQ usage.</p>
              <div role="img" aria-label={`Bar chart: ${data.directCount} direct OTC and ${data.rfqCount} sealed RFQ intents`} className="mt-5 h-64">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Direct OTC", value: data.directCount }, { name: "Sealed RFQ", value: data.rfqCount }]}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#a1a1aa", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#85858f", fontSize: 12 }} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#17171b" }} /><Bar dataKey="value" fill="#482bff" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
              </div>
              <p className="mt-2 text-sm text-pretty text-[var(--color-text-secondary)]">Direct OTC accounts for {Math.round((data.directCount / data.totalIntents) * 100)}% of intent creation.</p>
            </Card>
          </div>

          {data.timeline.length > 0 ? (
            <Card className="p-5 sm:p-6">
              <h2 className="font-display text-xl font-medium text-white">Activity timeline</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Daily intent creation over the latest 30 active days.</p>
              <div role="img" aria-label="Bar chart of daily intent creation" className="mt-6 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.timeline}><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#85858f", fontSize: 12 }} tickFormatter={(value) => value.slice(5)} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#85858f", fontSize: 12 }} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#17171b" }} /><Bar dataKey="count" fill="#482bff" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </Card>
          ) : null}

          {data.pairBreakdown.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="p-5 sm:p-6"><h2 className="font-display text-xl font-medium text-white">Pair breakdown</h2><p className="mt-2 text-sm text-[var(--color-text-secondary)]">Where trading interest is concentrated.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left"><thead className="border-y border-[var(--color-border)] bg-[var(--color-surface-low)] text-xs text-[var(--color-text-muted)]"><tr><th className="px-5 py-3 font-medium">Pair</th><th className="px-5 py-3 font-medium">Intents</th><th className="px-5 py-3 font-medium">Share</th></tr></thead><tbody className="divide-y divide-[var(--color-border)]">{data.pairBreakdown.map((pair) => <tr key={pair.pair}><td className="px-5 py-4 font-medium text-white">{pair.pair}</td><td className="px-5 py-4 font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">{pair.count}</td><td className="px-5 py-4 font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">{Math.round((pair.count / data.totalIntents) * 100)}%</td></tr>)}</tbody></table></div>
            </Card>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, detail }: { label: string; value: number | string; detail: string }) { return <Card className="p-5"><p className="text-sm text-[var(--color-text-secondary)]">{label}</p><p className="mt-3 font-mono text-3xl font-medium tabular-nums text-white">{value}</p><p className="mt-2 text-xs text-[var(--color-text-muted)]">{detail}</p></Card>; }
function AnalyticsSkeleton() { return <div className="space-y-6"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Card key={index} className="p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-10 w-20" /><Skeleton className="mt-3 h-3 w-28" /></Card>)}</div><div className="grid gap-6 lg:grid-cols-2"><Card className="p-6"><Skeleton className="h-6 w-40" /><Skeleton className="mt-6 h-64 w-full" /></Card><Card className="p-6"><Skeleton className="h-6 w-40" /><Skeleton className="mt-6 h-64 w-full" /></Card></div></div>; }
