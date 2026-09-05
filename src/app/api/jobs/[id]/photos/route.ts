import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { storeJobPhoto } from "@/lib/services/voice-service";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Mehrere Baustellenfotos gleichzeitig hochladen. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession();
    const { id: jobId } = await context.params;

    const formData = await request.formData();
    const files = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Es wurden keine Fotos übermittelt." },
        { status: 400 },
      );
    }
    if (files.length > 20) {
      return NextResponse.json(
        { error: "Bitte höchstens 20 Fotos auf einmal hochladen." },
        { status: 400 },
      );
    }

    const caption = formData.get("caption");
    const ids: string[] = [];
    for (const file of files) {
      const photo = await storeJobPhoto(session, {
        jobId,
        file,
        caption: typeof caption === "string" && caption ? caption : null,
      });
      ids.push(photo.id);
    }

    return NextResponse.json({ uploaded: ids.length, ids });
  } catch (error) {
    return apiError(error);
  }
}
