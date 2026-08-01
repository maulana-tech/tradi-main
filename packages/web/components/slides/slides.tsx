"use client";

import Link from "next/link";
import type { Route } from "next";
import { TradiNoxLogo } from "@/components/TradiNoxLogo";

/**
 * Pitch deck content. 7 slides for a 4-minute target (220s budget,
 * 20s buffer). Order here defines navigation order — reordering this
 * array is the only thing needed to swap slides around.
 *
 * Each slide carries:
 *   - marker:    short ribbon label shown top-right
 *   - budgetSec: recommended speaking time, drives the timer HUD
 *   - render:    function returning slide JSX (function so fade-up
 *                animations replay on every navigate-back)
 */
export type Slide = {
  marker: string;
  budgetSec: number;
  render: () => React.ReactNode;
};

export const SLIDES: Slide[] = [
  // ─────────── 01 · Title (15s) ───────────────────────────────────
  {
    marker: "TITLE",
    budgetSec: 15,
    render: () => (
      <div className="flex flex-col items-center text-center">
        <TradiNoxLogo
          size={140}
          variant="full"
          className="mb-10 text-[--color-primary] fade-up"
        />
        <h1 className="font-display text-[clamp(3rem,8vw,6rem)] font-bold leading-none tracking-tighter text-[--color-primary] fade-up fade-up-1">
          TRADI-NOX
        </h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.4em] text-[--color-text-muted] fade-up fade-up-2">
          Confidential · OTC · Desk
        </p>
        <p className="mt-12 max-w-2xl text-2xl font-light tracking-wide text-[--color-text] fade-up fade-up-3">
          Your trade. <span className="text-[--color-primary]">Their guess.</span>{" "}
          Nobody knows.
        </p>
        <p className="mt-12 font-mono text-[10px] uppercase tracking-[0.3em] text-[--color-text-muted] fade-up fade-up-4">
          iExec Vibe Coding Challenge · April 2026 · Built solo with Claude Code
        </p>
      </div>
    ),
  },

  // ─────────── 02 · Problem + Cost (40s) ──────────────────────────
  {
    marker: "01 · PROBLEM",
    budgetSec: 40,
    render: () => (
      <div className="space-y-10">
        <p className="fade-up">[ 01 ] · The leak</p>
        <h2 className="text-headline-xl text-[--color-foreground] fade-up fade-up-1">
          On-chain OTC{" "}
          <span className="text-[--color-danger]">leaks everything.</span>
        </h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 fade-up fade-up-2">
          {["Order size", "Side", "Counterparty", "Price"].map((field) => (
            <div
              key={field}
              className="border border-[--color-danger]/40 bg-[--color-danger]/5 p-4"
            >
              <div className="text-label-caps mb-1 text-[10px] text-[--color-danger]">
                EXPOSED
              </div>
              <div className="font-display text-base text-[--color-foreground]">{field}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-[--color-border] pt-6 md:grid-cols-[auto,1fr] md:gap-10 fade-up fade-up-3">
          <div>
            <div className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-none tracking-tighter text-[--color-primary]">
              $50M
            </div>
            <div className="mt-2 text-label-caps text-[--color-text-muted]">
              SELL ORDER COST
            </div>
          </div>
          <p className="text-lg leading-relaxed text-[--color-text]">
            moves the market{" "}
            <span className="text-[--color-danger]">2% against the maker</span>{" "}
            before they execute. That is why{" "}
            <span className="text-[--color-primary]">
              &gt;95% of institutional OTC volume
            </span>{" "}
            still happens off-chain — Telegram, Genesis, Cumberland, FalconX.
          </p>
        </div>
      </div>
    ),
  },

  // ─────────── 03 · Solution + How (45s) ──────────────────────────
  {
    marker: "02 · SOLUTION",
    budgetSec: 45,
    render: () => (
      <div className="space-y-8">
        <p className="fade-up">[ 02 ] · Sealed on-chain</p>
        <h2 className="text-headline-lg text-[--color-foreground] fade-up fade-up-1">
          What if the amount was{" "}
          <span className="text-[--color-primary]">sealed on-chain</span>?
        </h2>

        {/* Flow diagram */}
        <div className="flex items-center justify-between gap-2 fade-up fade-up-2">
          <FlowNode icon="account_balance" label="MAKER" />
          <FlowSeal label="euint256 · TEE-sealed" />
          <FlowNode icon="deployed_code" label="CONTRACT" />
          <FlowSeal label="still sealed" />
          <FlowNode icon="handshake" label="TAKER" />
        </div>

        {/* 3 pillars */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 fade-up fade-up-3">
          {[
            {
              i: "01",
              title: "TEE encryption",
              body: "`euint256` handles. Plaintext only inside Nox precompile — never on-chain.",
            },
            {
              i: "02",
              title: "Sealed Vickrey RFQ",
              body: "Winner + second-price computed entirely on encrypted handles. Only result revealed.",
            },
            {
              i: "03",
              title: "Atomic settlement",
              body: "`safeSub` + `select` make it all-or-nothing. No partial leaks.",
            },
          ].map((p) => (
            <div
              key={p.i}
              className="flex flex-col gap-2 border border-[--color-primary]/30 bg-[--color-primary]/5 p-4"
            >
              <div className="font-mono text-[10px] tracking-widest text-[--color-primary]/70">
                {p.i}
              </div>
              <div className="font-display text-sm font-semibold text-[--color-foreground]">
                {p.title}
              </div>
              <p className="text-xs leading-relaxed text-[--color-text-secondary]">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ─────────── 04 · Architecture (15s) ────────────────────────────
  {
    marker: "03 · STACK",
    budgetSec: 15,
    render: () => (
      <div className="space-y-8">
        <p className="fade-up">[ 03 ] · Stack</p>
        <h2 className="text-headline-lg text-[--color-foreground] fade-up fade-up-1">
          End-to-end on Ethereum Sepolia ·{" "}
          <span className="text-[--color-primary]">4 packages, one repo.</span>
        </h2>

        <div className="grid grid-cols-1 gap-3 font-mono text-sm md:grid-cols-2 fade-up fade-up-2">
          {[
            {
              label: "contracts/",
              desc: "PrivateOTC.sol + TradiNoxCToken (ERC-7984) · Foundry · Slither · 100% line coverage",
            },
            {
              label: "web/",
              desc: "Next.js 16 + wagmi v2 + RainbowKit · server components",
            },
            {
              label: "agents/",
              desc: "4 autonomous workers: market-maker · RFQ sweeper · monitor · coach",
            },
            {
              label: "mcp-server/",
              desc: "Desk exposed as 3 AI-callable tools — Claude can trade through Tradi-Nox",
            },
          ].map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-1 border border-[--color-border] bg-[--color-bg]/40 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-[--color-primary]">▸</span>
                <span className="font-display text-base font-bold text-[--color-primary]">
                  {row.label}
                </span>
              </div>
              <p className="pl-5 text-xs leading-relaxed text-[--color-text-secondary]">
                {row.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  // ─────────── 05 · Demo (60s) — THE WOW ──────────────────────────
  {
    marker: "04 · DEMO",
    budgetSec: 60,
    render: () => (
      <div className="space-y-10 text-center">
        <p className="fade-up">[ 04 ] · Live</p>
        <h2 className="text-headline-xl text-[--color-foreground] fade-up fade-up-1">
          Live on{" "}
          <span className="text-[--color-primary]">Ethereum Sepolia</span> right
          now.
        </h2>

        <div className="mx-auto max-w-2xl space-y-4 fade-up fade-up-2">
          <a
            href="https://private-otc.vercel.app"
            target="_blank"
            rel="noreferrer"
            className="glass-card block border border-[--color-primary]/30 px-8 py-6 transition"
          >
            <div className="text-label-caps text-[--color-primary]">
              OPEN THE DAPP
            </div>
            <div className="mt-2 font-mono text-2xl tracking-wider text-[--color-foreground]">
              private-otc.vercel.app
            </div>
          </a>

          <div className="grid grid-cols-1 gap-2 font-mono text-[11px] md:grid-cols-3">
            {[
              { k: "PrivateOTC", v: "0x5b2C…CEB4" },
              { k: "cUSDC", v: "0x5773…2ADE" },
              { k: "cETH", v: "0xCdD8…695d" },
            ].map((c) => (
              <div
                key={c.k}
                className="border border-[--color-border] bg-[--color-bg]/40 px-3 py-2 text-left"
              >
                <div className="text-label-caps text-[--color-text-muted]">{c.k}</div>
                <div className="mt-1 tracking-widest text-[--color-text]">{c.v}</div>
              </div>
            ))}
          </div>
        </div>

        <Link
          href={"/intents" as Route}
          className="tradi-nox-btn-primary inline-flex items-center gap-2 px-8 py-4 fade-up fade-up-3"
        >
          <span className="material-symbols-outlined text-base">
            play_arrow
          </span>
          TRY THE VICKREY REVEAL
        </Link>
      </div>
    ),
  },

  // ─────────── 06 · Craft + Built (35s) ───────────────────────────
  {
    marker: "05 · CRAFT",
    budgetSec: 35,
    render: () => (
      <div className="space-y-8">
        <p className="fade-up">[ 05 ] · Engineering</p>
        <h2 className="text-headline-lg text-[--color-foreground] fade-up fade-up-1">
          Caught a real Vickrey bug{" "}
          <span className="text-[--color-primary]">
            before mainnet ever saw it.
          </span>
        </h2>

        <div className="border border-[--color-primary]/30 bg-[--color-primary]/5 p-5 font-mono text-sm fade-up fade-up-2">
          <p className="mb-3 text-[--color-text]">
            Pure-Solidity mirror of the Vickrey algorithm, fuzzed 256 runs:
          </p>
          <pre className="whitespace-pre-wrap break-all text-xs leading-relaxed text-[--color-primary]">
{`bids = [100, 300, 200]
expected second-price = 200
got                    = 100   ← BUG`}
          </pre>
          <p className="mt-3 text-[--color-text]">
            Missing middle case in `_computeSecondPrice`. Three-line fix with a
            nested <code className="text-[--color-primary]">Nox.select</code>.
            Without that mirror, that bug ships.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 fade-up fade-up-3">
          {[
            { k: "100%", v: "logic coverage" },
            { k: "30+", v: "Foundry tests · fork mode" },
            { k: "0", v: "Slither high/medium" },
          ].map((s) => (
            <div
              key={s.k}
              className="border border-[--color-border] bg-[--color-bg]/40 p-3 text-center"
            >
              <div className="font-display text-xl font-bold text-[--color-primary]">
                {s.k}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-[--color-text-muted]">
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[--color-text-muted] fade-up fade-up-4">
          → One developer · 5 days · 4 packages · Claude Code Opus 4.7
        </p>
      </div>
    ),
  },

  // ─────────── 07 · FIN (10s) ─────────────────────────────────────
  {
    marker: "FIN",
    budgetSec: 10,
    render: () => (
      <div className="flex flex-col items-center text-center">
        <TradiNoxLogo
          size={96}
          variant="full"
          className="mb-8 text-[--color-primary] fade-up"
        />
        <h2 className="font-display text-[clamp(2.5rem,7vw,5rem)] font-bold leading-none tracking-tighter text-[--color-foreground] fade-up fade-up-1">
          Your trade.
          <br />
          <span className="text-[--color-primary]">Their guess.</span>
          <br />
          Nobody knows.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-3 font-mono text-xs md:grid-cols-3 fade-up fade-up-2">
          {[
            { k: "Demo", v: "private-otc.vercel.app" },
            { k: "Source", v: "github.com/PugarHuda/tradi-nox" },
            { k: "BUIDL", v: "dorahacks.io · iexec-vibe-coding" },
          ].map((c) => (
            <div
              key={c.k}
              className="border border-[--color-primary]/30 bg-[--color-primary]/5 px-4 py-3"
            >
              <div className="text-label-caps text-[--color-primary]">{c.k}</div>
              <div className="mt-1 tracking-widest text-[--color-text]">{c.v}</div>
            </div>
          ))}
        </div>

        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-[--color-text-muted] fade-up fade-up-3">
          Thank you · iExec · Claude Code
        </p>
      </div>
    ),
  },
];

// ─────────── Helpers used inside slide JSX ──────────────────────────

function FlowNode({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid h-16 w-16 place-items-center border border-[--color-primary]/40 bg-[--color-primary]/5">
        <span className="material-symbols-outlined text-2xl text-[--color-primary]">
          {icon}
        </span>
      </div>
      <span className="text-label-caps text-[10px] text-[--color-text-secondary]">{label}</span>
    </div>
  );
}

function FlowSeal({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`h-4 w-1.5 ${i === 3 ? "" : "bg-[--color-primary]/40"}`}
          />
        ))}
      </div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-[--color-primary]">
        {label}
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[--color-primary]/40 to-transparent" />
    </div>
  );
}
