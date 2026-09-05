import "server-only";

import type { InvoiceStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { NotFoundError, type SessionContext } from "@/lib/auth/session";
import { toNumber, toNumberOrNull } from "@/lib/money";
import {
  buildInvoiceDraft,
  calculateDueDate,
  recalculateTotals,
} from "@/lib/domain/invoice-builder";
import { nextInvoiceNumber } from "@/lib/domain/numbering";
import { getInvoiceReadiness } from "@/lib/services/job-service";

export type BillingSnapshot = {
  seller: {
    name: string;
    legalName: string | null;
    ownerName: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
    country: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    taxNumber: string | null;
    vatId: string | null;
    registerInfo: string | null;
    bankName: string | null;
    iban: string | null;
    bic: string | null;
  };
  buyer: {
    customerNumber: string;
    name: string;
    contactPerson: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
    country: string;
    vatId: string | null;
  };
  job: {
    jobNumber: string;
    title: string;
    siteLabel: string | null;
    siteAddress: string | null;
  } | null;
  activities: string[];
  serviceReportNumber: string | null;
};

export class InvoiceBlockedError extends Error {
  readonly status = 422;
  constructor(readonly blockers: string[]) {
    super(
      `Rechnung nicht möglich – es fehlen noch Angaben: ${blockers.join(" ")}`,
    );
    this.name = "InvoiceBlockedError";
  }
}

/**
 * Erstellt den Rechnungsentwurf aus einem Auftrag.
 *
 * Das Gate ist hart: Sind Blocker offen (fehlende Preise, unvollständige
 * Anschrift, nicht bestätigte KI-Vorschläge), entsteht kein Entwurf.
 */
export async function createDraftFromJob(
  session: SessionContext,
  jobId: string,
): Promise<{ id: string; invoiceNumber: string }> {
  const readiness = await getInvoiceReadiness(session, jobId);
  if (!readiness.canCreateDraft) {
    throw new InvoiceBlockedError(
      readiness.blockers.map((blocker) => blocker.message),
    );
  }

  const detail = readiness.detail;
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
  });

  const draft = buildInvoiceDraft({
    timeEntries: detail.timeEntries.map((entry) => ({
      hours: entry.hours,
      hourlyRate: entry.effectiveRate ?? 0,
      description: entry.description,
      date: entry.date,
    })),
    materials: detail.materials.map((material) => ({
      description: material.description,
      quantity: material.quantity,
      unit: material.unit,
      unitPrice: material.unitPrice ?? 0,
    })),
    travelFlatRate: toNumber(organization.travelFlatRate),
    vatRate: toNumber(organization.defaultVatRate),
    smallBusiness: organization.smallBusiness,
  });

  if (draft.lines.length === 0) {
    throw new InvoiceBlockedError([
      "Es gibt keine abrechenbaren Positionen für diesen Auftrag.",
    ]);
  }

  const snapshot: BillingSnapshot = {
    seller: {
      name: organization.name,
      legalName: organization.legalName,
      ownerName: organization.ownerName,
      street: organization.street,
      zip: organization.zip,
      city: organization.city,
      country: organization.country,
      email: organization.email,
      phone: organization.phone,
      website: organization.website,
      taxNumber: organization.taxNumber,
      vatId: organization.vatId,
      registerInfo: organization.registerInfo,
      bankName: organization.bankName,
      iban: organization.iban,
      bic: organization.bic,
    },
    buyer: {
      customerNumber: detail.customer.customerNumber,
      name: detail.customer.name,
      contactPerson: detail.customer.contactPerson,
      street: detail.customer.street,
      zip: detail.customer.zip,
      city: detail.customer.city,
      country: "DE",
      vatId: null,
    },
    job: {
      jobNumber: detail.jobNumber,
      title: detail.title,
      siteLabel: detail.site?.label ?? null,
      siteAddress: detail.site
        ? [detail.site.street, [detail.site.zip, detail.site.city].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(", ")
        : null,
    },
    activities: detail.activities.map((activity) => activity.description),
    serviceReportNumber: detail.serviceReport?.number ?? null,
  };

  const issueDate = new Date();
  const serviceDate = detail.performedAt ?? issueDate;
  const invoiceNumber = await nextInvoiceNumber(session.organizationId, issueDate);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: session.organizationId,
      customerId: detail.customer.id,
      jobId: detail.id,
      invoiceNumber,
      status: "DRAFT",
      issueDate,
      serviceDate,
      dueDate: calculateDueDate(issueDate, organization.paymentTermsDays),
      billingSnapshot: snapshot as unknown as object,
      netTotal: draft.netTotal,
      vatTotal: draft.vatTotal,
      grossTotal: draft.grossTotal,
      smallBusiness: organization.smallBusiness,
      introText:
        "für die von uns ausgeführten Arbeiten berechnen wir Ihnen wie folgt:",
      outroText: organization.invoiceFooterNote,
      items: {
        create: draft.lines.map((line) => ({
          organizationId: session.organizationId,
          position: line.position,
          kind: line.kind,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          netAmount: line.netAmount,
          vatRate: line.vatRate,
        })),
      },
    },
    select: { id: true, invoiceNumber: true },
  });

  return invoice;
}

/** Summen nach einer Positionsänderung neu berechnen. */
export async function recalcInvoice(invoiceId: string): Promise<void> {
  const items = await prisma.invoiceItem.findMany({
    where: { invoiceId },
    select: { quantity: true, unitPrice: true, vatRate: true },
  });

  const totals = recalculateTotals(
    items.map((item) => ({
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      vatRate: toNumber(item.vatRate),
    })),
  );

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      netTotal: totals.netTotal,
      vatTotal: totals.vatTotal,
      grossTotal: totals.grossTotal,
    },
  });
}

/**
 * Rechnungsliste inkl. Fälligkeitskennzeichen. Die Auswertung „überfällig“
 * gehört in die Datenschicht, nicht in den Seitenaufbau.
 */
export async function listInvoices(
  session: SessionContext,
  status?: InvoiceStatus,
) {
  const now = new Date();
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId: session.organizationId,
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      issueDate: true,
      dueDate: true,
      grossTotal: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return invoices.map((invoice) => ({
    ...invoice,
    grossTotal: toNumber(invoice.grossTotal),
    overdue:
      invoice.status === "OPEN" &&
      Boolean(invoice.dueDate && invoice.dueDate.getTime() < now.getTime()),
  }));
}

export type InvoiceDetail = Awaited<ReturnType<typeof getInvoiceDetail>>;

export async function getInvoiceDetail(
  session: SessionContext,
  invoiceId: string,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: session.organizationId },
    include: {
      items: { orderBy: { position: "asc" } },
      customer: true,
      job: { select: { id: true, jobNumber: true, title: true } },
      releasedBy: { select: { name: true } },
    },
  });
  if (!invoice) throw new NotFoundError("Rechnung nicht gefunden.");

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    serviceDate: invoice.serviceDate,
    dueDate: invoice.dueDate,
    netTotal: toNumber(invoice.netTotal),
    vatTotal: toNumber(invoice.vatTotal),
    grossTotal: toNumber(invoice.grossTotal),
    smallBusiness: invoice.smallBusiness,
    introText: invoice.introText,
    outroText: invoice.outroText,
    notes: invoice.notes,
    releasedAt: invoice.releasedAt,
    releasedByName: invoice.releasedBy?.name ?? null,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt,
    createdAt: invoice.createdAt,
    snapshot: invoice.billingSnapshot as unknown as BillingSnapshot,
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      email: invoice.customer.email,
    },
    job: invoice.job,
    items: invoice.items.map((item) => ({
      id: item.id,
      position: item.position,
      kind: item.kind,
      description: item.description,
      quantity: toNumber(item.quantity),
      unit: item.unit,
      unitPrice: toNumber(item.unitPrice),
      netAmount: toNumber(item.netAmount),
      vatRate: toNumber(item.vatRate),
    })),
    vatRate: toNumberOrNull(invoice.items[0]?.vatRate ?? null) ?? 0,
  };
}
