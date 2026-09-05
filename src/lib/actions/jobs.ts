"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, requireSession } from "@/lib/auth/session";
import { requireCustomer, requireJob } from "@/lib/auth/tenancy";
import { nextJobNumber, serviceReportNumber } from "@/lib/domain/numbering";
import { getStorage } from "@/lib/providers/storage";
import { getJobDetail } from "@/lib/services/job-service";
import {
  formError,
  formSuccess,
  readDate,
  readNumber,
  readOptionalString,
  readString,
  toFormState,
  zodErrors,
  type FormState,
} from "./state";

function revalidateJob(jobId: string) {
  revalidatePath("/");
  revalidatePath("/auftraege");
  revalidatePath(`/auftraege/${jobId}`);
}

const jobSchema = z.object({
  title: z.string().min(2, "Bitte kurze Bezeichnung eingeben."),
  description: z.string().nullable(),
  customerId: z.string().min(1, "Bitte Kunde auswählen."),
  siteId: z.string().nullable(),
  scheduledAt: z.date().nullable(),
  performedAt: z.date().nullable(),
  hourlyRate: z.number().positive().nullable(),
});

export async function createJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const parsed = jobSchema.safeParse({
      title: readString(formData, "title"),
      description: readOptionalString(formData, "description"),
      customerId: readString(formData, "customerId"),
      siteId: readOptionalString(formData, "siteId"),
      scheduledAt: readDate(formData, "scheduledAt"),
      performedAt: readDate(formData, "performedAt"),
      hourlyRate: readNumber(formData, "hourlyRate"),
    });
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    await requireCustomer(session, parsed.data.customerId);

    if (parsed.data.siteId) {
      const site = await prisma.site.findFirst({
        where: {
          id: parsed.data.siteId,
          organizationId: session.organizationId,
          customerId: parsed.data.customerId,
        },
        select: { id: true },
      });
      if (!site) {
        return formError("Die gewählte Baustelle gehört nicht zu diesem Kunden.");
      }
    }

    const employeeIds = formData
      .getAll("employeeIds")
      .filter((value): value is string => typeof value === "string" && !!value);

    const validEmployees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        organizationId: session.organizationId,
      },
      select: { id: true },
    });

    const job = await prisma.job.create({
      data: {
        organizationId: session.organizationId,
        jobNumber: await nextJobNumber(session.organizationId),
        title: parsed.data.title,
        description: parsed.data.description,
        customerId: parsed.data.customerId,
        siteId: parsed.data.siteId,
        scheduledAt: parsed.data.scheduledAt,
        performedAt: parsed.data.performedAt,
        hourlyRate: parsed.data.hourlyRate,
        status: "SCHEDULED",
        assignments: {
          create: validEmployees.map((employee) => ({
            employeeId: employee.id,
          })),
        },
      },
      select: { id: true, jobNumber: true },
    });

    await audit(session, {
      action: "job.create",
      entityType: "job",
      entityId: job.id,
      metadata: { jobNumber: job.jobNumber },
    });

    revalidateJob(job.id);
    return formSuccess("Auftrag angelegt.", { id: job.id });
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    await requireJob(session, jobId);

    const parsed = jobSchema.safeParse({
      title: readString(formData, "title"),
      description: readOptionalString(formData, "description"),
      customerId: readString(formData, "customerId"),
      siteId: readOptionalString(formData, "siteId"),
      scheduledAt: readDate(formData, "scheduledAt"),
      performedAt: readDate(formData, "performedAt"),
      hourlyRate: readNumber(formData, "hourlyRate"),
    });
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    await requireCustomer(session, parsed.data.customerId);

    const employeeIds = formData
      .getAll("employeeIds")
      .filter((value): value is string => typeof value === "string" && !!value);
    const validEmployees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        organizationId: session.organizationId,
      },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.jobAssignment.deleteMany({ where: { jobId } }),
      prisma.job.update({
        where: { id: jobId },
        data: {
          ...parsed.data,
          assignments: {
            create: validEmployees.map((employee) => ({
              employeeId: employee.id,
            })),
          },
        },
      }),
    ]);

    await audit(session, {
      action: "job.update",
      entityType: "job",
      entityId: jobId,
    });

    revalidateJob(jobId);
    return formSuccess("Auftrag gespeichert.");
  } catch (error) {
    return toFormState(error);
  }
}

const ALLOWED_STATUS: JobStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "IN_PROGRESS",
  "NEEDS_REVIEW",
  "READY_TO_INVOICE",
  "CLOSED",
  "CANCELLED",
];

export async function setJobStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    const job = await requireJob(session, jobId);
    const status = readString(formData, "status") as JobStatus;

    if (!ALLOWED_STATUS.includes(status)) {
      return formError("Unbekannter Status.");
    }

    await prisma.job.update({ where: { id: jobId }, data: { status } });

    await audit(session, {
      action: "job.status_change",
      entityType: "job",
      entityId: jobId,
      metadata: { from: job.status, to: status },
    });

    revalidateJob(jobId);
    return formSuccess("Status aktualisiert.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteJobAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const jobId = readString(formData, "jobId");
    await requireJob(session, jobId);

    const invoiceCount = await prisma.invoice.count({
      where: { jobId, organizationId: session.organizationId },
    });
    if (invoiceCount > 0) {
      return formError(
        "Zu diesem Auftrag gibt es bereits eine Rechnung. Bitte zuerst die Rechnung stornieren.",
      );
    }

    // Medien mitlöschen – Datenminimierung, keine verwaisten Dateien.
    const [photos, voiceNotes] = await Promise.all([
      prisma.jobPhoto.findMany({ where: { jobId }, select: { storageKey: true } }),
      prisma.voiceNote.findMany({
        where: { jobId },
        select: { storageKey: true },
      }),
    ]);
    const storage = getStorage();
    await Promise.allSettled(
      [...photos, ...voiceNotes].map((item) => storage.delete(item.storageKey)),
    );

    await prisma.job.delete({ where: { id: jobId } });

    await audit(session, {
      action: "job.delete",
      entityType: "job",
      entityId: jobId,
      metadata: { photos: photos.length, voiceNotes: voiceNotes.length },
    });

    revalidatePath("/auftraege");
    revalidatePath("/");
    return formSuccess("Auftrag gelöscht.");
  } catch (error) {
    return toFormState(error);
  }
}

// ---------------------------------------------------------------------------
// Positionen
// ---------------------------------------------------------------------------

export async function addTimeEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    await requireJob(session, jobId);

    const hours = readNumber(formData, "hours");
    const date = readDate(formData, "date") ?? new Date();
    if (hours === null || hours <= 0 || hours > 24) {
      return formError("Bitte eine Stundenzahl zwischen 0 und 24 eingeben.", {
        hours: ["Ungültige Stundenzahl."],
      });
    }

    const employeeId = readOptionalString(formData, "employeeId");
    if (employeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, organizationId: session.organizationId },
        select: { id: true },
      });
      if (!employee) return formError("Mitarbeiter nicht gefunden.");
    }

    await prisma.jobTimeEntry.create({
      data: {
        organizationId: session.organizationId,
        jobId,
        employeeId,
        date,
        startTime: readOptionalString(formData, "startTime"),
        endTime: readOptionalString(formData, "endTime"),
        hours,
        hourlyRate: readNumber(formData, "hourlyRate"),
        description: readOptionalString(formData, "description"),
        source: "MANUAL",
      },
    });

    await audit(session, {
      action: "job.update",
      entityType: "job_time_entry",
      entityId: jobId,
      metadata: { hours },
    });

    revalidateJob(jobId);
    return formSuccess("Arbeitszeit erfasst.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteTimeEntryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const id = readString(formData, "id");
    const entry = await prisma.jobTimeEntry.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true, jobId: true },
    });
    if (!entry) return formError("Eintrag nicht gefunden.");

    await prisma.jobTimeEntry.delete({ where: { id } });
    revalidateJob(entry.jobId);
    return formSuccess("Zeiteintrag gelöscht.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function addMaterialAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    await requireJob(session, jobId);

    const quantity = readNumber(formData, "quantity");
    const description = readString(formData, "description");
    if (!description) {
      return formError("Bitte Bezeichnung eingeben.", {
        description: ["Pflichtfeld."],
      });
    }
    if (quantity === null || quantity <= 0) {
      return formError("Bitte eine Menge größer als 0 eingeben.", {
        quantity: ["Ungültige Menge."],
      });
    }

    const materialId = readOptionalString(formData, "materialId");
    let unitPrice = readNumber(formData, "unitPrice");
    let unit = readString(formData, "unit") || "Stück";

    if (materialId) {
      const material = await prisma.material.findFirst({
        where: { id: materialId, organizationId: session.organizationId },
        select: { unit: true, defaultPrice: true },
      });
      if (!material) return formError("Material nicht im Katalog gefunden.");
      unit = unit || material.unit;
      if (unitPrice === null && material.defaultPrice) {
        unitPrice = Number(material.defaultPrice);
      }
    }

    await prisma.jobMaterial.create({
      data: {
        organizationId: session.organizationId,
        jobId,
        materialId,
        description,
        quantity,
        unit,
        unitPrice,
        source: "MANUAL",
      },
    });

    await audit(session, {
      action: "job.update",
      entityType: "job_material",
      entityId: jobId,
    });

    revalidateJob(jobId);
    return formSuccess("Material erfasst.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateMaterialPriceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const id = readString(formData, "id");
    const unitPrice = readNumber(formData, "unitPrice");

    const material = await prisma.jobMaterial.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true, jobId: true },
    });
    if (!material) return formError("Position nicht gefunden.");
    if (unitPrice === null || unitPrice < 0) {
      return formError("Bitte gültigen Preis eingeben.");
    }

    await prisma.jobMaterial.update({ where: { id }, data: { unitPrice } });
    revalidateJob(material.jobId);
    return formSuccess("Preis gespeichert.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteMaterialAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const id = readString(formData, "id");
    const material = await prisma.jobMaterial.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true, jobId: true },
    });
    if (!material) return formError("Position nicht gefunden.");

    await prisma.jobMaterial.delete({ where: { id } });
    revalidateJob(material.jobId);
    return formSuccess("Materialposition gelöscht.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function addActivityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    await requireJob(session, jobId);

    const description = readString(formData, "description");
    if (description.length < 3) {
      return formError("Bitte Tätigkeit beschreiben.", {
        description: ["Zu kurz."],
      });
    }

    const count = await prisma.jobActivity.count({ where: { jobId } });
    await prisma.jobActivity.create({
      data: {
        organizationId: session.organizationId,
        jobId,
        description,
        sortOrder: count,
        source: "MANUAL",
      },
    });

    revalidateJob(jobId);
    return formSuccess("Tätigkeit ergänzt.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteActivityAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const id = readString(formData, "id");
    const activity = await prisma.jobActivity.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true, jobId: true },
    });
    if (!activity) return formError("Tätigkeit nicht gefunden.");

    await prisma.jobActivity.delete({ where: { id } });
    revalidateJob(activity.jobId);
    return formSuccess("Tätigkeit gelöscht.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function addNoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    await requireJob(session, jobId);

    const text = readString(formData, "text");
    if (text.length < 2) {
      return formError("Bitte Notiz eingeben.", { text: ["Zu kurz."] });
    }

    await prisma.jobNote.create({
      data: {
        organizationId: session.organizationId,
        jobId,
        authorId: session.userId,
        text,
        source: "MANUAL",
      },
    });

    revalidateJob(jobId);
    return formSuccess("Notiz gespeichert.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deletePhotoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const id = readString(formData, "id");
    const photo = await prisma.jobPhoto.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true, jobId: true, storageKey: true },
    });
    if (!photo) return formError("Foto nicht gefunden.");

    await getStorage()
      .delete(photo.storageKey)
      .catch(() => undefined);
    await prisma.jobPhoto.delete({ where: { id } });

    await audit(session, {
      action: "photo.delete",
      entityType: "job_photo",
      entityId: id,
    });

    revalidateJob(photo.jobId);
    return formSuccess("Foto gelöscht.");
  } catch (error) {
    return toFormState(error);
  }
}

// ---------------------------------------------------------------------------
// Leistungsnachweis
// ---------------------------------------------------------------------------

/**
 * Erzeugt den Leistungsnachweis als unveränderlichen Snapshot der bestätigten
 * Leistungen – Grundlage für die Rechnung und für den Kunden nachvollziehbar.
 */
export async function createServiceReportAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    const job = await requireJob(session, jobId);

    const detail = await getJobDetail(session, jobId);

    if (detail.timeEntries.length === 0 && detail.materials.length === 0) {
      return formError(
        "Ohne erfasste Leistungen kann kein Leistungsnachweis erstellt werden.",
      );
    }

    const pending = detail.extractions.filter(
      (extraction) => extraction.status === "PENDING",
    ).length;
    if (pending > 0) {
      return formError(
        "Es warten noch KI-Vorschläge auf Ihre Bestätigung. Bitte zuerst prüfen.",
      );
    }

    const performedOn = detail.performedAt ?? detail.scheduledAt ?? new Date();

    const data = {
      activities: detail.activities.map((activity) => activity.description),
      timeEntries: detail.timeEntries.map((entry) => ({
        date: entry.date.toISOString(),
        hours: entry.hours,
        employee: entry.employeeName,
        description: entry.description,
      })),
      materials: detail.materials.map((material) => ({
        description: material.description,
        quantity: material.quantity,
        unit: material.unit,
      })),
      totals: detail.totals,
    };

    const summary = detail.activities
      .map((activity) => activity.description)
      .join("; ");

    const report = await prisma.serviceReport.upsert({
      where: { jobId },
      create: {
        organizationId: session.organizationId,
        jobId,
        createdById: session.userId,
        number: serviceReportNumber(job.jobNumber),
        performedOn,
        summary: summary || null,
        data,
      },
      update: {
        performedOn,
        summary: summary || null,
        data,
      },
      select: { id: true, number: true },
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        performedAt: detail.performedAt ?? performedOn,
        status:
          job.status === "INVOICED" || job.status === "CLOSED"
            ? job.status
            : "READY_TO_INVOICE",
      },
    });

    await audit(session, {
      action: "service_report.create",
      entityType: "service_report",
      entityId: report.id,
      metadata: { number: report.number, jobId },
    });

    revalidateJob(jobId);
    return formSuccess(`Leistungsnachweis ${report.number} erstellt.`);
  } catch (error) {
    return toFormState(error);
  }
}
