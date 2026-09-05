import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";

import { PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge } from "@/components/app/status-badge";
import { StatTile } from "@/components/app/stat-tile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { INVOICE_STATUS_LABELS } from "@/lib/domain/job-status";
import { formatCurrency, formatDate } from "@/lib/format";
import { toNumber } from "@/lib/money";
import { listInvoices } from "@/lib/services/invoice-service";

export const metadata: Metadata = { title: "Rechnungen" };

const STATUS_VALUES = Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const status = STATUS_VALUES.includes(params.status as InvoiceStatus)
    ? (params.status as InvoiceStatus)
    : undefined;

  const [invoices, drafts, open] = await Promise.all([
    listInvoices(session, status),
    prisma.invoice.aggregate({
      where: { organizationId: session.organizationId, status: "DRAFT" },
      _sum: { grossTotal: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { organizationId: session.organizationId, status: "OPEN" },
      _sum: { grossTotal: true },
      _count: true,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Rechnungen"
        description="Rechnungen entstehen aus abgeschlossenen Aufträgen."
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatTile
          label="Entwürfe"
          value={`${drafts._count}`}
          hint={formatCurrency(toNumber(drafts._sum.grossTotal))}
          href="/rechnungen?status=DRAFT"
          tone="warning"
        />
        <StatTile
          label="Offen"
          value={`${open._count}`}
          hint={formatCurrency(toNumber(open._sum.grossTotal))}
          href="/rechnungen?status=OPEN"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          asChild
          variant={status ? "secondary" : "primary"}
          size="sm"
        >
          <Link href="/rechnungen">Alle</Link>
        </Button>
        {STATUS_VALUES.map((value) => (
          <Button
            key={value}
            asChild
            variant={status === value ? "primary" : "secondary"}
            size="sm"
          >
            <Link href={`/rechnungen?status=${value}`}>
              {INVOICE_STATUS_LABELS[value]}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        {invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-8" aria-hidden />}
            title="Keine Rechnungen"
            description="Erstellen Sie einen Rechnungsentwurf direkt aus einem abgeschlossenen Auftrag."
            action={
              <Button asChild variant="secondary">
                <Link href="/auftraege">Zu den Aufträgen</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((invoice) => {
              return (
                <li key={invoice.id}>
                  <Link
                    href={`/rechnungen/${invoice.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">
                          {invoice.customer.name}
                        </span>
                        <InvoiceStatusBadge status={invoice.status} />
                        {invoice.overdue ? (
                          <span className="text-xs font-semibold text-danger">
                            überfällig
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {invoice.invoiceNumber} ·{" "}
                        {formatDate(invoice.issueDate)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(invoice.grossTotal)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
