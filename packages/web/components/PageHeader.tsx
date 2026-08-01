import type { ReactNode } from "react";

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
    <header className="mb-8 flex items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[--color-primary]/10">
          <span className="material-symbols-outlined text-xl text-[--color-primary]">
            {icon}
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[--color-foreground]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-[--color-text-secondary]">
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
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[--color-foreground]">
        {icon && (
          <span className="material-symbols-outlined text-base text-[--color-primary]">
            {icon}
          </span>
        )}
        {title}
      </h3>
      {right}
    </div>
  );
}
