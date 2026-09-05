import { z } from "zod";

/** Einheitlicher Rückgabetyp aller Server Actions (für `useActionState`). */
export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Optionale Nutzlast, z.B. die ID eines neu erstellten Datensatzes. */
  data?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function formError(
  message: string,
  fieldErrors?: Record<string, string[]>,
): FormState {
  return { status: "error", message, fieldErrors };
}

export function formSuccess(
  message?: string,
  data?: Record<string, string>,
): FormState {
  return { status: "success", message, data };
}

export function zodErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

/**
 * Übersetzt geworfene Fehler in eine Meldung für die Oberfläche.
 * Technische Details bleiben im Serverlog – sie gehören nicht in die UI und
 * könnten personenbezogene Daten enthalten.
 */
export function toFormState(error: unknown): FormState {
  if (error instanceof z.ZodError) {
    return formError("Bitte Eingaben prüfen.", zodErrors(error));
  }
  if (error instanceof Error) {
    const known = ["UnauthorizedError", "ForbiddenError", "NotFoundError"];
    if (known.includes(error.name)) {
      return formError(error.message);
    }
    if (error.name === "AiExtractionError" || error.name === "TranscriptionError") {
      return formError(error.message);
    }
  }
  console.error("[action] Unerwarteter Fehler", {
    name: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : String(error),
  });
  return formError(
    "Da ist etwas schiefgelaufen. Bitte erneut versuchen oder Support kontaktieren.",
  );
}

/** Hilfsfunktionen zum Lesen von FormData. */
export function readString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function readOptionalString(
  form: FormData,
  key: string,
): string | null {
  const value = readString(form, key);
  return value.length > 0 ? value : null;
}

export function readNumber(form: FormData, key: string): number | null {
  const raw = readString(form, key);
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readDate(form: FormData, key: string): Date | null {
  const raw = readString(form, key);
  if (!raw) return null;
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function readBoolean(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === "on" || value === "true" || value === "1";
}
