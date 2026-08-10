import Link from "next/link";
import type { Route } from "next";
import { Header } from "@/components/Header";
import { LiveStats } from "@/components/LiveStats";
import { ActivityFeed } from "@/components/ActivityFeed";
import { LatestIntentPreview } from "@/components/LatestIntentPreview";
import { TradiLogo } from "@/components/TradiLogo";
import { Icon } from "@/components/Icon";
import { ButtonLink } from "@/components/ui/Button";

const EXPLORER = "https://eth-sepolia.blockscout.com/address";

const PLATFORM_FEATURES = [
  {
    icon: "storefront",
    title: "Strategy Marketplace",
    body: "Browse and deploy automated trading strategies — from market-making to sealed-bid RFQ — each powered by AI decision-making.",
    href: "/strategies" as Route,
    cta: "Browse strategies",
  },
  {
    icon: "dashboard",
    title: "Agent Dashboard",
    body: "Monitor deployed agents, start and stop strategies, track performance — all from one control panel.",
    href: "/dashboard" as Route,
    cta: "Open dashboard",
  },
  {
    icon: "swap_horiz",
    title: "Private OTC Desk",
    body: "Create encrypted OTC trades with hidden amounts. Direct trades or sealed-bid Vickrey auctions with atomic settlement.",
    href: "/intents" as Route,
    cta: "Explore trades",
  },
];

const STEPS = [
  {
    title: "Choose a strategy",
    body: "Pick from the marketplace — market-maker, RFQ finalizer, settlement monitor, or create your own OTC trade.",
  },
  {
    title: "Configure and deploy",
    body: "Set your parameters, choose writer mode, and deploy. The agent runs continuously powered by Hermes AI and KeeperHub execution.",
  },
  {
    title: "Monitor and settle",
    body: "Track live performance on the dashboard. Every transaction is verified on-chain with full audit trail from KeeperHub.",
  },
];

export function LandingPage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="pt-20 outline-none">
        <section aria-labelledby="hero-title" className="border-b border-[var(--color-border)]">
          <div className="mx-auto grid min-w-0 max-w-7xl grid-cols-1 gap-20 px-5 py-20 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.86fr)] lg:items-center lg:py-[120px]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-primary-text)]">
                AI-Powered Trading Platform · Arbitrum Sepolia
              </p>
              <h1 id="hero-title" className="text-display mt-8">
                Automated strategies, private execution.
              </h1>
              <p className="mt-8 max-w-[62ch] text-lg leading-8 text-pretty text-[var(--color-text-secondary)]">
                Deploy AI agents that trade for you. Browse strategies in the marketplace, configure parameters, and let Hermes AI + KeeperHub handle execution — with encrypted amounts and atomic settlement.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/strategies" size="lg">
                  Browse strategies
                  <Icon name="arrow_forward" className="size-4" />
                </ButtonLink>
                <ButtonLink href="/dashboard" tone="secondary" size="lg">
                  Open dashboard
                </ButtonLink>
              </div>
              <LiveStats />
            </div>

            <div className="min-w-0 rounded-[24px] bg-[var(--color-primary)] p-6 text-white sm:p-8">
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/75">Active intent</p>
                    <h2 className="mt-2 font-display text-[2.375rem] font-normal leading-tight tracking-[-0.038rem] text-balance">
                      cETH → cUSDC
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-white/75">
                    <Icon name="lock" className="size-3.5" />
                    Amount sealed
                  </span>
                </div>
                <div className="mt-10 overflow-hidden rounded-[20px] bg-black">
                  <LatestIntentPreview />
                </div>
                <div className="mt-6 flex flex-col justify-between gap-4 text-sm sm:flex-row sm:items-center">
                  <span className="flex items-center gap-2 text-white/75">
                    <Icon name="shield" className="size-4" />
                    Powered by KeeperHub execution
                  </span>
                  <Link href="/intents" className="inline-flex min-h-11 items-center gap-2 font-semibold text-white underline decoration-white/50 underline-offset-4">
                    View live market
                    <Icon name="arrow_forward" className="size-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" aria-labelledby="platform-title" className="scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-10 lg:py-[120px]">
            <SectionIntro
              eyebrow="The Tradi Platform"
              titleId="platform-title"
              title="One dashboard. Multiple strategies. Full control."
              body="Tradi connects AI decision-making with reliable on-chain execution. Deploy agents, monitor performance, and manage everything from a single interface."
            />
            <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_FEATURES.map((feature) => (
                <Link key={feature.title} href={feature.href} className="group">
                  <div className="flex h-full flex-col rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all duration-200 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-raised)]">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)]">
                      <Icon name={feature.icon} className="size-5 text-[var(--color-primary-text)]" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-white group-hover:text-[var(--color-primary-text)]">
                      {feature.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                      {feature.body}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary-text)]">
                      {feature.cta}
                      <Icon name="arrow_forward" className="size-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="steps-title" className="scroll-mt-20 bg-[var(--color-primary)] text-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-10 lg:py-[120px]">
            <p className="text-sm font-medium text-white/75">How it works</p>
            <h2 id="steps-title" className="mt-4 max-w-[18ch] font-display text-[clamp(2.5rem,5vw,3.125rem)] font-normal leading-[1.1] tracking-[-0.0625rem] text-balance">
              Deploy in three steps.
            </h2>
            <ol className="mt-20 grid border-y border-white/25 lg:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="border-b border-white/25 py-10 last:border-b-0 lg:border-b-0 lg:border-r lg:px-10 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
                  <span className="font-mono text-sm tabular-nums text-white/70">0{index + 1}</span>
                  <h3 className="mt-10 font-display text-2xl font-normal text-balance">{step.title}</h3>
                  <p className="mt-4 max-w-[44ch] text-base leading-7 text-pretty text-white/80">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <ActivityFeed />

        <section id="stack" aria-labelledby="stack-title" className="scroll-mt-20">
          <div className="mx-auto grid max-w-7xl gap-16 px-5 py-20 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-[120px]">
            <SectionIntro
              eyebrow="Built on"
              titleId="stack-title"
              title="AI decisions. Reliable execution. Encrypted state."
              body="Tradi combines Hermes AI for strategy decisions, KeeperHub for transaction reliability, and TEE-encrypted handles for private state."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Hermes AI", desc: "Reads state, compares prices, decides skip/bid/finalize", icon: "psychology" },
                { label: "KeeperHub", desc: "Simulates, broadcasts, monitors transactions with gas sponsorship", icon: "hub" },
                { label: "Encrypted State", desc: "Trade amounts stay hidden via TEE-encrypted handles", icon: "lock" },
                { label: "Atomic Settlement", desc: "Both assets move in one transaction or nothing happens", icon: "sync_lock" },
              ].map((item) => (
                <div key={item.label} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <div className="flex items-center gap-3">
                    <Icon name={item.icon} className="size-5 text-[var(--color-primary-text)]" />
                    <h3 className="font-semibold text-white">{item.label}</h3>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-10 lg:pb-[120px]">
          <div className="rounded-[24px] bg-[var(--color-primary)] px-6 py-16 text-center text-white sm:px-10 lg:py-20">
            <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(2.5rem,5vw,3.125rem)] font-normal leading-[1.1] tracking-[-0.0625rem] text-balance">
              Deploy your first strategy.
            </h2>
            <p className="mx-auto mt-5 max-w-[58ch] text-lg leading-8 text-pretty text-white/80">
              Browse the marketplace, configure parameters, and deploy an AI agent that trades for you — powered by Hermes and KeeperHub.
            </p>
            <div className="mt-10 flex justify-center">
              <ButtonLink href="/strategies" size="lg" className="border-white bg-white text-[var(--color-primary)] hover:border-white hover:bg-white/90">
                Browse strategies
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 text-sm text-[var(--color-text-secondary)] sm:px-10 md:flex-row md:items-center md:justify-between">
          <span className="flex items-center gap-2 text-white"><TradiLogo size={16} className="text-[var(--color-primary-text)]" />Tradi</span>
          <div className="flex flex-wrap gap-8"><a href="https://github.com/maulana-tech/tradi-main" target="_blank" rel="noreferrer" className="flex min-h-11 items-center hover:text-white">Source</a><Link href="/slides" className="flex min-h-11 items-center hover:text-white">Pitch deck</Link><Link href="/dashboard" className="flex min-h-11 items-center hover:text-white">Dashboard</Link></div>
          <span>Ethereum Sepolia · 2026</span>
        </div>
      </footer>
    </>
  );
}

function SectionIntro({ eyebrow, titleId, title, body }: { eyebrow: string; titleId: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-medium text-[var(--color-primary-text)]">{eyebrow}</p>
      <h2 id={titleId} className="mt-4 text-headline-xl">{title}</h2>
      <p className="mt-5 max-w-[62ch] text-lg leading-8 text-pretty text-[var(--color-text-secondary)]">{body}</p>
    </div>
  );
}


