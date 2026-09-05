import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  FileWarning,
  Mic,
  Plus,
  Receipt,
  Sparkles,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { StatTile } from "@/components/app/stat-tile";
import { JobStatusBadge } from "@/components/app/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { getDashboardData } from "@/lib/services/dashboard-service";

export const metadata: Metadata = { title: "Übersicht" };

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await getDashboardData(session);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 11) return "Guten Morgen";
    if (hour < 18) return "Guten Tag";
    return "Guten Abend";
  })();

  return (
    <>
      <PageHeader
        title={`${greeting}, ${session.userName.split(" ")[0]}`}
        description={formatDate(new Date())}
        actions={
          <Button asChild>
            <Link href="/auftraege/neu">
              <Plus aria-hidden />
              Neuer Auftrag
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Heute"
          value={`${data.todayJobs.length}`}
          hint="Aufträge"
          href="/auftraege"
          icon={<CalendarDays className="size-4" aria-hidden />}
        />
        <StatTile
          label="Zu prüfen"
          value={`${data.pendingExtractions.length}`}
          hint="KI-Vorschläge"
          tone={data.pendingExtractions.length > 0 ? "warning" : "neutral"}
          icon={<Sparkles className="size-4" aria-hidden />}
        />
        <StatTile
          label="Entwürfe"
          value={`${data.draftInvoices.length}`}
          hint="Rechnungen"
          href="/rechnungen?status=DRAFT"
          icon={<Receipt className="size-4" aria-hidden />}
        />
        <StatTile
          label="Offen"
          value={formatCurrency(data.openInvoiceTotal)}
          hint={
            data.overdueCount > 0
              ? `${data.overdueCount} überfällig`
              : `${data.openInvoices.length} Rechnungen`
          }
          tone={data.overdueCount > 0 ? "danger" : "neutral"}
          href="/rechnungen?status=OPEN"
        />
      </div>

      <div className="mt-6 space-y-6">
        {/* --- KI-Vorschläge --- */}
        {data.pendingExtractions.length > 0 ? (
          <Card className="border-warning/30">
            <CardHeader className="bg-warning-soft">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-warning" aria-hidden />
                Wartet auf Ihre Bestätigung
              </CardTitle>
            </CardHeader>
            <ul className="divide-y divide-border">
              {data.pendingExtractions.map((extraction) => (
                <li key={extraction.id}>
                  <Link
                    href={`/auftraege/${extraction.job.id}#pruefen`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {extraction.job.customer.name}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {extraction.job.jobNumber} · {extraction.job.title}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      Prüfen
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* --- Heutige Aufträge --- */}
        <Card>
          <CardHeader>
            <CardTitle>Heutige Aufträge</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/auftraege">Alle anzeigen</Link>
            </Button>
          </CardHeader>

          {data.todayJobs.length === 0 ? (
            <EmptyState
              icon={<Wrench className="size-8" aria-hidden />}
              title="Für heute ist nichts eingeplant"
              description="Legen Sie einen Auftrag an, um direkt von der Baustelle einen Bericht aufzunehmen."
              action={
                <Button asChild>
                  <Link href="/auftraege/neu">
                    <Plus aria-hidden />
                    Auftrag anlegen
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {data.todayJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/auftraege/${job.id}`}
                        className="truncate font-semibold hover:text-primary"
                      >
                        {job.customer.name}
                      </Link>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {job.scheduledAt ? `${formatTime(job.scheduledAt)} Uhr · ` : ""}
                      {job.title}
                      {job.site?.label ? ` · ${job.site.label}` : ""}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/auftraege/${job.id}#aufnehmen`}>
                      <Mic aria-hidden />
                      Bericht
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* --- Fehlende Informationen --- */}
        {data.incompleteJobs.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="size-4 text-warning" aria-hidden />
                Fehlende Informationen
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="mb-3 text-sm text-muted">
                Diese Aufträge können noch nicht abgerechnet werden.
              </p>
              <ul className="space-y-2">
                {data.incompleteJobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/auftraege/${job.id}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border px-3.5 py-3 hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {job.customer.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {job.jobNumber} · {job.title}
                        </p>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {job.missing.map((item) => (
                            <li
                              key={item}
                              className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <AlertTriangle
                        className="mt-0.5 size-4 shrink-0 text-warning"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* --- Rechnungsentwürfe --- */}
        {data.draftInvoices.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Rechnungsentwürfe</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/rechnungen">Alle Rechnungen</Link>
              </Button>
            </CardHeader>
            <ul className="divide-y divide-border">
              {data.draftInvoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/rechnungen/${invoice.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {invoice.customer.name}
                      </p>
                      <p className="text-sm text-muted">
                        {invoice.invoiceNumber}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatCurrency(invoice.grossTotal)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {/* --- Offene Rechnungen --- */}
        {data.openInvoices.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Offene Rechnungen</CardTitle>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(data.openInvoiceTotal)}
              </span>
            </CardHeader>
            <ul className="divide-y divide-border">
              {data.openInvoices.map((invoice) => {
                return (
                  <li key={invoice.id}>
                    <Link
                      href={`/rechnungen/${invoice.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {invoice.customer.name}
                        </p>
                        <p className="text-sm text-muted">
                          {invoice.invoiceNumber} · fällig{" "}
                          {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${
                          invoice.overdue ? "text-danger" : ""
                        }`}
                      >
                        {formatCurrency(invoice.grossTotal)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {data.openJobsCount === 0 &&
        data.draftInvoices.length === 0 &&
        data.openInvoices.length === 0 ? (
          <Alert tone="info" title="Noch keine Daten">
            Legen Sie zuerst einen Kunden und einen Auftrag an – danach genügt
            ein Druck auf „Bericht aufnehmen“.
          </Alert>
        ) : null}
      </div>
    </>
  );
}
