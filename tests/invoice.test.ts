import { describe, expect, it } from "vitest";

import {
  buildInvoiceDraft,
  calculateDueDate,
  recalculateTotals,
} from "@/lib/domain/invoice-builder";
import {
  lineNet,
  parseGermanNumber,
  round2,
  sumInvoiceLines,
  toNumber,
} from "@/lib/money";

const baseInput = {
  timeEntries: [
    {
      hours: 2,
      hourlyRate: 68,
      description: null,
      date: new Date("2026-03-11"),
    },
  ],
  materials: [
    { description: "Flexschlauch", quantity: 2, unit: "Stück", unitPrice: 8.9 },
    { description: "Eckventil", quantity: 1, unit: "Stück", unitPrice: 12.5 },
  ],
  travelFlatRate: 0,
  vatRate: 19,
  smallBusiness: false,
};

describe("buildInvoiceDraft", () => {
  it("erzeugt Positionen für Arbeitszeit und Material", () => {
    const draft = buildInvoiceDraft(baseInput);

    expect(draft.lines).toHaveLength(3);
    expect(draft.lines[0]).toMatchObject({
      kind: "LABOR",
      quantity: 2,
      unit: "Std.",
      unitPrice: 68,
      netAmount: 136,
    });
    expect(draft.lines[1]).toMatchObject({
      kind: "MATERIAL",
      description: "Flexschlauch",
      netAmount: 17.8,
    });
  });

  it("rechnet Netto, Umsatzsteuer und Brutto korrekt", () => {
    const draft = buildInvoiceDraft(baseInput);

    // 136,00 + 17,80 + 12,50 = 166,30
    expect(draft.netTotal).toBe(166.3);
    expect(draft.vatTotal).toBe(31.6);
    expect(draft.grossTotal).toBe(197.9);
  });

  it("weist bei Kleinunternehmern keine Umsatzsteuer aus", () => {
    const draft = buildInvoiceDraft({ ...baseInput, smallBusiness: true });

    expect(draft.vatTotal).toBe(0);
    expect(draft.grossTotal).toBe(draft.netTotal);
    expect(draft.lines.every((line) => line.vatRate === 0)).toBe(true);
  });

  it("fasst gleiche Stundensätze zu einer Position zusammen", () => {
    const draft = buildInvoiceDraft({
      ...baseInput,
      timeEntries: [
        { hours: 4, hourlyRate: 68, description: null, date: new Date() },
        { hours: 4, hourlyRate: 68, description: null, date: new Date() },
      ],
      materials: [],
    });

    const laborLines = draft.lines.filter((line) => line.kind === "LABOR");
    expect(laborLines).toHaveLength(1);
    expect(laborLines[0]?.quantity).toBe(8);
    expect(laborLines[0]?.netAmount).toBe(544);
  });

  it("trennt unterschiedliche Stundensätze in eigene Positionen", () => {
    const draft = buildInvoiceDraft({
      ...baseInput,
      timeEntries: [
        { hours: 4, hourlyRate: 78, description: null, date: new Date() },
        { hours: 4, hourlyRate: 62, description: null, date: new Date() },
      ],
      materials: [],
    });

    const laborLines = draft.lines.filter((line) => line.kind === "LABOR");
    expect(laborLines).toHaveLength(2);
    expect(laborLines[0]?.unitPrice).toBe(78);
    expect(draft.netTotal).toBe(560);
  });

  it("ergänzt die Anfahrtspauschale als eigene Position", () => {
    const draft = buildInvoiceDraft({ ...baseInput, travelFlatRate: 25 });
    const travel = draft.lines.find((line) => line.kind === "TRAVEL");

    expect(travel).toMatchObject({ quantity: 1, netAmount: 25 });
    expect(draft.netTotal).toBe(191.3);
  });

  it("überspringt Positionen ohne Menge", () => {
    const draft = buildInvoiceDraft({
      ...baseInput,
      timeEntries: [
        { hours: 0, hourlyRate: 68, description: null, date: new Date() },
      ],
      materials: [
        { description: "Nichts", quantity: 0, unit: "Stück", unitPrice: 5 },
      ],
    });

    expect(draft.lines).toHaveLength(0);
    expect(draft.grossTotal).toBe(0);
  });
});

describe("recalculateTotals", () => {
  it("rechnet nach einer Positionsänderung neu", () => {
    const totals = recalculateTotals([
      { quantity: 3, unitPrice: 10, vatRate: 19 },
      { quantity: 1, unitPrice: 5.5, vatRate: 19 },
    ]);

    expect(totals.netTotal).toBe(35.5);
    expect(totals.vatTotal).toBe(6.75);
    expect(totals.grossTotal).toBe(42.25);
  });
});

describe("sumInvoiceLines", () => {
  it("bildet die Steuer je Steuersatz", () => {
    const totals = sumInvoiceLines([
      { netAmount: 100, vatRate: 19 },
      { netAmount: 100, vatRate: 7 },
    ]);

    expect(totals.net).toBe(200);
    expect(totals.vat).toBe(26);
    expect(totals.gross).toBe(226);
  });

  it("rundet ohne Float-Artefakte", () => {
    const totals = sumInvoiceLines([
      { netAmount: 0.1, vatRate: 19 },
      { netAmount: 0.2, vatRate: 19 },
    ]);
    expect(totals.net).toBe(0.3);
  });
});

describe("calculateDueDate", () => {
  it("addiert das Zahlungsziel", () => {
    const due = calculateDueDate(new Date("2026-03-11T10:00:00"), 14);
    expect(due.toISOString().slice(0, 10)).toBe("2026-03-25");
  });
});

describe("Zahlenhilfen", () => {
  it("parst deutsche Zahleneingaben", () => {
    expect(parseGermanNumber("1.234,56")).toBe(1234.56);
    expect(parseGermanNumber("2,5")).toBe(2.5);
    expect(parseGermanNumber("12")).toBe(12);
    expect(parseGermanNumber("")).toBeNull();
    expect(parseGermanNumber("keine Zahl")).toBeNull();
  });

  it("normalisiert Decimal-Werte", () => {
    expect(toNumber({ toString: () => "12.50" })).toBe(12.5);
    expect(toNumber(null, 7)).toBe(7);
  });

  it("rundet kaufmännisch", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(lineNet(3, 3.333)).toBe(10);
  });
});
