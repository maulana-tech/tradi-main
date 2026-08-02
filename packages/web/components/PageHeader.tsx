import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function PageHeader({
  icon,
  title,
  subtitle,
  badge,
  action,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-10 flex flex-col justify-between gap-6 border-b border-[var(--color-border)] pb-8 sm:flex-row sm:items-end">
      <div className="flex max-w-3xl items-start gap-3">
        <Icon name={icon} className="mt-2 size-5 shrink-0 text-[var(--color-primary-text)]" />
        <div>
          <h1 className="font-display text-[clamp(2rem,4vw,2.375rem)] font-normal leading-tight tracking-[-0.038rem] text-balance text-[var(--color-foreground)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {(badge || action) && (
        <div className="flex items-center gap-3">
          {badge}
          {action}
        </div>
      )}
    </header>
  );
}

export function SectionHeader({
  icon,
  title,
  right,
}: {
  icon?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
        {icon && (
          <Icon name={icon} className="size-4 text-[var(--color-primary-text)]" />
        )}
        {title}
      </h3>
      {right}
    </div>
  );
}
