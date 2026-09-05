/**
 * Demo-Daten für Edonis.
 *
 * Ziel: Nach `npm run db:seed` ist die Anwendung sofort vorführbar – mit
 * Betrieb, Team, Kunden, Aufträgen in allen relevanten Zuständen, einem
 * wartenden KI-Vorschlag und mehreren Rechnungen.
 *
 * Der Seed ist wiederholbar: Der Demo-Betrieb wird vorher vollständig
 * entfernt (Cascade), andere Mandanten bleiben unberührt.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { extractFromGermanReport } from "../src/lib/ai/mock";
import { buildInvoiceDraft } from "../src/lib/domain/invoice-builder";
import { getTradeConfig } from "../src/lib/domain/trades";

const prisma = new PrismaClient();

const DEMO_SLUG = "sanitaer-berger";
const DEMO_PASSWORD = "handwerk2026";

function daysAgo(days: number, hour = 9): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function today(hour = 8): Date {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  console.log("→ Demo-Betrieb wird zurückgesetzt …");
  await prisma.organization.deleteMany({ where: { slug: DEMO_SLUG } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // -------------------------------------------------------------------------
  // Betrieb
  // -------------------------------------------------------------------------
  const organization = await prisma.organization.create({
    data: {
      name: "Sanitär Berger",
      slug: DEMO_SLUG,
      trade: "SHK",
      legalName: "Sanitär Berger GmbH",
      ownerName: "Michael Berger",
      street: "Rosenheimer Straße 42",
      zip: "81669",
      city: "München",
      email: "buero@sanitaer-berger.de",
      phone: "089 1234567",
      website: "www.sanitaer-berger.de",
      taxNumber: "143/205/60123",
      vatId: "DE812345678",
      registerInfo: "HRB 210456 Amtsgericht München · HWK für München und Oberbayern",
      bankName: "Stadtsparkasse München",
      iban: "DE02 7015 0000 0000 1234 56",
      bic: "SSKMDEMM",
      defaultHourlyRate: 68,
      defaultVatRate: 19,
      travelFlatRate: 25,
      paymentTermsDays: 14,
      invoiceFooterNote:
        "Für Arbeitskosten kann eine Steuerermäßigung nach § 35a EStG geltend gemacht werden.",
    },
  });

  // -------------------------------------------------------------------------
  // Zugänge
  // -------------------------------------------------------------------------
  const [owner, office, field] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: organization.id,
        email: "demo@sanitaer-berger.de",
        name: "Michael Berger",
        role: "OWNER",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        email: "buero@sanitaer-berger.de",
        name: "Sabine Berger",
        role: "OFFICE",
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id,
        email: "tobias@sanitaer-berger.de",
        name: "Tobias Krämer",
        role: "FIELD",
        passwordHash,
      },
    }),
  ]);

  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        organizationId: organization.id,
        userId: owner.id,
        name: "Michael Berger",
        role: "Installateur- und Heizungsbaumeister",
        phone: "0170 1234567",
        hourlyRate: 78,
      },
    }),
    prisma.employee.create({
      data: {
        organizationId: organization.id,
        userId: field.id,
        name: "Tobias Krämer",
        role: "Anlagenmechaniker SHK",
        phone: "0170 2345678",
        hourlyRate: 68,
      },
    }),
    prisma.employee.create({
      data: {
        organizationId: organization.id,
        name: "Ayşe Demir",
        role: "Anlagenmechanikerin SHK",
        phone: "0170 3456789",
        hourlyRate: 62,
      },
    }),
  ]);

  const [meister, monteur, gesellin] = employees as [
    (typeof employees)[number],
    (typeof employees)[number],
    (typeof employees)[number],
  ];

  // -------------------------------------------------------------------------
  // Materialkatalog
  // -------------------------------------------------------------------------
  const catalog = getTradeConfig("SHK").catalog;
  await prisma.material.createMany({
    data: catalog.map((entry) => ({
      organizationId: organization.id,
      sku: entry.sku,
      name: entry.name,
      category: entry.category,
      unit: entry.unit,
      defaultPrice: entry.defaultPrice ?? undefined,
      aliases: entry.aliases,
    })),
  });

  // Ein Artikel ohne Preis – zeigt den „fehlende Informationen“-Fall.
  await prisma.material.create({
    data: {
      organizationId: organization.id,
      sku: "SHK-1099",
      name: "Sonderanfertigung Blende",
      category: "Sonstiges",
      unit: "Stück",
      defaultPrice: null,
      aliases: ["Blende", "Sonderblende"],
    },
  });

  const materials = await prisma.material.findMany({
    where: { organizationId: organization.id },
  });
  const byName = (name: string) => {
    const found = materials.find((material) => material.name === name);
    if (!found) throw new Error(`Material fehlt im Seed: ${name}`);
    return found;
  };

  // -------------------------------------------------------------------------
  // Kunden
  // -------------------------------------------------------------------------
  const customerSeed: Array<{
    name: string;
    type: "PRIVATE" | "COMPANY";
    contactPerson?: string;
    street: string | null;
    zip: string | null;
    city: string | null;
    email?: string;
    phone?: string;
    notes?: string;
  }> = [
    {
      name: "Müller",
      type: "PRIVATE",
      contactPerson: "Familie Müller",
      street: "Lindenstraße 8",
      zip: "81543",
      city: "München",
      phone: "089 2233445",
      email: "familie.mueller@example.de",
    },
    {
      name: "Schneider",
      type: "PRIVATE",
      street: "Am Hartmannshofer Bächl 12",
      zip: "80995",
      city: "München",
      phone: "089 3344556",
    },
    {
      name: "Bäckerei Hoffmann GmbH",
      type: "COMPANY",
      contactPerson: "Petra Hoffmann",
      street: "Marktplatz 3",
      zip: "82041",
      city: "Oberhaching",
      email: "info@baeckerei-hoffmann.de",
      phone: "089 4455667",
      notes: "Arbeiten möglichst vor 6 Uhr oder nach 18 Uhr.",
    },
    {
      name: "Weber",
      type: "PRIVATE",
      contactPerson: "Familie Weber",
      street: "Tulpenweg 19",
      zip: "85521",
      city: "Ottobrunn",
      phone: "089 5566778",
    },
    {
      name: "Krüger Immobilien GmbH",
      type: "COMPANY",
      contactPerson: "Jens Krüger",
      street: "Leopoldstraße 145",
      zip: "80804",
      city: "München",
      email: "verwaltung@krueger-immobilien.de",
      phone: "089 6677889",
      notes: "Rechnungen bitte immer mit Objektangabe.",
    },
    {
      name: "Fischer",
      type: "PRIVATE",
      street: "Bergstraße 5",
      zip: "82031",
      city: "Grünwald",
      phone: "089 7788990",
    },
    {
      name: "Autohaus Vogel KG",
      type: "COMPANY",
      contactPerson: "Ralf Vogel",
      street: "Industriestraße 22",
      zip: "85609",
      city: "Aschheim",
      email: "technik@autohaus-vogel.de",
    },
    {
      name: "Wagner",
      type: "PRIVATE",
      street: "Kirchweg 2",
      zip: "82008",
      city: "Unterhaching",
      phone: "089 8899001",
    },
    {
      name: "Pflegeheim St. Anna",
      type: "COMPANY",
      contactPerson: "Herr Sedlmeier",
      street: "Annastraße 14",
      zip: "81667",
      city: "München",
      email: "haustechnik@st-anna-pflege.de",
    },
    {
      // Bewusst unvollständig – erzeugt einen Blocker im Rechnungs-Gate.
      name: "Neubauer",
      type: "PRIVATE",
      street: null,
      zip: null,
      city: null,
      phone: "0176 11223344",
      notes: "Anschrift muss noch erfragt werden.",
    },
  ];

  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];
  for (const [index, entry] of customerSeed.entries()) {
    customers.push(
      await prisma.customer.create({
        data: {
          organizationId: organization.id,
          customerNumber: `K-${`${index + 1}`.padStart(4, "0")}`,
          name: entry.name,
          type: entry.type,
          contactPerson: entry.contactPerson ?? null,
          street: entry.street,
          zip: entry.zip,
          city: entry.city,
          email: entry.email ?? null,
          phone: entry.phone ?? null,
          notes: entry.notes ?? null,
        },
      }),
    );
  }

  const customerByName = (name: string) => {
    const found = customers.find((customer) => customer.name === name);
    if (!found) throw new Error(`Kunde fehlt im Seed: ${name}`);
    return found;
  };

  // -------------------------------------------------------------------------
  // Baustellen
  // -------------------------------------------------------------------------
  const siteMueller = await prisma.site.create({
    data: {
      organizationId: organization.id,
      customerId: customerByName("Müller").id,
      label: "Bad Erdgeschoss",
      street: "Lindenstraße 8",
      zip: "81543",
      city: "München",
      notes: "Zugang über den Hof, Klingel Müller.",
    },
  });

  const siteWeber = await prisma.site.create({
    data: {
      organizationId: organization.id,
      customerId: customerByName("Weber").id,
      label: "Neubau Bad OG",
      street: "Tulpenweg 19",
      zip: "85521",
      city: "Ottobrunn",
    },
  });

  await prisma.site.create({
    data: {
      organizationId: organization.id,
      customerId: customerByName("Krüger Immobilien GmbH").id,
      label: "Objekt Leopoldstraße 145, Keller",
      street: "Leopoldstraße 145",
      zip: "80804",
      city: "München",
      notes: "Hauptabsperrung im Heizungsraum.",
    },
  });

  // -------------------------------------------------------------------------
  // Aufträge
  // -------------------------------------------------------------------------
  let jobCounter = 0;
  const year = new Date().getFullYear();
  const nextJobNumber = () => {
    jobCounter += 1;
    return `A-${year}-${`${jobCounter}`.padStart(4, "0")}`;
  };

  type JobSeed = {
    customer: string;
    title: string;
    description?: string;
    status: Prisma.JobCreateInput["status"];
    siteId?: string;
    scheduledAt?: Date | null;
    performedAt?: Date | null;
    employeeIds: string[];
    activities?: string[];
    time?: Array<{
      hours: number;
      date: Date;
      startTime?: string;
      endTime?: string;
      employeeId?: string;
    }>;
    materials?: Array<{ name: string; quantity: number; withoutPrice?: boolean }>;
    notes?: string[];
  };

  const jobSeeds: JobSeed[] = [
    {
      customer: "Müller",
      title: "Armatur tauschen, Bad EG",
      description: "Undichte Waschtischarmatur austauschen.",
      status: "SCHEDULED",
      siteId: siteMueller.id,
      scheduledAt: today(8),
      employeeIds: [monteur.id],
    },
    {
      customer: "Schneider",
      title: "Heizungswartung Brennwerttherme",
      status: "SCHEDULED",
      scheduledAt: today(13),
      employeeIds: [meister.id],
    },
    {
      customer: "Bäckerei Hoffmann GmbH",
      title: "Abfluss verstopft, Backstube",
      status: "IN_PROGRESS",
      scheduledAt: daysAgo(1, 6),
      performedAt: daysAgo(1, 6),
      employeeIds: [monteur.id],
      activities: ["Rohr gereinigt", "Siphon ausgetauscht"],
      time: [{ hours: 3, date: daysAgo(1), startTime: "06:00", endTime: "09:00" }],
      materials: [{ name: "Siphon Waschtisch", quantity: 1 }],
      notes: ["Kunde war vor Ort, alles in Ordnung."],
    },
    {
      customer: "Weber",
      title: "Bad Obergeschoss, Rohinstallation",
      status: "READY_TO_INVOICE",
      siteId: siteWeber.id,
      scheduledAt: daysAgo(4),
      performedAt: daysAgo(4),
      employeeIds: [meister.id, gesellin.id],
      activities: [
        "Vorwandinstallation gesetzt",
        "Spülkasten montiert",
        "Kupferrohr verlegt und gelötet",
        "Druckprobe durchgeführt, dicht",
      ],
      time: [
        { hours: 4, date: daysAgo(4), startTime: "07:30", endTime: "11:30", employeeId: meister.id },
        { hours: 4, date: daysAgo(4), startTime: "07:30", endTime: "11:30", employeeId: gesellin.id },
      ],
      materials: [
        { name: "Vorwandelement WC", quantity: 1 },
        { name: "Spülkasten Unterputz", quantity: 1 },
        { name: "Kupferrohr 15 mm", quantity: 15 },
        { name: "Winkel 90° 15 mm", quantity: 3 },
      ],
    },
    {
      customer: "Krüger Immobilien GmbH",
      title: "Notdienst Rohrbruch Keller",
      status: "READY_TO_INVOICE",
      scheduledAt: daysAgo(6, 18),
      performedAt: daysAgo(6, 18),
      employeeIds: [meister.id],
      activities: [
        "Rohrbruch im Keller lokalisiert",
        "Absperrventil getauscht",
        "Leitung wieder in Betrieb genommen",
      ],
      time: [{ hours: 1.5, date: daysAgo(6), startTime: "18:00", endTime: "19:30" }],
      materials: [
        { name: "Kugelhahn 1/2 Zoll", quantity: 1 },
        { name: "Pressfitting 15 mm", quantity: 2 },
      ],
    },
    {
      customer: "Fischer",
      title: "Thermostatventile erneuern",
      status: "INVOICED",
      scheduledAt: daysAgo(12),
      performedAt: daysAgo(12),
      employeeIds: [gesellin.id],
      activities: ["Sechs Thermostatventile getauscht", "Anlage entlüftet"],
      time: [{ hours: 3.5, date: daysAgo(12) }],
      materials: [{ name: "Thermostatventil", quantity: 6 }],
    },
    {
      customer: "Autohaus Vogel KG",
      title: "Waschraum: Armaturen erneuern",
      status: "CLOSED",
      scheduledAt: daysAgo(28),
      performedAt: daysAgo(28),
      employeeIds: [monteur.id],
      activities: ["Vier Armaturen getauscht", "Eckventile erneuert"],
      time: [{ hours: 5, date: daysAgo(28) }],
      materials: [
        { name: "Waschtischarmatur", quantity: 4 },
        { name: "Eckventil", quantity: 8 },
        { name: "Flexschlauch", quantity: 8 },
      ],
    },
    {
      customer: "Pflegeheim St. Anna",
      title: "Umwälzpumpe defekt, Heizkreis 2",
      status: "INVOICED",
      scheduledAt: daysAgo(19),
      performedAt: daysAgo(19),
      employeeIds: [meister.id],
      activities: ["Umwälzpumpe getauscht", "Anlage entlüftet und eingestellt"],
      time: [{ hours: 2.5, date: daysAgo(19) }],
      materials: [{ name: "Umwälzpumpe", quantity: 1 }],
    },
    {
      customer: "Wagner",
      title: "Duscharmatur montieren",
      status: "IN_PROGRESS",
      scheduledAt: daysAgo(2),
      performedAt: daysAgo(2),
      employeeIds: [gesellin.id],
      activities: ["Alte Duscharmatur demontiert", "Neue Armatur montiert"],
      time: [{ hours: 1.5, date: daysAgo(2) }],
      // Sonderanfertigung ohne Katalogpreis – blockiert die Rechnung bewusst.
      materials: [
        { name: "Duscharmatur", quantity: 1 },
        { name: "Sonderanfertigung Blende", quantity: 1, withoutPrice: true },
      ],
    },
    {
      customer: "Neubauer",
      title: "Erstbesichtigung Heizungstausch",
      description: "Aufmaß und Beratung vor Ort.",
      status: "DRAFT",
      scheduledAt: null,
      employeeIds: [meister.id],
    },
  ];

  const createdJobs: Awaited<ReturnType<typeof prisma.job.create>>[] = [];
  for (const seed of jobSeeds) {
    const customer = customerByName(seed.customer);
    const job = await prisma.job.create({
      data: {
        organizationId: organization.id,
        jobNumber: nextJobNumber(),
        customerId: customer.id,
        siteId: seed.siteId ?? null,
        title: seed.title,
        description: seed.description ?? null,
        status: seed.status,
        scheduledAt: seed.scheduledAt ?? null,
        performedAt: seed.performedAt ?? null,
        assignments: {
          create: seed.employeeIds.map((employeeId) => ({ employeeId })),
        },
        activities: {
          create: (seed.activities ?? []).map((description, index) => ({
            organizationId: organization.id,
            description,
            sortOrder: index,
          })),
        },
        timeEntries: {
          create: (seed.time ?? []).map((entry) => ({
            organizationId: organization.id,
            employeeId: entry.employeeId ?? seed.employeeIds[0] ?? null,
            date: entry.date,
            startTime: entry.startTime ?? null,
            endTime: entry.endTime ?? null,
            hours: entry.hours,
          })),
        },
        materials: {
          create: (seed.materials ?? []).map((entry) => {
            const material = byName(entry.name);
            return {
              organizationId: organization.id,
              materialId: material.id,
              description: material.name,
              quantity: entry.quantity,
              unit: material.unit,
              unitPrice: entry.withoutPrice ? null : material.defaultPrice,
            };
          }),
        },
        notes: {
          create: (seed.notes ?? []).map((text) => ({
            organizationId: organization.id,
            authorId: field.id,
            text,
          })),
        },
      },
    });
    createdJobs.push(job);
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: { jobCounter, invoiceCounter: 0 },
  });

  // -------------------------------------------------------------------------
  // Ein wartender KI-Vorschlag (Sprachaufnahme, noch nicht bestätigt)
  // -------------------------------------------------------------------------
  const muellerJob = createdJobs[0];
  if (muellerJob) {
    const transcript =
      "Baustelle Müller. Heute von 8 bis 10 Uhr. Alte Armatur ausgebaut, neue Armatur eingebaut. Zwei Flexschläuche und ein Eckventil verwendet. Anlage geprüft, alles dicht.";

    const voiceNote = await prisma.voiceNote.create({
      data: {
        organizationId: organization.id,
        jobId: muellerJob.id,
        recordedById: field.id,
        storageKey: `org/${organization.id}/jobs/${muellerJob.id}/voice/demo.webm`,
        filename: "demo.webm",
        mimeType: "audio/webm",
        size: 48_000,
        durationSec: 18,
        status: "TRANSCRIBED",
        transcript,
        transcriptLang: "de",
        sttProvider: "mock",
        sttModel: "mock-whisper",
        transcribedAt: new Date(),
      },
    });

    const extraction = extractFromGermanReport(transcript, {
      trade: "SHK",
      today: new Date().toISOString().slice(0, 10),
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
      })),
      materials: materials.map((material) => ({
        id: material.id,
        name: material.name,
        unit: material.unit,
        aliases: material.aliases,
        defaultPrice: material.defaultPrice ? Number(material.defaultPrice) : null,
      })),
      currentCustomerName: "Müller",
      defaultHourlyRate: 68,
    });

    await prisma.aiExtraction.create({
      data: {
        organizationId: organization.id,
        jobId: muellerJob.id,
        voiceNoteId: voiceNote.id,
        source: "VOICE",
        inputText: transcript,
        result: extraction,
        confidence: extraction.confidence,
        missing: extraction.missing_information,
        status: "PENDING",
        provider: "mock",
        model: "regelbasiert",
      },
    });

    await prisma.job.update({
      where: { id: muellerJob.id },
      data: { status: "NEEDS_REVIEW" },
    });
  }

  // -------------------------------------------------------------------------
  // Rechnungen
  // -------------------------------------------------------------------------
  let invoiceCounter = 0;
  const nextInvoiceNumber = () => {
    invoiceCounter += 1;
    return `RE-${year}-${`${invoiceCounter}`.padStart(4, "0")}`;
  };

  async function createInvoiceForJob(
    jobId: string,
    status: "DRAFT" | "OPEN" | "PAID",
    issued: Date,
  ) {
    const job = await prisma.job.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        customer: true,
        site: true,
        activities: { orderBy: { sortOrder: "asc" } },
        timeEntries: true,
        materials: true,
      },
    });

    const draft = buildInvoiceDraft({
      timeEntries: job.timeEntries.map((entry) => ({
        hours: Number(entry.hours),
        hourlyRate: entry.hourlyRate
          ? Number(entry.hourlyRate)
          : Number(organization.defaultHourlyRate),
        description: entry.description,
        date: entry.date,
      })),
      materials: job.materials.map((material) => ({
        description: material.description,
        quantity: Number(material.quantity),
        unit: material.unit,
        unitPrice: material.unitPrice ? Number(material.unitPrice) : 0,
      })),
      travelFlatRate: Number(organization.travelFlatRate),
      vatRate: Number(organization.defaultVatRate),
      smallBusiness: organization.smallBusiness,
    });

    const dueDate = new Date(issued);
    dueDate.setDate(dueDate.getDate() + organization.paymentTermsDays);

    const snapshot = {
      seller: {
        name: organization.name,
        legalName: organization.legalName,
        ownerName: organization.ownerName,
        street: organization.street,
        zip: organization.zip,
        city: organization.city,
        country: organization.country,
        email: organization.email,
        phone: organization.phone,
        website: organization.website,
        taxNumber: organization.taxNumber,
        vatId: organization.vatId,
        registerInfo: organization.registerInfo,
        bankName: organization.bankName,
        iban: organization.iban,
        bic: organization.bic,
      },
      buyer: {
        customerNumber: job.customer.customerNumber,
        name: job.customer.name,
        contactPerson: job.customer.contactPerson,
        street: job.customer.street,
        zip: job.customer.zip,
        city: job.customer.city,
        country: job.customer.country,
        vatId: job.customer.vatId,
      },
      job: {
        jobNumber: job.jobNumber,
        title: job.title,
        siteLabel: job.site?.label ?? null,
        siteAddress: job.site
          ? [job.site.street, [job.site.zip, job.site.city].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", ")
          : null,
      },
      activities: job.activities.map((activity) => activity.description),
      serviceReportNumber: null,
    };

    return prisma.invoice.create({
      data: {
        organizationId: organization.id,
        customerId: job.customerId,
        jobId: job.id,
        invoiceNumber: nextInvoiceNumber(),
        status,
        issueDate: issued,
        serviceDate: job.performedAt ?? issued,
        dueDate,
        billingSnapshot: snapshot,
        netTotal: draft.netTotal,
        vatTotal: draft.vatTotal,
        grossTotal: draft.grossTotal,
        introText:
          "für die von uns ausgeführten Arbeiten berechnen wir Ihnen wie folgt:",
        outroText: organization.invoiceFooterNote,
        releasedAt: status === "DRAFT" ? null : issued,
        releasedById: status === "DRAFT" ? null : office.id,
        paidAt: status === "PAID" ? daysAgo(3) : null,
        items: {
          create: draft.lines.map((line) => ({
            organizationId: organization.id,
            position: line.position,
            kind: line.kind,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            netAmount: line.netAmount,
            vatRate: line.vatRate,
          })),
        },
      },
    });
  }

  const fischerJob = createdJobs.find((job) => job.title.includes("Thermostat"));
  const vogelJob = createdJobs.find((job) => job.title.includes("Waschraum"));
  const annaJob = createdJobs.find((job) => job.title.includes("Umwälzpumpe"));
  const kruegerJob = createdJobs.find((job) => job.title.includes("Notdienst"));

  if (fischerJob) await createInvoiceForJob(fischerJob.id, "OPEN", daysAgo(11));
  if (annaJob) await createInvoiceForJob(annaJob.id, "OPEN", daysAgo(18));
  if (vogelJob) await createInvoiceForJob(vogelJob.id, "PAID", daysAgo(27));
  if (kruegerJob) await createInvoiceForJob(kruegerJob.id, "DRAFT", daysAgo(1));

  await prisma.organization.update({
    where: { id: organization.id },
    data: { invoiceCounter },
  });

  // -------------------------------------------------------------------------
  // Leistungsnachweis für einen abgerechneten Auftrag
  // -------------------------------------------------------------------------
  if (vogelJob) {
    const detail = await prisma.job.findUniqueOrThrow({
      where: { id: vogelJob.id },
      include: { activities: true, timeEntries: true, materials: true },
    });

    await prisma.serviceReport.create({
      data: {
        organizationId: organization.id,
        jobId: detail.id,
        createdById: owner.id,
        number: `LN-${detail.jobNumber}`,
        performedOn: detail.performedAt ?? daysAgo(28),
        summary: detail.activities.map((a) => a.description).join("; "),
        data: {
          activities: detail.activities.map((a) => a.description),
          timeEntries: detail.timeEntries.map((entry) => ({
            date: entry.date.toISOString(),
            hours: Number(entry.hours),
          })),
          materials: detail.materials.map((material) => ({
            description: material.description,
            quantity: Number(material.quantity),
            unit: material.unit,
          })),
        },
      },
    });
  }

  console.log(`
✓ Demo-Daten angelegt

  Betrieb        ${organization.name}
  Mitarbeiter    ${employees.length}
  Kunden         ${customers.length}
  Aufträge       ${createdJobs.length}
  Material       ${materials.length}
  Rechnungen     ${invoiceCounter}

  Anmeldung
    Inhaber      demo@sanitaer-berger.de     / ${DEMO_PASSWORD}
    Büro         buero@sanitaer-berger.de    / ${DEMO_PASSWORD}
    Monteur      tobias@sanitaer-berger.de   / ${DEMO_PASSWORD}
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
