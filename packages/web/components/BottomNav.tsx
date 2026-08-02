"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { Icon } from "./Icon";
import { MobileMenu } from "./MobileMenu";
import { cn } from "@/lib/utils";

const TABS: { href: Route; label: string; icon: string }[] = [
  { href: "/intents", label: "Market", icon: "grid_view" },
  { href: "/create", label: "Create", icon: "add_circle" },
  { href: "/portfolio", label: "Portfolio", icon: "account_balance_wallet" },
  { href: "/history" as Route, label: "Activity", icon: "history" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-bg)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid h-20 grid-cols-5">
        {TABS.map(({ href, label, icon }) => {
          const active =
            href === "/intents"
              ? pathname.startsWith("/intents") || pathname.startsWith("/rfq")
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mx-1 my-2 flex min-h-11 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150 active:opacity-80",
                active ? "text-white" : "text-[var(--color-text-muted)]",
              )}
            >
              <Icon name={icon} className={cn("size-5", active && "text-[var(--color-primary-text)]")} />
              {label}
            </Link>
          );
        })}
        <MobileMenu />
      </div>
    </nav>
  );
}
