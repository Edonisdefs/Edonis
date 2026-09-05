import type { ExtractJobReportInput } from "./types";

const TRADE_LABELS: Record<string, string> = {
  SHK: "Sanitär-, Heizungs- und Klimatechnik (SHK)",
  ELEKTRO: "Elektrotechnik",
  MALER: "Maler- und Lackiererhandwerk",
  DACHDECKER: "Dachdeckerhandwerk",
  SCHREINER: "Schreiner-/Tischlerhandwerk",
  BAU: "Bau- und Montagearbeiten",
  SONSTIGES: "Handwerk",
};

/**
 * Stabiler Teil der Anweisung – identisch für alle Anfragen und damit gut
 * cachebar. Betriebsspezifischer Kontext steht bewusst in der User-Nachricht.
 */
export const EXTRACTION_SYSTEM_PROMPT = `Du bist der Büroassistent eines deutschen Handwerksbetriebs.

Deine Aufgabe: Aus einem gesprochenen oder getippten Baustellenbericht die abrechnungsrelevanten Daten extrahieren.

Verbindliche Regeln:
1. Erfinde niemals Daten. Was nicht klar aus dem Text hervorgeht, bleibt null bzw. eine leere Liste.
2. Was fehlt, aber für eine Rechnung gebraucht wird, gehört nach "missing_information" – in kurzem, verständlichem Deutsch (z.B. "Stundensatz", "Materialpreis Eckventil", "Leistungsdatum").
3. Preise gehören NICHT in die Ausgabe. Du erfasst nur Mengen und Bezeichnungen; kalkuliert wird im System.
4. "activities" sind durchgeführte Tätigkeiten, je ein kurzer Satz im Perfekt-Partizip-Stil ("Alte Armatur ausgebaut"). Baue keine Materialmengen in Tätigkeiten ein.
5. "materials" enthält nur tatsächlich verbautes oder verbrauchtes Material mit ausdrücklich genannter Menge. Ausbau oder Demontage eines Teils ist kein Materialverbrauch.
6. Rechne Zeitangaben in Dezimalstunden um ("von 8 bis 10 Uhr" → 2, "von 9 bis 11 Uhr 30" → 2.5). Bei mehreren Monteuren zählt die Summe aller Arbeitsstunden.
7. Nutze die mitgelieferten Kunden- und Materiallisten. Nenne Material möglichst exakt so wie im Katalog. Ist ein Kunde nicht in der Liste, gib den gehörten Namen zurück und weise in "missing_information" darauf hin.
8. "confidence" ist deine ehrliche Selbsteinschätzung von 0 bis 1 über die gesamte Extraktion. Bei undeutlichem oder widersprüchlichem Text niedrig ansetzen.
9. Antworte ausschließlich im vorgegebenen JSON-Format, ohne zusätzlichen Text.`;

export function buildUserPrompt(input: ExtractJobReportInput): string {
  const { context } = input;
  const parts: string[] = [];

  parts.push(`Gewerk: ${TRADE_LABELS[context.trade] ?? TRADE_LABELS.SONSTIGES}`);
  parts.push(`Heutiges Datum: ${context.today}`);

  if (context.currentCustomerName) {
    parts.push(
      `Der Bericht gehört zu einem Auftrag des Kunden: ${context.currentCustomerName}`,
    );
  }

  if (context.customers.length > 0) {
    parts.push(
      `Bekannte Kunden:\n${context.customers
        .slice(0, 200)
        .map((customer) => `- ${customer.name}`)
        .join("\n")}`,
    );
  }

  if (context.materials.length > 0) {
    parts.push(
      `Materialkatalog (Bezeichnung | Einheit | Synonyme):\n${context.materials
        .slice(0, 300)
        .map(
          (material) =>
            `- ${material.name} | ${material.unit}${
              material.aliases.length > 0
                ? ` | ${material.aliases.join(", ")}`
                : ""
            }`,
        )
        .join("\n")}`,
    );
  }

  parts.push(`Bericht des Monteurs:\n"""\n${input.text.trim()}\n"""`);

  return parts.join("\n\n");
}

export { TRADE_LABELS };
