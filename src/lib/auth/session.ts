import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "edonis_session";
const SESSION_TTL_DAYS = 30;

export type SessionContext = {
  sessionId: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  userName: string;
  userEmail: string;
  organizationName: string;
};

/**
 * Der Cookie enthält nur ein zufälliges Token. In der Datenbank liegt
 * ausschließlich dessen HMAC – ein Datenbank-Leak erlaubt damit keine
 * Übernahme bestehender Sitzungen.
 */
function hashToken(token: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function createSession(params: {
  userId: string;
  organizationId: string;
  userAgent?: string | null;
}): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      tokenHash: hashToken(token),
      userAgent: params.userAgent?.slice(0, 255) ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Liest die aktuelle Sitzung. Pro Request gecached, damit Layout, Seite und
 * Server Actions nicht mehrfach die Datenbank befragen.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (!session.user.active) return null;

  return {
    sessionId: session.id,
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
    userName: session.user.name,
    userEmail: session.user.email,
    organizationName: session.user.organization.name,
  };
});

/** Für Server Components / Server Actions: erzwingt eine gültige Sitzung. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Für Route Handler: wirft statt umzuleiten. */
export async function requireApiSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Nicht angemeldet.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Keine Berechtigung für diese Aktion.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Nicht gefunden.") {
    super(message);
    this.name = "NotFoundError";
  }
}

const ROLE_RANK: Record<UserRole, number> = {
  FIELD: 1,
  OFFICE: 2,
  OWNER: 3,
};

export function hasRole(session: SessionContext, minimum: UserRole): boolean {
  return ROLE_RANK[session.role] >= ROLE_RANK[minimum];
}

export function assertRole(session: SessionContext, minimum: UserRole): void {
  if (!hasRole(session, minimum)) {
    throw new ForbiddenError(
      "Für diese Aktion fehlt die Berechtigung. Bitte an die Betriebsleitung wenden.",
    );
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
