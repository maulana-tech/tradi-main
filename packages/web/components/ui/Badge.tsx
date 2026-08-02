import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral:
          "border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)]",
        primary:
          "border-[var(--color-primary)]/50 bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]",
        success:
          "border-[var(--color-success)]/40 bg-[var(--color-success-soft)] text-[var(--color-success-text)]",
        warning:
          "border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]",
        danger:
          "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function Status({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: VariantProps<typeof badgeVariants>["tone"];
}) {
  return (
    <Badge tone={tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}
