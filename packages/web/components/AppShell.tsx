"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Header } from "./Header";
import { NetworkGuard } from "./NetworkGuard";
import { BalanceWidget } from "./BalanceWidget";
import { BottomNav } from "./BottomNav";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

type NavItem = { href: Route; label: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/strategies", label: "Strategies", icon: "storefront" },
      { href: "/notifications", label: "Notifications", icon: "notifications" },
    ],
  },
  {
    label: "Trading",
    items: [
      { href: "/intents", label: "Marketplace", icon: "grid_view" },
      { href: "/create", label: "Create Trade", icon: "add_circle" },
      { href: "/portfolio", label: "Portfolio", icon: "account_balance_wallet" },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/history" as Route, label: "Activity", icon: "history" },
      { href: "/analytics" as Route, label: "Analytics", icon: "analytics" },
      { href: "/faucet", label: "Faucet", icon: "water_drop" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/intents") {
    return pathname.startsWith("/intents") || pathname.startsWith("/rfq");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <Header />

      <aside className="fixed bottom-0 left-0 top-20 z-30 hidden w-72 border-r border-[var(--color-border)] bg-[var(--color-bg)] lg:flex lg:flex-col">
        <nav aria-label="Product navigation" className="flex-1 space-y-10 overflow-y-auto px-5 py-10">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-3 px-4 text-xs font-medium text-[var(--color-text-muted)]">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors duration-150 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] motion-reduce:transition-none",
                        active
                          ? "bg-[var(--color-primary-soft)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-white",
                      )}
                    >
                      <Icon name={icon} className="size-[18px]" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--color-border)] p-4">
          <div className="flex gap-4 px-3 text-sm text-[var(--color-text-secondary)]">
            <a
              href="https://docs.iex.ec/nox-protocol/getting-started/welcome"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center hover:text-white"
            >
              Docs
            </a>
            <a
              href="https://github.com/maulana-tech/tradi-main"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center hover:text-white"
            >
              Source
            </a>
          </div>
        </div>
      </aside>

      <div className="pt-20 lg:pl-72">
        <NetworkGuard />
        <main id="main-content" tabIndex={-1} className="min-h-[calc(100dvh-80px)] w-full pb-[calc(6rem+env(safe-area-inset-bottom))] pt-10 outline-none md:pb-16 lg:pb-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-10">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
      <BalanceWidget />
    </>
  );
}
