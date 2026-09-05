import "server-only";

import { prisma } from "@/lib/db";

/**
 * Fortlaufende Nummernkreise.
 *
 * Der Zähler wird per `increment` in der Datenbank hochgezählt – damit gibt es
 * auch bei parallelen Anfragen keine doppelten Rechnungsnummern. Der Zähler
 * wird bewusst nicht jährlich zurückgesetzt: Eindeutigkeit über die gesamte
 * Historie ist wichtiger als kurze Nummern.
 */

function pad(value: number): string {
  return `${value}`.padStart(4, "0");
}

export async function nextInvoiceNumber(
  organizationId: string,
  reference = new Date(),
): Promise<string> {
  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: { invoiceCounter: { increment: 1 } },
    select: { invoiceCounter: true, invoicePrefix: true },
  });

  return `${organization.invoicePrefix}-${reference.getFullYear()}-${pad(
    organization.invoiceCounter,
  )}`;
}

export async function nextJobNumber(
  organizationId: string,
  reference = new Date(),
): Promise<string> {
  const organization = await prisma.organization.update({
    where: { id: organizationId },
    data: { jobCounter: { increment: 1 } },
    select: { jobCounter: true, jobPrefix: true },
  });

  return `${organization.jobPrefix}-${reference.getFullYear()}-${pad(
    organization.jobCounter,
  )}`;
}

/** Der Leistungsnachweis erbt die Auftragsnummer – eindeutig und auffindbar. */
export function serviceReportNumber(jobNumber: string): string {
  return `LN-${jobNumber}`;
}

export async function nextCustomerNumber(
  organizationId: string,
): Promise<string> {
  const count = await prisma.customer.count({ where: { organizationId } });
  let candidate = `K-${pad(count + 1)}`;
  let attempt = count + 1;

  // Nach Löschungen kann die Zählung kollidieren – dann weiterzählen.
  while (
    await prisma.customer.findFirst({
      where: { organizationId, customerNumber: candidate },
      select: { id: true },
    })
  ) {
    attempt += 1;
    candidate = `K-${pad(attempt)}`;
  }

  return candidate;
}
