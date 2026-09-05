import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { processVoiceNote, storeVoiceNote } from "@/lib/services/voice-service";

export const runtime = "nodejs";
/** Transkription und KI-Auswertung laufen synchron – etwas mehr Zeit geben. */
export const maxDuration = 60;

/**
 * Sprachnachricht hochladen, transkribieren und auswerten – in einem Aufruf.
 * Der Monteur drückt einmal auf Stopp und sieht danach das Ergebnis.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession();
    const { id: jobId } = await context.params;

    const formData = await request.formData();
    const file = formData.get("audio");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Es wurde keine Aufnahme übermittelt." },
        { status: 400 },
      );
    }

    const durationRaw = formData.get("durationSec");
    const durationSec =
      typeof durationRaw === "string" && durationRaw
        ? Math.max(0, Math.round(Number(durationRaw)))
        : null;

    const voiceNote = await storeVoiceNote(session, {
      jobId,
      file,
      durationSec: Number.isFinite(durationSec) ? durationSec : null,
    });

    const result = await processVoiceNote(session, voiceNote.id);

    return NextResponse.json({
      voiceNoteId: result.voiceNoteId,
      extractionId: result.extractionId,
      transcript: result.transcript,
      failed: result.failed,
      message: result.message,
    });
  } catch (error) {
    return apiError(error);
  }
}
