/**
 * Corner brackets overlay for emphasis on important UI.
 * Pure decoration — pointer-events-none, doesn't affect layout.
 */
export function CornerBrackets({
  color = "primary",
  size = "md",
}: {
  color?: "primary" | "muted";
  size?: "sm" | "md" | "lg";
}) {
  const colorClass =
    color === "primary"
      ? "border-[--color-primary]/60"
      : "border-[--color-border]";
  const dimClass =
    size === "sm" ? "h-2 w-2" : size === "lg" ? "h-4 w-4" : "h-3 w-3";

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className={`absolute left-0 top-0 ${dimClass} border-l border-t ${colorClass}`} />
      <div className={`absolute right-0 top-0 ${dimClass} border-r border-t ${colorClass}`} />
      <div className={`absolute bottom-0 left-0 ${dimClass} border-b border-l ${colorClass}`} />
      <div className={`absolute bottom-0 right-0 ${dimClass} border-b border-r ${colorClass}`} />
    </div>
  );
}
