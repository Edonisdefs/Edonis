import "server-only";

import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { SessionContext } from "@/lib/auth/session";

/**
 * Audit-Log für kritische Aktionen.
 *
 * Datenschutz: Es werden bewusst keine Inhalte (Transkripte, Notizen,
 * Kundendaten) protokolliert – nur Aktion, Entitätsreferenz und wenige
 * unkritische Kennzahlen. IP-Adressen werden gekürzt gespeichert.
 */

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.signup"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "site.create"
  | "job.create"
  | "job.update"
  | "job.delete"
  | "job.status_change"
  | "voice_note.upload"
  | "voice_note.transcribe"
  | "photo.upload"
  | "photo.delete"
  | "ai.extract"
  | "ai.extraction_confirm"
  | "ai.extraction_reject"
  | "service_report.create"
  | "invoice.create_draft"
  | "invoice.update"
  | "invoice.release"
  | "invoice.mark_paid"
  | "invoice.cancel"
  | "invoice.pdf_generate"
  | "settings.update";

type AuditInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const MAX_METADATA_KEYS = 20;

/** Verkürzt IPv4 auf /24 bzw. IPv6 auf /48 – Nachvollziehbarkeit ohne volle Identifizierbarkeit. */
function anonymizeIp(raw: string | null): string | null {
  if (!raw) return null;
  const ip = raw.split(",")[0]?.trim();
  if (!ip) return null;
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 3).join(":") + "::";
  }
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  return null;
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;
  const entries = Object.entries(metadata).slice(0, MAX_METADATA_KEYS);
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      result[key] = value.length > 200 ? `${value.slice(0, 200)}…` : value;
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      Array.isArray(value)
    ) {
      result[key] = value;
    } else {
      result[key] = String(value).slice(0, 200);
    }
  }
  return result;
}

export async function recordAudit(
  context: { organizationId: string; userId?: string | null },
  input: AuditInput,
): Promise<void> {
  let ip: string | null = null;
  try {
    const headerList = await headers();
    ip = anonymizeIp(
      headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip"),
    );
  } catch {
    // Außerhalb eines Requests (z.B. Seed) gibt es keine Header.
  }

  try {
    await prisma.auditLog.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata:
          (sanitizeMetadata(input.metadata) as Prisma.InputJsonValue | null) ??
          undefined,
        ip,
      },
    });
  } catch (error) {
    // Ein fehlgeschlagenes Audit-Log darf die Fachaktion nicht abbrechen,
    // muss aber sichtbar sein.
    console.error("[audit] Eintrag konnte nicht geschrieben werden", {
      action: input.action,
      error: error instanceof Error ? error.message : "unbekannt",
    });
  }
}

export async function audit(
  session: SessionContext,
  input: AuditInput,
): Promise<void> {
  await recordAudit(
    { organizationId: session.organizationId, userId: session.userId },
    input,
  );
}
