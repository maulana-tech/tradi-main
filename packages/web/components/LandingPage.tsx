import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { LiveStats } from "@/components/LiveStats";
import { ActivityFeed } from "@/components/ActivityFeed";
import { LatestIntentPreview } from "@/components/LatestIntentPreview";
import { TradiNoxLogo } from "@/components/TradiNoxLogo";
import { Icon } from "@/components/Icon";
import { ButtonLink } from "@/components/ui/Button";
import { PRIVATE_OTC_ADDRESS } from "@/lib/wagmi";

const EXPLORER = "https://eth-sepolia.blockscout.com/address";

const PRODUCT_CHOICES = [
  {
    eyebrow: "Known price target",
    title: "Direct OTC",
    body: "Set a private minimum and let the first qualifying counterparty settle both assets atomically.",
    href: "/create/direct" as Route,
    cta: "Create direct trade",
  },
  {
    eyebrow: "Private price discovery",
    title: "Sealed RFQ",
    body: "Collect encrypted bids, identify the winner, and settle at the second-highest price.",
    href: "/create/rfq" as Route,
    cta: "Open sealed RFQ",
  },
];

const STEPS = [
  {
    title: "Create the intent",
    body: "Choose assets and terms. Sensitive values are encrypted before the wallet transaction is prepared.",
  },
  {
    title: "Receive a response",
    body: "A counterparty accepts directly or submits a sealed bid without seeing your private threshold.",
  },
  {
    title: "Settle atomically",
    body: "Both assets move in one settlement. If the trade conditions fail, neither participant is left exposed.",
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
                Confidential OTC · Ethereum Sepolia
              </p>
              <h1 id="hero-title" className="text-display mt-8">
                Private markets, without public size.
              </h1>
              <p className="mt-8 max-w-[62ch] text-lg leading-8 text-pretty text-[var(--color-text-secondary)]">
                Create encrypted OTC intents, discover a fair price, and settle atomically without exposing your size or minimum to the market.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/intents" size="lg">
                  Explore private trades
                  <Icon name="arrow_forward" className="size-4" />
                </ButtonLink>
                <ButtonLink href="/create" tone="secondary" size="lg">
                  Launch a trade
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
                    Encrypted state via Nox
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

        <section id="products" aria-labelledby="products-title" className="scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-10 lg:py-[120px]">
            <SectionIntro
              eyebrow="Choose your execution"
              titleId="products-title"
              title="One private desk. Two ways to trade."
              body="Start with the outcome you need. Encryption and settlement details appear only when they help you take the next safe action."
            />
            <div className="mt-16 grid border-y border-[var(--color-border)] lg:grid-cols-2">
              {PRODUCT_CHOICES.map((choice, index) => (
                <article key={choice.title} className="group flex flex-col border-b border-[var(--color-border)] py-10 last:border-b-0 lg:min-h-80 lg:border-b-0 lg:border-r lg:px-10 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
                  <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                    <span className="font-mono tabular-nums text-[var(--color-primary-text)]">0{index + 1}</span>
                    <span>{choice.eyebrow}</span>
                  </div>
                  <h3 className="mt-10 font-display text-[2.375rem] font-normal leading-tight tracking-[-0.038rem] text-balance text-white">
                    {choice.title}
                  </h3>
                  <p className="mt-5 max-w-[55ch] text-base leading-7 text-pretty text-[var(--color-text-secondary)]">
                    {choice.body}
                  </p>
                  <Link href={choice.href} className="mt-auto inline-flex min-h-11 items-center gap-2 self-start pt-10 font-semibold text-white underline decoration-[var(--color-primary)] underline-offset-4">
                    {choice.cta}
                    <Icon name="arrow_forward" className="size-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="steps-title" className="scroll-mt-20 bg-[var(--color-primary)] text-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-10 lg:py-[120px]">
            <p className="text-sm font-medium text-white/75">How it works</p>
            <h2 id="steps-title" className="mt-4 max-w-[18ch] font-display text-[clamp(2.5rem,5vw,3.125rem)] font-normal leading-[1.1] tracking-[-0.0625rem] text-balance">
              From private intent to final settlement.
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

        <section id="trust" aria-labelledby="trust-title" className="scroll-mt-20">
          <div className="mx-auto grid max-w-7xl gap-16 px-5 py-20 sm:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:py-[120px]">
            <SectionIntro
              eyebrow="Trust and technology"
              titleId="trust-title"
              title="Private by design. Verifiable by anyone."
              body="Review the protocol details when you need them. The primary trading flow stays focused on the next safe action."
            />
            <div className="space-y-3">
              <TechDisclosure title="What keeps trade amounts private?">
                Amounts and thresholds are encrypted off-chain and represented as Nox handles on-chain. Observers verify state transitions without reading the private values.
              </TechDisclosure>
              <TechDisclosure title="Why is operator permission required?">
                Atomic settlement transfers assets for both participants. Each holder explicitly authorizes PrivateOTC before settlement, and the interface treats this as a visible preparation step.
              </TechDisclosure>
              <TechDisclosure title="How does sealed RFQ pricing work?">
                The highest encrypted bid wins and pays the second-highest price. This Vickrey design encourages bidders to submit their real valuation.
              </TechDisclosure>
              <TechDisclosure title="Can I inspect the contracts?">
                <a href={`${EXPLORER}/${PRIVATE_OTC_ADDRESS}`} target="_blank" rel="noreferrer" className="font-semibold text-white underline decoration-[var(--color-primary)] underline-offset-4">View PrivateOTC on the explorer</a>
                {" or "}
                <a href="https://github.com/maulana-tech/tradi-main" target="_blank" rel="noreferrer" className="font-semibold text-white underline decoration-[var(--color-primary)] underline-offset-4">inspect the source code</a>.
              </TechDisclosure>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-10 lg:pb-[120px]">
          <div className="rounded-[24px] bg-[var(--color-primary)] px-6 py-16 text-center text-white sm:px-10 lg:py-20">
            <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(2.5rem,5vw,3.125rem)] font-normal leading-[1.1] tracking-[-0.0625rem] text-balance">
              Make your first private trade.
            </h2>
            <p className="mx-auto mt-5 max-w-[58ch] text-lg leading-8 text-pretty text-white/80">
              Get Sepolia test tokens, authorize settlement, and experience the complete confidential OTC flow.
            </p>
            <div className="mt-10 flex justify-center">
              <ButtonLink href="/faucet" size="lg" className="border-white bg-white text-[var(--color-primary)] hover:border-white hover:bg-white/90">
                Get testnet funds
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 text-sm text-[var(--color-text-secondary)] sm:px-10 md:flex-row md:items-center md:justify-between">
          <span className="flex items-center gap-2 text-white"><TradiNoxLogo size={16} className="text-[var(--color-primary-text)]" />Tradi-Nox</span>
          <div className="flex flex-wrap gap-8"><a href="https://docs.iex.ec/nox-protocol/getting-started/welcome" target="_blank" rel="noreferrer" className="flex min-h-11 items-center hover:text-white">Nox docs</a><a href="https://github.com/maulana-tech/tradi-main" target="_blank" rel="noreferrer" className="flex min-h-11 items-center hover:text-white">Source</a><Link href="/slides" className="flex min-h-11 items-center hover:text-white">Pitch deck</Link></div>
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

function TechDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-[var(--color-border)] py-3 first:border-t open:border-[var(--color-border-control)]">
      <summary className="flex min-h-11 list-none items-center justify-between gap-4 font-semibold text-white marker:hidden">
        {title}
        <Icon name="expand_more" className="size-5 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <p className="max-w-[65ch] pb-2 pt-3 text-sm leading-6 text-pretty text-[var(--color-text-secondary)]">{children}</p>
    </details>
  );
}
