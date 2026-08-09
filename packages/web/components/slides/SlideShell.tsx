"use client";

import { TradiLogo } from "@/components/TradiLogo";

type Props = {
  index: number;
  total: number;
  marker?: string;
  /** Recommended speaking time for this slide, seconds. */
  budgetSec: number;
  /** Live elapsed time on the current slide, seconds. */
  slideElapsedSec: number;
  /** Live elapsed time across the whole pitch, seconds. */
  totalElapsedSec: number;
  /** Whether the user has timer HUD turned on (toggled with `T`). */
  timerVisible: boolean;
  children: React.ReactNode;
  bg?: "default" | "plain";
};

export function SlideShell({
  index,
  total,
  marker,
  budgetSec,
  slideElapsedSec,
  totalElapsedSec,
  timerVisible,
  children,
  bg = "default",
}: Props) {
  const progress = ((index + 1) / total) * 100;

  // Color tier for slide timer. 0-79% = neutral, 80-99% = warning, ≥100% = danger.
  const ratio = budgetSec > 0 ? slideElapsedSec / budgetSec : 0;
  const slideTimerClass =
    ratio >= 1
      ? "text-[--color-danger]"
      : ratio >= 0.8
        ? "text-[--color-warning]"
        : "text-[--color-text]";

  return (
    <section
      className="relative grid h-screen w-screen place-items-center overflow-hidden bg-[--color-bg] px-8 py-16 md:px-16"
      data-slide={index}
    >
      {bg === "default" && (
        <>
          <div className="pointer-events-none absolute inset-0 opacity-20" />
          <div className="pointer-events-none absolute inset-0 opacity-30" />
        </>
      )}

      <div className="pointer-events-none absolute left-0 top-0 z-30 h-[2px] w-full bg-[--color-surface-low]">
        <div
          className="h-full bg-[--color-primary] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="absolute left-8 top-6 z-20 flex items-center gap-2.5 md:left-12">
        <TradiLogo size={20} className="text-[--color-primary]" />
        <span className="font-display text-sm font-bold tracking-tighter text-[--color-primary]">
          TRADI-NOX
        </span>
      </div>

      <div className="absolute right-8 top-6 z-20 flex flex-col items-end gap-1 font-mono text-[10px] tracking-[0.3em] md:right-12">
        <div className="flex items-center gap-3 text-[--color-text-muted]">
          <span data-numeric>
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
          {marker && (
            <>
              <span className="text-[--color-text-muted]">·</span>
              <span className="text-[--color-primary]/70">{marker}</span>
            </>
          )}
        </div>

        {timerVisible && (
          <div
            className="flex items-center gap-3 text-[9px] tracking-[0.25em]"
            data-numeric
          >
            <span className={slideTimerClass}>
              SLIDE {fmt(slideElapsedSec)} / {fmt(budgetSec)}
            </span>
            <span className="text-[--color-border]">·</span>
            <span className="text-[--color-text-muted]">TOTAL {fmt(totalElapsedSec)}</span>
          </div>
        )}
      </div>

      <div className="z-10 mx-auto w-full max-w-[1100px]">{children}</div>

      <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center gap-4 font-mono text-[10px] tracking-[0.25em] text-[--color-text-muted]">
        <span>← PREV</span>
        <span className="text-[--color-border]">·</span>
        <span>SPACE / → NEXT</span>
        <span className="text-[--color-border]">·</span>
        <span>F FULLSCREEN</span>
        <span className="text-[--color-border]">·</span>
        <span>T TIMER</span>
        <span className="text-[--color-border]">·</span>
        <span>R RESET</span>
        <span className="text-[--color-border]">·</span>
        <span>ESC EXIT</span>
      </div>
    </section>
  );
}

function fmt(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
