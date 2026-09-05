"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/auth/session";
import { requireJob } from "@/lib/auth/tenancy";
import { getAiProvider } from "@/lib/ai";
import { matchCatalog } from "@/lib/ai/mock";
import { parseExtraction } from "@/lib/ai/schema";
import { getSttProvider } from "@/lib/providers/stt";
import {
  createExtractionForJob,
  processVoiceNote,
} from "@/lib/services/voice-service";
import {
  formError,
  formSuccess,
  readString,
  toFormState,
  type FormState,
} from "./state";

function revalidateJob(jobId: string) {
  revalidatePath("/");
  revalidatePath("/auftraege");
  revalidatePath(`/auftraege/${jobId}`);
}

/** Audio → Text → strukturierter Vorschlag. */
export async function transcribeVoiceNoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const voiceNoteId = readString(formData, "voiceNoteId");

    const voiceNote = await prisma.voiceNote.findFirst({
      where: { id: voiceNoteId, organizationId: session.organizationId },
      select: { id: true, jobId: true },
    });
    if (!voiceNote) return formError("Sprachnachricht nicht gefunden.");

    const result = await processVoiceNote(session, voiceNote.id);

    revalidateJob(voiceNote.jobId);
    return result.failed
      ? formError(result.message)
      : formSuccess(result.message);
  } catch (error) {
    return toFormState(error);
  }
}

/** Getippte Notiz durch die KI strukturieren lassen. */
export async function extractFromTextAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const jobId = readString(formData, "jobId");
    await requireJob(session, jobId);

    const text = readString(formData, "text");
    if (text.length < 10) {
      return formError(
        "Bitte etwas ausführlicher beschreiben, damit die KI etwas erkennen kann.",
        { text: ["Mindestens 10 Zeichen."] },
      );
    }

    const result = await createExtractionForJob(session, {
      jobId,
      text,
      source: "TEXT",
    });
    if (result.failed) {
      revalidateJob(jobId);
      return formError(
        "Die KI-Auswertung ist fehlgeschlagen. Bitte später erneut versuchen oder manuell erfassen.",
      );
    }

    revalidateJob(jobId);
    return formSuccess("Notiz ausgewertet. Bitte Ergebnis prüfen.");
  } catch (error) {
    return toFormState(error);
  }
}

// ---------------------------------------------------------------------------
// Bestätigen / Verwerfen
// ---------------------------------------------------------------------------

const confirmPayloadSchema = z.object({
  date: z.string().nullable(),
  work_duration_hours: z.number().nonnegative().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  employeeId: z.string().nullable(),
  activities: z.array(z.string().min(1)).max(50),
  materials: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unit: z.string().min(1),
        unitPrice: z.number().nonnegative().nullable(),
        materialId: z.string().nullable(),
      }),
    )
    .max(100),
  notes: z.string().nullable(),
});

/**
 * Übernimmt einen geprüften (und ggf. korrigierten) KI-Vorschlag in den
 * Auftrag. Erst ab hier existieren die Daten als Leistung.
 */
export async function confirmExtractionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const extractionId = readString(formData, "extractionId");

    const extraction = await prisma.aiExtraction.findFirst({
      where: { id: extractionId, organizationId: session.organizationId },
    });
    if (!extraction) return formError("KI-Vorschlag nicht gefunden.");
    if (extraction.status !== "PENDING") {
      return formError("Dieser Vorschlag wurde bereits bearbeitet.");
    }

    let payloadRaw: unknown;
    try {
      payloadRaw = JSON.parse(readString(formData, "payload"));
    } catch {
      return formError("Die geprüften Daten konnten nicht gelesen werden.");
    }

    const parsed = confirmPayloadSchema.safeParse(payloadRaw);
    if (!parsed.success) {
      return formError(
        "Die geprüften Daten sind unvollständig. Bitte Mengen und Bezeichnungen prüfen.",
      );
    }
    const payload = parsed.data;

    if (payload.activities.length === 0 && payload.materials.length === 0) {
      return formError(
        "Es wurde nichts zum Übernehmen ausgewählt. Bitte mindestens eine Tätigkeit oder Materialposition behalten.",
      );
    }

    const jobId = extraction.jobId;
    const job = await requireJob(session, jobId);

    // Preise aus dem Katalog ergänzen, wo der Nutzer keinen Preis gesetzt hat.
    const catalog = await prisma.material.findMany({
      where: { organizationId: session.organizationId, active: true },
      select: {
        id: true,
        name: true,
        unit: true,
        aliases: true,
        defaultPrice: true,
      },
    });
    const catalogHints = catalog.map((material) => ({
      id: material.id,
      name: material.name,
      unit: material.unit,
      aliases: material.aliases,
      defaultPrice: material.defaultPrice ? Number(material.defaultPrice) : null,
    }));

    const performedAt = payload.date ? new Date(`${payload.date}T12:00:00`) : null;

    let employeeId: string | null = null;
    if (payload.employeeId) {
      const employee = await prisma.employee.findFirst({
        where: {
          id: payload.employeeId,
          organizationId: session.organizationId,
        },
        select: { id: true },
      });
      employeeId = employee?.id ?? null;
    }

    const activityStart = await prisma.jobActivity.count({ where: { jobId } });

    await prisma.$transaction(async (tx) => {
      if (payload.activities.length > 0) {
        await tx.jobActivity.createMany({
          data: payload.activities.map((description, index) => ({
            organizationId: session.organizationId,
            jobId,
            description,
            sortOrder: activityStart + index,
            source: "AI" as const,
          })),
        });
      }

      if (payload.work_duration_hours && payload.work_duration_hours > 0) {
        await tx.jobTimeEntry.create({
          data: {
            organizationId: session.organizationId,
            jobId,
            employeeId,
            date: performedAt ?? job.performedAt ?? new Date(),
            startTime: payload.start_time,
            endTime: payload.end_time,
            hours: payload.work_duration_hours,
            description: "Aus Sprachbericht übernommen",
            source: "AI",
          },
        });
      }

      for (const material of payload.materials) {
        const hint = material.materialId
          ? catalogHints.find((entry) => entry.id === material.materialId)
          : matchCatalog(material.description, catalogHints);

        await tx.jobMaterial.create({
          data: {
            organizationId: session.organizationId,
            jobId,
            materialId: hint?.id ?? null,
            description: material.description,
            quantity: material.quantity,
            unit: material.unit,
            unitPrice: material.unitPrice ?? hint?.defaultPrice ?? null,
            source: "AI",
          },
        });
      }

      if (payload.notes) {
        await tx.jobNote.create({
          data: {
            organizationId: session.organizationId,
            jobId,
            authorId: session.userId,
            text: payload.notes,
            source: "AI",
          },
        });
      }

      await tx.aiExtraction.update({
        where: { id: extractionId },
        data: {
          status: "CONFIRMED",
          reviewedAt: new Date(),
          confirmedById: session.userId,
          confirmedData: {
            ...parseExtraction(extraction.result),
            date: payload.date,
            work_duration_hours: payload.work_duration_hours,
            start_time: payload.start_time,
            end_time: payload.end_time,
            activities: payload.activities,
            materials: payload.materials.map((material) => ({
              description: material.description,
              quantity: material.quantity,
              unit: material.unit,
            })),
            notes: payload.notes,
          },
        },
      });

      const stillPending = await tx.aiExtraction.count({
        where: { jobId, status: "PENDING" },
      });

      if (!["INVOICED", "CLOSED", "CANCELLED"].includes(job.status)) {
        await tx.job.update({
          where: { id: jobId },
          data: {
            status: stillPending > 0 ? "NEEDS_REVIEW" : "IN_PROGRESS",
            performedAt: job.performedAt ?? performedAt ?? undefined,
          },
        });
      }
    });

    await audit(session, {
      action: "ai.extraction_confirm",
      entityType: "ai_extraction",
      entityId: extractionId,
      metadata: {
        jobId,
        activities: payload.activities.length,
        materials: payload.materials.length,
        hours: payload.work_duration_hours ?? 0,
      },
    });

    revalidateJob(jobId);
    return formSuccess("Daten übernommen.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function rejectExtractionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const extractionId = readString(formData, "extractionId");

    const extraction = await prisma.aiExtraction.findFirst({
      where: { id: extractionId, organizationId: session.organizationId },
      select: { id: true, jobId: true },
    });
    if (!extraction) return formError("KI-Vorschlag nicht gefunden.");

    await prisma.aiExtraction.update({
      where: { id: extractionId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        confirmedById: session.userId,
      },
    });

    const stillPending = await prisma.aiExtraction.count({
      where: { jobId: extraction.jobId, status: "PENDING" },
    });
    if (stillPending === 0) {
      await prisma.job.updateMany({
        where: {
          id: extraction.jobId,
          organizationId: session.organizationId,
          status: "NEEDS_REVIEW",
        },
        data: { status: "IN_PROGRESS" },
      });
    }

    await audit(session, {
      action: "ai.extraction_reject",
      entityType: "ai_extraction",
      entityId: extractionId,
      metadata: { jobId: extraction.jobId },
    });

    revalidateJob(extraction.jobId);
    return formSuccess("Vorschlag verworfen.");
  } catch (error) {
    return toFormState(error);
  }
}

/** Optionaler Hinweis in der UI: Läuft das System gerade mit Mock-Providern? */
export async function getProviderStatus(): Promise<{
  ai: string;
  stt: string;
}> {
  return { ai: getAiProvider().name, stt: getSttProvider().name };
}
