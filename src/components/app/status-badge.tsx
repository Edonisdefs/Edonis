import type { InvoiceStatus, JobStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONE,
  JOB_STATUS_LABELS,
  JOB_STATUS_TONE,
} from "@/lib/domain/job-status";

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={JOB_STATUS_TONE[status]}>{JOB_STATUS_LABELS[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge tone={INVOICE_STATUS_TONE[status]}>
      {INVOICE_STATUS_LABELS[status]}
    </Badge>
  );
}
