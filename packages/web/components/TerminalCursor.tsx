/**
 * Blinking terminal cursor — for hero text or anywhere "live" feel needed.
 */
export function TerminalCursor({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`inline-block h-[1em] w-[0.55em] -mb-0.5 bg-[--color-primary] ${className}`}
      aria-hidden
    />
  );
}
