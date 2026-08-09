"use client";

import Link from "next/link";
import type { Route } from "next";
import { ConnectWallet } from "./ConnectWallet";
import { NetworkBadge } from "./NetworkBadge";
import { TradiLogo } from "./TradiLogo";
import { Icon } from "./Icon";
import { usePathname } from "next/navigation";

const LANDING_LINKS = [
  { href: "#products", label: "Products" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#trust", label: "Trust" },
];

export function Header() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-20 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-5 sm:px-10">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Link
        href={"/" as Route}
        aria-label="Tradi home"
        className="flex min-h-11 shrink-0 items-center gap-3 rounded-full text-white transition-opacity duration-150 hover:opacity-80 motion-reduce:transition-none"
      >
        <span className="grid size-10 place-items-center rounded-full bg-[var(--color-primary)] text-white">
          <TradiLogo size={20} />
        </span>
        <span className="font-display text-base font-normal">Tradi</span>
      </Link>

      {isLanding ? (
        <nav aria-label="Landing page" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {LANDING_LINKS.map((item) => (
            <a key={item.href} href={item.href} className="flex min-h-11 items-center text-sm text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-white motion-reduce:transition-none">
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}

      <div className="flex items-center gap-2 sm:gap-3">
        <NetworkBadge />
        <Link
          href={"/create" as Route}
          className="hidden min-h-11 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-primary-hover)] active:opacity-80 sm:inline-flex motion-reduce:transition-none"
        >
          <Icon name="add" className="size-4" />
          Create trade
        </Link>
        <ConnectWallet />
      </div>
    </header>
  );
}
