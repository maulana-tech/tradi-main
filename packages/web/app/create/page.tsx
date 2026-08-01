import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { HelpHint } from "@/components/Tooltip";

export default function CreatePage() {
  return (
    <AppShell>
      <PageHeader
        icon="add_circle"
        title="New Order"
        subtitle="Choose order type"
      />

      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ModeCard
          href="/create/direct"
          title="Limit Order"
          description="Set your price with a hidden minimum. First qualifying taker fills atomically. Amounts stay encrypted until settlement."
          icon="lock"
          stats={[
            { label: "Latency", value: "< 5s" },
            { label: "Privacy", value: "End-to-end" },
          ]}
        />
        <ModeCard
          href="/create/rfq"
          title="RFQ Mode"
          description="Multi-bidder sealed auction. Highest sealed bid wins, pays second-highest price. Optimal execution for size."
          icon="hub"
          stats={[
            { label: "Pricing", value: "Vickrey" },
            { label: "Max bidders", value: "10" },
          ]}
          highlight
        />
      </div>

      <div className="mt-6 rounded-lg border border-[--color-border] bg-[--color-surface] p-5">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-xl text-[--color-primary]">
            gpp_good
          </span>
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[--color-foreground]">
              Strategy B Guarantee
              <HelpHint content="When a bid is below your hidden minimum, the contract uses Nox.safeSub + Nox.select to route encrypted zeros instead of real amounts. The on-chain status is always Filled — observers cannot distinguish a successful trade from a rejected one." />
            </p>
            <p className="text-sm leading-relaxed text-[--color-text-secondary]">
              When a bid falls below your hidden minimum, Tradi-Nox settles as
              an atomic no-op. The on-chain status is always{" "}
              <span className="font-medium text-[--color-primary]">Filled</span>{" "}
              — observers cannot distinguish success from rejection.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ModeCard({
  href,
  title,
  description,
  icon,
  stats,
  highlight,
}: {
  href: Route;
  title: string;
  description: string;
  icon: string;
  stats: { label: string; value: string }[];
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-lg border p-6 transition-all hover:shadow-sm ${
        highlight
          ? "border-[--color-primary]/20 bg-[--color-primary]/[0.03]"
          : "border-[--color-border] bg-[--color-surface] hover:border-[--color-primary]/30"
      }`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[--color-primary]/10">
          <span className="material-symbols-outlined text-xl text-[--color-primary]">
            {icon}
          </span>
        </div>
        {highlight && (
          <span className="rounded-full bg-[--color-primary]/10 px-2 py-0.5 text-xs font-medium text-[--color-primary]">
            Recommended
          </span>
        )}
      </div>

      <h2 className="mb-1 text-base font-semibold text-[--color-foreground]">
        {title}
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-[--color-text-secondary]">
        {description}
      </p>

      <div className="flex gap-6 border-t border-[--color-border] pt-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-[--color-text-muted]">{s.label}</p>
            <p className="mt-0.5 text-sm font-medium text-[--color-primary]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[--color-primary] transition-all group-hover:gap-2.5">
        Continue
        <span className="material-symbols-outlined text-base">
          arrow_forward
        </span>
      </span>
    </Link>
  );
}
