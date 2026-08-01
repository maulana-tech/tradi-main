import Link from "next/link";
import type { Route } from "next";
import { Header } from "@/components/Header";
import { LiveStats } from "@/components/LiveStats";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CopyButton } from "@/components/CopyButton";
import { LatestIntentPreview } from "@/components/LatestIntentPreview";
import { TradiNoxLogo } from "@/components/TradiNoxLogo";

const PRIVATE_OTC_ADDRESS = (process.env.NEXT_PUBLIC_PRIVATE_OTC_ADDRESS ??
  "0x0") as `0x${string}`;
const CUSDC_ADDRESS = (process.env.NEXT_PUBLIC_CUSDC_ADDRESS ??
  "0x0") as `0x${string}`;
const CETH_ADDRESS = (process.env.NEXT_PUBLIC_CETH_ADDRESS ??
  "0x0") as `0x${string}`;
const RECEIPT_ADDRESS = (process.env.NEXT_PUBLIC_TRADI_NOX_RECEIPT_ADDRESS ??
  "0x0") as `0x${string}`;

const EXPLORER = "https://eth-sepolia.blockscout.com/address";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="pt-16">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[--color-primary]/[0.03] to-transparent" />
          <div className="relative mx-auto max-w-4xl px-6 pt-28 pb-24 text-center">
            <h1 className="mb-6 fade-up fade-up-1">
              <span className="block text-[clamp(2.25rem,6vw,3.5rem)] font-black leading-[1.1] tracking-tight text-[--color-foreground]">
                Your trade. Their guess.
              </span>
              <span className="mt-1 block text-[clamp(2.25rem,6vw,3.5rem)] font-black leading-[1.1] tracking-tight text-[--color-primary]">
                Nobody knows.
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-[--color-text-secondary] fade-up fade-up-2">
              On-chain OTC desk with encrypted amounts and Vickrey-fair price
              discovery. Built on the iExec Nox confidential computing protocol.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 fade-up fade-up-3">
              <Link href={"/intents" as Route}>
                <button className="tradi-nox-btn-primary px-7 py-3 text-sm">
                  Launch App
                </button>
              </Link>
              <a
                href="https://youtu.be/_tMBT32r_kQ"
                target="_blank"
                rel="noreferrer"
              >
                <button className="tradi-nox-btn-secondary px-7 py-3 text-sm">
                  Watch Demo
                </button>
              </a>
              <Link href={"/slides" as Route}>
                <button className="tradi-nox-btn-secondary px-7 py-3 text-sm">
                  View Pitch
                </button>
              </Link>
            </div>

            <LiveStats />

            <div className="mt-14">
              <LatestIntentPreview />
            </div>
          </div>
        </section>

        {/* ── Why ── */}
        <section className=" bg-[--color-surface]">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <div className="mb-14 text-center">
              <h2 className="text-headline-lg mb-3 text-[--color-foreground]">
                Why Tradi-Nox?
              </h2>
              <p className="text-sm text-[--color-text-secondary]">
                Three approaches to large OTC trades, compared.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <ComparisonCard
                title="Public DEX"
                subtitle="Uniswap, Curve"
                items={[
                  { text: "Full mempool transparency", tone: "danger" },
                  { text: "MEV sandwich attacks", tone: "danger" },
                  { text: "Slippage on size", tone: "danger" },
                ]}
              />
              <ComparisonCard
                title="Telegram OTC"
                subtitle="GSR, Wintermute"
                items={[
                  { text: "Manual counterparty trust", tone: "warning" },
                  { text: "No audit trail", tone: "warning" },
                  { text: "Information leakage", tone: "warning" },
                ]}
              />
              <ComparisonCard
                title="Tradi-Nox"
                subtitle="On-chain, confidential"
                highlight
                items={[
                  { text: "Encrypted amounts via Nox TEE", tone: "primary" },
                  { text: "Atomic settlement, no MEV", tone: "primary" },
                  { text: "Vickrey-fair RFQ pricing", tone: "primary" },
                  { text: "Composable with any ERC-20", tone: "primary" },
                ]}
              />
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <div className="mb-14 text-center">
              <h2 className="text-headline-lg mb-3 text-[--color-foreground]">
                How it works
              </h2>
              <p className="text-sm text-[--color-text-secondary]">
                Three layers of composable privacy.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <LayerCard
                icon="smart_toy"
                title="AI Layer"
                body="AI agents trade through MCP tools. One prompt, encrypted execution, no manual steps."
              />
              <LayerCard
                icon="autorenew"
                title="Automation"
                body="Autonomous agents handle market-making, RFQ sweeping, and settlement monitoring."
              />
              <LayerCard
                icon="lock"
                title="Protocol"
                body="Solidity contracts using Nox safeSub + select. Atomic conditional settlement."
              />
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-[--color-text-muted]">
              <a
                href={`${EXPLORER}/${PRIVATE_OTC_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-[--color-primary]"
              >
                PrivateOTC{" "}
                <span className="font-mono">
                  {PRIVATE_OTC_ADDRESS.slice(0, 6)}…{PRIVATE_OTC_ADDRESS.slice(-4)}
                </span>
              </a>
              <span className="hidden sm:inline">·</span>
              <a
                href="https://github.com/PugarHuda/tradi-nox"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-[--color-primary]"
              >
                Source code
              </a>
            </div>
          </div>
        </section>

        {/* ── Activity ── */}
        <ActivityFeed />

        {/* ── CTA ── */}
        <section className=" bg-[--color-surface]">
          <div className="mx-auto max-w-2xl px-6 py-24 text-center">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[--color-primary]/10">
              <TradiNoxLogo size={28} className="text-[--color-primary]" />
            </div>
            <h2 className="text-headline-lg mb-4 text-[--color-foreground]">
              Ready to trade privately?
            </h2>
            <p className="mb-8 text-sm text-[--color-text-secondary]">
              Institutional-grade confidentiality is no longer a luxury.
            </p>
            <Link href={"/faucet" as Route}>
              <button className="tradi-nox-btn-primary px-8 py-3 text-sm">
                Get started
              </button>
            </Link>
          </div>
        </section>
      </main>

      <footer className=" bg-[--color-surface]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <p className="text-label-caps mb-4">Contracts</p>
              <div className="space-y-2">
                <ContractRow name="PrivateOTC" address={PRIVATE_OTC_ADDRESS} />
                <ContractRow name="cUSDC" address={CUSDC_ADDRESS} />
                <ContractRow name="cETH" address={CETH_ADDRESS} />
                <ContractRow name="Receipt" address={RECEIPT_ADDRESS} />
              </div>
            </div>
            <div>
              <p className="text-label-caps mb-4">Resources</p>
              <div className="space-y-2 text-sm">
                <FooterLink
                  href="https://github.com/PugarHuda/tradi-nox"
                  label="GitHub"
                />
                <FooterLink
                  href="https://youtu.be/_tMBT32r_kQ"
                  label="Demo video"
                />
                <FooterLink
                  href="https://docs.iex.ec/nox-protocol/getting-started/welcome"
                  label="Nox docs"
                />
                <FooterLink
                  href="https://dorahacks.io/hackathon/vibe-coding-iexec"
                  label="Hackathon"
                />
              </div>
            </div>
            <div>
              <p className="text-label-caps mb-4">Network</p>
              <div className="space-y-2 text-sm text-[--color-text-secondary]">
                <p className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary]" />
                  TEE encryption active
                </p>
                <p>Ethereum Sepolia</p>
                <p className="font-mono text-xs text-[--color-text-muted]">
                  Chain ID 11155111
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3  pt-8 text-xs text-[--color-text-muted] sm:flex-row">
            <span className="flex items-center gap-2">
              <TradiNoxLogo
                size={14}
                className="text-[--color-primary]"
              />
              © 2026 Tradi-Nox
            </span>
            <span>Built on iExec Nox</span>
          </div>
        </div>
      </footer>
    </>
  );
}

function ContractRow({ name, address }: { name: string; address: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <a
        href={`${EXPLORER}/${address}`}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-[--color-text-secondary] transition-colors hover:text-[--color-primary]"
      >
        {name}
        <span className="ml-1 font-mono text-[--color-text-muted]">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      </a>
      <CopyButton value={address} />
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block text-[--color-text-secondary] transition-colors hover:text-[--color-primary]"
    >
      {label}
    </a>
  );
}

function ComparisonCard({
  title,
  subtitle,
  items,
  highlight,
}: {
  title: string;
  subtitle: string;
  highlight?: boolean;
  items: { text: string; tone: "danger" | "warning" | "primary" }[];
}) {
  const iconMap = { danger: "close", warning: "warning", primary: "check" };
  const colorMap = {
    danger: "text-[--color-danger]",
    warning: "text-[--color-warning]",
    primary: "text-[--color-primary]",
  };

  return (
    <div
      className={`rounded-xl border p-6 transition-shadow ${
        highlight
          ? "border-[--color-primary]/20 bg-[--color-primary]/[0.03] shadow-sm"
          : "border-[--color-border] bg-[--color-surface]"
      }`}
    >
      <div className="mb-5">
        <h3
          className={`text-sm font-semibold ${
            highlight ? "text-[--color-primary]" : "text-[--color-foreground]"
          }`}
        >
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-[--color-text-muted]">{subtitle}</p>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-sm text-[--color-text-secondary]"
          >
            <span
              className={`material-symbols-outlined mt-0.5 text-base ${colorMap[item.tone]}`}
            >
              {iconMap[item.tone]}
            </span>
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LayerCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-6 transition-shadow hover:shadow-sm">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-[--color-primary]/10">
        <span className="material-symbols-outlined text-xl text-[--color-primary]">
          {icon}
        </span>
      </div>
      <h4 className="mb-2 text-sm font-semibold text-[--color-foreground]">
        {title}
      </h4>
      <p className="text-sm leading-relaxed text-[--color-text-secondary]">
        {body}
      </p>
    </div>
  );
}
