import { describe, expect, it } from "vitest";

import {
  detectCustomer,
  detectDate,
  detectMaterials,
  detectWorkTime,
  extractFromGermanReport,
  matchCatalog,
} from "@/lib/ai/mock";
import { jobReportExtractionSchema } from "@/lib/ai/schema";
import type { ExtractionContext, MaterialHint } from "@/lib/ai/types";

const catalog: MaterialHint[] = [
  {
    id: "m1",
    name: "Flexschlauch",
    unit: "Stück",
    aliases: ["Panzerschlauch"],
    defaultPrice: 8.9,
  },
  {
    id: "m2",
    name: "Eckventil",
    unit: "Stück",
    aliases: ["Ventil"],
    defaultPrice: 12.5,
  },
  {
    id: "m3",
    name: "Kupferrohr 15 mm",
    unit: "m",
    aliases: ["Kupferrohr"],
    defaultPrice: 9.4,
  },
  {
    id: "m4",
    name: "Winkel 90° 15 mm",
    unit: "Stück",
    aliases: ["Winkel"],
    defaultPrice: 3.2,
  },
  {
    id: "m5",
    name: "Sonderanfertigung Blende",
    unit: "Stück",
    aliases: ["Blende"],
    defaultPrice: null,
  },
];

const context: ExtractionContext = {
  trade: "SHK",
  today: "2026-03-11",
  customers: [
    { id: "c1", name: "Müller" },
    { id: "c2", name: "Bäckerei Hoffmann GmbH" },
  ],
  materials: catalog,
  currentCustomerName: null,
  defaultHourlyRate: 68,
};

describe("extractFromGermanReport – Beispiel aus der Anforderung", () => {
  const report =
    "Baustelle Müller. Heute von 8 bis 10 Uhr. Alte Armatur ausgebaut, neue Armatur eingebaut. Zwei Flexschläuche und ein Eckventil verwendet. Anlage geprüft, alles dicht.";

  const result = extractFromGermanReport(report, context);

  it("erfüllt das Ausgabeschema", () => {
    expect(jobReportExtractionSchema.safeParse(result).success).toBe(true);
  });

  it("erkennt den Kunden", () => {
    expect(result.customer).toBe("Müller");
  });

  it("rechnet die Arbeitszeit in Dezimalstunden um", () => {
    expect(result.work_duration_hours).toBe(2);
    expect(result.start_time).toBe("08:00");
    expect(result.end_time).toBe("10:00");
  });

  it("löst „heute“ gegen das Referenzdatum auf", () => {
    expect(result.date).toBe("2026-03-11");
  });

  it("erkennt die drei Tätigkeiten", () => {
    expect(result.activities).toEqual([
      "Alte Armatur ausgebaut",
      "Neue Armatur eingebaut",
      "Anlage geprüft",
    ]);
  });

  it("erkennt Material mit Menge und Einheit", () => {
    expect(result.materials).toEqual([
      { description: "Flexschlauch", quantity: 2, unit: "Stück" },
      { description: "Eckventil", quantity: 1, unit: "Stück" },
    ]);
  });

  it("legt Restinformationen als Notiz ab statt sie zu verwerfen", () => {
    expect(result.notes).toBe("Alles dicht");
  });
});

describe("extractFromGermanReport – erfindet nichts", () => {
  it("meldet fehlende Angaben statt sie zu raten", () => {
    const result = extractFromGermanReport("Kurz vorbeigeschaut.", {
      ...context,
      customers: [],
      defaultHourlyRate: null,
    });

    expect(result.customer).toBeNull();
    expect(result.date).toBeNull();
    expect(result.work_duration_hours).toBeNull();
    expect(result.materials).toEqual([]);
    expect(result.missing_information).toEqual(
      expect.arrayContaining([
        "Kunde",
        "Leistungsdatum",
        "Arbeitszeit",
        "Stundensatz",
      ]),
    );
  });

  it("weist auf fehlende Materialpreise hin", () => {
    const result = extractFromGermanReport(
      "Kunde Müller, heute zwei Stunden. Eine Blende montiert.",
      context,
    );

    expect(result.missing_information).toContain(
      "Materialpreis: Sonderanfertigung Blende",
    );
  });

  it("hält die Confidence unter dem Schwellwert, wenn kaum etwas erkennbar ist", () => {
    const result = extractFromGermanReport("Ähm, ja.", {
      ...context,
      customers: [],
    });
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("macht aus einem Ausbau kein verbrauchtes Material", () => {
    const result = extractFromGermanReport(
      "Kunde Müller, heute eine Stunde. Alte Armatur ausgebaut.",
      context,
    );
    expect(result.materials).toEqual([]);
    expect(result.activities).toContain("Alte Armatur ausgebaut");
  });
});

describe("detectWorkTime", () => {
  it("versteht Zeitspannen mit Minutenangabe", () => {
    expect(detectWorkTime("Von 9 bis 11 Uhr 30 gearbeitet.").hours).toBe(2.5);
  });

  it("versteht Zeitspannen mit Doppelpunkt", () => {
    const result = detectWorkTime("von 8:30 bis 16:00");
    expect(result.hours).toBe(7.5);
    expect(result.start).toBe("08:30");
    expect(result.end).toBe("16:00");
  });

  it("summiert mehrere Monteure", () => {
    expect(
      detectWorkTime("Zwei Monteure, jeweils vier Stunden gearbeitet.").hours,
    ).toBe(8);
  });

  it("versteht ausgeschriebene Stundenangaben", () => {
    expect(detectWorkTime("Drei Stunden vor Ort.").hours).toBe(3);
  });

  it("gibt null zurück, wenn keine Zeit genannt wird", () => {
    expect(detectWorkTime("Kurz vorbeigefahren.").hours).toBeNull();
  });
});

describe("detectMaterials", () => {
  it("erkennt Mengen mit Einheit", () => {
    const result = detectMaterials("Fünfzehn Meter Kupferrohr verlegt.", catalog);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      description: "Kupferrohr 15 mm",
      quantity: 15,
      unit: "m",
    });
  });

  it("fasst dasselbe Material zusammen", () => {
    const result = detectMaterials(
      "Zwei Eckventile eingebaut und später noch ein Eckventil ergänzt.",
      catalog,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(3);
  });

  it("hält Zeitangaben von Material fern", () => {
    expect(detectMaterials("Von 8 bis 10 Uhr, drei Stunden.", catalog)).toEqual(
      [],
    );
  });

  it("ignoriert Adjektive zwischen Zahl und Nomen", () => {
    expect(detectMaterials("Zwei alte Armaturen gesehen.", catalog)).toEqual([]);
  });

  it("versteht halbe Mengen", () => {
    const result = detectMaterials("Ein halber Meter HT-Rohr.", catalog);
    expect(result[0]).toMatchObject({ quantity: 0.5, unit: "m" });
  });
});

describe("matchCatalog", () => {
  it("findet den Katalogartikel trotz Pluralform und Umlaut", () => {
    expect(matchCatalog("Flexschläuche", catalog)?.id).toBe("m1");
  });

  it("findet über ein Synonym", () => {
    expect(matchCatalog("Panzerschlauch", catalog)?.id).toBe("m1");
  });

  it("gibt null zurück, wenn nichts passt", () => {
    expect(matchCatalog("Dachziegel", catalog)).toBeNull();
  });
});

describe("detectCustomer", () => {
  it("bevorzugt bekannte Kunden aus der Datenbank", () => {
    const result = detectCustomer("Heute bei Hoffmann gewesen.", context);
    expect(result.name).toBe("Bäckerei Hoffmann GmbH");
    expect(result.matchedKnown).toBe(true);
  });

  it("erkennt unbekannte Kunden über Sprachmuster", () => {
    const result = detectCustomer("Baustelle Zimmermann, alles erledigt.", {
      ...context,
      customers: [],
    });
    expect(result.name).toBe("Zimmermann");
    expect(result.matchedKnown).toBe(false);
  });
});

describe("detectDate", () => {
  it("löst relative Angaben auf", () => {
    expect(detectDate("gestern", "2026-03-11").date).toBe("2026-03-10");
    expect(detectDate("heute", "2026-03-11").date).toBe("2026-03-11");
  });

  it("versteht ein ausgeschriebenes Datum", () => {
    expect(detectDate("Am 5.3.2026 gearbeitet.", "2026-03-11").date).toBe(
      "2026-03-05",
    );
  });
});
