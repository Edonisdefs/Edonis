import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CheckCircle2, Download, FileText } from "lucide-react";

import {
  InvoiceItemRow,
  InvoiceMetaForm,
  ReleaseInvoiceForm,
} from "./invoice-editor";
import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { InvoiceStatusBadge } from "@/components/app/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cancelInvoiceAction,
  markInvoicePaidAction,
} from "@/lib/actions/invoices";
import { NotFoundError, requireSession } from "@/lib/auth/session";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getInvoiceDetail } from "@/lib/services/invoice-service";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await requireSession();
  try {
    const invoice = await getInvoiceDetail(session, id);
    return { title: `Rechnung ${invoice.invoiceNumber}` };
  } catch {
    return { title: "Rechnung" };
  }
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const session = await requireSession();
  const { id } = await params;

  let invoice;
  try {
    invoice = await getInvoiceDetail(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const isDraft = invoice.status === "DRAFT";
  const seller = invoice.snapshot.seller;
  const buyer = invoice.snapshot.buyer;

  return (
    <>
      <PageHeader
        title={`Rechnung ${invoice.invoiceNumber}`}
        description={`${buyer.name} · ${formatDate(invoice.issueDate)}`}
        backHref="/rechnungen"
        backLabel="Rechnungen"
        actions={
          <>
            <InvoiceStatusBadge status={invoice.status} />
            <Button asChild variant="secondary" size="sm">
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                <Download aria-hidden />
                PDF
              </a>
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        {isDraft ? (
          <Alert tone="warning" title="Dies ist ein Entwurf">
            Der Entwurf wurde noch nicht freigegeben. Das PDF trägt einen
            deutlichen Entwurfsvermerk.
          </Alert>
        ) : null}

        {invoice.status === "CANCELLED" ? (
          <Alert tone="danger" title="Diese Rechnung wurde storniert">
            Storniert am {formatDate(invoice.cancelledAt)}.
          </Alert>
        ) : null}

        {/* --- Beteiligte --- */}
        <Card>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Rechnungsempfänger
              </p>
              <address className="mt-1 not-italic text-sm leading-relaxed">
                {buyer.name}
                {buyer.contactPerson ? <br /> : null}
                {buyer.contactPerson}
                <br />
                {buyer.street}
                <br />
                {[buyer.zip, buyer.city].filter(Boolean).join(" ")}
              </address>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Rechnungssteller
              </p>
              <address className="mt-1 not-italic text-sm leading-relaxed">
                {seller.legalName || seller.name}
                <br />
                {seller.street}
                <br />
                {[seller.zip, seller.city].filter(Boolean).join(" ")}
                {seller.taxNumber ? (
                  <>
                    <br />
                    Steuernummer: {seller.taxNumber}
                  </>
                ) : null}
                {seller.vatId ? (
                  <>
                    <br />
                    USt-IdNr.: {seller.vatId}
                  </>
                ) : null}
              </address>
            </div>
          </CardContent>
        </Card>

        {/* --- Positionen --- */}
        <Card>
          <CardHeader>
            <CardTitle>Positionen</CardTitle>
            {invoice.job ? (
              <Link
                href={`/auftraege/${invoice.job.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Auftrag {invoice.job.jobNumber}
              </Link>
            ) : null}
          </CardHeader>

          <div className="scroll-x">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left">
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Pos.
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Bezeichnung
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Menge
                  </th>
                  <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Einheit
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Einzelpreis
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Betrag
                  </th>
                  {isDraft ? <th className="w-24" /> : null}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <InvoiceItemRow
                    key={item.id}
                    item={item}
                    editable={isDraft}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <CardContent className="border-t border-border">
            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Nettobetrag</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(invoice.netTotal)}
                </dd>
              </div>
              {invoice.smallBusiness ? (
                <p className="text-xs text-muted">
                  Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
                </p>
              ) : (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">
                    zzgl. {formatNumber(invoice.vatRate)} % USt.
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatCurrency(invoice.vatTotal)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-1.5 text-base">
                <dt className="font-semibold">Gesamtbetrag</dt>
                <dd className="font-bold tabular-nums">
                  {formatCurrency(invoice.grossTotal)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* --- Leistungsbeschreibung --- */}
        {invoice.snapshot.activities.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Ausgeführte Arbeiten</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {invoice.snapshot.activities.map((activity, index) => (
                  <li key={index}>{activity}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* --- Bearbeiten / Freigeben --- */}
        {isDraft ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Rechnungsdaten</CardTitle>
              </CardHeader>
              <CardContent>
                <InvoiceMetaForm
                  invoiceId={invoice.id}
                  serviceDate={invoice.serviceDate}
                  dueDate={invoice.dueDate}
                  introText={invoice.introText}
                  outroText={invoice.outroText}
                />
              </CardContent>
            </Card>

            <Card className="border-success/30">
              <CardHeader className="bg-success-soft">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                  Rechnung freigeben
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReleaseInvoiceForm
                  invoiceId={invoice.id}
                  grossTotal={invoice.grossTotal}
                  customerName={buyer.name}
                />
              </CardContent>
            </Card>
          </>
        ) : null}

        {/* --- Status --- */}
        {invoice.status === "OPEN" ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Zahlungseingang</p>
                <p className="text-sm text-muted">
                  Fällig am {formatDate(invoice.dueDate)}
                  {invoice.releasedByName
                    ? ` · freigegeben von ${invoice.releasedByName}`
                    : ""}
                </p>
              </div>
              <ActionForm
                action={markInvoicePaidAction}
                fields={{ invoiceId: invoice.id }}
                label={
                  <>
                    <CheckCircle2 aria-hidden />
                    Als bezahlt markieren
                  </>
                }
                variant="success"
              />
            </CardContent>
          </Card>
        ) : null}

        {invoice.status === "PAID" ? (
          <Alert tone="success" title="Rechnung bezahlt">
            Zahlungseingang am {formatDate(invoice.paidAt)}.
          </Alert>
        ) : null}

        {invoice.status !== "CANCELLED" ? (
          <Card className="border-danger/20">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Rechnung stornieren</p>
                <p className="text-sm text-muted">
                  Die Rechnung bleibt aus Nachweisgründen erhalten und wird als
                  storniert gekennzeichnet.
                </p>
              </div>
              <ActionForm
                action={cancelInvoiceAction}
                fields={{ invoiceId: invoice.id }}
                label={
                  <>
                    <Ban aria-hidden />
                    Stornieren
                  </>
                }
                confirm="Diese Rechnung wirklich stornieren?"
                variant="danger"
              />
            </CardContent>
          </Card>
        ) : null}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Edonis berücksichtigt die üblichen Pflichtangaben für Rechnungen nach
          § 14 UStG, ersetzt aber keine steuerliche oder rechtliche Beratung.
          Die inhaltliche Prüfung liegt bei Ihnen bzw. Ihrer Steuerberatung.
        </p>
      </div>
    </>
  );
}
