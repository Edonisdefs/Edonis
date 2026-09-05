import * as React from "react";

import { cn } from "@/lib/utils";

const baseControl =
  "w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-foreground shadow-none transition-colors placeholder:text-subtle focus:border-primary focus:outline-none disabled:bg-surface-muted disabled:text-muted";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(baseControl, "h-12", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(baseControl, "min-h-28 resize-y leading-relaxed", className)}
      {...props}
    />
  );
}

/**
 * Bewusst das native <select>: Auf dem Smartphone öffnet es den
 * Systemauswahldialog – schneller und zuverlässiger als jede eigene Liste.
 */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(baseControl, "h-12 appearance-none pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath d='M5.5 7.5L10 12l4.5-4.5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        backgroundSize: "18px",
      }}
      {...props}
    />
  );
}

export function Label({
  className,
  required,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    >
      {props.children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string[] | string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("w-full", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint && !message ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
      {message ? (
        <p className="mt-1 text-xs font-medium text-danger">{message}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-5 shrink-0 rounded-md border-border-strong text-primary accent-[var(--color-primary)]",
        className,
      )}
      {...props}
    />
  );
}
