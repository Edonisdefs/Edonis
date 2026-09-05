import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireApiSession } from "@/lib/auth/session";
import { getStorage } from "@/lib/providers/storage";
import { renderInvoicePdf } from "@/lib/services/invoice-pdf";
import { getInvoiceDetail } from "@/lib/services/invoice-service";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Rechnungs-PDF. Entwürfe werden sichtbar als solche erzeugt, damit ein
 * Entwurf nie versehentlich als fertige Rechnung verschickt wird.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;

    const detail = await getInvoiceDetail(session, id);

    // Freigegebene Rechnungen werden aus dem Storage geliefert: Die zum
    // Zeitpunkt der Freigabe erzeugte Fassung bleibt damit unverändert.
    let pdf: Buffer | null = null;
    if (detail.status !== "DRAFT") {
      const stored = await prisma.invoice.findFirst({
        where: { id, organizationId: session.organizationId },
        select: { pdfStorageKey: true },
      });
      if (stored?.pdfStorageKey) {
        pdf = await getStorage()
          .get(stored.pdfStorageKey)
          .then((file) => file.body)
          .catch(() => null);
      }
    }
    pdf ??= await renderInvoicePdf(detail);

    await audit(session, {
      action: "invoice.pdf_generate",
      entityType: "invoice",
      entityId: id,
      metadata: { status: detail.status },
    });

    const prefix = detail.status === "DRAFT" ? "ENTWURF-" : "";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": `${pdf.length}`,
        "Content-Disposition": `inline; filename="${prefix}Rechnung-${detail.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
