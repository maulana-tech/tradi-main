"use client";

import { useId, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/Icon";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  suffix?: string;
};

export function Field({
  id: providedId,
  label,
  hint,
  error,
  suffix,
  className,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-foreground)]">
        {label}{props.required ? <span aria-hidden="true" className="ml-1 text-[var(--color-danger-text)]">*</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-errormessage={error ? `${id}-error` : undefined}
          className={cn("tradi-nox-input", suffix ? "pr-20" : undefined, className)}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-xs text-[var(--color-text-secondary)]">
            {suffix}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-[var(--color-danger-text)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-[var(--color-text-secondary)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id: providedId,
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </label>
      <div className="relative">
        <select id={id} className={cn("tradi-nox-input appearance-none pr-12", className)} {...props}>
          {children}
        </select>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
        />
      </div>
    </div>
  );
}
