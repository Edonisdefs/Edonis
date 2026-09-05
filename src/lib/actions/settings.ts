"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Trade } from "@prisma/client";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, requireSession } from "@/lib/auth/session";
import {
  formError,
  formSuccess,
  readBoolean,
  readNumber,
  readOptionalString,
  readString,
  toFormState,
  zodErrors,
  type FormState,
} from "./state";

const organizationSchema = z.object({
  name: z.string().min(2, "Bitte Betriebsnamen eingeben."),
  legalName: z.string().nullable(),
  ownerName: z.string().nullable(),
  street: z.string().nullable(),
  zip: z.string().nullable(),
  city: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  taxNumber: z.string().nullable(),
  vatId: z.string().nullable(),
  registerInfo: z.string().nullable(),
  bankName: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  invoiceFooterNote: z.string().nullable(),
  defaultHourlyRate: z
    .number()
    .positive("Der Stundensatz muss größer als 0 sein."),
  defaultVatRate: z.number().min(0).max(100),
  travelFlatRate: z.number().min(0),
  paymentTermsDays: z.number().int().min(0).max(120),
  smallBusiness: z.boolean(),
  trade: z.enum([
    "SHK",
    "ELEKTRO",
    "MALER",
    "DACHDECKER",
    "SCHREINER",
    "BAU",
    "SONSTIGES",
  ]),
});

export async function updateOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OWNER");

    const parsed = organizationSchema.safeParse({
      name: readString(formData, "name"),
      legalName: readOptionalString(formData, "legalName"),
      ownerName: readOptionalString(formData, "ownerName"),
      street: readOptionalString(formData, "street"),
      zip: readOptionalString(formData, "zip"),
      city: readOptionalString(formData, "city"),
      email: readOptionalString(formData, "email"),
      phone: readOptionalString(formData, "phone"),
      website: readOptionalString(formData, "website"),
      taxNumber: readOptionalString(formData, "taxNumber"),
      vatId: readOptionalString(formData, "vatId"),
      registerInfo: readOptionalString(formData, "registerInfo"),
      bankName: readOptionalString(formData, "bankName"),
      iban: readOptionalString(formData, "iban"),
      bic: readOptionalString(formData, "bic"),
      invoiceFooterNote: readOptionalString(formData, "invoiceFooterNote"),
      defaultHourlyRate: readNumber(formData, "defaultHourlyRate") ?? 0,
      defaultVatRate: readNumber(formData, "defaultVatRate") ?? 19,
      travelFlatRate: readNumber(formData, "travelFlatRate") ?? 0,
      paymentTermsDays: readNumber(formData, "paymentTermsDays") ?? 14,
      smallBusiness: readBoolean(formData, "smallBusiness"),
      trade: (readString(formData, "trade") || "SHK") as Trade,
    });

    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    await prisma.organization.update({
      where: { id: session.organizationId },
      data: parsed.data,
    });

    await audit(session, {
      action: "settings.update",
      entityType: "organization",
      entityId: session.organizationId,
    });

    revalidatePath("/einstellungen");
    revalidatePath("/");
    return formSuccess("Einstellungen gespeichert.");
  } catch (error) {
    return toFormState(error);
  }
}

const employeeSchema = z.object({
  name: z.string().min(2, "Bitte Namen eingeben."),
  role: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  hourlyRate: z.number().positive().nullable(),
});

export async function createEmployeeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OWNER");

    const parsed = employeeSchema.safeParse({
      name: readString(formData, "name"),
      role: readOptionalString(formData, "role"),
      email: readOptionalString(formData, "email"),
      phone: readOptionalString(formData, "phone"),
      hourlyRate: readNumber(formData, "hourlyRate"),
    });
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    await prisma.employee.create({
      data: { organizationId: session.organizationId, ...parsed.data },
    });

    revalidatePath("/einstellungen");
    return formSuccess("Mitarbeiter angelegt.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteEmployeeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OWNER");

    const id = readString(formData, "id");
    const employee = await prisma.employee.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!employee) return formError("Mitarbeiter nicht gefunden.");

    // Zeiteinträge bleiben erhalten (Nachvollziehbarkeit), der Bezug wird
    // beim Löschen automatisch auf null gesetzt.
    await prisma.employee.delete({ where: { id } });

    revalidatePath("/einstellungen");
    return formSuccess("Mitarbeiter entfernt.");
  } catch (error) {
    return toFormState(error);
  }
}

const materialSchema = z.object({
  name: z.string().min(2, "Bitte Bezeichnung eingeben."),
  sku: z.string().nullable(),
  category: z.string().nullable(),
  unit: z.string().min(1),
  defaultPrice: z.number().min(0).nullable(),
});

export async function createMaterialAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const parsed = materialSchema.safeParse({
      name: readString(formData, "name"),
      sku: readOptionalString(formData, "sku"),
      category: readOptionalString(formData, "category"),
      unit: readString(formData, "unit") || "Stück",
      defaultPrice: readNumber(formData, "defaultPrice"),
    });
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    const aliases = readString(formData, "aliases")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);

    await prisma.material.create({
      data: {
        organizationId: session.organizationId,
        ...parsed.data,
        aliases,
      },
    });

    revalidatePath("/einstellungen");
    return formSuccess("Material im Katalog gespeichert.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateMaterialAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const id = readString(formData, "id");
    const material = await prisma.material.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!material) return formError("Material nicht gefunden.");

    const price = readNumber(formData, "defaultPrice");
    await prisma.material.update({
      where: { id },
      data: {
        defaultPrice: price,
        unit: readString(formData, "unit") || undefined,
      },
    });

    revalidatePath("/einstellungen");
    return formSuccess("Katalogpreis aktualisiert.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteMaterialAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OFFICE");

    const id = readString(formData, "id");
    const material = await prisma.material.findFirst({
      where: { id, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!material) return formError("Material nicht gefunden.");

    await prisma.material.update({ where: { id }, data: { active: false } });

    revalidatePath("/einstellungen");
    return formSuccess("Material deaktiviert.");
  } catch (error) {
    return toFormState(error);
  }
}
