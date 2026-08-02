import { Icon } from "./Icon";

const SYMBOL_GLYPH: Record<string, { glyph: string; tone: "primary" | "neutral" }> = {
  cUSDC: { glyph: "$", tone: "neutral" },
  cETH: { glyph: "Ξ", tone: "primary" },
  cBTC: { glyph: "₿", tone: "primary" },
  USDC: { glyph: "$", tone: "neutral" },
  ETH: { glyph: "Ξ", tone: "primary" },
};

export function TokenIcon({ symbol, size = "md" }: { symbol: string; size?: "sm" | "md" | "lg" }) {
  const config = SYMBOL_GLYPH[symbol] ?? { glyph: symbol[0]?.toUpperCase() ?? "?", tone: "neutral" };
  const dimensions = { sm: "size-7 text-xs", md: "size-10 text-base", lg: "size-14 text-2xl" }[size];
  const tone = config.tone === "primary" ? "border-[var(--color-primary-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]" : "border-[var(--color-border)] bg-[var(--color-surface-low)] text-white";
  return (
    <span aria-label={symbol} className={`relative grid shrink-0 place-items-center rounded-full border ${tone} ${dimensions} font-display font-semibold`}>
      {config.glyph}
      {symbol.startsWith("c") ? <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border border-[var(--color-primary-border)] bg-[var(--color-bg)] font-mono text-xs text-[var(--color-primary-text)]">c</span> : null}
    </span>
  );
}

export function PairIcon({ from, to, size = "md" }: { from: string; to: string; size?: "sm" | "md" }) {
  return <div className="flex items-center gap-2"><TokenIcon symbol={from} size={size} /><Icon name="arrow_forward" className="size-4 text-[var(--color-primary-text)]" /><TokenIcon symbol={to} size={size} /></div>;
}
