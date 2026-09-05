import "server-only";

import { prisma } from "@/lib/db";
import { NotFoundError, type SessionContext } from "@/lib/auth/session";
import { toNumber, toNumberOrNull, round2, round3 } from "@/lib/money";
import { parseExtraction, type JobReportExtraction } from "@/lib/ai/schema";
import {
  validateJobForInvoice,
  type InvoiceReadiness,
} from "@/lib/domain/validation";

/**
 * Liest einen Auftrag mit allen Details – immer mandantengebunden – und
 * normalisiert Prisma-Decimals zu `number`, damit die Daten unverändert an
 * Client Components weitergereicht werden können.
 */

export type JobTotals = {
  hours: number;
  laborNet: number;
  materialNet: number;
  net: number;
};

export type JobDetail = Awaited<ReturnType<typeof getJobDetail>>;

const jobInclude = {
  customer: true,
  site: true,
  assignments: { include: { employee: true } },
  activities: { orderBy: { sortOrder: "asc" } },
  timeEntries: {
    orderBy: { date: "asc" },
    include: { employee: { select: { id: true, name: true } } },
  },
  materials: { orderBy: { createdAt: "asc" } },
  notes: {
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  },
  photos: { orderBy: { createdAt: "desc" } },
  voiceNotes: { orderBy: { createdAt: "desc" } },
  extractions: { orderBy: { createdAt: "desc" } },
  serviceReport: true,
  invoices: { orderBy: { createdAt: "desc" } },
} as const;

export function effectiveHourlyRate(params: {
  entryRate: number | null;
  jobRate: number | null;
  customerRate: number | null;
  organizationRate: number | null;
}): number | null {
  const candidates = [
    params.entryRate,
    params.jobRate,
    params.customerRate,
    params.organizationRate,
  ];
  for (const candidate of candidates) {
    if (candidate !== null && candidate > 0) return candidate;
  }
  return null;
}

export async function getJobDetail(session: SessionContext, jobId: string) {
  const [job, organization] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, organizationId: session.organizationId },
      include: jobInclude,
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
    }),
  ]);

  if (!job) throw new NotFoundError("Auftrag nicht gefunden.");

  const organizationRate = toNumber(organization.defaultHourlyRate);
  const customerRate = toNumberOrNull(job.customer.hourlyRate);
  const jobRate = toNumberOrNull(job.hourlyRate);

  const timeEntries = job.timeEntries.map((entry) => {
    const entryRate = toNumberOrNull(entry.hourlyRate);
    return {
      id: entry.id,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      hours: toNumber(entry.hours),
      hourlyRate: entryRate,
      effectiveRate: effectiveHourlyRate({
        entryRate,
        jobRate,
        customerRate,
        organizationRate,
      }),
      description: entry.description,
      employeeId: entry.employeeId,
      employeeName: entry.employee?.name ?? null,
      source: entry.source,
    };
  });

  const materials = job.materials.map((material) => ({
    id: material.id,
    materialId: material.materialId,
    description: material.description,
    quantity: toNumber(material.quantity),
    unit: material.unit,
    unitPrice: toNumberOrNull(material.unitPrice),
    source: material.source,
  }));

  const hours = round3(
    timeEntries.reduce((sum, entry) => sum + entry.hours, 0),
  );
  const laborNet = round2(
    timeEntries.reduce(
      (sum, entry) => sum + entry.hours * (entry.effectiveRate ?? 0),
      0,
    ),
  );
  const materialNet = round2(
    materials.reduce(
      (sum, material) => sum + material.quantity * (material.unitPrice ?? 0),
      0,
    ),
  );

  return {
    id: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    description: job.description,
    status: job.status,
    scheduledAt: job.scheduledAt,
    performedAt: job.performedAt,
    hourlyRate: jobRate,
    createdAt: job.createdAt,
    customer: {
      id: job.customer.id,
      customerNumber: job.customer.customerNumber,
      name: job.customer.name,
      type: job.customer.type,
      contactPerson: job.customer.contactPerson,
      email: job.customer.email,
      phone: job.customer.phone,
      street: job.customer.street,
      zip: job.customer.zip,
      city: job.customer.city,
      hourlyRate: customerRate,
    },
    site: job.site
      ? {
          id: job.site.id,
          label: job.site.label,
          street: job.site.street,
          zip: job.site.zip,
          city: job.site.city,
        }
      : null,
    employees: job.assignments.map((assignment) => ({
      id: assignment.employee.id,
      name: assignment.employee.name,
    })),
    activities: job.activities.map((activity) => ({
      id: activity.id,
      description: activity.description,
      source: activity.source,
      sortOrder: activity.sortOrder,
    })),
    timeEntries,
    materials,
    notes: job.notes.map((note) => ({
      id: note.id,
      text: note.text,
      source: note.source,
      createdAt: note.createdAt,
      authorName: note.author?.name ?? null,
    })),
    photos: job.photos.map((photo) => ({
      id: photo.id,
      storageKey: photo.storageKey,
      filename: photo.filename,
      caption: photo.caption,
      mimeType: photo.mimeType,
      size: photo.size,
      createdAt: photo.createdAt,
    })),
    voiceNotes: job.voiceNotes.map((note) => ({
      id: note.id,
      status: note.status,
      transcript: note.transcript,
      durationSec: note.durationSec,
      mimeType: note.mimeType,
      createdAt: note.createdAt,
      error: note.error,
    })),
    extractions: job.extractions.map((extraction) => ({
      id: extraction.id,
      status: extraction.status,
      source: extraction.source,
      confidence: toNumberOrNull(extraction.confidence),
      missing: extraction.missing,
      inputText: extraction.inputText,
      result: parseExtraction(extraction.result),
      confirmedData: extraction.confirmedData
        ? parseExtraction(extraction.confirmedData)
        : null,
      provider: extraction.provider,
      createdAt: extraction.createdAt,
      voiceNoteId: extraction.voiceNoteId,
      error: extraction.error,
    })),
    serviceReport: job.serviceReport
      ? {
          id: job.serviceReport.id,
          number: job.serviceReport.number,
          performedOn: job.serviceReport.performedOn,
          summary: job.serviceReport.summary,
          createdAt: job.serviceReport.createdAt,
        }
      : null,
    invoices: job.invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      grossTotal: toNumber(invoice.grossTotal),
      issueDate: invoice.issueDate,
    })),
    totals: {
      hours,
      laborNet,
      materialNet,
      net: round2(laborNet + materialNet),
    } satisfies JobTotals,
    organization: {
      id: organization.id,
      defaultHourlyRate: organizationRate,
      defaultVatRate: toNumber(organization.defaultVatRate),
      travelFlatRate: toNumber(organization.travelFlatRate),
      smallBusiness: organization.smallBusiness,
      paymentTermsDays: organization.paymentTermsDays,
    },
  };
}

/** Prüft, ob aus diesem Auftrag eine Rechnung entstehen darf. */
export async function getInvoiceReadiness(
  session: SessionContext,
  jobId: string,
): Promise<InvoiceReadiness & { detail: JobDetail }> {
  const detail = await getJobDetail(session, jobId);
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
  });

  const confirmedConfidences = detail.extractions
    .filter((extraction) => extraction.status === "CONFIRMED")
    .map((extraction) => extraction.confidence)
    .filter((confidence): confidence is number => confidence !== null);

  const readiness = validateJobForInvoice({
    job: {
      performedAt: detail.performedAt,
      activityCount: detail.activities.length,
    },
    timeEntries: detail.timeEntries.map((entry) => ({
      hours: entry.hours,
      hourlyRate: entry.effectiveRate,
    })),
    materials: detail.materials.map((material) => ({
      description: material.description,
      quantity: material.quantity,
      unitPrice: material.unitPrice,
    })),
    customer: {
      name: detail.customer.name,
      street: detail.customer.street,
      zip: detail.customer.zip,
      city: detail.customer.city,
    },
    organization: {
      name: organization.name,
      street: organization.street,
      zip: organization.zip,
      city: organization.city,
      taxNumber: organization.taxNumber,
      vatId: organization.vatId,
      smallBusiness: organization.smallBusiness,
    },
    pendingExtractions: detail.extractions.filter(
      (extraction) => extraction.status === "PENDING",
    ).length,
    lowestConfirmedConfidence:
      confirmedConfidences.length > 0
        ? Math.min(...confirmedConfidences)
        : null,
    hasServiceReport: detail.serviceReport !== null,
  });

  return { ...readiness, detail };
}

/** Kontext für die KI-Extraktion: bekannte Kunden und Materialkatalog. */
export async function buildExtractionContext(
  session: SessionContext,
  jobId?: string,
) {
  const [organization, customers, materials, job] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { trade: true, defaultHourlyRate: true },
    }),
    prisma.customer.findMany({
      where: { organizationId: session.organizationId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.material.findMany({
      where: { organizationId: session.organizationId, active: true },
      select: {
        id: true,
        name: true,
        unit: true,
        aliases: true,
        defaultPrice: true,
      },
      orderBy: { name: "asc" },
      take: 300,
    }),
    jobId
      ? prisma.job.findFirst({
          where: { id: jobId, organizationId: session.organizationId },
          select: { customer: { select: { name: true } } },
        })
      : Promise.resolve(null),
  ]);

  const today = new Date();
  const isoToday = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(
    2,
    "0",
  )}-${`${today.getDate()}`.padStart(2, "0")}`;

  const organizationRate = toNumber(organization.defaultHourlyRate);

  return {
    trade: organization.trade,
    today: isoToday,
    customers,
    materials: materials.map((material) => ({
      id: material.id,
      name: material.name,
      unit: material.unit,
      aliases: material.aliases,
      defaultPrice: toNumberOrNull(material.defaultPrice),
    })),
    currentCustomerName: job?.customer.name ?? null,
    defaultHourlyRate: organizationRate > 0 ? organizationRate : null,
  };
}

export type { JobReportExtraction };
