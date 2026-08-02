export function Skeleton({
  className = "",
  variant = "block",
}: {
  className?: string;
  variant?: "block" | "text" | "circle";
}) {
  const base = "animate-pulse bg-[var(--color-surface-low)]";
  const shape =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
        ? "h-3 rounded"
        : "rounded";

  return <div aria-hidden="true" className={cn(base, shape, className)} />;
}

export function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--color-border)]">
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" variant="circle" />
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-6 w-6" variant="circle" />
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-32" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-6 w-16 ml-auto" />
      </td>
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
import { cn } from "@/lib/utils";
