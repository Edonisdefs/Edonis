import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  ListChecks,
  Mic,
  Package,
  Pencil,
  Receipt,
  StickyNote,
  Trash2,
} from "lucide-react";

import {
  AddActivityForm,
  AddMaterialForm,
  AddNoteForm,
  AddTimeEntryForm,
  TextExtractForm,
} from "./job-forms";
import { ActionForm } from "@/components/app/action-form";
import {
  ExtractionReview,
  type ReviewMaterial,
} from "@/components/app/extraction-review";
import { PageHeader } from "@/components/app/page-header";
import { PhotoUploader } from "@/components/app/photo-uploader";
import { JobStatusBadge } from "@/components/app/status-badge";
import { VoiceRecorder } from "@/components/app/voice-recorder";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createServiceReportAction,
  deleteActivityAction,
  deleteJobAction,
  deleteMaterialAction,
  deletePhotoAction,
  deleteTimeEntryAction,
} from "@/lib/actions/jobs";
import { createInvoiceDraftAction } from "@/lib/actions/invoices";
import { matchCatalog } from "@/lib/ai/mock";
import { NotFoundError, requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/lib/format";
import { toNumberOrNull } from "@/lib/money";
import { getInvoiceReadiness } from "@/lib/services/job-service";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const session = await requireSession();
  const { id } = await params;
  const job = await prisma.job.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { jobNumber: true, customer: { select: { name: true } } },
  });
  return {
    title: job ? `${job.jobNumber} · ${job.customer.name}` : "Auftrag",
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;

  let readiness;
  try {
    readiness = await getInvoiceReadiness(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const job = readiness.detail;

  const [employees, catalog] = await Promise.all([
    prisma.employee.findMany({
      where: { organizationId: session.organizationId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.material.findMany({
      where: { organizationId: session.organizationId, active: true },
      select: {
        id: true,
        name: true,
        unit: true,
        aliases: true,
        defaultPrice: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const catalogHints = catalog.map((material) => ({
    id: material.id,
    name: material.name,
    unit: material.unit,
    aliases: material.aliases,
    defaultPrice: toNumberOrNull(material.defaultPrice),
  }));

  const pending = job.extractions.filter(
    (extraction) => extraction.status === "PENDING",
  );
  const failed = job.extractions.filter(
    (extraction) => extraction.status === "FAILED",
  );

  const activeInvoice = job.invoices.find(
    (invoice) => invoice.status !== "CANCELLED",
  );

  const address =
    job.site?.street || job.site?.city
      ? [job.site.street, [job.site.zip, job.site.city].filter(Boolean).join(" ")]
          .filter(Boolean)
          .join(", ")
      : [
          job.customer.street,
          [job.customer.zip, job.customer.city].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <>
      <PageHeader
        title={job.customer.name}
        description={`${job.jobNumber} · ${job.title}`}
        backHref="/auftraege"
        backLabel="Aufträge"
        actions={
          <>
            <JobStatusBadge status={job.status} />
            <Button asChild variant="secondary" size="sm">
              <Link href={`/auftraege/${job.id}/bearbeiten`}>
                <Pencil aria-hidden />
                Bearbeiten
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        {/* --- Kopfdaten --- */}
        <Card>
          <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Kunde">
              <Link
                href={`/kunden/${job.customer.id}`}
                className="font-medium text-primary hover:underline"
              >
                {job.customer.name}
              </Link>
            </Detail>
            <Detail label="Einsatzort">{address || "–"}</Detail>
            <Detail label="Geplant">{formatDate(job.scheduledAt)}</Detail>
            <Detail label="Ausgeführt">{formatDate(job.performedAt)}</Detail>
            <Detail label="Mitarbeiter">
              {job.employees.length > 0
                ? job.employees.map((employee) => employee.name).join(", ")
                : "–"}
            </Detail>
            <Detail label="Zwischensumme (netto)">
              {formatCurrency(job.totals.net)}
            </Detail>
            {job.description ? (
              <div className="sm:col-span-2">
                <Detail label="Beschreibung">{job.description}</Detail>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* --- Aufnahme --- */}
        <Card id="aufnehmen" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="size-4 text-primary" aria-hidden />
              Bericht erfassen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <VoiceRecorder jobId={job.id} />
            <details className="rounded-xl border border-border bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted">
                Lieber tippen als sprechen
              </summary>
              <div className="mt-3">
                <TextExtractForm jobId={job.id} />
              </div>
            </details>
          </CardContent>
        </Card>

        {/* --- Zu prüfen --- */}
        {pending.length > 0 ? (
          <div id="pruefen" className="scroll-mt-20 space-y-4">
            {pending.map((extraction) => {
              const source = extraction.confirmedData ?? extraction.result;
              const materials: ReviewMaterial[] = source.materials.map(
                (material) => {
                  const hint = matchCatalog(material.description, catalogHints);
                  return {
                    description: material.description,
                    quantity: material.quantity,
                    unit: material.unit || hint?.unit || "Stück",
                    unitPrice: hint?.defaultPrice ?? null,
                    materialId: hint?.id ?? null,
                  };
                },
              );

              const voiceNote = job.voiceNotes.find(
                (note) => note.id === extraction.voiceNoteId,
              );

              return (
                <ExtractionReview
                  key={extraction.id}
                  employees={employees}
                  data={{
                    extractionId: extraction.id,
                    customer: source.customer,
                    date: source.date,
                    workDurationHours: source.work_duration_hours,
                    startTime: source.start_time,
                    endTime: source.end_time,
                    activities: source.activities,
                    materials,
                    notes: source.notes,
                    confidence: extraction.confidence ?? source.confidence,
                    missingInformation: extraction.missing,
                    transcript: voiceNote?.transcript ?? extraction.inputText,
                  }}
                />
              );
            })}
          </div>
        ) : null}

        {failed.length > 0 ? (
          <Alert tone="danger" title="KI-Auswertung fehlgeschlagen">
            {failed[0]?.error ??
              "Die Auswertung hat nicht geklappt. Bitte erneut aufnehmen oder manuell erfassen."}
          </Alert>
        ) : null}

        {/* --- Leistungen --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-muted" aria-hidden />
              Tätigkeiten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.activities.length === 0 ? (
              <p className="text-sm text-muted">
                Noch keine Tätigkeiten erfasst.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {job.activities.map((activity) => (
                  <li
                    key={activity.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CheckCircle2
                        className="size-4 shrink-0 text-success"
                        aria-hidden
                      />
                      <span className="truncate text-sm">
                        {activity.description}
                      </span>
                      {activity.source === "AI" ? (
                        <Badge tone="primary">KI</Badge>
                      ) : null}
                    </span>
                    <ActionForm
                      action={deleteActivityAction}
                      fields={{ id: activity.id }}
                      label={<Trash2 aria-hidden />}
                      variant="ghost"
                      size="icon"
                      showMessage={false}
                      aria-label="Tätigkeit löschen"
                    />
                  </li>
                ))}
              </ul>
            )}
            <AddActivityForm jobId={job.id} />
          </CardContent>
        </Card>

        {/* --- Arbeitszeit --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-muted" aria-hidden />
              Arbeitszeit
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums">
              {formatNumber(job.totals.hours)} Std. ·{" "}
              {formatCurrency(job.totals.laborNet)}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.timeEntries.length === 0 ? (
              <p className="text-sm text-muted">
                Noch keine Arbeitszeit erfasst.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {job.timeEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatNumber(entry.hours)} Std.
                        {entry.startTime && entry.endTime
                          ? ` (${entry.startTime}–${entry.endTime} Uhr)`
                          : ""}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {formatDate(entry.date)}
                        {entry.employeeName ? ` · ${entry.employeeName}` : ""}
                        {entry.effectiveRate !== null
                          ? ` · ${formatCurrency(entry.effectiveRate)}/Std.`
                          : " · Stundensatz fehlt"}
                      </p>
                    </div>
                    <ActionForm
                      action={deleteTimeEntryAction}
                      fields={{ id: entry.id }}
                      label={<Trash2 aria-hidden />}
                      variant="ghost"
                      size="icon"
                      showMessage={false}
                      aria-label="Zeiteintrag löschen"
                    />
                  </li>
                ))}
              </ul>
            )}
            <details className="rounded-xl border border-border bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted">
                Arbeitszeit manuell erfassen
              </summary>
              <div className="mt-3">
                <AddTimeEntryForm
                  jobId={job.id}
                  employees={employees}
                  defaultDate={job.performedAt ?? job.scheduledAt}
                />
              </div>
            </details>
          </CardContent>
        </Card>

        {/* --- Material --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4 text-muted" aria-hidden />
              Material
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums">
              {formatCurrency(job.totals.materialNet)}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.materials.length === 0 ? (
              <p className="text-sm text-muted">Noch kein Material erfasst.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {job.materials.map((material) => (
                  <li
                    key={material.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatNumber(material.quantity)} {material.unit} ·{" "}
                        {material.description}
                      </p>
                      <p className="text-xs text-muted">
                        {material.unitPrice !== null ? (
                          <>
                            {formatCurrency(material.unitPrice)} /{" "}
                            {material.unit} ={" "}
                            {formatCurrency(
                              material.quantity * material.unitPrice,
                            )}
                          </>
                        ) : (
                          <span className="font-medium text-danger">
                            Einzelpreis fehlt
                          </span>
                        )}
                      </p>
                    </div>
                    <ActionForm
                      action={deleteMaterialAction}
                      fields={{ id: material.id }}
                      label={<Trash2 aria-hidden />}
                      variant="ghost"
                      size="icon"
                      showMessage={false}
                      aria-label="Material löschen"
                    />
                  </li>
                ))}
              </ul>
            )}
            <details className="rounded-xl border border-border bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted">
                Material manuell erfassen
              </summary>
              <div className="mt-3">
                <AddMaterialForm
                  jobId={job.id}
                  catalog={catalogHints.map((item) => ({
                    id: item.id,
                    name: item.name,
                    unit: item.unit,
                    defaultPrice: item.defaultPrice,
                  }))}
                />
              </div>
            </details>
          </CardContent>
        </Card>

        {/* --- Fotos --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="size-4 text-muted" aria-hidden />
              Baustellenfotos ({job.photos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.photos.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {job.photos.map((photo) => (
                  <li
                    key={photo.id}
                    className="group relative overflow-hidden rounded-xl border border-border"
                  >
                    <a
                      href={`/api/files/${photo.storageKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${photo.storageKey}`}
                        alt={photo.caption ?? photo.filename}
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                    <ActionForm
                      action={deletePhotoAction}
                      fields={{ id: photo.id }}
                      label={<Trash2 aria-hidden />}
                      variant="danger"
                      size="icon"
                      showMessage={false}
                      confirm="Dieses Foto endgültig löschen?"
                      className="absolute right-1.5 top-1.5 opacity-90"
                      aria-label="Foto löschen"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <PhotoUploader jobId={job.id} />
          </CardContent>
        </Card>

        {/* --- Notizen und Aufnahmen --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="size-4 text-muted" aria-hidden />
              Notizen und Aufnahmen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.voiceNotes.length > 0 ? (
              <ul className="space-y-2">
                {job.voiceNotes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted">
                        {formatDateTime(note.createdAt)}
                      </span>
                      <Badge
                        tone={
                          note.status === "TRANSCRIBED"
                            ? "success"
                            : note.status === "FAILED"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {note.status === "TRANSCRIBED"
                          ? "Ausgewertet"
                          : note.status === "FAILED"
                            ? "Fehlgeschlagen"
                            : "In Arbeit"}
                      </Badge>
                    </div>
                    {note.transcript ? (
                      <p className="mt-2 text-sm leading-relaxed">
                        „{note.transcript}“
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {job.notes.length > 0 ? (
              <ul className="space-y-2">
                {job.notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-xl border border-border bg-surface-muted p-3"
                  >
                    <p className="text-sm leading-relaxed">{note.text}</p>
                    <p className="mt-1 text-xs text-muted">
                      {note.authorName ?? "System"} ·{" "}
                      {formatDateTime(note.createdAt)}
                      {note.source === "AI" ? " · aus KI-Bericht" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            <AddNoteForm jobId={job.id} />
          </CardContent>
        </Card>

        {/* --- Abrechnung --- */}
        <Card id="abrechnung" className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4 text-muted" aria-hidden />
              Leistungsnachweis und Rechnung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {readiness.blockers.length > 0 ? (
              <Alert tone="warning" title="Vor der Rechnung fehlt noch">
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {readiness.blockers.map((blocker) => (
                    <li key={blocker.code + blocker.message}>
                      {blocker.message}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert tone="success" title="Alle Pflichtangaben vorhanden">
                Der Auftrag kann abgerechnet werden.
              </Alert>
            )}

            {readiness.warnings.length > 0 ? (
              <Alert tone="info" title="Hinweise">
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {readiness.warnings.map((warning) => (
                    <li key={warning.code}>{warning.message}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            {job.serviceReport ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-3 text-sm">
                <ClipboardCheck className="size-4 text-success" aria-hidden />
                Leistungsnachweis {job.serviceReport.number} vom{" "}
                {formatDate(job.serviceReport.performedOn)}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionForm
                action={createServiceReportAction}
                fields={{ jobId: job.id }}
                label={
                  <>
                    <ClipboardCheck aria-hidden />
                    {job.serviceReport
                      ? "Leistungsnachweis aktualisieren"
                      : "Leistungsnachweis erstellen"}
                  </>
                }
                pendingLabel="Wird erstellt …"
                variant="secondary"
                size="lg"
                className="sm:flex-1"
              />

              {activeInvoice ? (
                <Button asChild size="lg" className="sm:flex-1">
                  <Link href={`/rechnungen/${activeInvoice.id}`}>
                    <FileText aria-hidden />
                    Rechnung {activeInvoice.invoiceNumber} öffnen
                  </Link>
                </Button>
              ) : (
                <ActionForm
                  action={createInvoiceDraftAction}
                  fields={{ jobId: job.id }}
                  label={
                    <>
                      <Receipt aria-hidden />
                      Rechnungsentwurf erstellen
                    </>
                  }
                  pendingLabel="Wird erstellt …"
                  size="lg"
                  className="sm:flex-1"
                  disabled={!readiness.canCreateDraft}
                />
              )}
            </div>

            {!readiness.canCreateDraft && !activeInvoice ? (
              <p className="text-xs text-muted">
                Der Rechnungsentwurf ist gesperrt, solange Pflichtangaben
                fehlen. So kann keine unvollständige Rechnung entstehen.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* --- Löschen --- */}
        <Card className="border-danger/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Auftrag löschen</p>
              <p className="text-sm text-muted">
                Entfernt Auftrag, Fotos und Aufnahmen endgültig.
              </p>
            </div>
            <ActionForm
              action={deleteJobAction}
              fields={{ jobId: job.id }}
              label={
                <>
                  <Trash2 aria-hidden />
                  Löschen
                </>
              }
              pendingLabel="Wird gelöscht …"
              confirm="Diesen Auftrag mit allen Fotos und Aufnahmen endgültig löschen?"
              variant="danger"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}
