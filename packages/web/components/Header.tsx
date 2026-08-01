"use client";

import Link from "next/link";
import type { Route } from "next";
import { ConnectWallet } from "./ConnectWallet";
import { MobileMenu } from "./MobileMenu";
import { TradiNoxLogo } from "./TradiNoxLogo";

export function Header() {
  return (
    <nav className="fixed left-0 top-0 z-50 flex h-14 w-full items-center justify-between bg-[--color-surface] px-4 lg:px-5">
      <Link
        href={"/" as Route}
        className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
      >
        <TradiNoxLogo size={18} className="text-[--color-primary]" />
        <span className="text-sm font-bold tracking-tight text-[--color-primary]">
          Tradi-Nox
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <ConnectWallet />
        <MobileMenu />
      </div>
    </nav>
  );
}
