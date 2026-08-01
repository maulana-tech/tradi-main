"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const TABS: { href: Route; label: string; icon: string }[] = [
  { href: "/intents", label: "Book", icon: "grid_view" },
  { href: "/create", label: "New", icon: "add_circle" },
  { href: "/history" as Route, label: "History", icon: "history" },
  { href: "/analytics" as Route, label: "Stats", icon: "analytics" },
  { href: "/portfolio", label: "Wallet", icon: "account_balance_wallet" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 z-50 w-full border-t border-[--color-border] bg-[--color-surface]/95 backdrop-blur-md md:hidden">
      <div className="flex items-stretch">
        {TABS.map(({ href, label, icon }) => {
          const active =
            href === "/intents"
              ? pathname.startsWith("/intents") || pathname.startsWith("/rfq")
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-medium transition-colors ${
                active
                  ? "text-[--color-primary]"
                  : "text-[--color-text-muted] active:text-[--color-text-secondary]"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] leading-none transition-transform ${
                  active ? "scale-110" : ""
                }`}
                style={{ fontVariationSettings: active ? '"FILL" 1' : '"FILL" 0' }}
              >
                {icon}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      {/* safe area padding for iPhone */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
