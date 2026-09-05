import type { JobReportExtraction } from "./schema";

/**
 * KI-Abstraktion.
 *
 * `MockAiProvider` arbeitet regelbasiert und ohne Netzwerkzugriff, damit das
 * MVP lokal und in Tests vollständig funktioniert. `AnthropicAiProvider`
 * nutzt dieselbe Schnittstelle mit strukturierter Ausgabe.
 */

export type MaterialHint = {
  id: string;
  name: string;
  unit: string;
  aliases: string[];
  defaultPrice: number | null;
};

export type CustomerHint = {
  id: string;
  name: string;
};

/** Kontext aus der Datenbank – reduziert Halluzinationen deutlich. */
export type ExtractionContext = {
  trade: string;
  /** Referenzdatum für relative Angaben wie "heute" (YYYY-MM-DD). */
  today: string;
  customers: CustomerHint[];
  materials: MaterialHint[];
  /** Bereits bekannter Auftragskunde, falls die Aufnahme am Auftrag hängt. */
  currentCustomerName?: string | null;
  defaultHourlyRate: number | null;
};

export type ExtractJobReportInput = {
  /** Transkript der Sprachnachricht oder eingetippte Notiz. */
  text: string;
  context: ExtractionContext;
};

export type ExtractionOutcome = {
  extraction: JobReportExtraction;
  provider: string;
  model: string | null;
};

export type PhotoAnalysisInput = {
  images: Array<{ data: Buffer; mimeType: string }>;
  context: ExtractionContext;
};

export interface AiProvider {
  readonly name: string;
  extractJobReport(input: ExtractJobReportInput): Promise<ExtractionOutcome>;
  /**
   * Bildanalyse ist im MVP nicht aktiv – der Einstiegspunkt existiert, damit
   * Fotos später ohne Umbau ausgewertet werden können.
   */
  analyzePhotos?(input: PhotoAnalysisInput): Promise<ExtractionOutcome>;
}

export class AiExtractionError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiExtractionError";
  }
}
