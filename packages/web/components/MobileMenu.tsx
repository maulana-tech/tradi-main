"use client";

import Link from "next/link";
import type { Route } from "next";
import { Menu } from "@base-ui/react/menu";
import { Icon } from "./Icon";

const MORE_NAV: { href: Route; label: string; icon: string }[] = [
  { href: "/prices" as Route, label: "Prices", icon: "candlestick_chart" },
  { href: "/analytics" as Route, label: "Analytics", icon: "analytics" },
  { href: "/faucet", label: "Faucet", icon: "water_drop" },
];

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-[var(--color-text-secondary)] outline-none data-[highlighted]:bg-[var(--color-primary-soft)] data-[highlighted]:text-white";

export function MobileMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="More destinations"
        className="mx-1 my-2 flex min-h-11 flex-col items-center justify-center gap-1 text-xs font-medium text-[var(--color-text-muted)] outline-none active:opacity-80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus)]"
      >
        <Icon name="menu" className="size-5" />
        More
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={12} className="z-50">
          <Menu.Popup className="w-56 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-2 shadow-xl outline-none transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none">
            {MORE_NAV.map(({ href, label, icon }) => (
              <Menu.Item key={href} render={<Link href={href} />} className={itemClass}>
                <Icon name={icon} className="size-[18px]" />
                {label}
              </Menu.Item>
            ))}
            <Menu.Separator className="my-2 h-px bg-[var(--color-border)]" />
            <Menu.Item
              render={
                <a
                  href="https://docs.iex.ec/nox-protocol/getting-started/welcome"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              className={itemClass}
            >
              <Icon name="menu_book" className="size-[18px]" />
              Docs
            </Menu.Item>
            <Menu.Item
              render={
                <a
                  href="https://github.com/maulana-tech/tradi-main"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              className={itemClass}
            >
              <Icon name="code" className="size-[18px]" />
              Source
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
