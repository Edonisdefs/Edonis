import { toNumber, type DecimalLike } from "@/lib/money";

const LOCALE = "de-DE";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
});

const numberFormatter = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateLongFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value: DecimalLike): string {
  return currencyFormatter.format(toNumber(value));
}

export function formatNumber(value: DecimalLike): string {
  return numberFormatter.format(toNumber(value));
}

export function formatQuantity(value: DecimalLike, unit?: string | null): string {
  const formatted = numberFormatter.format(toNumber(value));
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatHours(value: DecimalLike): string {
  const hours = toNumber(value);
  const formatted = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: hours % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(hours);
  return `${formatted} ${hours === 1 ? "Stunde" : "Stunden"}`;
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "–";
  return dateFormatter.format(date);
}

export function formatDateLong(value: Date | string | null | undefined): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "–";
  return dateLongFormatter.format(date);
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "–";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "–";
  return timeFormatter.format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "–";
  return `${formatDate(value)}, ${formatTime(value)} Uhr`;
}

/** `2026-09-04` – für <input type="date"> */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${`${rest}`.padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAddress(parts: {
  street?: string | null;
  zip?: string | null;
  city?: string | null;
}): string {
  const line1 = parts.street?.trim();
  const line2 = [parts.zip?.trim(), parts.city?.trim()].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join(", ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function relativeDayLabel(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const diffDays = Math.round((startOfDate - startOfToday) / 86_400_000);

  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays === -1) return "Gestern";
  return formatDate(date);
}
