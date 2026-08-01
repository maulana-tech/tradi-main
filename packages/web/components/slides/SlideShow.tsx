"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { SLIDES } from "./slides";
import { SlideShell } from "./SlideShell";

/**
 * Deck controller. Owns:
 *   - active slide index (synced to ?slide=N)
 *   - timer state (per-slide elapsed + total elapsed since first activity)
 *   - timer visibility toggle
 *
 * Keys:
 *   →  Space  PageDown          → next
 *   ←  PageUp                   → prev
 *   Home / End                  → first / last
 *   1-9                         → jump to that slide
 *   F                           → toggle fullscreen
 *   T                           → toggle timer HUD
 *   R                           → reset both timers
 *   ESC (when not fullscreen)   → back to "/"
 */
export function SlideShow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = clampSlide(Number(searchParams.get("slide")) || 1);
  const [index, setIndex] = useState(initial - 1);
  const [timerVisible, setTimerVisible] = useState(true);

  // Timer anchors live in refs so a tick re-render doesn't reset them.
  // `now` (ms) is the only state that changes on each tick.
  const slideStartRef = useRef<number>(Date.now());
  const totalStartRef = useRef<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  const total = SLIDES.length;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === index) return;
      setIndex(clamped);
      slideStartRef.current = Date.now();
      const params = new URLSearchParams(searchParams.toString());
      params.set("slide", String(clamped + 1));
      router.replace(
        `/slides?${params.toString()}` as Route,
        { scroll: false },
      );
    },
    [router, searchParams, total, index],
  );

  const resetTimers = useCallback(() => {
    const t = Date.now();
    slideStartRef.current = t;
    totalStartRef.current = t;
    setNow(t);
  }, []);

  // 1Hz tick. Cheap because state is just a number, no DOM thrash beyond
  // the timer text. Could go to 100ms for sub-second feel but the eye can
  // barely tell at this scale and battery cost goes up.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Keyboard handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
          e.preventDefault();
          goTo(index + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          goTo(index - 1);
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(total - 1);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "t":
        case "T":
          e.preventDefault();
          setTimerVisible((v) => !v);
          break;
        case "r":
        case "R":
          e.preventDefault();
          resetTimers();
          break;
        case "Escape":
          if (!document.fullscreenElement) {
            router.push("/");
          }
          break;
        default:
          if (/^[1-9]$/.test(e.key)) {
            const n = Number(e.key) - 1;
            if (n < total) goTo(n);
          }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, total, router, resetTimers]);

  const slide = SLIDES[index];
  if (!slide) return null;

  const slideElapsedSec = Math.floor((now - slideStartRef.current) / 1000);
  const totalElapsedSec = Math.floor((now - totalStartRef.current) / 1000);

  return (
    <main
      className="relative cursor-pointer select-none"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("a, button, [role='button']")) return;
        goTo(index + 1);
      }}
    >
      <SlideShell
        index={index}
        total={total}
        marker={slide.marker}
        budgetSec={slide.budgetSec}
        slideElapsedSec={slideElapsedSec}
        totalElapsedSec={totalElapsedSec}
        timerVisible={timerVisible}
      >
        {slide.render()}
      </SlideShell>
    </main>
  );
}

function clampSlide(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > SLIDES.length) return SLIDES.length;
  return n;
}

function toggleFullscreen() {
  if (typeof document === "undefined") return;
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}
