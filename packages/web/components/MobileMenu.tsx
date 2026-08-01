"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const NAV: { href: Route; label: string; icon: string }[] = [
  { href: "/intents", label: "Intents", icon: "grid_view" },
  { href: "/create", label: "Create", icon: "add_circle" },
  { href: "/portfolio", label: "Portfolio", icon: "account_balance_wallet" },
  { href: "/faucet", label: "Faucet", icon: "water_drop" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-lg text-[--color-text-secondary] transition-colors hover:bg-[--color-surface-low] hover:text-[--color-foreground] md:hidden"
        aria-label="Toggle menu"
      >
        <span className="material-symbols-outlined text-xl">
          {open ? "close" : "menu"}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 top-14 z-40 bg-[--color-bg]/80 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="slide-down mx-3 mt-2 rounded-xl border border-[--color-border] bg-[--color-surface] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col gap-0.5 p-2">
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
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
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
          </div>
        </div>
      )}
    </>
  );
}
