import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "neutral" | "warning" | "success" | "danger" | "primary";
  icon?: React.ReactNode;
}) {
  const toneClass = {
    neutral: "text-foreground",
    warning: "text-warning",
    success: "text-success",
    danger: "text-danger",
    primary: "text-primary",
  }[tone];

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        {icon ? <span className="text-subtle">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums", toneClass)}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </>
  );

  const className = cn(
    "block rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
    href && "transition-colors hover:border-border-strong hover:bg-surface-muted",
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
