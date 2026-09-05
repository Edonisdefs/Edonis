import "server-only";

import { NextResponse } from "next/server";

/**
 * Einheitliche Fehlerantworten für Route Handler.
 * Nach außen geht nur eine verständliche Meldung – Stacktraces und
 * technische Details bleiben im Serverlog.
 */
export function apiError(error: unknown): NextResponse {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;

  const message =
    error instanceof Error && status !== 500
      ? error.message
      : "Da ist etwas schiefgelaufen. Bitte erneut versuchen.";

  if (status === 500) {
    console.error("[api] Unerwarteter Fehler", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({ error: message }, { status });
}
