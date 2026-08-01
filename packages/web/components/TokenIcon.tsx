const SYMBOL_GLYPH: Record<string, { glyph: string; tone: "primary" | "neutral" }> = {
  cUSDC: { glyph: "$", tone: "neutral" },
  cETH: { glyph: "Ξ", tone: "primary" },
  cBTC: { glyph: "₿", tone: "primary" },
  USDC: { glyph: "$", tone: "neutral" },
  ETH: { glyph: "Ξ", tone: "primary" },
};

export function TokenIcon({
  symbol,
  size = "md",
}: {
  symbol: string;
  size?: "sm" | "md" | "lg";
}) {
  const cfg = SYMBOL_GLYPH[symbol] ?? { glyph: symbol[0]?.toUpperCase() ?? "?", tone: "neutral" };

  const dims = {
    sm: "h-7 w-7 text-xs",
    md: "h-10 w-10 text-base",
    lg: "h-14 w-14 text-2xl",
  }[size];

  const toneClass =
    cfg.tone === "primary"
      ? "border-[--color-primary]/40 bg-[--color-primary]/10 text-[--color-primary]"
      : "border-[--color-border] bg-[--color-surface-low] text-[--color-text]";

  return (
    <div
      className={`relative grid place-items-center border ${toneClass} ${dims} font-display font-bold`}
    >
      {cfg.glyph}
      {symbol.startsWith("c") && (
        <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center border border-[--color-primary]/60 bg-[--color-bg] font-mono text-[8px] text-[--color-primary]">
          c
        </span>
      )}
    </div>
  );
}

export function PairIcon({
  from,
  to,
  size = "md",
}: {
  from: string;
  to: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-2">
      <TokenIcon symbol={from} size={size} />
      <span className="material-symbols-outlined text-[--color-primary]">
        arrow_forward
      </span>
      <TokenIcon symbol={to} size={size} />
    </div>
  );
}
