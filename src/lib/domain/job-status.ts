import type { InvoiceStatus, JobStatus } from "@prisma/client";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: "Entwurf",
  SCHEDULED: "Geplant",
  IN_PROGRESS: "In Arbeit",
  NEEDS_REVIEW: "Prüfen",
  READY_TO_INVOICE: "Abrechnungsbereit",
  INVOICED: "Abgerechnet",
  CLOSED: "Abgeschlossen",
  CANCELLED: "Storniert",
};

export const JOB_STATUS_TONE: Record<
  JobStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  IN_PROGRESS: "info",
  NEEDS_REVIEW: "warning",
  READY_TO_INVOICE: "success",
  INVOICED: "success",
  CLOSED: "neutral",
  CANCELLED: "danger",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Entwurf",
  OPEN: "Offen",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
};

export const INVOICE_STATUS_TONE: Record<
  InvoiceStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  DRAFT: "warning",
  OPEN: "info",
  PAID: "success",
  CANCELLED: "danger",
};

export const OPEN_JOB_STATUSES: JobStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "READY_TO_INVOICE",
];

/** Aufträge, die noch abgerechnet werden müssen. */
export const BILLABLE_JOB_STATUSES: JobStatus[] = [
  "READY_TO_INVOICE",
  "IN_PROGRESS",
  "NEEDS_REVIEW",
];

export function isJobEditable(status: JobStatus): boolean {
  return status !== "CANCELLED" && status !== "CLOSED";
}
