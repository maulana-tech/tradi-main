"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[tradi-nox] unhandled error:", error); }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--color-bg)] px-4 py-12 sm:px-6">
      <Card className="w-full max-w-lg p-6 sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]"><Icon name="error" className="size-7" /></span>
        <h1 className="mt-6 font-display text-3xl font-medium text-balance text-white">Something interrupted this view.</h1>
        <p className="mt-4 text-base leading-7 text-pretty text-[var(--color-text-secondary)]">Your wallet session and on-chain state are unchanged. Retry this section, or return home and continue from another route.</p>
        <details className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-low)] p-4">
          <summary className="min-h-11 content-center text-sm font-semibold text-white">Technical details</summary>
          <p className="mt-2 break-all font-mono text-xs leading-5 text-[var(--color-text-secondary)]">{error.message}{error.digest ? ` · digest: ${error.digest}` : ""}</p>
        </details>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button className="flex-1" onClick={reset}><Icon name="restart_alt" className="size-4" />Retry</Button><ButtonLink href="/" tone="secondary" className="flex-1"><Icon name="home" className="size-4" />Home</ButtonLink></div>
      </Card>
    </main>
  );
}
