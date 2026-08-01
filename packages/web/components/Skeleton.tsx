export function Skeleton({
  className = "",
  variant = "block",
}: {
  className?: string;
  variant?: "block" | "text" | "circle";
}) {
  const base = "animate-pulse bg-[--color-surface-low] rounded";
  const shape =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
        ? "h-3 rounded"
        : "rounded";

  return <div className={`${base} ${shape} ${className}`} />;
}

export function SkeletonRow() {
  return (
    <tr className="border-b border-[--color-border]">
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
    <div className="rounded-lg border border-[--color-border] bg-[--color-surface] space-y-3 p-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
