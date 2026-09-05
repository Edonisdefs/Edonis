import "server-only";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { NotFoundError, type SessionContext } from "@/lib/auth/session";
import { requireJob } from "@/lib/auth/tenancy";
import { getAiProvider } from "@/lib/ai";
import { getSttProvider } from "@/lib/providers/stt";
import { buildKey, getStorage } from "@/lib/providers/storage";
import { buildExtractionContext } from "@/lib/services/job-service";

/**
 * Die Sprach-Pipeline an einer Stelle:
 * Upload → Speech-to-Text → KI-Extraktion → Vorschlag zur Prüfung.
 *
 * Der Auftrag selbst wird dabei nicht verändert – es entsteht ausschließlich
 * ein `AiExtraction` im Status PENDING.
 */

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB ≈ 30 Minuten Sprachaufnahme
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const ALLOWED_AUDIO = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
];

const ALLOWED_IMAGES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export class UploadError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/aac": "aac",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[mimeType] ?? "bin";
}

/** Nimmt eine hochgeladene Sprachaufnahme entgegen und legt sie ab. */
export async function storeVoiceNote(
  session: SessionContext,
  params: {
    jobId: string;
    file: File;
    durationSec: number | null;
  },
): Promise<{ id: string }> {
  await requireJob(session, params.jobId);

  const mimeType = (params.file.type || "audio/webm").split(";")[0]!.trim();
  if (!ALLOWED_AUDIO.includes(mimeType)) {
    throw new UploadError(
      "Dieses Audioformat wird nicht unterstützt. Bitte direkt in der App aufnehmen.",
    );
  }
  if (params.file.size === 0) {
    throw new UploadError("Die Aufnahme ist leer.");
  }
  if (params.file.size > MAX_AUDIO_BYTES) {
    throw new UploadError(
      "Die Aufnahme ist zu groß (max. 25 MB). Bitte kürzer aufnehmen.",
    );
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const id = crypto.randomUUID();
  const filename = `${id}.${extensionFor(mimeType)}`;
  const key = buildKey(
    session.organizationId,
    "jobs",
    params.jobId,
    "voice",
    filename,
  );

  await getStorage().put(key, buffer, { contentType: mimeType });

  const voiceNote = await prisma.voiceNote.create({
    data: {
      organizationId: session.organizationId,
      jobId: params.jobId,
      recordedById: session.userId,
      storageKey: key,
      filename,
      mimeType,
      size: buffer.length,
      durationSec: params.durationSec,
      status: "UPLOADED",
    },
    select: { id: true },
  });

  await audit(session, {
    action: "voice_note.upload",
    entityType: "voice_note",
    entityId: voiceNote.id,
    metadata: { jobId: params.jobId, bytes: buffer.length },
  });

  return voiceNote;
}

/** Baustellenfotos speichern und dem Auftrag zuordnen. */
export async function storeJobPhoto(
  session: SessionContext,
  params: { jobId: string; file: File; caption: string | null },
): Promise<{ id: string }> {
  await requireJob(session, params.jobId);

  const mimeType = (params.file.type || "").split(";")[0]!.trim();
  if (!ALLOWED_IMAGES.includes(mimeType)) {
    throw new UploadError(
      "Nur JPG-, PNG-, WebP- oder HEIC-Bilder können hochgeladen werden.",
    );
  }
  if (params.file.size > MAX_IMAGE_BYTES) {
    throw new UploadError("Das Foto ist zu groß (max. 15 MB).");
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const id = crypto.randomUUID();
  const filename = `${id}.${extensionFor(mimeType)}`;
  const key = buildKey(
    session.organizationId,
    "jobs",
    params.jobId,
    "photos",
    filename,
  );

  await getStorage().put(key, buffer, { contentType: mimeType });

  const photo = await prisma.jobPhoto.create({
    data: {
      organizationId: session.organizationId,
      jobId: params.jobId,
      uploadedById: session.userId,
      storageKey: key,
      filename: params.file.name || filename,
      mimeType,
      size: buffer.length,
      caption: params.caption,
    },
    select: { id: true },
  });

  await audit(session, {
    action: "photo.upload",
    entityType: "job_photo",
    entityId: photo.id,
    metadata: { jobId: params.jobId, bytes: buffer.length },
  });

  return photo;
}

/**
 * Erzeugt aus einem Text einen KI-Vorschlag. Fehler der KI werden als
 * fehlgeschlagene Extraktion festgehalten statt verworfen – der Monteur soll
 * sehen, dass etwas nicht geklappt hat.
 */
export async function createExtractionForJob(
  session: SessionContext,
  params: {
    jobId: string;
    text: string;
    voiceNoteId?: string | null;
    source: "VOICE" | "TEXT";
  },
): Promise<{ id: string; failed: boolean }> {
  const context = await buildExtractionContext(session, params.jobId);
  const provider = getAiProvider();

  try {
    const outcome = await provider.extractJobReport({
      text: params.text,
      context,
    });

    const extraction = await prisma.aiExtraction.create({
      data: {
        organizationId: session.organizationId,
        jobId: params.jobId,
        voiceNoteId: params.voiceNoteId ?? null,
        source: params.source,
        inputText: params.text,
        result: outcome.extraction,
        confidence: outcome.extraction.confidence,
        missing: outcome.extraction.missing_information,
        status: "PENDING",
        provider: outcome.provider,
        model: outcome.model,
      },
      select: { id: true },
    });

    await prisma.job.updateMany({
      where: {
        id: params.jobId,
        organizationId: session.organizationId,
        status: { notIn: ["INVOICED", "CLOSED", "CANCELLED"] },
      },
      data: { status: "NEEDS_REVIEW" },
    });

    await audit(session, {
      action: "ai.extract",
      entityType: "ai_extraction",
      entityId: extraction.id,
      metadata: {
        jobId: params.jobId,
        provider: outcome.provider,
        confidence: outcome.extraction.confidence,
        missing: outcome.extraction.missing_information.length,
      },
    });

    return { id: extraction.id, failed: false };
  } catch (error) {
    const extraction = await prisma.aiExtraction.create({
      data: {
        organizationId: session.organizationId,
        jobId: params.jobId,
        voiceNoteId: params.voiceNoteId ?? null,
        source: params.source,
        inputText: params.text,
        result: {},
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler bei der KI-Auswertung.",
      },
      select: { id: true },
    });
    return { id: extraction.id, failed: true };
  }
}

export type VoiceProcessingResult = {
  voiceNoteId: string;
  transcript: string;
  extractionId: string | null;
  failed: boolean;
  message: string;
};

/** Sprachnachricht transkribieren und direkt auswerten. */
export async function processVoiceNote(
  session: SessionContext,
  voiceNoteId: string,
): Promise<VoiceProcessingResult> {
  const voiceNote = await prisma.voiceNote.findFirst({
    where: { id: voiceNoteId, organizationId: session.organizationId },
  });
  if (!voiceNote) throw new NotFoundError("Sprachnachricht nicht gefunden.");

  await prisma.voiceNote.update({
    where: { id: voiceNote.id },
    data: { status: "TRANSCRIBING", error: null },
  });

  let transcript: string;
  try {
    const file = await getStorage().get(voiceNote.storageKey);
    const result = await getSttProvider().transcribe({
      audio: file.body,
      filename: voiceNote.filename,
      mimeType: voiceNote.mimeType,
      language: "de",
    });
    transcript = result.text.trim();

    await prisma.voiceNote.update({
      where: { id: voiceNote.id },
      data: {
        status: "TRANSCRIBED",
        transcript,
        transcriptLang: result.language,
        sttProvider: result.provider,
        sttModel: result.model,
        durationSec: voiceNote.durationSec ?? result.durationSec,
        transcribedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.voiceNote.update({
      where: { id: voiceNote.id },
      data: {
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Transkription fehlgeschlagen.",
      },
    });
    throw error;
  }

  await audit(session, {
    action: "voice_note.transcribe",
    entityType: "voice_note",
    entityId: voiceNote.id,
    // Bewusst nur die Länge, nicht der Inhalt: Transkripte enthalten
    // personenbezogene Daten und gehören nicht ins Audit-Log.
    metadata: { chars: transcript.length },
  });

  if (transcript.length < 5) {
    return {
      voiceNoteId: voiceNote.id,
      transcript,
      extractionId: null,
      failed: true,
      message:
        "In der Aufnahme war kein Text zu erkennen. Bitte noch einmal aufnehmen.",
    };
  }

  const extraction = await createExtractionForJob(session, {
    jobId: voiceNote.jobId,
    text: transcript,
    voiceNoteId: voiceNote.id,
    source: "VOICE",
  });

  return {
    voiceNoteId: voiceNote.id,
    transcript,
    extractionId: extraction.id,
    failed: extraction.failed,
    message: extraction.failed
      ? "Die Aufnahme wurde gespeichert, die KI-Auswertung ist aber fehlgeschlagen."
      : "Aufnahme ausgewertet. Bitte Ergebnis prüfen.",
  };
}
