import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

export type TransactionStep = {
  label: string;
  description?: string;
  state: "pending" | "active" | "complete" | "error";
};

export function TransactionProgress({ steps }: { steps: TransactionStep[] }) {
  return (
    <ol aria-label="Transaction progress" className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold",
              step.state === "complete" && "border-[var(--color-success)] bg-[var(--color-success)] text-black",
              step.state === "active" && "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]",
              step.state === "error" && "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]",
              step.state === "pending" && "border-[var(--color-border)] text-[var(--color-text-secondary)]",
            )}
          >
            {step.state === "complete" ? <Icon name="check" className="size-4" /> : index + 1}
          </span>
          <div className="pt-1">
            <p className="text-sm font-medium text-[var(--color-foreground)]">{step.label}</p>
            {step.description ? (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
