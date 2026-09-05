import type { InvoiceItemKind } from "@prisma/client";

import { lineNet, round2, round3, sumInvoiceLines } from "@/lib/money";

/**
 * Baut aus den bestätigten Auftragsdaten die Rechnungspositionen.
 * Rein funktional – die Kalkulation ist damit vollständig testbar und
 * unabhängig von Datenbank und Framework.
 */

export type DraftLine = {
  position: number;
  kind: InvoiceItemKind;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  netAmount: number;
  vatRate: number;
};

export type BuildInvoiceInput = {
  timeEntries: Array<{
    hours: number;
    hourlyRate: number;
    description: string | null;
    date: Date;
  }>;
  materials: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  travelFlatRate: number;
  vatRate: number;
  /** § 19 UStG: keine Umsatzsteuer ausweisen. */
  smallBusiness: boolean;
};

export type InvoiceDraft = {
  lines: DraftLine[];
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
};

const LABOR_DESCRIPTION = "Monteurstunden";

export function buildInvoiceDraft(input: BuildInvoiceInput): InvoiceDraft {
  const vatRate = input.smallBusiness ? 0 : input.vatRate;
  const lines: DraftLine[] = [];
  let position = 1;

  // --- Arbeitszeit ---------------------------------------------------------
  // Gleiche Stundensätze werden zu einer Position zusammengefasst; das ist
  // die Darstellung, die Handwerksbetriebe auf ihren Rechnungen erwarten.
  const laborByRate = new Map<number, number>();
  for (const entry of input.timeEntries) {
    if (entry.hours <= 0) continue;
    laborByRate.set(
      entry.hourlyRate,
      round3((laborByRate.get(entry.hourlyRate) ?? 0) + entry.hours),
    );
  }

  const sortedRates = [...laborByRate.entries()].sort((a, b) => b[0] - a[0]);
  for (const [rate, hours] of sortedRates) {
    lines.push({
      position: position++,
      kind: "LABOR",
      description:
        sortedRates.length > 1
          ? `${LABOR_DESCRIPTION} (${rate.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
            })}/Std.)`
          : LABOR_DESCRIPTION,
      quantity: hours,
      unit: "Std.",
      unitPrice: rate,
      netAmount: lineNet(hours, rate),
      vatRate,
    });
  }

  // --- Material ------------------------------------------------------------
  for (const material of input.materials) {
    if (material.quantity <= 0) continue;
    lines.push({
      position: position++,
      kind: "MATERIAL",
      description: material.description,
      quantity: round3(material.quantity),
      unit: material.unit,
      unitPrice: material.unitPrice,
      netAmount: lineNet(material.quantity, material.unitPrice),
      vatRate,
    });
  }

  // --- Anfahrt -------------------------------------------------------------
  if (input.travelFlatRate > 0) {
    lines.push({
      position: position++,
      kind: "TRAVEL",
      description: "Anfahrtspauschale",
      quantity: 1,
      unit: "Pauschale",
      unitPrice: round2(input.travelFlatRate),
      netAmount: round2(input.travelFlatRate),
      vatRate,
    });
  }

  const totals = sumInvoiceLines(lines);

  return {
    lines,
    netTotal: totals.net,
    vatTotal: totals.vat,
    grossTotal: totals.gross,
  };
}

export function recalculateTotals(
  lines: Array<{ quantity: number; unitPrice: number; vatRate: number }>,
): { netTotal: number; vatTotal: number; grossTotal: number } {
  const withNet = lines.map((line) => ({
    netAmount: lineNet(line.quantity, line.unitPrice),
    vatRate: line.vatRate,
  }));
  const totals = sumInvoiceLines(withNet);
  return {
    netTotal: totals.net,
    vatTotal: totals.vat,
    grossTotal: totals.gross,
  };
}

/** Zahlungsziel aus den Betriebseinstellungen. */
export function calculateDueDate(issueDate: Date, termsDays: number): Date {
  const due = new Date(issueDate);
  due.setDate(due.getDate() + Math.max(0, termsDays));
  return due;
}
