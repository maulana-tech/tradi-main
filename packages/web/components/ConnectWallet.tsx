"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Icon } from "./Icon";

const walletClass =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-white transition-colors duration-150 hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] sm:px-4";

export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        if (!mounted) {
          return (
            <button type="button" disabled className={walletClass}>
              <Icon name="account_balance_wallet" className="size-4" />
              <span className="hidden sm:inline">Connect wallet</span>
            </button>
          );
        }
        if (!connected) {
          return (
            <button type="button" onClick={openConnectModal} className={walletClass}>
              <Icon name="account_balance_wallet" className="size-4" />
              <span className="hidden sm:inline">Connect wallet</span>
              <span className="sm:hidden">Connect</span>
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button type="button" onClick={openChainModal} className={`${walletClass} border-[var(--color-warning)]/50 text-[var(--color-warning-text)]`}>
              Wrong network
            </button>
          );
        }
        return (
          <button type="button" onClick={openAccountModal} className={walletClass}>
            <span className="size-2 rounded-full bg-[var(--color-success)]" aria-hidden="true" />
            <span className="max-w-28 truncate">{account.displayName}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
