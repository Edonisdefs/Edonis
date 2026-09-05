# Deployment

Zielbild: **Vercel** für die Anwendung, **Managed PostgreSQL** (Neon, Supabase,
Railway …) für die Datenbank, **S3-kompatibler Objektspeicher** (AWS S3,
Cloudflare R2, Hetzner Object Storage) für Aufnahmen, Fotos und PDFs.

---

## 1. Datenbank

```bash
# Verbindungsstring des Providers als DATABASE_URL hinterlegen, dann:
npm run db:deploy      # prisma migrate deploy
```

Serverlose Umgebungen brauchen einen Connection-Pooler (bei Neon/Supabase im
Dashboard aktivieren und die Pooler-URL als `DATABASE_URL` verwenden).

Der Demo-Seed ist **nicht** für Produktion gedacht – er löscht den Betrieb mit
dem Slug `sanitaer-berger` und legt ihn neu an.

---

## 2. Objektspeicher

`STORAGE_DRIVER=local` schreibt ins Dateisystem und ist damit für serverlose
Deployments ungeeignet (kein persistenter Schreibzugriff). In Produktion:

```env
STORAGE_DRIVER="s3"
S3_BUCKET="edonis-produktion"
S3_REGION="eu-central-1"
S3_ACCESS_KEY_ID="…"
S3_SECRET_ACCESS_KEY="…"
# Für R2/MinIO zusätzlich:
S3_ENDPOINT="https://<account>.r2.cloudflarestorage.com"
S3_FORCE_PATH_STYLE="true"
```

Der Bucket muss **privat** sein. Ausgeliefert wird über
`/api/files/[...key]`; bei S3 antwortet die Route mit einer 5 Minuten gültigen
signierten URL, sonst streamt sie die Datei nach Prüfung der Sitzung.

Empfohlene Bucket-Einstellungen: Public Access blockieren,
Server-Side-Encryption aktivieren, Versionierung aktivieren.

---

## 3. Umgebungsvariablen

| Variable                | Pflicht | Hinweis                                                    |
| ----------------------- | ------- | ---------------------------------------------------------- |
| `DATABASE_URL`          | ja      | PostgreSQL, in serverlosen Umgebungen als Pooler-URL        |
| `AUTH_SECRET`           | ja      | ≥ 32 Zeichen, z. B. `openssl rand -base64 48`               |
| `AI_PROVIDER`           | –       | `mock` (Standard) oder `anthropic`                          |
| `ANTHROPIC_API_KEY`     | bei `anthropic` | –                                                   |
| `ANTHROPIC_MODEL`       | –       | Standard `claude-opus-5`                                    |
| `STT_PROVIDER`          | –       | `mock` (Standard) oder `openai`                             |
| `STT_API_KEY`           | bei `openai` | –                                                      |
| `STT_BASE_URL`          | –       | für Groq/Azure/eigenes Gateway anpassen                     |
| `STT_MODEL`             | –       | Standard `whisper-1`                                        |
| `STORAGE_DRIVER`        | –       | `local` (Standard) oder `s3`                                |
| `S3_*`                  | bei `s3` | siehe oben                                                 |
| `ALLOW_SIGNUP`          | –       | in Produktion auf `false` setzen, wenn nur Einladung gilt   |

`AUTH_SECRET` niemals zwischen Umgebungen teilen – ein Wechsel macht alle
bestehenden Sitzungen ungültig (was beim Verdacht auf Kompromittierung genau
das gewünschte Verhalten ist).

---

## 4. Vercel

1. Repository verbinden; Framework „Next.js“ wird erkannt.
2. Build-Command bleibt `npm run build` (führt `prisma generate` aus).
3. Umgebungsvariablen für Production **und** Preview setzen.
4. Nach dem ersten Deploy einmalig `npm run db:deploy` gegen die
   Produktionsdatenbank ausführen (lokal mit gesetzter `DATABASE_URL` oder als
   Deploy-Hook).

Laufzeitverhalten:

- `/api/jobs/[id]/voice-notes` läuft mit `maxDuration = 60`, weil
  Transkription und KI-Auswertung synchron erfolgen. Reicht das nicht (sehr
  lange Aufnahmen, langsamer Anbieter), sollte die Verarbeitung in eine
  Queue verlagert werden – die Zustände `UPLOADED → TRANSCRIBING →
  TRANSCRIBED` im Datenmodell sind dafür bereits vorgesehen.
- PDFKit ist über `serverExternalPackages` vom Bundling ausgenommen; die
  Schriftmetriken werden zur Laufzeit geladen.
- Die Middleware prüft nur das Sitzungs-Cookie. Die eigentliche Autorisierung
  passiert in jeder Server Action und jedem Route Handler.

---

## 5. Betrieb

**Vor dem Livegang je Betrieb prüfen:**

- Anschrift, Steuernummer bzw. USt-IdNr., Bankverbindung in den Einstellungen
- Stundensatz, USt-Satz, Anfahrtspauschale, Zahlungsziel
- Kleinunternehmerregelung (§ 19 UStG) korrekt gesetzt
- Rechnungsnummernkreis: `invoicePrefix` und `invoiceCounter` so wählen, dass
  sie nicht mit bestehenden Nummern des Betriebs kollidieren
- Materialkatalog mit realen Preisen und gebräuchlichen Synonymen füllen –
  davon hängt die Qualität der Spracherkennung ab

**Wartung:**

- Abgelaufene Sitzungen aufräumen: `cleanupExpiredSessions()` aus
  `src/lib/auth/session.ts` regelmäßig aufrufen (Cron/Scheduled Function).
- Datenbank-Backups über den Managed Provider; der Objektspeicher sollte
  Versionierung aktiviert haben.
- Das Audit-Log wächst mit; für lange Laufzeiten eine Aufbewahrungsfrist
  festlegen und ältere Einträge löschen.

**Vor Produktivbetrieb mit echten Kundendaten offen:**

- Auftragsverarbeitungsverträge mit KI-, STT- und Storage-Anbieter
- Löschkonzept und Aufbewahrungsfristen schriftlich festhalten
- Prüfung der Rechnungsvorlage durch die Steuerberatung des Betriebs
