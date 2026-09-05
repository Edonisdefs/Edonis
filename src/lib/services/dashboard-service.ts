import "server-only";

import { prisma } from "@/lib/db";
import type { SessionContext } from "@/lib/auth/session";
import { toNumber } from "@/lib/money";
import { OPEN_JOB_STATUSES } from "@/lib/domain/job-status";

/**
 * Kennzahlen und Arbeitsvorrat für die Übersicht.
 * Bewusst wenige, gezielte Abfragen – die Startseite ist die meistgeöffnete
 * Seite und muss auch im Funkloch schnell da sein.
 */

const ACTIONABLE_STATUSES = [
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "READY_TO_INVOICE",
] as const;

export async function getDashboardData(session: SessionContext) {
  const organizationId = session.organizationId;

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const jobSelect = {
    id: true,
    jobNumber: true,
    title: true,
    status: true,
    scheduledAt: true,
    performedAt: true,
    customer: {
      select: {
        id: true,
        name: true,
        street: true,
        zip: true,
        city: true,
      },
    },
    site: { select: { label: true, city: true } },
  } as const;

  const [
    todayJobs,
    openJobs,
    pendingExtractions,
    draftInvoices,
    openInvoices,
    incompleteJobs,
  ] = await Promise.all([
    prisma.job.findMany({
      where: {
        organizationId,
        status: { notIn: ["CANCELLED", "CLOSED"] },
        OR: [
          { scheduledAt: { gte: startOfDay, lt: endOfDay } },
          { performedAt: { gte: startOfDay, lt: endOfDay } },
        ],
      },
      select: jobSelect,
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),

    prisma.job.count({
      where: { organizationId, status: { in: [...OPEN_JOB_STATUSES] } },
    }),

    prisma.aiExtraction.findMany({
      where: { organizationId, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        confidence: true,
        job: {
          select: {
            id: true,
            jobNumber: true,
            title: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    prisma.invoice.findMany({
      where: { organizationId, status: "DRAFT" },
      select: {
        id: true,
        invoiceNumber: true,
        grossTotal: true,
        issueDate: true,
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    prisma.invoice.findMany({
      where: { organizationId, status: "OPEN" },
      select: {
        id: true,
        invoiceNumber: true,
        grossTotal: true,
        dueDate: true,
        customer: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),

    // „Fehlende Informationen“: Aufträge, die ohne Nacharbeit nicht
    // abgerechnet werden können.
    prisma.job.findMany({
      where: {
        organizationId,
        status: { in: [...ACTIONABLE_STATUSES] },
        OR: [
          { materials: { some: { unitPrice: null } } },
          { customer: { street: null } },
          { customer: { zip: null } },
          { customer: { city: null } },
          { performedAt: null },
        ],
      },
      select: {
        ...jobSelect,
        materials: {
          where: { unitPrice: null },
          select: { id: true, description: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const openTotal = openInvoices.reduce(
    (sum, invoice) => sum + toNumber(invoice.grossTotal),
    0,
  );
  const overdueCount = openInvoices.filter(
    (invoice) => invoice.dueDate && invoice.dueDate.getTime() < now.getTime(),
  ).length;

  return {
    todayJobs,
    openJobsCount: openJobs,
    pendingExtractions,
    draftInvoices: draftInvoices.map((invoice) => ({
      ...invoice,
      grossTotal: toNumber(invoice.grossTotal),
    })),
    openInvoices: openInvoices.map((invoice) => ({
      ...invoice,
      grossTotal: toNumber(invoice.grossTotal),
      // Fälligkeit wird hier ausgewertet und nicht beim Rendern – so bleibt
      // die Seite eine reine Darstellung der geladenen Daten.
      overdue: Boolean(
        invoice.dueDate && invoice.dueDate.getTime() < now.getTime(),
      ),
    })),
    openInvoiceTotal: openTotal,
    overdueCount,
    incompleteJobs: incompleteJobs.map((job) => ({
      ...job,
      missing: [
        job.materials.length > 0
          ? `${job.materials.length} Materialpreis${
              job.materials.length === 1 ? "" : "e"
            } fehlt`
          : null,
        !job.customer.street || !job.customer.zip || !job.customer.city
          ? "Kundenanschrift unvollständig"
          : null,
        !job.performedAt ? "Leistungsdatum fehlt" : null,
      ].filter((entry): entry is string => entry !== null),
    })),
  };
}
