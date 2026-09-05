# Edonis

**KI-Büroassistent für deutsche Handwerksbetriebe.**
Der Monteur spricht einen Baustellenbericht ein, Edonis macht daraus geprüfte
Auftragsdaten, einen Leistungsnachweis und einen Rechnungsentwurf.

```
🎙️ „Baustelle Müller. Heute von 8 bis 10 Uhr. Alte Armatur ausgebaut,
    neue Armatur eingebaut. Zwei Flexschläuche und ein Eckventil
    verwendet. Anlage geprüft, alles dicht.“
                          ↓
   Kunde: Müller · Arbeitszeit: 2 Stunden
   Tätigkeiten: Alte Armatur ausgebaut · Neue Armatur eingebaut · Anlage geprüft
   Material: 2 × Flexschlauch · 1 × Eckventil
                          ↓
        [Bearbeiten]  [Bestätigen und übernehmen]
                          ↓
        Leistungsnachweis → Rechnungsentwurf → PDF
```

MVP-Branche: **SHK** (Sanitär/Heizung/Klima). Die Architektur ist auf weitere
Gewerke vorbereitet.

---

## Schnellstart

Voraussetzungen: Node.js ≥ 20, PostgreSQL ≥ 14.

```bash
npm install
cp .env.example .env          # DATABASE_URL und AUTH_SECRET eintragen
npm run db:migrate            # Schema anlegen
npm run db:seed               # Demo-Betrieb mit Kunden, Aufträgen, Rechnungen
npm run dev
```

Danach http://localhost:3000 öffnen und anmelden:

| Rolle   | E-Mail                      | Passwort       |
| ------- | --------------------------- | -------------- |
| Inhaber | `demo@sanitaer-berger.de`   | `handwerk2026` |
| Büro    | `buero@sanitaer-berger.de`  | `handwerk2026` |
| Monteur | `tobias@sanitaer-berger.de` | `handwerk2026` |

**Ohne API-Keys lauffähig.** KI, Spracherkennung und Dateiablage laufen
standardmäßig als lokale Mock- bzw. Dateisystem-Provider. Die Oberfläche weist
in diesem Zustand sichtbar auf den Demo-Modus hin.

### Die Demo in 60 Sekunden

1. Auf der Übersicht steht ein wartender KI-Vorschlag → **Prüfen**.
2. Erkanntes Ergebnis kontrollieren, ggf. korrigieren → **Bestätigen und übernehmen**.
3. **Leistungsnachweis erstellen** → **Rechnungsentwurf erstellen**.
4. In der Rechnung Häkchen setzen → **Rechnung freigeben** → **PDF**.

Für den Sprachweg auf einem Auftrag **🎙️ Bericht aufnehmen** drücken; die
Mock-Erkennung liefert einen realistischen SHK-Bericht zurück.

---

## Kommandos

| Befehl               | Zweck                                                     |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Entwicklungsserver                                        |
| `npm run build`      | Produktionsbuild (inkl. `prisma generate`)                 |
| `npm run typecheck`  | TypeScript ohne Emit                                      |
| `npm run lint`       | ESLint                                                    |
| `npm test`           | Unit-Tests (Vitest)                                       |
| `npm run test:smoke` | Rauchtest des Kernworkflows im Browser (Server muss laufen) |
| `npm run db:migrate` | Migration erstellen und anwenden                           |
| `npm run db:seed`    | Demo-Daten neu aufsetzen                                   |
| `npm run db:reset`   | Datenbank zurücksetzen                                     |

---

## Was funktioniert

- **Sprachaufnahme im Browser** (MediaRecorder) inkl. Upload, Transkription und
  KI-Auswertung in einem Schritt; Fallback auf Dateiupload und auf getippten Text.
- **KI-Extraktion** mit striktem JSON-Vertrag: Kunde, Datum, Arbeitszeit,
  Tätigkeiten, Material, Notizen, `confidence`, `missing_information`.
- **Bestätigungspflicht:** Kein KI-Wert landet ungeprüft im Auftrag.
- **Aufträge** mit Tätigkeiten, Zeiten, Material, Fotos, Notizen, Aufnahmen.
- **Kunden und Baustellen**, Materialkatalog mit Synonymen (Grundlage der
  Materialerkennung).
- **Leistungsnachweis** als unveränderlicher Snapshot.
- **Rechnungen**: Entwurf → ausdrückliche Freigabe → Status „offen“ → PDF nach
  § 14 UStG, inkl. § 19-Hinweis für Kleinunternehmer.
- **Dashboard** mit heutigen Aufträgen, offenen Prüfungen, fehlenden
  Informationen, Entwürfen und offenen Beträgen.
- **Multi-Tenant** mit serverseitiger Autorisierung und Audit-Log.
- **PWA-Manifest**, Bottom-Navigation, große Touch-Ziele – für die Baustelle.

## Was bewusst fehlt

- Bildanalyse durch die KI (Fotos werden hochgeladen und zugeordnet; der
  Einstiegspunkt `AiProvider.analyzePhotos` existiert).
- E-Mail-Versand von Rechnungen.
- ZUGFeRD/XRechnung und GoBD-Archivierung (das Datenmodell ist darauf
  vorbereitet).
- Benutzerverwaltung über die Oberfläche (Rollen existieren, Anlage über Seed
  bzw. Registrierung).

---

## Provider austauschen

Alle externen Abhängigkeiten liegen hinter einer Schnittstelle. Umschalten
geschieht ausschließlich über Umgebungsvariablen.

| Bereich       | Variable         | Werte                  |
| ------------- | ---------------- | ---------------------- |
| KI            | `AI_PROVIDER`    | `mock` \| `anthropic`  |
| Spracherkennung | `STT_PROVIDER` | `mock` \| `openai`     |
| Dateiablage   | `STORAGE_DRIVER` | `local` \| `s3`        |

```
AiProvider          SttProvider          StorageProvider
├── MockAiProvider  ├── MockSttProvider  ├── LocalStorageProvider
└── AnthropicAi…    └── OpenAiSttProvider └── S3StorageProvider
```

Fehlt der passende Key, fällt die Anwendung auf den Mock zurück, statt eine
Aufnahme zu verlieren. `STT_PROVIDER=openai` spricht das verbreitete
`/audio/transcriptions`-Format und funktioniert damit auch mit Groq, Azure oder
einem eigenen Whisper-Gateway (`STT_BASE_URL`).

---

## Dokumentation

- [`docs/ROADMAP.md`](docs/ROADMAP.md) – Anforderungsanalyse, Stack-Entscheidungen, Umsetzungsschritte
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) – Datenmodell, Schichten, Mandantentrennung, Datenschutz
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) – Vercel, Managed Postgres, S3, Umgebungsvariablen

---

## Rechtlicher Hinweis

Die Rechnungserstellung berücksichtigt die üblichen Pflichtangaben nach § 14
UStG und den Hinweis nach § 19 UStG für Kleinunternehmer. **Edonis ersetzt
keine steuerliche oder rechtliche Beratung.** Die inhaltliche Prüfung der
Rechnungen obliegt dem Betrieb bzw. dessen Steuerberatung.
