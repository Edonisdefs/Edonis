import "server-only";

import { prisma } from "@/lib/db";
import { NotFoundError, type SessionContext } from "@/lib/auth/session";

/**
 * Mandantentrennung.
 *
 * Regel für das gesamte Projekt: Es gibt keinen Lesezugriff auf eine
 * Fachtabelle ohne `organizationId` in der `where`-Klausel. Diese Helfer
 * kapseln das Muster, damit es nicht an jeder Stelle neu geschrieben (und
 * irgendwann vergessen) wird.
 */

export function orgScope(session: SessionContext) {
  return { organizationId: session.organizationId } as const;
}

type Delegate = {
  findFirst: (args: {
    where: Record<string, unknown>;
    select?: Record<string, unknown>;
  }) => Promise<unknown>;
};

/**
 * Prüft, dass eine Entität zum Mandanten der Sitzung gehört.
 * Gibt es sie nicht (oder gehört sie einem anderen Betrieb), ist die Antwort
 * bewusst identisch: „nicht gefunden“ – so lässt sich die Existenz fremder
 * Datensätze nicht ausprobieren.
 */
export async function assertBelongsToOrg(
  session: SessionContext,
  model: keyof typeof prisma,
  id: string,
): Promise<void> {
  const delegate = prisma[model] as unknown as Delegate;
  const found = await delegate.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!found) {
    throw new NotFoundError();
  }
}

export async function requireJob(session: SessionContext, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: session.organizationId },
  });
  if (!job) throw new NotFoundError("Auftrag nicht gefunden.");
  return job;
}

export async function requireCustomer(
  session: SessionContext,
  customerId: string,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new NotFoundError("Kunde nicht gefunden.");
  return customer;
}

export async function requireInvoice(
  session: SessionContext,
  invoiceId: string,
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: session.organizationId },
  });
  if (!invoice) throw new NotFoundError("Rechnung nicht gefunden.");
  return invoice;
}
