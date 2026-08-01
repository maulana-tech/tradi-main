"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const MORE_NAV: { href: Route; label: string; icon: string }[] = [
  { href: "/prices" as Route, label: "Prices", icon: "candlestick_chart" },
  { href: "/faucet", label: "Faucet", icon: "water_drop" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-lg text-[--color-text-secondary] transition-colors hover:bg-[--color-surface-low] hover:text-[--color-foreground] md:hidden"
        aria-label="More options"
      >
        <span className="material-symbols-outlined text-xl">
          {open ? "close" : "more_horiz"}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 top-14 z-40 bg-black/20 backdrop-blur-[2px] md:hidden">
          <div
            ref={ref}
            className="slide-down mx-3 mt-2 overflow-hidden rounded-xl border border-[--color-border] bg-[--color-surface] shadow-xl"
          >
            <nav className="flex flex-col gap-0.5 p-2">
              {MORE_NAV.map(({ href, label, icon }) => {
                const active = pathname.startsWith(href);
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
