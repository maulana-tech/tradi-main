import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/Icon";

const MODES = [
  {
    href: "/create/direct" as Route,
    title: "Direct OTC",
    description: "Set an encrypted minimum and let the first qualifying counterparty settle atomically.",
    benefit: "Fast execution at a price you control",
    meta: ["Private minimum", "Single taker", "Atomic settlement"],
  },
  {
    href: "/create/rfq" as Route,
    title: "Sealed RFQ",
    description: "Collect private bids and settle with the winner at the second-highest price.",
    benefit: "Fair price discovery for larger trades",
    meta: ["Sealed bids", "Up to 10 bidders", "Vickrey pricing"],
  },
];

export default function CreatePage() {
  return (
    <AppShell>
      <PageHeader
        icon="add_circle"
        title="Create a private trade"
        subtitle="Choose the execution that matches your goal. You can review every term before signing."
      />

      <div className="border-b border-[var(--color-border)]">
        {MODES.map((mode) => (
          <Link
            key={mode.href}
            href={mode.href}
            className="group grid min-h-44 gap-6 border-t border-[var(--color-border)] py-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3"
          >
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
                <h2 className="font-display text-3xl font-normal text-balance text-white">{mode.title}</h2>
                <p className="text-sm font-medium text-[var(--color-primary-text)]">{mode.benefit}</p>
              </div>
              <p className="mt-4 text-base leading-7 text-pretty text-[var(--color-text-secondary)]">{mode.description}</p>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--color-text-muted)]">
                {mode.meta.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <span className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-white group-hover:text-[var(--color-primary-text)] sm:self-center">
              Continue <Icon name="arrow_forward" className="size-4" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex max-w-3xl items-start gap-4 border-l-2 border-[var(--color-primary)] py-1 pl-5">
        <Icon name="shield" className="mt-0.5 size-5 shrink-0 text-[var(--color-primary-text)]" />
        <div>
          <h2 className="text-sm font-semibold text-white">Private outcome protection</h2>
          <p className="mt-1 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">
            If encrypted conditions are not met, settlement resolves without exposing which private threshold failed. You keep your price strategy private either way.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
