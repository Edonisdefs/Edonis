"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { recordAudit } from "@/lib/audit";
import {
  burnPasswordTime,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { getTradeConfig } from "@/lib/domain/trades";
import {
  formError,
  readString,
  toFormState,
  zodErrors,
  type FormState,
} from "./state";

const loginSchema = z.object({
  email: z.string().min(3, "Bitte E-Mail-Adresse eingeben.").toLowerCase(),
  password: z.string().min(1, "Bitte Passwort eingeben."),
});

const signupSchema = z.object({
  company: z.string().min(2, "Bitte Firmennamen eingeben."),
  name: z.string().min(2, "Bitte Ihren Namen eingeben."),
  email: z
    .string()
    .regex(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      "Bitte gültige E-Mail-Adresse eingeben.",
    )
    .toLowerCase(),
  password: z.string().min(10, "Das Passwort muss mindestens 10 Zeichen haben."),
});

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "betrieb"
  );
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let target = "/";
  try {
    const parsed = loginSchema.safeParse({
      email: readString(formData, "email"),
      password: readString(formData, "password"),
    });
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        passwordHash: true,
        active: true,
        organizationId: true,
      },
    });

    // Immer dieselbe Meldung und Laufzeit – so lässt sich nicht ermitteln,
    // welche E-Mail-Adressen registriert sind.
    if (!user || !user.active) {
      await burnPasswordTime();
      return formError("E-Mail-Adresse oder Passwort ist falsch.");
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      await recordAudit(
        { organizationId: user.organizationId, userId: user.id },
        { action: "auth.login_failed", entityType: "user", entityId: user.id },
      );
      return formError("E-Mail-Adresse oder Passwort ist falsch.");
    }

    const headerList = await headers();
    await createSession({
      userId: user.id,
      organizationId: user.organizationId,
      userAgent: headerList.get("user-agent"),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await recordAudit(
      { organizationId: user.organizationId, userId: user.id },
      { action: "auth.login", entityType: "user", entityId: user.id },
    );

    const requested = readString(formData, "redirectTo");
    if (requested.startsWith("/") && !requested.startsWith("//")) {
      target = requested;
    }
  } catch (error) {
    return toFormState(error);
  }

  redirect(target);
}

export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    if (!getEnv().ALLOW_SIGNUP) {
      return formError(
        "Die Selbstregistrierung ist deaktiviert. Bitte wenden Sie sich an Ihren Administrator.",
      );
    }

    const parsed = signupSchema.safeParse({
      company: readString(formData, "company"),
      name: readString(formData, "name"),
      email: readString(formData, "email"),
      password: readString(formData, "password"),
    });
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return formError("Für diese E-Mail-Adresse besteht bereits ein Zugang.", {
        email: ["Bereits vergeben."],
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    let slug = slugify(parsed.data.company);
    while (
      await prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      })
    ) {
      slug = `${slugify(parsed.data.company)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
    }

    const organization = await prisma.organization.create({
      data: {
        name: parsed.data.company,
        slug,
        trade: "SHK",
        ownerName: parsed.data.name,
        email: parsed.data.email,
        users: {
          create: {
            email: parsed.data.email,
            name: parsed.data.name,
            passwordHash,
            role: "OWNER",
          },
        },
      },
      include: { users: true },
    });

    // Startkatalog des Gewerks, damit die KI sofort Material zuordnen kann.
    const catalog = getTradeConfig(organization.trade).catalog;
    if (catalog.length > 0) {
      await prisma.material.createMany({
        data: catalog.map((entry) => ({
          organizationId: organization.id,
          sku: entry.sku,
          name: entry.name,
          category: entry.category,
          unit: entry.unit,
          defaultPrice: entry.defaultPrice ?? undefined,
          aliases: entry.aliases,
        })),
      });
    }

    const owner = organization.users[0];
    if (!owner) {
      return formError("Der Zugang konnte nicht angelegt werden.");
    }

    const headerList = await headers();
    await createSession({
      userId: owner.id,
      organizationId: organization.id,
      userAgent: headerList.get("user-agent"),
    });

    await recordAudit(
      { organizationId: organization.id, userId: owner.id },
      {
        action: "auth.signup",
        entityType: "organization",
        entityId: organization.id,
      },
    );
  } catch (error) {
    return toFormState(error);
  }

  redirect("/einstellungen?willkommen=1");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    await recordAudit(
      { organizationId: session.organizationId, userId: session.userId },
      { action: "auth.logout", entityType: "user", entityId: session.userId },
    );
  }
  await destroySession();
  redirect("/login");
}
