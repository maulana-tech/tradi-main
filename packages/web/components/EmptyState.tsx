import type { ReactNode } from "react";
import { Icon } from "./Icon";

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
    <div className="border-y border-[var(--color-border)] px-6 py-16 text-center">
      <Icon name={icon} className="mx-auto mb-5 size-6 text-[var(--color-primary-text)]" />
      <p className="text-sm font-medium text-[var(--color-foreground)]">{title}</p>
      {body && (
        <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-[var(--color-text-secondary)]">{body}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
