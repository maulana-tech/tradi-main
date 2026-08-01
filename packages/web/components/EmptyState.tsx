import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[--color-border] bg-[--color-surface] p-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-[--color-surface-low]">
        <span className="material-symbols-outlined text-2xl text-[--color-text-muted]">
          {icon}
        </span>
      </div>
      <p className="text-sm font-medium text-[--color-foreground]">{title}</p>
      {body && (
        <p className="mt-1 text-sm text-[--color-text-secondary]">{body}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
