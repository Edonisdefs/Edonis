/**
 * Rechnen mit Geldbeträgen.
 *
 * Prisma liefert Decimal-Objekte. Server Components dürfen keine Decimals an
 * Client Components weiterreichen, deshalb wird an der Grenze konsequent auf
 * `number` normalisiert – gerundet auf 2 (Geld) bzw. 3 (Mengen) Stellen.
 */

export type DecimalLike =
  | number
  | string
  | { toString(): string }
  | null
  | undefined;

export function toNumber(value: DecimalLike, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number(
    typeof value === "string" ? value.replace(",", ".") : value.toString(),
  );
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toNumberOrNull(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Kaufmännisches Runden auf 2 Nachkommastellen, ohne Float-Artefakte. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Parst deutsche Zahleneingaben: "1.234,56" → 1234.56, "2,5" → 2.5.
 */
export function parseGermanNumber(input: string | number | null | undefined):
  | number
  | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasComma = trimmed.includes(",");
  const normalized = hasComma
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/\s/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export type LineTotals = {
  net: number;
  vat: number;
  gross: number;
};

/**
 * Summiert Rechnungspositionen. Die Steuer wird je Steuersatz gebildet und
 * erst danach summiert – so entsteht dasselbe Ergebnis wie in der Buchhaltung.
 */
export function sumInvoiceLines(
  lines: Array<{ netAmount: number; vatRate: number }>,
): LineTotals {
  const byRate = new Map<number, number>();
  let net = 0;

  for (const line of lines) {
    const lineNet = round2(line.netAmount);
    net = round2(net + lineNet);
    byRate.set(line.vatRate, round2((byRate.get(line.vatRate) ?? 0) + lineNet));
  }

  let vat = 0;
  for (const [rate, base] of byRate) {
    vat = round2(vat + round2((base * rate) / 100));
  }

  return { net, vat, gross: round2(net + vat) };
}

export function lineNet(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}
