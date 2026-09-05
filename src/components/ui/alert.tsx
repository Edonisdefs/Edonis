import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const TONES = {
  info: {
    className: "border-info/25 bg-info-soft text-info",
    Icon: Info,
  },
  success: {
    className: "border-success/25 bg-success-soft text-success",
    Icon: CheckCircle2,
  },
  warning: {
    className: "border-warning/25 bg-warning-soft text-warning",
    Icon: AlertTriangle,
  },
  danger: {
    className: "border-danger/25 bg-danger-soft text-danger",
    Icon: XCircle,
  },
} as const;

export function Alert({
  tone = "info",
  title,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm",
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={cn(title && "mt-0.5", "leading-relaxed")}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
