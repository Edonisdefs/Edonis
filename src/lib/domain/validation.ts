/**
 * Freigabe-Gate für Rechnungen.
 *
 * Kernanforderung des Produkts: Es darf niemals eine Rechnung entstehen oder
 * herausgehen, solange wichtige Daten fehlen oder ein KI-Vorschlag noch nicht
 * bestätigt wurde. Diese Prüfung ist rein funktional und deshalb vollständig
 * testbar.
 */

export type IssueSeverity = "blocker" | "warning";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: IssueSeverity;
  /** Wohin die Oberfläche springen soll, um es zu beheben. */
  target?: "job" | "customer" | "organization" | "material" | "time" | "review";
};

export type InvoiceReadinessInput = {
  job: {
    performedAt: Date | null;
    activityCount: number;
  };
  timeEntries: Array<{
    hours: number;
    /** Effektiver Stundensatz nach Auftrag/Kunde/Betrieb, null = ungeklärt. */
    hourlyRate: number | null;
  }>;
  materials: Array<{
    description: string;
    quantity: number;
    unitPrice: number | null;
  }>;
  customer: {
    name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
  };
  organization: {
    name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
    taxNumber: string | null;
    vatId: string | null;
    smallBusiness: boolean;
  };
  /** Noch offene KI-Vorschläge (Status PENDING). */
  pendingExtractions: number;
  /** Niedrigste Confidence unter den bestätigten Extraktionen. */
  lowestConfirmedConfidence: number | null;
  hasServiceReport: boolean;
};

export type InvoiceReadiness = {
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  canCreateDraft: boolean;
};

const CONFIDENCE_WARNING_THRESHOLD = 0.7;

export function validateJobForInvoice(
  input: InvoiceReadinessInput,
): InvoiceReadiness {
  const blockers: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // --- Es muss überhaupt etwas abzurechnen geben ---------------------------
  const totalHours = input.timeEntries.reduce(
    (sum, entry) => sum + entry.hours,
    0,
  );
  if (totalHours <= 0 && input.materials.length === 0) {
    blockers.push({
      code: "no_services",
      severity: "blocker",
      message:
        "Es sind weder Arbeitszeiten noch Material erfasst. Bericht aufnehmen oder Positionen ergänzen.",
      target: "job",
    });
  }

  // --- Offene KI-Vorschläge ------------------------------------------------
  if (input.pendingExtractions > 0) {
    blockers.push({
      code: "pending_extraction",
      severity: "blocker",
      message:
        input.pendingExtractions === 1
          ? "Ein KI-Vorschlag wartet noch auf Ihre Bestätigung."
          : `${input.pendingExtractions} KI-Vorschläge warten noch auf Ihre Bestätigung.`,
      target: "review",
    });
  }

  // --- Preise --------------------------------------------------------------
  if (input.timeEntries.some((entry) => entry.hourlyRate === null)) {
    blockers.push({
      code: "missing_hourly_rate",
      severity: "blocker",
      message:
        "Für mindestens einen Zeiteintrag fehlt der Stundensatz. In den Einstellungen oder am Auftrag hinterlegen.",
      target: "organization",
    });
  }

  for (const material of input.materials) {
    if (material.unitPrice === null) {
      blockers.push({
        code: "missing_material_price",
        severity: "blocker",
        message: `Für „${material.description}“ fehlt der Einzelpreis.`,
        target: "material",
      });
    }
    if (material.quantity <= 0) {
      blockers.push({
        code: "invalid_material_quantity",
        severity: "blocker",
        message: `Die Menge für „${material.description}“ ist nicht plausibel.`,
        target: "material",
      });
    }
  }

  // --- Leistungsdatum ------------------------------------------------------
  if (!input.job.performedAt) {
    blockers.push({
      code: "missing_service_date",
      severity: "blocker",
      message: "Das Leistungsdatum fehlt (Pflichtangabe auf der Rechnung).",
      target: "job",
    });
  }

  // --- Empfängerdaten (§ 14 UStG) -----------------------------------------
  if (!input.customer.street || !input.customer.zip || !input.customer.city) {
    blockers.push({
      code: "incomplete_customer_address",
      severity: "blocker",
      message:
        "Die Anschrift des Kunden ist unvollständig (Straße, PLZ und Ort sind Pflicht).",
      target: "customer",
    });
  }

  // --- Absenderdaten (§ 14 UStG) ------------------------------------------
  const organization = input.organization;
  if (!organization.street || !organization.zip || !organization.city) {
    blockers.push({
      code: "incomplete_organization_address",
      severity: "blocker",
      message:
        "Die Anschrift Ihres Betriebs ist unvollständig. Bitte in den Einstellungen ergänzen.",
      target: "organization",
    });
  }
  if (!organization.taxNumber && !organization.vatId) {
    blockers.push({
      code: "missing_tax_number",
      severity: "blocker",
      message:
        "Steuernummer oder USt-IdNr. fehlt. Beides ist Pflichtangabe auf der Rechnung.",
      target: "organization",
    });
  }

  // --- Hinweise, die nicht blockieren -------------------------------------
  if (input.job.activityCount === 0) {
    warnings.push({
      code: "no_activities",
      severity: "warning",
      message:
        "Es ist keine Tätigkeit beschrieben. Die Rechnung wäre für den Kunden schwer nachvollziehbar.",
      target: "job",
    });
  }

  if (
    input.lowestConfirmedConfidence !== null &&
    input.lowestConfirmedConfidence < CONFIDENCE_WARNING_THRESHOLD
  ) {
    warnings.push({
      code: "low_confidence",
      severity: "warning",
      message:
        "Die KI war sich bei diesem Bericht unsicher. Bitte Positionen besonders sorgfältig prüfen.",
      target: "review",
    });
  }

  if (!input.hasServiceReport) {
    warnings.push({
      code: "no_service_report",
      severity: "warning",
      message: "Für diesen Auftrag gibt es noch keinen Leistungsnachweis.",
      target: "job",
    });
  }

  return {
    blockers,
    warnings,
    canCreateDraft: blockers.length === 0,
  };
}
