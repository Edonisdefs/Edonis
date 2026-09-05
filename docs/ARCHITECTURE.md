# Architektur

## 1. Schichten

```
src/app/            Routen (Server Components), Route Handler, PWA-Manifest
src/components/     UI-Bausteine (shadcn-Stil) und App-Komponenten
src/lib/
  ├── actions/      Server Actions – Eingabevalidierung, Autorisierung, Audit
  ├── services/     Datenzusammenstellung, Rechnungslogik, Sprach-Pipeline
  ├── domain/       Reine Fachlogik ohne I/O (testbar)
  ├── ai/           KI-Vertrag, Mock- und Anthropic-Provider, Prompts
  ├── providers/    Storage- und Speech-to-Text-Abstraktion
  ├── auth/         Passwörter, Sitzungen, Rollen, Mandantentrennung
  └── db.ts,…       Prisma-Client, Umgebung, Formatierung, Geldrechnung
prisma/             Schema, Migrationen, Demo-Daten
tests/              Unit-Tests der Fachlogik
scripts/            Rauchtest des Kernworkflows
```

Feste Regel: **Fachlogik ohne I/O liegt in `domain/`.** Rechnungskalkulation,
Freigabe-Gate und die regelbasierte Extraktion sind dadurch vollständig
testbar, ohne Datenbank oder Netzwerk.

---

## 2. Datenmodell

```
Organization (Mandant)
├── User            OWNER | OFFICE | FIELD
├── Session         DB-gestützt, Cookie enthält nur ein Token
├── Employee        Monteure (optional mit User verknüpft)
├── Customer
│   └── Site        Baustelle
├── Material        Katalog inkl. Synonymen für die Spracherkennung
├── Job
│   ├── JobAssignment   eingeteilte Mitarbeiter
│   ├── JobActivity     Tätigkeiten
│   ├── JobTimeEntry    Arbeitszeit
│   ├── JobMaterial     verbautes Material
│   ├── JobNote         Notizen
│   ├── JobPhoto        Baustellenfotos
│   ├── VoiceNote       Audio + Transkript
│   ├── AiExtraction    KI-Vorschlag (bestätigungspflichtig)
│   └── ServiceReport   Leistungsnachweis (Snapshot)
├── Invoice
│   └── InvoiceItem
├── Document        PDF-Ablage
└── AuditLog
```

Jede Fachtabelle trägt `organizationId`. Geldbeträge liegen als
`Decimal(10,2)`, Mengen als `Decimal(10,3)` in der Datenbank und werden an der
Grenze zur Oberfläche über `toNumber()` normalisiert – Prisma-Decimals dürfen
nicht an Client Components weitergereicht werden.

### Statusfluss

```
Job:      DRAFT → SCHEDULED → IN_PROGRESS → NEEDS_REVIEW → READY_TO_INVOICE
                                                        → INVOICED → CLOSED
Invoice:  DRAFT → OPEN → PAID
                    ↘ CANCELLED
```

`NEEDS_REVIEW` entsteht automatisch, sobald ein KI-Vorschlag vorliegt, und
verschwindet erst, wenn dieser bestätigt oder verworfen wurde.

---

## 3. Mandantentrennung

Drei Ebenen, absichtlich redundant:

1. **Sitzung** – `requireSession()` liefert `organizationId`; die Middleware
   prüft nur die Existenz des Cookies und ersetzt keine Autorisierung.
2. **Abfrage** – jede Prisma-Abfrage enthält `organizationId` in `where`. Die
   Helfer in `lib/auth/tenancy.ts` (`requireJob`, `requireCustomer`,
   `requireInvoice`) kapseln das Muster.
3. **Antwort** – fremde Datensätze ergeben „nicht gefunden“ statt „kein
   Zugriff“; damit lässt sich die Existenz fremder Daten nicht ausprobieren.

Auch Dateien sind getrennt: Storage-Keys beginnen mit `org/<organizationId>/`,
und `/api/files/[...key]` liefert nur aus, was mit dem eigenen Präfix beginnt.

Rollen: `FIELD` (erfassen) < `OFFICE` (Kunden, Aufträge, Rechnungen) <
`OWNER` (Einstellungen, Stornierung, Löschung). Geprüft wird serverseitig über
`assertRole()`, nicht durch Ausblenden in der Oberfläche.

---

## 4. Der KI-Pfad

```
VoiceRecorder (Client)
   │ POST /api/jobs/:id/voice-notes   (multipart, Node-Runtime)
   ▼
storeVoiceNote()        Storage + VoiceNote(UPLOADED)
   ▼
processVoiceNote()      SttProvider.transcribe() → VoiceNote(TRANSCRIBED)
   ▼
createExtractionForJob() AiProvider.extractJobReport()
   ▼
AiExtraction(status = PENDING, confidence, missing[])   ← Auftrag unverändert
   ▼
ExtractionReview (Client)   „KI hat folgende Informationen erkannt“
   ▼
confirmExtractionAction()   Transaktion: JobActivity + JobTimeEntry +
                            JobMaterial + JobNote, Extraktion → CONFIRMED
```

Der Vertrag (`lib/ai/schema.ts`) ist gleichzeitig Zod-Schema für die
Anthropic-Structured-Outputs und Validierung jedes gespeicherten Ergebnisses.
Gespeichert wird nur, was das Schema erfüllt; ungültige Antworten führen zu
einer leeren Extraktion mit `confidence = 0` statt zu einem Absturz.

**Der Mock ist kein Platzhalter.** `extractFromGermanReport()` erkennt
deutsche Baustellenberichte regelbasiert: Kundenabgleich gegen die
Kundenliste, Zeitspannen („von 8 bis 10 Uhr“, „zwei Monteure, jeweils vier
Stunden“), Partizipien als Tätigkeiten und Mengenangaben als Material – mit
Abgleich gegen den Materialkatalog inklusive Synonymen und Pluralformen. Ohne
ausdrückliche Menge entsteht kein Material: „alte Armatur ausgebaut“ ist eine
Tätigkeit, kein Verbrauch.

---

## 5. Das Rechnungs-Gate

`domain/validation.ts` ist die einzige Stelle, die entscheidet, ob aus einem
Auftrag eine Rechnung werden darf.

**Blocker** (kein Entwurf möglich):

- keine Leistungen erfasst
- offener, ungeprüfter KI-Vorschlag
- fehlender Stundensatz oder Materialpreis
- fehlendes Leistungsdatum
- unvollständige Anschrift von Kunde oder Betrieb
- weder Steuernummer noch USt-IdNr.

**Warnungen** (Hinweis, kein Stopp): niedrige Confidence, fehlende
Tätigkeitsbeschreibung, fehlender Leistungsnachweis.

Zweite Stufe: Der Wechsel `DRAFT → OPEN` verlangt zusätzlich ein ausdrücklich
gesetztes Bestätigungshäkchen. Ohne `confirm=ja` lehnt die Server Action ab –
auch dann, wenn die Oberfläche umgangen wird. Die Software versendet nichts von
sich aus.

Freigegebene Rechnungen sind nicht mehr editierbar; das zur Freigabe erzeugte
PDF wird gespeichert und danach unverändert ausgeliefert. Entwurfs-PDFs tragen
einen sichtbaren Entwurfsvermerk.

---

## 6. Datenschutz

- **Keine Keys im Frontend.** Alle Provider werden ausschließlich serverseitig
  instanziiert; `lib/env.ts` ist mit `server-only` markiert.
- **Sitzungen**: zufälliges Token im httpOnly-Cookie, in der Datenbank liegt
  nur dessen HMAC. Ein Datenbank-Leak erlaubt keine Sitzungsübernahme.
- **Login**: gleiche Meldung und gleiche Laufzeit für unbekannte Konten
  (`burnPasswordTime`), damit sich registrierte Adressen nicht ermitteln lassen.
- **Audit-Log** für kritische Aktionen (Anmeldung, Bestätigung von KI-Daten,
  Rechnungsfreigabe, Löschungen) – ohne Inhalte, mit gekürzter IP (IPv4 /24,
  IPv6 /48) und begrenzten Metadaten.
- **Logs**: keine Prisma-Query-Logs, keine Transkripte, keine Kundendaten.
  Fehlermeldungen an die Oberfläche sind bewusst allgemein.
- **Löschen**: Aufträge werden inklusive Fotos und Aufnahmen aus dem Storage
  entfernt. Kunden mit Rechnungen können nur archiviert werden – Rechnungen
  unterliegen der Aufbewahrungspflicht.
- **Datenminimierung**: Der Materialkatalog und die Kundenliste gehen als
  Kontext an die KI, nicht der gesamte Datenbestand.

---

## 7. Technische Entscheidungen

| Entscheidung                            | Begründung                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Server Actions statt eigener REST-API   | Weniger Client-JS, Secrets bleiben serverseitig; Uploads laufen über Route Handler, weil dort Streams gebraucht werden. |
| Eigene Auth statt Fremdbibliothek       | DB-gestützte Sitzungen sind revozierbar, kein Vendor-Lock-in, kein zusätzlicher Datenempfänger.                   |
| PDFKit statt Headless-Chrome            | Deterministisch, klein, in serverlosen Umgebungen lauffähig; WinAnsi deckt Umlaute und € ab.                     |
| Natives `<select>` statt Custom-Dropdown | Auf dem Smartphone öffnet es den Systemdialog – schneller und zuverlässiger bedienbar.                          |
| Regelbasierter Mock statt Stub          | Die Demo funktioniert ohne Keys, und die Extraktionslogik ist deterministisch testbar.                          |
| Confidence + `missing_information`      | Macht Unsicherheit sichtbar, statt sie in scheinbar vollständigen Daten zu verstecken.                          |

---

## 8. Neues Gewerk ergänzen

1. `Trade`-Enum in `prisma/schema.prisma` erweitern und migrieren.
2. Profil in `src/lib/domain/trades.ts` ergänzen (Katalog, Einheiten,
   Standardtätigkeiten).
3. Optional die Gewerksbezeichnung in `src/lib/ai/prompt.ts` ergänzen.

Workflow, Datenmodell und Oberfläche bleiben unverändert.
