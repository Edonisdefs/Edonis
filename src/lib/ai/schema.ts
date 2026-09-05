import { z } from "zod";

/**
 * Vertrag für die KI-Extraktion.
 *
 * Zentrale Regel: Die KI darf nichts erfinden. Was sie nicht sicher erkennt,
 * bleibt `null` bzw. leer und wird in `missing_information` benannt. Dieses
 * Schema ist gleichzeitig die Ausgabestruktur der Anthropic-API
 * (Structured Outputs) und die Validierung für jedes gespeicherte Ergebnis.
 */

export const extractedMaterialSchema = z.object({
  /** Wortlaut aus dem Bericht, z.B. "Flexschlauch" */
  description: z.string().min(1),
  quantity: z.number().nonnegative(),
  /** "Stück", "m", "kg", "h", "Pauschale" … */
  unit: z.string().min(1),
});

export const jobReportExtractionSchema = z.object({
  /** Kundenname, wenn eindeutig erkennbar – sonst null. */
  customer: z.string().nullable(),
  /** Leistungsdatum im Format YYYY-MM-DD. */
  date: z.string().nullable(),
  /** Gesamte Arbeitszeit in Stunden (alle Mitarbeiter zusammen). */
  work_duration_hours: z.number().nonnegative().nullable(),
  /** "08:00" */
  start_time: z.string().nullable(),
  /** "10:00" */
  end_time: z.string().nullable(),
  /** Durchgeführte Tätigkeiten, je ein kurzer Satz. */
  activities: z.array(z.string().min(1)),
  materials: z.array(extractedMaterialSchema),
  /** Freitext-Hinweise, die keine Tätigkeit sind (z.B. "Kunde war vor Ort"). */
  notes: z.string().nullable(),
  /** 0–1. Unter 0.7 wird in der Oberfläche deutlich gewarnt. */
  confidence: z.number().min(0).max(1),
  /** Klartext, was fehlt – z.B. "Stundensatz", "Materialpreis Eckventil". */
  missing_information: z.array(z.string()),
});

export type ExtractedMaterial = z.infer<typeof extractedMaterialSchema>;
export type JobReportExtraction = z.infer<typeof jobReportExtractionSchema>;

export const EMPTY_EXTRACTION: JobReportExtraction = {
  customer: null,
  date: null,
  work_duration_hours: null,
  start_time: null,
  end_time: null,
  activities: [],
  materials: [],
  notes: null,
  confidence: 0,
  missing_information: [],
};

/**
 * Nimmt beliebiges JSON entgegen und gibt eine garantiert gültige Extraktion
 * zurück. Ungültige Daten führen nie zu einem Absturz der Oberfläche – im
 * Zweifel steht dort eine leere Extraktion mit Confidence 0.
 */
export function parseExtraction(value: unknown): JobReportExtraction {
  const result = jobReportExtractionSchema.safeParse(value);
  if (result.success) return result.data;
  return { ...EMPTY_EXTRACTION };
}

/** Zusammenfassung für die Review-Oberfläche. */
export function summarizeExtraction(extraction: JobReportExtraction): {
  hours: number;
  activityCount: number;
  materialCount: number;
  hasMissing: boolean;
  lowConfidence: boolean;
} {
  return {
    hours: extraction.work_duration_hours ?? 0,
    activityCount: extraction.activities.length,
    materialCount: extraction.materials.length,
    hasMissing: extraction.missing_information.length > 0,
    lowConfidence: extraction.confidence < CONFIDENCE_THRESHOLD,
  };
}

/** Ab hier gilt eine Extraktion als „unsicher“ und wird deutlich markiert. */
export const CONFIDENCE_THRESHOLD = 0.7;
