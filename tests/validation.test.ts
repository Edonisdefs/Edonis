import { describe, expect, it } from "vitest";

import {
  validateJobForInvoice,
  type InvoiceReadinessInput,
} from "@/lib/domain/validation";

/** Ein Auftrag, aus dem eine Rechnung entstehen darf. */
function completeJob(): InvoiceReadinessInput {
  return {
    job: { performedAt: new Date("2026-03-11"), activityCount: 3 },
    timeEntries: [{ hours: 2, hourlyRate: 68 }],
    materials: [{ description: "Eckventil", quantity: 1, unitPrice: 12.5 }],
    customer: {
      name: "Müller",
      street: "Lindenstraße 8",
      zip: "81543",
      city: "München",
    },
    organization: {
      name: "Sanitär Berger",
      street: "Rosenheimer Straße 42",
      zip: "81669",
      city: "München",
      taxNumber: "143/205/60123",
      vatId: null,
      smallBusiness: false,
    },
    pendingExtractions: 0,
    lowestConfirmedConfidence: 0.95,
    hasServiceReport: true,
  };
}

const codes = (issues: Array<{ code: string }>) =>
  issues.map((issue) => issue.code);

describe("validateJobForInvoice", () => {
  it("gibt einen vollständigen Auftrag frei", () => {
    const result = validateJobForInvoice(completeJob());

    expect(result.blockers).toEqual([]);
    expect(result.canCreateDraft).toBe(true);
  });

  it("blockiert, solange ein KI-Vorschlag ungeprüft ist", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      pendingExtractions: 2,
    });

    expect(codes(result.blockers)).toContain("pending_extraction");
    expect(result.canCreateDraft).toBe(false);
    expect(result.blockers[0]?.message).toContain("2 KI-Vorschläge");
  });

  it("blockiert bei fehlendem Materialpreis", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      materials: [{ description: "Blende", quantity: 1, unitPrice: null }],
    });

    expect(codes(result.blockers)).toContain("missing_material_price");
    expect(result.blockers[0]?.message).toContain("Blende");
  });

  it("blockiert bei fehlendem Stundensatz", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      timeEntries: [{ hours: 2, hourlyRate: null }],
    });

    expect(codes(result.blockers)).toContain("missing_hourly_rate");
  });

  it("blockiert bei unvollständiger Kundenanschrift", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      customer: { name: "Neubauer", street: null, zip: null, city: null },
    });

    expect(codes(result.blockers)).toContain("incomplete_customer_address");
  });

  it("blockiert ohne Steuernummer und ohne USt-IdNr.", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      organization: {
        ...completeJob().organization,
        taxNumber: null,
        vatId: null,
      },
    });

    expect(codes(result.blockers)).toContain("missing_tax_number");
  });

  it("akzeptiert die USt-IdNr. anstelle der Steuernummer", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      organization: {
        ...completeJob().organization,
        taxNumber: null,
        vatId: "DE812345678",
      },
    });

    expect(codes(result.blockers)).not.toContain("missing_tax_number");
  });

  it("blockiert ohne Leistungsdatum", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      job: { performedAt: null, activityCount: 2 },
    });

    expect(codes(result.blockers)).toContain("missing_service_date");
  });

  it("blockiert ohne jede Leistung", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      timeEntries: [],
      materials: [],
    });

    expect(codes(result.blockers)).toContain("no_services");
  });

  it("warnt bei niedriger Confidence, blockiert aber nicht", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      lowestConfirmedConfidence: 0.42,
    });

    expect(result.blockers).toEqual([]);
    expect(codes(result.warnings)).toContain("low_confidence");
    expect(result.canCreateDraft).toBe(true);
  });

  it("warnt bei fehlendem Leistungsnachweis und fehlender Tätigkeit", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      hasServiceReport: false,
      job: { performedAt: new Date(), activityCount: 0 },
    });

    expect(codes(result.warnings)).toEqual(
      expect.arrayContaining(["no_activities", "no_service_report"]),
    );
    expect(result.canCreateDraft).toBe(true);
  });

  it("sammelt mehrere Blocker gleichzeitig", () => {
    const result = validateJobForInvoice({
      ...completeJob(),
      pendingExtractions: 1,
      timeEntries: [{ hours: 1, hourlyRate: null }],
      customer: { name: "X", street: null, zip: null, city: null },
    });

    expect(result.blockers.length).toBeGreaterThanOrEqual(3);
    expect(result.canCreateDraft).toBe(false);
  });
});
