"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useAccount } from "wagmi";
import { Header } from "./Header";
import { NetworkGuard } from "./NetworkGuard";
import { BalanceWidget } from "./BalanceWidget";
import { shortAddress } from "@/lib/utils";

type NavItem = { href: Route; label: string; icon: string };

const NAV: NavItem[] = [
  { href: "/intents", label: "Intents", icon: "grid_view" },
  { href: "/create", label: "Create", icon: "swap_horiz" },
  { href: "/activity" as Route, label: "Activity", icon: "history" },
  { href: "/portfolio", label: "Portfolio", icon: "account_balance_wallet" },
  { href: "/faucet", label: "Faucet", icon: "water_drop" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  return (
    <>
      <Header />

      <aside className="fixed left-0 top-14 z-40 hidden h-[calc(100vh-3.5rem)] w-56 flex-col bg-[--color-surface] pb-4 lg:flex">
        <nav className="flex flex-1 flex-col gap-0.5 px-2.5 pt-3">
          {NAV.map(({ href, label, icon }) => {
            const active =
              href === "/intents"
                ? pathname.startsWith("/intents") ||
                  pathname.startsWith("/rfq")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[--color-primary]/10 text-[--color-primary]"
                    : "text-[--color-text-secondary] hover:bg-[--color-surface-low] hover:text-[--color-foreground]"
                }`}
              >
                <span className="material-symbols-outlined text-lg">
                  {icon}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 px-2.5">
          <Link href={"/create" as Route} className="block">
            <button className="w-full tradi-nox-btn-primary text-sm">
              New Intent
            </button>
          </Link>
          <div className="flex justify-between px-1">
            <a
              href="https://docs.iex.ec/nox-protocol/getting-started/welcome"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[--color-text-muted] hover:text-[--color-primary]"
            >
              Docs
            </a>
            <a
              href="https://github.com/PugarHuda/tradi-nox"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[--color-text-muted] hover:text-[--color-primary]"
            >
              Source
            </a>
          </div>
          {isConnected && address && (
            <div className="border-t border-[--color-border] pt-3 font-mono text-xs text-[--color-text-muted]">
              {shortAddress(address, 6)}
            </div>
          )}
        </div>
      </aside>

      <div className="pt-14">
        <NetworkGuard />
      </div>

      <main className="w-full pb-16 pt-4 lg:ml-56">
        <div className="mx-auto max-w-[960px] px-6">{children}</div>
      </main>

      <BalanceWidget />
    </>
  );
}
