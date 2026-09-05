/**
 * Rauchtest für den Kernworkflow.
 *
 * Voraussetzungen:
 *   1. `npm run db:seed`   – Demo-Daten anlegen
 *   2. `npm run build && npm run start`  (oder `npm run dev`)
 *   3. `npm run test:smoke`
 *
 * Geprüft wird der komplette Weg: Anmeldung → KI-Vorschlag prüfen →
 * bestätigen → Leistungsnachweis → Rechnungsentwurf → Freigabe → PDF,
 * dazu die Sprach-Pipeline und zwei Zugriffsschutz-Fälle.
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const steps = [];
function ok(label, extra = "") {
  steps.push(`✓ ${label}${extra ? ` — ${extra}` : ""}`);
}
function fail(label, extra = "") {
  steps.push(`✗ ${label}${extra ? ` — ${extra}` : ""}`);
  throw new Error(`${label} ${extra}`);
}

const browser = await chromium.launch(
  // In CI-Images liegt Chromium oft an fester Stelle; lokal genügt der
  // Standardpfad von Playwright.
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
);
const context = await browser.newContext({ locale: "de-DE" });
const page = await context.newPage();
page.setDefaultTimeout(20000);

try {
  // --- 1. Anmeldung ---------------------------------------------------------
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "demo@sanitaer-berger.de");
  await page.fill("#password", "handwerk2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
  ok("Anmeldung", await page.locator("h1").first().innerText());

  // --- 2. Dashboard zeigt den wartenden KI-Vorschlag ------------------------
  const pendingCard = page.getByText("Wartet auf Ihre Bestätigung");
  if (!(await pendingCard.isVisible())) fail("Dashboard: KI-Vorschlag fehlt");
  ok("Dashboard zeigt wartenden KI-Vorschlag");

  // --- 3. Auftrag öffnen ----------------------------------------------------
  await page.locator('a[href*="#pruefen"]').first().click();
  await page.waitForURL(/\/auftraege\//);
  const jobUrl = page.url().split("#")[0];
  await page.waitForSelector("text=KI hat folgende Informationen erkannt");
  ok("Review-UI sichtbar");

  const hours = await page.inputValue("#review-hours");
  const activityCount = await page.locator('input[aria-label^="Tätigkeit "]').count();
  const materialCount = await page.locator('input[id^="material-desc-"]').count();
  if (hours !== "2") fail("Arbeitszeit falsch erkannt", hours);
  if (activityCount !== 3) fail("Tätigkeiten falsch erkannt", `${activityCount}`);
  if (materialCount !== 2) fail("Material falsch erkannt", `${materialCount}`);
  ok(
    "KI-Ergebnis",
    `${hours} Std., ${activityCount} Tätigkeiten, ${materialCount} Materialpositionen`,
  );

  // --- 4. Bestätigen --------------------------------------------------------
  await page.getByRole("button", { name: /Bestätigen und übernehmen/ }).click();
  await page.waitForSelector("text=KI hat folgende Informationen erkannt", {
    state: "detached",
  });
  ok("KI-Vorschlag bestätigt");

  const bodyAfter = await page.locator("main").innerText();
  if (!bodyAfter.includes("Flexschlauch") || !bodyAfter.includes("Eckventil")) {
    fail("Material wurde nicht übernommen");
  }
  if (!/2 Std\./.test(bodyAfter.replace(/\s+/g, " "))) {
    fail("Arbeitszeit wurde nicht übernommen");
  }
  ok("Leistungen im Auftrag übernommen");

  // --- 5. Leistungsnachweis -------------------------------------------------
  await page
    .getByRole("button", { name: /Leistungsnachweis (erstellen|aktualisieren)/ })
    .click();
  await page.waitForSelector("text=Leistungsnachweis LN-");
  ok("Leistungsnachweis erstellt");

  // --- 6. Rechnungsentwurf --------------------------------------------------
  const draftButton = page.getByRole("button", {
    name: /Rechnungsentwurf erstellen/,
  });
  if ((await draftButton.count()) === 0) {
    fail(
      "Zu diesem Auftrag gibt es bereits eine Rechnung",
      "Der Rauchtest erwartet frische Demo-Daten: npm run db:seed",
    );
  }
  if (await draftButton.isDisabled()) fail("Rechnungsentwurf ist gesperrt");
  await draftButton.click();
  const invoiceLink = page.locator('a[href^="/rechnungen/"]').first();
  await invoiceLink.waitFor();
  ok("Rechnungsentwurf erstellt", await invoiceLink.innerText());

  // --- 7. Rechnung prüfen ---------------------------------------------------
  await invoiceLink.click();
  await page.waitForURL(/\/rechnungen\//);
  const invoiceUrl = page.url();
  const invoiceId = invoiceUrl.split("/rechnungen/")[1];
  const invoiceText = await page.locator("main").innerText();
  if (!invoiceText.includes("Dies ist ein Entwurf")) fail("Entwurfshinweis fehlt");
  const totalMatch = invoiceText.match(/Gesamtbetrag\s*([\d.,]+\s*€)/);
  ok("Rechnungsentwurf geöffnet", totalMatch?.[1] ?? "Betrag nicht gelesen");

  // --- 8. Freigabe erst nach ausdrücklicher Bestätigung ---------------------
  const releaseButton = page.getByRole("button", { name: /Rechnung freigeben/ });
  if (!(await releaseButton.isDisabled())) {
    fail("Freigabe war ohne Bestätigung möglich");
  }
  ok("Freigabe ohne Bestätigung gesperrt");

  await page.locator('input[type="checkbox"]').last().check();
  await releaseButton.click();
  await page.waitForSelector("text=Zahlungseingang");
  const releasedText = await page.locator("main").innerText();
  if (!releasedText.includes("Offen")) fail("Status nicht auf offen gesetzt");
  ok("Rechnung freigegeben, Status offen");

  // --- 9. PDF ---------------------------------------------------------------
  const pdf = await context.request.get(
    `${BASE}/api/invoices/${invoiceId}/pdf`,
  );
  const buffer = await pdf.body();
  if (!buffer.subarray(0, 4).toString("latin1").startsWith("%PDF")) {
    fail("PDF ungültig", buffer.subarray(0, 20).toString("latin1"));
  }
  ok("PDF erzeugt", `${(buffer.length / 1024).toFixed(1)} KB`);

  // --- 10. Sprachaufnahme über die API (Mock-STT) --------------------------
  const jobId = jobUrl.split("/auftraege/")[1];
  const upload = await context.request.post(
    `${BASE}/api/jobs/${jobId}/voice-notes`,
    {
      multipart: {
        audio: {
          name: "bericht.webm",
          mimeType: "audio/webm",
          buffer: Buffer.alloc(64_000, 7),
        },
        durationSec: "22",
      },
    },
  );
  const uploadJson = await upload.json();
  if (!upload.ok() || uploadJson.failed) {
    fail("Sprach-Pipeline fehlgeschlagen", JSON.stringify(uploadJson));
  }
  ok("Sprachaufnahme verarbeitet", `„${uploadJson.transcript.slice(0, 48)}…“`);

  // --- 11. Mandantentrennung ------------------------------------------------
  const foreign = await context.request.get(
    `${BASE}/api/files/org/fremde-organisation/jobs/x/photos/y.jpg`,
  );
  if (foreign.status() !== 404) {
    fail("Fremder Storage-Key nicht abgewiesen", `${foreign.status()}`);
  }
  ok("Zugriff auf fremden Mandanten abgewiesen (404)");

  const anon = await browser.newContext();
  const anonResponse = await anon.request.get(`${BASE}/api/invoices/${invoiceId}/pdf`, {
    maxRedirects: 0,
  });
  if (anonResponse.status() !== 401) {
    fail("PDF ohne Sitzung erreichbar", `${anonResponse.status()}`);
  }
  ok("PDF ohne Anmeldung abgewiesen (401)");
  await anon.close();
} catch (error) {
  console.log(steps.join("\n"));
  console.error("\nFEHLER:", error.message);
  await page
    .screenshot({ path: "smoke-failure.png", fullPage: true })
    .catch(() => {});
  await browser.close();
  process.exit(1);
}

console.log(steps.join("\n"));
await browser.close();
