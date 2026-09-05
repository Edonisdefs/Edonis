import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, MapPin, Plus, Trash2, Wrench } from "lucide-react";

import { SiteForm } from "./site-form";
import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { JobStatusBadge } from "@/components/app/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerForm } from "../neu/customer-form";
import {
  archiveCustomerAction,
  deleteCustomerAction,
  deleteSiteAction,
} from "@/lib/actions/customers";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatAddress, formatCurrency, formatDate } from "@/lib/format";
import { toNumberOrNull } from "@/lib/money";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { name: true },
  });
  return { title: customer?.name ?? "Kunde" };
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      sites: { orderBy: { label: "asc" } },
      jobs: {
        select: {
          id: true,
          jobNumber: true,
          title: true,
          status: true,
          scheduledAt: true,
          performedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          grossTotal: true,
          issueDate: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`${customer.customerNumber}${
          formatAddress(customer) ? ` · ${formatAddress(customer)}` : ""
        }`}
        backHref="/kunden"
        backLabel="Kunden"
        actions={
          <Button asChild>
            <Link href={`/auftraege/neu?kunde=${customer.id}`}>
              <Plus aria-hidden />
              Auftrag anlegen
            </Link>
          </Button>
        }
      />

      <div className="space-y-5">
        {customer.archivedAt ? (
          <Alert tone="warning" title="Dieser Kunde ist archiviert">
            Archivierte Kunden erscheinen nicht mehr in der Auswahl für neue
            Aufträge.
          </Alert>
        ) : null}

        {!customer.street || !customer.zip || !customer.city ? (
          <Alert tone="warning" title="Anschrift unvollständig">
            Für Rechnungen sind Straße, PLZ und Ort Pflicht. Bitte unten
            ergänzen.
          </Alert>
        ) : null}

        {/* --- Aufträge --- */}
        <Card>
          <CardHeader>
            <CardTitle>Aufträge</CardTitle>
          </CardHeader>
          {customer.jobs.length === 0 ? (
            <CardContent>
              <p className="text-sm text-muted">Noch keine Aufträge.</p>
            </CardContent>
          ) : (
            <ul className="divide-y divide-border">
              {customer.jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/auftraege/${job.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted sm:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Wrench className="size-4 text-subtle" aria-hidden />
                        <span className="truncate font-medium">
                          {job.title}
                        </span>
                        <JobStatusBadge status={job.status} />
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {job.jobNumber}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-muted">
                      {formatDate(job.performedAt ?? job.scheduledAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* --- Baustellen --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-muted" aria-hidden />
              Baustellen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.sites.length > 0 ? (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {customer.sites.map((site) => (
                  <li
                    key={site.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {site.label}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {formatAddress(site) || "Keine Anschrift hinterlegt"}
                      </p>
                    </div>
                    <ActionForm
                      action={deleteSiteAction}
                      fields={{ siteId: site.id }}
                      label={<Trash2 aria-hidden />}
                      variant="ghost"
                      size="icon"
                      showMessage={false}
                      confirm="Diese Baustelle löschen?"
                      aria-label="Baustelle löschen"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Noch keine Baustelle hinterlegt.
              </p>
            )}
            <details className="rounded-xl border border-border bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted">
                Baustelle hinzufügen
              </summary>
              <div className="mt-3">
                <SiteForm customerId={customer.id} />
              </div>
            </details>
          </CardContent>
        </Card>

        {/* --- Rechnungen --- */}
        {customer.invoices.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Rechnungen</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-border">
              {customer.invoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/rechnungen/${invoice.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted sm:px-5"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-muted">
                        {formatDate(invoice.issueDate)}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(invoice.grossTotal)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* --- Stammdaten --- */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Stammdaten
          </h2>
          <CustomerForm
            values={{
              id: customer.id,
              name: customer.name,
              type: customer.type,
              contactPerson: customer.contactPerson,
              email: customer.email,
              phone: customer.phone,
              street: customer.street,
              zip: customer.zip,
              city: customer.city,
              vatId: customer.vatId,
              notes: customer.notes,
              hourlyRate: toNumberOrNull(customer.hourlyRate),
            }}
          />
        </div>

        {/* --- Datenschutz --- */}
        <Card className="border-danger/20">
          <CardHeader>
            <CardTitle>Daten dieses Kunden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted">
              Archivieren blendet den Kunden aus, behält aber alle Belege.
              Löschen entfernt die personenbezogenen Daten endgültig – das ist
              nur möglich, solange keine Aufträge oder Rechnungen bestehen
              (Aufbewahrungspflicht).
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionForm
                action={archiveCustomerAction}
                fields={{ customerId: customer.id }}
                label={
                  <>
                    <Archive aria-hidden />
                    {customer.archivedAt ? "Reaktivieren" : "Archivieren"}
                  </>
                }
                variant="secondary"
              />
              <ActionForm
                action={deleteCustomerAction}
                fields={{ customerId: customer.id }}
                label={
                  <>
                    <Trash2 aria-hidden />
                    Endgültig löschen
                  </>
                }
                confirm="Diesen Kunden mit allen Stammdaten endgültig löschen?"
                variant="danger"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
