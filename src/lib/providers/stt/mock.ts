import type {
  SttProvider,
  TranscriptionInput,
  TranscriptionResult,
} from "./types";

/**
 * Mock-Transkription für Entwicklung, Demo und Tests.
 *
 * Liefert realistische SHK-Baustellenberichte. Die Auswahl ist deterministisch
 * (abgeleitet aus der Länge der Audiodaten), damit Tests reproduzierbar sind,
 * aber unterschiedliche Aufnahmen unterschiedliche Ergebnisse erzeugen.
 */
const SAMPLES = [
  "Baustelle Müller. Heute von 8 bis 10 Uhr. Alte Armatur ausgebaut, neue Armatur eingebaut. Zwei Flexschläuche und ein Eckventil verwendet. Anlage geprüft, alles dicht.",
  "Kunde Schneider, Heizungswartung. Von 9 bis 11 Uhr 30 gearbeitet. Brennwerttherme gewartet, Filter getauscht, Anlagendruck eingestellt. Ein Wartungsset und zwei Dichtungen verbaut.",
  "Baustelle Bäckerei Hoffmann. Drei Stunden. Abfluss verstopft, Rohr gereinigt und Siphon ausgetauscht. Ein Siphon und ein halber Meter HT-Rohr verwendet. Kunde war vor Ort, alles in Ordnung.",
  "Auftrag Familie Weber, Bad im Obergeschoss. Zwei Monteure, jeweils vier Stunden. Vorwandinstallation gesetzt, Spülkasten montiert, fünfzehn Meter Kupferrohr verlegt und drei Winkel gelötet. Druckprobe gemacht, dicht.",
  "Firma Krüger, Notdienst. Von 18 bis 19 Uhr. Rohrbruch im Keller lokalisiert, Absperrventil getauscht, Leitung wieder in Betrieb genommen. Ein Kugelhahn und zwei Pressfittinge verbaut.",
];

export class MockSttProvider implements SttProvider {
  readonly name = "mock";

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    // Kleine Verzögerung, damit die UI ihre Ladezustände realistisch zeigt.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const index = input.audio.length % SAMPLES.length;
    const text = SAMPLES[index] ?? SAMPLES[0]!;

    return {
      text,
      language: input.language ?? "de",
      provider: this.name,
      model: "mock-whisper",
      // grobe Schätzung: 16 kB/s bei Opus-Sprachaufnahmen
      durationSec: Math.max(1, Math.round(input.audio.length / 16_000)),
    };
  }
}
