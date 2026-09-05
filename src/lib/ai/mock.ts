import { round2, round3 } from "@/lib/money";
import { CONFIDENCE_THRESHOLD, type JobReportExtraction } from "./schema";
import type {
  AiProvider,
  ExtractJobReportInput,
  ExtractionContext,
  ExtractionOutcome,
  MaterialHint,
} from "./types";

/**
 * Regelbasierte Extraktion für Entwicklung, Demo und Tests.
 *
 * Der Mock ist bewusst konservativ: Er erkennt nur, was klar im Text steht.
 * Alles andere bleibt `null` und landet in `missing_information` – exakt das
 * Verhalten, das auch vom echten Modell erwartet wird.
 */

const NUMBER_WORDS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einen: 1,
  einem: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  dreizehn: 13,
  vierzehn: 14,
  fünfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  dreißig: 30,
  vierzig: 40,
  fünfzig: 50,
};

const UNIT_WORDS: Record<string, string> = {
  meter: "m",
  metern: "m",
  m: "m",
  laufmeter: "m",
  stück: "Stück",
  stk: "Stück",
  liter: "l",
  litern: "l",
  l: "l",
  kilogramm: "kg",
  kilo: "kg",
  kg: "kg",
  packung: "Packung",
  packungen: "Packung",
  rolle: "Rolle",
  rollen: "Rolle",
  sack: "Sack",
  säcke: "Sack",
  satz: "Satz",
  set: "Set",
  dose: "Dose",
  dosen: "Dose",
  paar: "Paar",
  stunde: "h",
  stunden: "h",
};

/** Nomen, die nie Material sind (Zeit- und Personenangaben). */
const NON_MATERIAL_NOUNS = new Set([
  "uhr",
  "stunde",
  "stunden",
  "minute",
  "minuten",
  "tag",
  "tage",
  "tagen",
  "woche",
  "wochen",
  "monteur",
  "monteure",
  "monteuren",
  "mitarbeiter",
  "kollege",
  "kollegen",
  "mann",
  "leute",
  "personen",
  "person",
  "grad",
  "prozent",
  "mal",
  "euro",
  "kunde",
  "kunden",
  "baustelle",
  "termin",
  "auftrag",
]);

const MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

/** Partizipien: "geprüft", "eingebaut", "verlegt", "montiert" … */
// Achtung: \w ist in JavaScript ASCII-only – „geprüft“ würde damit nicht
// erkannt. Deshalb durchgehend \p{L} mit u-Flag.
const PARTICIPLE_PATTERNS = [
  /(?:^|\s)[\p{L}]*ge[\p{L}]{2,}(?:t|en)(?=$|[\s.,;:!?])/iu,
  /(?:^|\s)(?:ver|be|er|ent|zer|über|unter|durch|um|wieder|voll)[\p{L}]{3,}(?:t|en)(?=$|[\s.,;:!?])/iu,
  /(?:^|\s)[\p{L}]{4,}iert(?=$|[\s.,;:!?])/iu,
];

function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function parseNumeric(token: string): number | null {
  const cleaned = token.trim().toLowerCase();
  if (!cleaned) return null;
  if (/^\d+(?:[.,]\d+)?$/.test(cleaned)) {
    return Number(cleaned.replace(",", "."));
  }
  return NUMBER_WORDS[cleaned] ?? null;
}

function hasParticiple(text: string): boolean {
  return PARTICIPLE_PATTERNS.some((pattern) => pattern.test(text));
}

function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Kunde
// ---------------------------------------------------------------------------

export function detectCustomer(
  text: string,
  context: ExtractionContext,
): { name: string | null; matchedKnown: boolean; span: string | null } {
  const haystack = normalizeWord(text);

  // 1) Bekannte Kunden aus der Datenbank – höchste Trefferqualität.
  let best: { name: string; length: number } | null = null;
  for (const customer of context.customers) {
    const tokens = customer.name
      .split(/[\s,]+/)
      .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ""))
      .filter((token) => token.length >= 4);
    for (const token of tokens) {
      const needle = normalizeWord(token);
      if (needle.length >= 4 && haystack.includes(needle)) {
        if (!best || needle.length > best.length) {
          best = { name: customer.name, length: needle.length };
        }
      }
    }
  }
  if (best) return { name: best.name, matchedKnown: true, span: null };

  // 2) Sprachliche Muster: "Baustelle Müller", "Kunde Schneider", "Familie Weber"
  // Das Schlüsselwort wird ohne Rücksicht auf Groß-/Kleinschreibung gesucht,
  // der Name danach muss aber großgeschrieben sein (deutsches Nomen).
  const keyword =
    /\b(?:baustelle|kunde|kundin|auftrag|objekt|firma|familie|bei)\s+/iu;
  const keywordMatch = keyword.exec(text);
  if (keywordMatch) {
    const rest = text.slice(keywordMatch.index + keywordMatch[0].length);
    const nameMatch = /^([A-ZÄÖÜ][\p{L}.-]+(?:\s+[A-ZÄÖÜ][\p{L}.-]+)?)/u.exec(
      rest,
    );
    if (nameMatch?.[1]) {
      return {
        name: nameMatch[1].trim(),
        matchedKnown: false,
        span: `${keywordMatch[0]}${nameMatch[1]}`,
      };
    }
  }

  return { name: null, matchedKnown: false, span: null };
}

// ---------------------------------------------------------------------------
// Datum
// ---------------------------------------------------------------------------

export function detectDate(
  text: string,
  todayIso: string,
): { date: string | null; span: string | null } {
  const today = new Date(`${todayIso}T12:00:00`);
  const lower = text.toLowerCase();

  if (/\bheute\b/.test(lower)) return { date: todayIso, span: "heute" };
  if (/\bgestern\b/.test(lower)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return { date: toIsoDate(date), span: "gestern" };
  }
  if (/\bvorgestern\b/.test(lower)) {
    const date = new Date(today);
    date.setDate(date.getDate() - 2);
    return { date: toIsoDate(date), span: "vorgestern" };
  }
  if (/\bmorgen\b/.test(lower)) {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return { date: toIsoDate(date), span: "morgen" };
  }

  const numeric = /\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})?/.exec(text);
  if (numeric?.[1] && numeric[2]) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const yearRaw = numeric[3];
    const year = yearRaw
      ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw)
      : today.getFullYear();
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return {
        date: `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`,
        span: numeric[0],
      };
    }
  }

  const named = /\b(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\b/.exec(text);
  if (named?.[1] && named[2]) {
    const month = MONTHS[named[2].toLowerCase()];
    const day = Number(named[1]);
    if (month && day >= 1 && day <= 31) {
      return {
        date: `${today.getFullYear()}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`,
        span: named[0],
      };
    }
  }

  return { date: null, span: null };
}

// ---------------------------------------------------------------------------
// Arbeitszeit
// ---------------------------------------------------------------------------

export type TimeResult = {
  hours: number | null;
  start: string | null;
  end: string | null;
  span: string | null;
};

export function detectWorkTime(text: string): TimeResult {
  // "von 8 bis 10 Uhr", "von 9 Uhr 30 bis 11 Uhr", "von 8:30 bis 16:00"
  const range =
    /von\s+(\d{1,2})(?:[.:](\d{2}))?\s*(?:uhr\s*(\d{2})?)?\s*bis\s+(\d{1,2})(?:[.:](\d{2}))?\s*(?:uhr\s*(\d{2})?)?/i.exec(
      text,
    );

  if (range) {
    const startHour = Number(range[1]);
    const startMin = Number(range[2] ?? range[3] ?? 0);
    const endHour = Number(range[4]);
    const endMin = Number(range[5] ?? range[6] ?? 0);

    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const diff = endTotal - startTotal;

    if (diff > 0 && diff <= 16 * 60) {
      const pad = (value: number) => `${value}`.padStart(2, "0");
      return {
        hours: round2(diff / 60),
        start: `${pad(startHour)}:${pad(startMin)}`,
        end: `${pad(endHour)}:${pad(endMin)}`,
        span: range[0],
      };
    }
  }

  // "Zwei Monteure, jeweils vier Stunden"
  const crew =
    /(\d+|[a-zäöüß]+)\s+(?:monteure?n?|mitarbeitern?|kollegen?|mann|personen)\b[^.]*?\b(?:jeweils|je|jeder)\s+(\d+(?:[.,]\d+)?|[a-zäöüß]+)\s+stunden?\b/i.exec(
      text,
    );
  if (crew?.[1] && crew[2]) {
    const people = parseNumeric(crew[1]);
    const each = parseNumeric(crew[2]);
    if (people && each) {
      return {
        hours: round2(people * each),
        start: null,
        end: null,
        span: crew[0],
      };
    }
  }

  // "drei Stunden", "2,5 Stunden", "eine halbe Stunde"
  const half = /\b(?:eine\s+)?halbe\s+stunde\b/i.exec(text);
  const simple = /\b(\d+(?:[.,]\d+)?|[a-zäöüß]+)\s+stunden?\b/i.exec(text);
  if (simple?.[1]) {
    const hours = parseNumeric(simple[1]);
    if (hours && hours > 0 && hours <= 24) {
      return { hours, start: null, end: null, span: simple[0] };
    }
  }
  if (half) {
    return { hours: 0.5, start: null, end: null, span: half[0] };
  }

  return { hours: null, start: null, end: null, span: null };
}

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

export type MaterialMatch = {
  description: string;
  quantity: number;
  unit: string;
  catalogId: string | null;
  hasPrice: boolean;
  span: string;
};

export function matchCatalog(
  noun: string,
  catalog: MaterialHint[],
): MaterialHint | null {
  const needle = normalizeWord(noun);
  if (needle.length < 3) return null;

  let best: { hint: MaterialHint; score: number } | null = null;
  for (const hint of catalog) {
    for (const candidate of [hint.name, ...hint.aliases]) {
      const normalized = normalizeWord(candidate);
      if (normalized.length < 3) continue;

      let score = 0;
      if (normalized === needle) score = 100;
      else if (needle.startsWith(normalized)) score = 80 + normalized.length;
      else if (normalized.startsWith(needle)) score = 60 + needle.length;

      if (score > 0 && (!best || score > best.score)) {
        best = { hint, score };
      }
    }
  }

  return best?.hint ?? null;
}

/**
 * Findet Materialangaben nach dem Muster
 * `MENGE [EINHEIT] NOMEN` – z.B. „zwei Flexschläuche“, „fünfzehn Meter
 * Kupferrohr“, „ein halber Meter HT-Rohr“.
 *
 * Ohne ausdrückliche Mengenangabe wird bewusst nichts erkannt: „alte Armatur
 * ausgebaut“ ist eine Tätigkeit, kein verbautes Material.
 */
export function detectMaterials(
  text: string,
  catalog: MaterialHint[],
): MaterialMatch[] {
  const results: MaterialMatch[] = [];
  const pattern =
    /\b(\d+(?:[.,]\d+)?|[A-Za-zäöüÄÖÜß]+)\s+(?:(halbe[rn]?)\s+)?(?:([A-Za-zäöüÄÖÜß]+)\s+)?([A-ZÄÖÜ][\p{L}]*(?:-[A-ZÄÖÜ]?[\p{L}]+)*)/gu;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const [span, amountToken, halfToken, maybeUnit, nounRaw] = match;

    // Verworfene Kandidaten dürfen den nachfolgenden Text nicht verschlucken:
    // aus „zwei Flexschläuche und ein Eckventil“ muss auch das zweite
    // Material gefunden werden.
    const reject = () => {
      pattern.lastIndex = match!.index + 1;
    };

    if (!amountToken || !nounRaw) {
      reject();
      continue;
    }

    let quantity = parseNumeric(amountToken);
    if (quantity === null) {
      reject();
      continue;
    }
    if (halfToken) quantity = round3(quantity * 0.5);
    if (quantity <= 0) {
      reject();
      continue;
    }

    const noun = nounRaw.replace(/[.,;:]$/, "");
    if (NON_MATERIAL_NOUNS.has(noun.toLowerCase())) {
      reject();
      continue;
    }

    // Steht zwischen Menge und Nomen ein Wort, muss es eine Einheit sein –
    // sonst ist es ein Adjektiv und die Fundstelle keine Materialangabe.
    let unit: string | null = null;
    if (maybeUnit) {
      const resolved = UNIT_WORDS[maybeUnit.toLowerCase()];
      if (!resolved) {
        reject();
        continue;
      }
      unit = resolved;
    }
    if (unit === "h") {
      reject();
      continue; // Zeitangabe, kein Material
    }

    const hint = matchCatalog(noun, catalog);
    if (!hint && !unit && !/^\d/.test(amountToken)) {
      // Weder Katalogtreffer noch Einheit noch Ziffer: zu unsicher.
      // Ausnahme: zusammengesetzte Nomen mit Bindestrich (z.B. "HT-Rohr").
      if (!noun.includes("-")) {
        reject();
        continue;
      }
    }

    results.push({
      description: hint?.name ?? noun,
      quantity,
      unit: unit ?? hint?.unit ?? "Stück",
      catalogId: hint?.id ?? null,
      hasPrice: hint?.defaultPrice != null,
      span,
    });
  }

  // Gleiches Material mehrfach genannt → zusammenfassen.
  const merged = new Map<string, MaterialMatch>();
  for (const item of results) {
    const key = `${item.catalogId ?? item.description.toLowerCase()}|${item.unit}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = round3(existing.quantity + item.quantity);
      existing.span = `${existing.span} ${item.span}`;
    } else {
      merged.set(key, { ...item });
    }
  }

  return [...merged.values()];
}

// ---------------------------------------------------------------------------
// Gesamtextraktion
// ---------------------------------------------------------------------------

function splitClauses(text: string): string[] {
  return text
    .split(/[.;!?]\s*/)
    .flatMap((sentence) => sentence.split(/,|\bund\b|\bsowie\b/i))
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 2);
}

function tidy(clause: string): string {
  const trimmed = clause.replace(/\s+/g, " ").trim().replace(/[.,;:]$/, "");
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function extractFromGermanReport(
  text: string,
  context: ExtractionContext,
): JobReportExtraction {
  const input = text.replace(/\s+/g, " ").trim();

  const customer = detectCustomer(input, context);
  const date = detectDate(input, context.today);
  const time = detectWorkTime(input);
  const materials = detectMaterials(input, context.materials);

  const consumedSpans = [
    customer.span,
    date.span,
    time.span,
    ...materials.map((material) => material.span),
  ].filter((span): span is string => Boolean(span));

  const activities: string[] = [];
  const noteParts: string[] = [];

  for (const clause of splitClauses(input)) {
    const isConsumed = consumedSpans.some(
      (span) =>
        clause.toLowerCase().includes(span.toLowerCase().trim()) ||
        span.toLowerCase().includes(clause.toLowerCase()),
    );
    if (isConsumed) continue;
    if (customer.name && normalizeWord(clause).includes(normalizeWord(customer.name))) {
      continue;
    }

    if (hasParticiple(clause)) {
      activities.push(tidy(clause));
    } else if (clause.split(/\s+/).length >= 2) {
      noteParts.push(tidy(clause));
    }
  }

  const missing: string[] = [];
  if (!customer.name) missing.push("Kunde");
  if (!date.date) missing.push("Leistungsdatum");
  if (time.hours === null) missing.push("Arbeitszeit");
  if (activities.length === 0) missing.push("Durchgeführte Tätigkeiten");
  if (context.defaultHourlyRate === null) missing.push("Stundensatz");
  for (const material of materials) {
    if (!material.hasPrice) {
      missing.push(`Materialpreis: ${material.description}`);
    }
  }

  // Confidence: nur belegte Treffer erhöhen den Wert.
  let confidence = 0.4;
  if (customer.matchedKnown) confidence += 0.2;
  else if (customer.name) confidence += 0.1;
  if (date.date) confidence += 0.1;
  if (time.hours !== null) confidence += 0.15;
  if (activities.length > 0) confidence += 0.1;
  if (materials.length > 0) {
    const matched = materials.filter((material) => material.catalogId).length;
    confidence += 0.05 + 0.05 * (matched / materials.length);
  }
  confidence = Math.min(0.95, round2(confidence));

  return {
    customer: customer.name,
    date: date.date,
    work_duration_hours: time.hours,
    start_time: time.start,
    end_time: time.end,
    activities,
    materials: materials.map((material) => ({
      description: material.description,
      quantity: material.quantity,
      unit: material.unit,
    })),
    notes: noteParts.length > 0 ? noteParts.join(". ") : null,
    confidence,
    missing_information: missing,
  };
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async extractJobReport(
    input: ExtractJobReportInput,
  ): Promise<ExtractionOutcome> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      extraction: extractFromGermanReport(input.text, input.context),
      provider: this.name,
      model: "regelbasiert",
    };
  }
}

export { CONFIDENCE_THRESHOLD };
