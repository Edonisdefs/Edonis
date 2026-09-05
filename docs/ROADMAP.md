# Edonis – Technische Roadmap (MVP)

**Produkt:** KI-Büroassistent für deutsche Handwerksbetriebe.
**Leitprinzip:** *So wenig Tippen wie möglich.* Auftrag wählen → 🎙️ sprechen → KI strukturiert → prüfen → bestätigen → Rechnung.

**MVP-Branche:** SHK (Sanitär/Heizung/Klima). Die Branche ist als `Trade`-Enum auf der Organisation modelliert; branchenspezifische Prompts, Materialkataloge und Standardleistungen liegen in `src/lib/domain/trades.ts`, sodass Elektro/Maler/Dachdecker/Schreiner später ohne Schema-Änderung ergänzt werden können.

---

## 1. Anforderungsanalyse – die harten Punkte

| Anforderung | Konsequenz für die Architektur |
| --- | --- |
| KI darf nichts erfinden | Extraktion liefert `confidence` + `missing_information`; jedes Feld wird als *Vorschlag* gespeichert (`AiExtraction`), nie direkt auf den Auftrag geschrieben. |
| Keine Rechnung bei fehlenden Daten | Zweistufiges Gate: `validateJobForInvoice()` (Blocker/Warnungen) + expliziter Nutzer-Klick. Rechnung wird nie automatisch versendet und nie automatisch von `DRAFT` nach `OPEN` gehoben. |
| Multi-Tenant ab Tag 1 | `organizationId` auf **jeder** Fachtabelle; jeder Datenzugriff läuft über `requireSession()` + orgweite `where`-Klausel. Keine Client-seitige Filterung. |
| DSGVO | Serverseitige Validierung (Zod), httpOnly-Session-Cookies, Audit-Log für kritische Aktionen, Redaction in Logs, harte Löschung von Kunden/Aufträgen inkl. Medien. |
| Läuft ohne externe API-Keys | Provider-Abstraktion mit Mock-Implementierung als Default (`AI_PROVIDER=mock`, `STT_PROVIDER=mock`, `STORAGE_DRIVER=local`). |
| Mobile-first Baustelle | PWA-Manifest, große Touch-Targets (min. 48px), Bottom-Navigation auf Mobile, MediaRecorder-Aufnahme direkt im Browser. |

---

## 2. Tech-Stack

| Ebene | Wahl | Begründung |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript strict | Server Components + Server Actions = wenig Client-JS, alle Secrets bleiben serverseitig. |
| UI | Tailwind CSS v4, shadcn/ui-Stil (Radix-Primitives, CVA) | Professionelles B2B-Look-and-Feel, volle Kontrolle im Repo. |
| Backend | Server Actions + Route Handlers | Keine separate API-Schicht nötig; Uploads/Streams über Route Handler. |
| DB | PostgreSQL + Prisma 6 | Relationales Modell, Migrationen, Typsicherheit. |
| Auth | Eigene E-Mail/Passwort-Auth: bcrypt + DB-Sessions in httpOnly-Cookie | Revozierbar, kein Vendor-Lock-in, keine Client-Secrets. |
| Storage | `StorageProvider` → Local FS \| S3-kompatibel | Lokal lauffähig, Prod-tauglich (S3/R2/MinIO). |
| KI | `AiProvider` → Mock \| Anthropic (Tool-basierte strukturierte Ausgabe) | Deterministische Mocks für Tests/Demo. |
| STT | `SttProvider` → Mock \| OpenAI-kompatibel (Whisper-API-Format, Base-URL konfigurierbar) | Anbieter austauschbar (OpenAI, Groq, lokales whisper.cpp-Gateway). |
| PDF | PDFKit (serverseitig, Node-Runtime) | Kein Headless-Chrome, deterministisch, Vercel-tauglich. |
| Tests | Vitest | Schnell, TS-nativ. |
| Deployment | Vercel + Managed Postgres (Neon/Supabase) + S3/R2 | Siehe `docs/DEPLOYMENT.md`. |

---

## 3. Datenmodell (Kurzform)

```
Organization ──┬── User (OWNER | OFFICE | FIELD)
               ├── Employee
               ├── Customer ── Site (Baustelle)
               ├── Material (Katalog)
               ├── Job ──┬── JobActivity      (Tätigkeiten)
               │         ├── JobTimeEntry     (Arbeitszeit)
               │         ├── JobMaterial      (verbautes Material)
               │         ├── JobNote          (Notizen, manuell/KI)
               │         ├── JobPhoto         (Baustellenfotos)
               │         ├── VoiceNote        (Audio + Transkript)
               │         ├── AiExtraction     (KI-Vorschlag, bestätigungspflichtig)
               │         └── ServiceReport    (Leistungsnachweis, unveränderlicher Snapshot)
               ├── Invoice ── InvoiceItem
               ├── Document
               └── AuditLog
```

Vollständige Beschreibung: `docs/ARCHITECTURE.md`.

---

## 4. Kernworkflow (implementiert)

```
Handwerker
  └─ 🎙️ Bericht aufnehmen (MediaRecorder, webm/opus)
       └─ POST /api/jobs/:id/voice-notes        → Storage + VoiceNote(status=UPLOADED)
            └─ SttProvider.transcribe()         → VoiceNote(status=TRANSCRIBED, transcript)
                 └─ AiProvider.extractJobReport() → AiExtraction(status=PENDING, confidence, missing_information)
                      └─ Review-UI „KI hat erkannt …“  [Bearbeiten] [Bestätigen]
                           └─ confirmExtraction()      → JobActivity/TimeEntry/JobMaterial + AuditLog
                                └─ Leistungsnachweis (ServiceReport)
                                     └─ Rechnungsentwurf (Invoice status=DRAFT)
                                          └─ Nutzer bestätigt → status=OPEN
                                               └─ PDF (/api/invoices/:id/pdf)
```

Ohne Bestätigung wird **kein** extrahiertes Feld auf den Auftrag geschrieben.

---

## 5. Umsetzungsschritte

| # | Schritt | Status |
| --- | --- | --- |
| 1 | Analyse, Architektur, Roadmap | ✅ |
| 2 | Projekt-Setup (Next.js, TS strict, Tailwind, ESLint, Vitest) | ✅ |
| 3 | Prisma-Schema + Migration | ✅ |
| 4 | Auth + Multi-Tenancy + Audit-Log | ✅ |
| 5 | Provider-Abstraktionen (Storage, STT, AI) inkl. Mocks | ✅ |
| 6 | Kunden + Baustellen | ✅ |
| 7 | Aufträge (Liste, Detail, Zeiten, Material, Notizen) | ✅ |
| 8 | Audio-Upload + Foto-Upload | ✅ |
| 9 | Speech-to-Text-Pipeline | ✅ |
| 10 | KI-Extraktion mit strukturiertem JSON | ✅ |
| 11 | Review-UI (Bearbeiten/Bestätigen) | ✅ |
| 12 | Leistungsnachweis | ✅ |
| 13 | Rechnungsentwurf + Freigabe-Gate | ✅ |
| 14 | PDF-Erzeugung | ✅ |
| 15 | Dashboard, Dokumente, Einstellungen | ✅ |
| 16 | Seed-Daten, Tests, Typecheck, Lint, Rauchtest | ✅ |

**Verifikation:** 54 Unit-Tests (`npm test`), sauberer `tsc --noEmit` und
`eslint`, erfolgreicher Produktionsbuild sowie ein Browser-Rauchtest
(`npm run test:smoke`), der den kompletten Weg von der Anmeldung bis zum
freigegebenen Rechnungs-PDF inklusive Sprach-Pipeline und zwei
Zugriffsschutz-Fällen durchläuft.

---

## 6. Bewusst nicht im MVP

- Bild-Analyse durch die KI (Fotos werden hochgeladen, zugeordnet und angezeigt; der `AiProvider` hat bereits einen `analyzePhotos()`-Einstiegspunkt).
- E-Mail-Versand von Rechnungen (bewusst: „niemals automatisch versenden“ – der Versand-Kanal kommt erst nach dem Freigabe-Workflow).
- ZUGFeRD/XRechnung (Datenmodell ist darauf vorbereitet: Steuersätze pro Position, Leistungsdatum, Kundendaten-Snapshot).
- GoBD-konforme revisionssichere Archivierung.

---

## 7. Rechtlicher Hinweis

Die Rechnungserstellung berücksichtigt die üblichen Pflichtangaben nach § 14 UStG (Rechnungsnummer, Rechnungs- und Leistungsdatum, vollständige Anschriften, Steuernummer/USt-IdNr., Entgelt, Steuersatz, Steuerbetrag) und den Hinweis nach § 19 UStG für Kleinunternehmer. **Diese Software ersetzt keine steuerliche oder rechtliche Beratung.** Die Prüfung der Rechnungen obliegt dem Betrieb bzw. dessen Steuerberatung.
