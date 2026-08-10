"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export function StarRating({
  strategyId,
  initialRating = 0,
  initialCount = 0,
  interactive = false,
  size = "sm",
}: {
  strategyId: string;
  initialRating?: number;
  initialCount?: number;
  interactive?: boolean;
  size?: "sm" | "md";
}) {
  const [rating, setRating] = useState(initialRating);
  const [count, setCount] = useState(initialCount);
  const [hovered, setHovered] = useState(0);
  const [voted, setVoted] = useState(false);

  async function handleVote(value: number) {
    if (!interactive || voted) return;
    setVoted(true);
    try {
      const res = await fetch("/api/strategies/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId, rating: value }),
      });
      const data = (await res.json()) as { rating: { rating: number; count: number } };
      if (data.rating) {
        setRating(data.rating.rating);
        setCount(data.rating.count);
      }
    } catch {
      setVoted(false);
    }
  }

  const starSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = value <= (hovered || rating);
        return (
          <button
            key={value}
            type="button"
            disabled={!interactive || voted}
            onMouseEnter={() => interactive && setHovered(value)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => handleVote(value)}
            className={`${interactive && !voted ? "cursor-pointer hover:scale-110" : "cursor-default"} transition`}
          >
            <Icon
              name={filled ? "star" : "star_outline"}
              className={`${starSize} ${filled ? "text-yellow-400" : "text-[var(--color-text-muted)]"}`}
            />
          </button>
        );
      })}
      {count > 0 && (
        <span className="ml-1 text-xs text-[var(--color-text-muted)]">
          ({count})
        </span>
      )}
    </div>
  );
}
