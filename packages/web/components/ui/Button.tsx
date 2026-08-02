import Link from "next/link";
import type { Route } from "next";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";

export const buttonVariants = cva(
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-[background-color,border-color,color,opacity] duration-150 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
  {
    variants: {
      tone: {
        primary:
          "border border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]",
        secondary:
          "border border-[var(--color-border-control)] bg-transparent text-[var(--color-foreground)] hover:border-[var(--color-primary-border)] hover:bg-[var(--color-primary-soft)] hover:text-white",
        ghost:
          "border border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-white",
        danger:
          "border border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-strong)]",
      },
      size: {
        sm: "min-h-11 px-4 text-sm",
        md: "min-h-12 px-5 text-sm",
        lg: "min-h-14 px-7 text-base",
        icon: "size-11 p-0",
      },
      loading: { true: "cursor-wait" },
    },
    defaultVariants: { tone: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loadingLabel?: string;
  };

export function Button({
  children,
  className,
  loading,
  loadingLabel = "Working…",
  disabled,
  tone,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || Boolean(loading)}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ tone, size, loading }), className)}
      {...props}
    >
      {loading ? <Icon name="sync" className="size-4 animate-spin" /> : null}
      {loading ? loadingLabel : children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  className,
  tone,
  size,
  external = false,
}: {
  href: Route | string;
  children: ReactNode;
  className?: string;
  tone?: VariantProps<typeof buttonVariants>["tone"];
  size?: VariantProps<typeof buttonVariants>["size"];
  external?: boolean;
}) {
  const styles = cn(buttonVariants({ tone, size }), className);
  if (external) {
    return (
      <a href={href.toString()} target="_blank" rel="noreferrer" className={styles}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href as Route} className={styles}>
      {children}
    </Link>
  );
}
