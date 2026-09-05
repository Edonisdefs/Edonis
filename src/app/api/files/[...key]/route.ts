import { NextResponse } from "next/server";

import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/auth/session";
import { getStorage, orgPrefix } from "@/lib/providers/storage";

export const runtime = "nodejs";

/**
 * Liefert gespeicherte Dateien aus (Fotos, Sprachaufnahmen, PDFs).
 *
 * Mandantentrennung: Der Schlüssel muss mit dem Präfix der eigenen
 * Organisation beginnen. Ein fremder Schlüssel ergibt 404 – auch dann, wenn
 * die Datei existiert.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  try {
    const session = await requireApiSession();
    const { key: segments } = await context.params;
    const key = segments.join("/");

    if (!key.startsWith(`${orgPrefix(session.organizationId)}/`)) {
      return NextResponse.json(
        { error: "Datei nicht gefunden." },
        { status: 404 },
      );
    }

    const storage = getStorage();

    // S3-kompatible Provider liefern eine signierte URL – dann muss die Datei
    // nicht durch die Anwendung gestreamt werden.
    const signed = await storage.signedUrl(key, 300);
    if (signed) return NextResponse.redirect(signed);

    const file = await storage.get(key);
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": `${file.body.length}`,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
