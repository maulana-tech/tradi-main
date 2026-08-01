"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;

        if (!mounted) {
          return (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-lg bg-[--color-primary] px-3 py-1.5 text-xs font-semibold text-[--color-primary-fg] opacity-70"
            >
              <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
              Connect Wallet
            </button>
          );
        }

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="inline-flex items-center gap-2 rounded-lg bg-[--color-primary] px-3 py-1.5 text-xs font-semibold text-[--color-primary-fg] hover:bg-[#1a6b2e]"
            >
              <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="inline-flex items-center gap-2 rounded-lg bg-[--color-danger] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Wrong Network
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="inline-flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-surface-low] px-3 py-1.5 text-xs font-medium text-[--color-foreground] transition-colors hover:bg-[--color-border]/50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[--color-primary]" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
