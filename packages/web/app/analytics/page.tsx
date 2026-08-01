"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonRow } from "@/components/Skeleton";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#124d1c", "#4a7c5a", "#b8860b", "#c0392b", "#9c9c94"];

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  return (
    <AppShell>
      <PageHeader
        icon="analytics"
        title="Analytics"
        subtitle="On-chain activity overview"
      />

      {isLoading || !data ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <tbody className="divide-y divide-[--color-border]/50">
              <SkeletonRow /><SkeletonRow /><SkeletonRow />
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total Intents" value={data.totalIntents} />
            <StatCard label="Unique Makers" value={data.uniqueMakers} />
            <StatCard label="Settlement Rate" value={`${data.settlementRate}%`} />
            <StatCard label="Open Orders" value={data.open} />
          </div>

          {/* Status + Mode charts */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="glass-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-[--color-foreground]">By Status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Open", value: data.open },
                      { name: "Filled", value: data.filled },
                      { name: "Cancelled", value: data.cancelled },
                      { name: "Expired", value: data.expired },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e4e2dc",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-[--color-foreground]">By Mode</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[
                  { name: "Limit Order", value: data.directCount },
                  { name: "RFQ Auction", value: data.rfqCount },
                ]}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e4e2dc",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#124d1c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Timeline */}
          {data.timeline.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-[--color-foreground]">Activity Timeline</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.timeline}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e4e2dc",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#124d1c" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pair breakdown */}
          {data.pairBreakdown.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-3">
                <h3 className="text-sm font-semibold text-[--color-foreground]">Pair Breakdown</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-t border-[--color-border] bg-[--color-surface-low]/30 text-left text-xs text-[--color-text-muted]">
                    <th className="px-5 py-2 font-medium">Pair</th>
                    <th className="px-5 py-2 font-medium">Count</th>
                    <th className="px-5 py-2 font-medium">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--color-border]/50">
                  {data.pairBreakdown.map((p) => (
                    <tr key={p.pair} className="text-sm">
                      <td className="px-5 py-2.5 font-medium text-[--color-foreground]">{p.pair}</td>
                      <td className="px-5 py-2.5 font-mono text-xs">{p.count}</td>
                      <td className="px-5 py-2.5 text-xs text-[--color-text-secondary]">
                        {Math.round((p.count / data.totalIntents) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-[--color-primary]/5 p-4 text-center">
      <p className="text-xs text-[--color-text-muted]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[--color-primary]">{value}</p>
    </div>
  );
}
