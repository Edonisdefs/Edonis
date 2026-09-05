"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, requireSession } from "@/lib/auth/session";
import { requireInvoice } from "@/lib/auth/tenancy";
import { calculateDueDate } from "@/lib/domain/invoice-builder";
import { lineNet } from "@/lib/money";
import {
  createDraftFromJob,
  getInvoiceDetail,
  InvoiceBlockedError,
  recalcInvoice,
} from "@/lib/services/invoice-service";
import { renderInvoicePdf } from "@/lib/services/invoice-pdf";
import { buildKey, getStorage } from "@/lib/providers/storage";
import {
  formError,
  formSuccess,
  readDate,
  readNumber,
  readOptionalString,
  readString,
  toFormState,
  type FormState,
} from "./state";

function revalidateInvoice(invoiceId: string, jobId?: string | null) {
  revalidatePath("/");
  revalidatePath("/rechnungen");
  revalidatePath(`/rechnungen/${invoiceId}`);
  revalidatePath("/dokumente");
  if (jobId) revalidatePath(`/auftraege/${jobId}`);
}

export async function createInvoiceDraftAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const jobId = readString(formData, "jobId");
    const invoice = await createDraftFromJob(session, jobId);

    await audit(session, {
      action: "invoice.create_draft",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { jobId, invoiceNumber: invoice.invoiceNumber },
    });

    revalidateInvoice(invoice.id, jobId);
    return formSuccess(`Rechnungsentwurf ${invoice.invoiceNumber} erstellt.`, {
      id: invoice.id,
    });
  } catch (error) {
    if (error instanceof InvoiceBlockedError) {
      return formError(error.message);
    }
    return toFormState(error);
  }
}

export async function updateInvoiceItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const itemId = readString(formData, "itemId");
    const item = await prisma.invoiceItem.findFirst({
      where: { id: itemId, organizationId: session.organizationId },
      include: { invoice: { select: { id: true, status: true, jobId: true } } },
    });
    if (!item) return formError("Position nicht gefunden.");
    if (item.invoice.status !== "DRAFT") {
      return formError(
        "Nur Entwürfe können bearbeitet werden. Bitte die Rechnung stornieren und neu erstellen.",
      );
    }

    const description = readString(formData, "description");
    const quantity = readNumber(formData, "quantity");
    const unitPrice = readNumber(formData, "unitPrice");

    if (!description) return formError("Bitte Bezeichnung eingeben.");
    if (quantity === null || quantity <= 0) {
      return formError("Bitte eine Menge größer als 0 eingeben.");
    }
    if (unitPrice === null || unitPrice < 0) {
      return formError("Bitte gültigen Einzelpreis eingeben.");
    }

    await prisma.invoiceItem.update({
      where: { id: itemId },
      data: {
        description,
        quantity,
        unitPrice,
        unit: readString(formData, "unit") || item.unit,
        netAmount: lineNet(quantity, unitPrice),
      },
    });

    await recalcInvoice(item.invoice.id);
    revalidateInvoice(item.invoice.id, item.invoice.jobId);
    return formSuccess("Position aktualisiert.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteInvoiceItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const itemId = readString(formData, "itemId");
    const item = await prisma.invoiceItem.findFirst({
      where: { id: itemId, organizationId: session.organizationId },
      include: { invoice: { select: { id: true, status: true, jobId: true } } },
    });
    if (!item) return formError("Position nicht gefunden.");
    if (item.invoice.status !== "DRAFT") {
      return formError("Nur Entwürfe können bearbeitet werden.");
    }

    await prisma.invoiceItem.delete({ where: { id: itemId } });
    await recalcInvoice(item.invoice.id);

    revalidateInvoice(item.invoice.id, item.invoice.jobId);
    return formSuccess("Position entfernt.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateInvoiceMetaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const invoiceId = readString(formData, "invoiceId");
    const invoice = await requireInvoice(session, invoiceId);
    if (invoice.status !== "DRAFT") {
      return formError("Nur Entwürfe können bearbeitet werden.");
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        serviceDate: readDate(formData, "serviceDate") ?? invoice.serviceDate,
        dueDate: readDate(formData, "dueDate") ?? invoice.dueDate,
        introText: readOptionalString(formData, "introText"),
        outroText: readOptionalString(formData, "outroText"),
        notes: readOptionalString(formData, "notes"),
      },
    });

    await audit(session, {
      action: "invoice.update",
      entityType: "invoice",
      entityId: invoiceId,
    });

    revalidateInvoice(invoiceId, invoice.jobId);
    return formSuccess("Rechnung gespeichert.");
  } catch (error) {
    return toFormState(error);
  }
}

/**
 * Freigabe: Aus dem Entwurf wird eine offene Rechnung.
 *
 * Das passiert ausschließlich auf ausdrückliche Bestätigung des Nutzers
 * (`confirm=ja`) und niemals automatisch.
 */
export async function releaseInvoiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const invoiceId = readString(formData, "invoiceId");
    const invoice = await requireInvoice(session, invoiceId);

    if (invoice.status !== "DRAFT") {
      return formError("Diese Rechnung ist bereits freigegeben.");
    }
    if (readString(formData, "confirm") !== "ja") {
      return formError("Bitte die Freigabe ausdrücklich bestätigen.");
    }

    const detail = await getInvoiceDetail(session, invoiceId);
    if (detail.items.length === 0 || detail.grossTotal <= 0) {
      return formError(
        "Die Rechnung enthält keine Positionen mit Betrag und kann nicht freigegeben werden.",
      );
    }
    if (
      !detail.snapshot.buyer.street ||
      !detail.snapshot.buyer.zip ||
      !detail.snapshot.buyer.city
    ) {
      return formError(
        "Die Anschrift des Kunden ist unvollständig. Bitte zuerst die Kundendaten ergänzen.",
      );
    }
    if (!detail.snapshot.seller.taxNumber && !detail.snapshot.seller.vatId) {
      return formError(
        "Steuernummer oder USt-IdNr. fehlt in den Betriebseinstellungen.",
      );
    }

    const releasedAt = new Date();
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "OPEN",
        releasedAt,
        releasedById: session.userId,
        dueDate:
          invoice.dueDate ??
          calculateDueDate(
            invoice.issueDate,
            (
              await prisma.organization.findUniqueOrThrow({
                where: { id: session.organizationId },
                select: { paymentTermsDays: true },
              })
            ).paymentTermsDays,
          ),
      },
    });

    if (invoice.jobId) {
      await prisma.job.updateMany({
        where: { id: invoice.jobId, organizationId: session.organizationId },
        data: { status: "INVOICED" },
      });
    }

    await audit(session, {
      action: "invoice.release",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        gross: detail.grossTotal,
      },
    });

    // PDF direkt erzeugen und ablegen – die freigegebene Fassung soll
    // unverändert reproduzierbar bleiben.
    await generateAndStoreInvoicePdf(session.organizationId, invoiceId, {
      ...detail,
      status: "OPEN",
      releasedAt,
    });

    revalidateInvoice(invoiceId, invoice.jobId);
    return formSuccess(
      `Rechnung ${invoice.invoiceNumber} freigegeben. Status: offen.`,
    );
  } catch (error) {
    return toFormState(error);
  }
}

export async function markInvoicePaidAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const invoiceId = readString(formData, "invoiceId");
    const invoice = await requireInvoice(session, invoiceId);
    if (invoice.status !== "OPEN") {
      return formError("Nur offene Rechnungen können auf bezahlt gesetzt werden.");
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: readDate(formData, "paidAt") ?? new Date() },
    });

    if (invoice.jobId) {
      await prisma.job.updateMany({
        where: { id: invoice.jobId, organizationId: session.organizationId },
        data: { status: "CLOSED" },
      });
    }

    await audit(session, {
      action: "invoice.mark_paid",
      entityType: "invoice",
      entityId: invoiceId,
    });

    revalidateInvoice(invoiceId, invoice.jobId);
    return formSuccess("Rechnung als bezahlt markiert.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function cancelInvoiceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OWNER");

    const invoiceId = readString(formData, "invoiceId");
    const invoice = await requireInvoice(session, invoiceId);
    if (invoice.status === "CANCELLED") {
      return formError("Diese Rechnung ist bereits storniert.");
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    if (invoice.jobId) {
      await prisma.job.updateMany({
        where: { id: invoice.jobId, organizationId: session.organizationId },
        data: { status: "READY_TO_INVOICE" },
      });
    }

    await audit(session, {
      action: "invoice.cancel",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
    });

    revalidateInvoice(invoiceId, invoice.jobId);
    return formSuccess("Rechnung storniert.");
  } catch (error) {
    return toFormState(error);
  }
}

/** Erzeugt das PDF, legt es im Storage ab und verlinkt es als Dokument. */
export async function generateAndStoreInvoicePdf(
  organizationId: string,
  invoiceId: string,
  detail: Awaited<ReturnType<typeof getInvoiceDetail>>,
): Promise<string> {
  const pdf = await renderInvoicePdf(detail);
  const key = buildKey(
    organizationId,
    "invoices",
    `${invoiceId}-${detail.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "")}.pdf`,
  );

  await getStorage().put(key, pdf, { contentType: "application/pdf" });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { pdfStorageKey: key },
  });

  const filename = `Rechnung-${detail.invoiceNumber}.pdf`;
  const existing = await prisma.document.findFirst({
    where: { organizationId, invoiceId, kind: "INVOICE_PDF" },
    select: { id: true },
  });

  if (existing) {
    await prisma.document.update({
      where: { id: existing.id },
      data: { storageKey: key, filename, size: pdf.length },
    });
  } else {
    await prisma.document.create({
      data: {
        organizationId,
        invoiceId,
        jobId: detail.job?.id ?? null,
        customerId: detail.customer.id,
        kind: "INVOICE_PDF",
        title: `Rechnung ${detail.invoiceNumber}`,
        filename,
        storageKey: key,
        mimeType: "application/pdf",
        size: pdf.length,
      },
    });
  }

  return key;
}
