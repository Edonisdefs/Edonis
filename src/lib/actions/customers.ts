"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, requireSession } from "@/lib/auth/session";
import { requireCustomer } from "@/lib/auth/tenancy";
import { nextCustomerNumber } from "@/lib/domain/numbering";
import {
  formError,
  formSuccess,
  readNumber,
  readOptionalString,
  readString,
  toFormState,
  zodErrors,
  type FormState,
} from "./state";

const customerSchema = z.object({
  name: z.string().min(2, "Bitte Namen eingeben."),
  type: z.enum(["PRIVATE", "COMPANY"]),
  contactPerson: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  street: z.string().nullable(),
  zip: z.string().nullable(),
  city: z.string().nullable(),
  vatId: z.string().nullable(),
  notes: z.string().nullable(),
  hourlyRate: z.number().positive().nullable(),
});

function readCustomerForm(formData: FormData) {
  return customerSchema.safeParse({
    name: readString(formData, "name"),
    type: readString(formData, "type") === "COMPANY" ? "COMPANY" : "PRIVATE",
    contactPerson: readOptionalString(formData, "contactPerson"),
    email: readOptionalString(formData, "email"),
    phone: readOptionalString(formData, "phone"),
    street: readOptionalString(formData, "street"),
    zip: readOptionalString(formData, "zip"),
    city: readOptionalString(formData, "city"),
    vatId: readOptionalString(formData, "vatId"),
    notes: readOptionalString(formData, "notes"),
    hourlyRate: readNumber(formData, "hourlyRate"),
  });
}

export async function createCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const parsed = readCustomerForm(formData);
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    const customer = await prisma.customer.create({
      data: {
        organizationId: session.organizationId,
        customerNumber: await nextCustomerNumber(session.organizationId),
        ...parsed.data,
      },
      select: { id: true },
    });

    await audit(session, {
      action: "customer.create",
      entityType: "customer",
      entityId: customer.id,
    });

    revalidatePath("/kunden");
    return formSuccess("Kunde angelegt.", { id: customer.id });
  } catch (error) {
    return toFormState(error);
  }
}

export async function updateCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const customerId = readString(formData, "customerId");
    await requireCustomer(session, customerId);

    const parsed = readCustomerForm(formData);
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: parsed.data,
    });

    await audit(session, {
      action: "customer.update",
      entityType: "customer",
      entityId: customerId,
    });

    revalidatePath("/kunden");
    revalidatePath(`/kunden/${customerId}`);
    return formSuccess("Änderungen gespeichert.");
  } catch (error) {
    return toFormState(error);
  }
}

/**
 * Endgültiges Löschen (DSGVO, Art. 17). Bestehende Rechnungen sind
 * aufbewahrungspflichtig – dann wird stattdessen archiviert.
 */
export async function deleteCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    assertRole(session, "OWNER");

    const customerId = readString(formData, "customerId");
    await requireCustomer(session, customerId);

    const [invoiceCount, jobCount] = await Promise.all([
      prisma.invoice.count({
        where: { customerId, organizationId: session.organizationId },
      }),
      prisma.job.count({
        where: { customerId, organizationId: session.organizationId },
      }),
    ]);

    if (invoiceCount > 0) {
      return formError(
        "Zu diesem Kunden gibt es Rechnungen. Rechnungen unterliegen der Aufbewahrungspflicht – der Kunde kann nur archiviert werden.",
      );
    }
    if (jobCount > 0) {
      return formError(
        `Zu diesem Kunden gibt es noch ${jobCount} Auftrag/Aufträge. Bitte zuerst die Aufträge löschen.`,
      );
    }

    await prisma.customer.delete({ where: { id: customerId } });

    await audit(session, {
      action: "customer.delete",
      entityType: "customer",
      entityId: customerId,
    });

    revalidatePath("/kunden");
    return formSuccess("Kunde vollständig gelöscht.");
  } catch (error) {
    return toFormState(error);
  }
}

export async function archiveCustomerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const customerId = readString(formData, "customerId");
    const customer = await requireCustomer(session, customerId);

    await prisma.customer.update({
      where: { id: customerId },
      data: { archivedAt: customer.archivedAt ? null : new Date() },
    });

    await audit(session, {
      action: "customer.update",
      entityType: "customer",
      entityId: customerId,
      metadata: { archived: !customer.archivedAt },
    });

    revalidatePath("/kunden");
    revalidatePath(`/kunden/${customerId}`);
    return formSuccess(
      customer.archivedAt ? "Kunde reaktiviert." : "Kunde archiviert.",
    );
  } catch (error) {
    return toFormState(error);
  }
}

const siteSchema = z.object({
  label: z.string().min(2, "Bitte Bezeichnung der Baustelle eingeben."),
  street: z.string().nullable(),
  zip: z.string().nullable(),
  city: z.string().nullable(),
  notes: z.string().nullable(),
});

export async function createSiteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const customerId = readString(formData, "customerId");
    await requireCustomer(session, customerId);

    const parsed = siteSchema.safeParse({
      label: readString(formData, "label"),
      street: readOptionalString(formData, "street"),
      zip: readOptionalString(formData, "zip"),
      city: readOptionalString(formData, "city"),
      notes: readOptionalString(formData, "notes"),
    });
    if (!parsed.success) {
      return formError("Bitte Eingaben prüfen.", zodErrors(parsed.error));
    }

    const site = await prisma.site.create({
      data: {
        organizationId: session.organizationId,
        customerId,
        ...parsed.data,
      },
      select: { id: true },
    });

    await audit(session, {
      action: "site.create",
      entityType: "site",
      entityId: site.id,
    });

    revalidatePath("/baustellen");
    revalidatePath(`/kunden/${customerId}`);
    return formSuccess("Baustelle angelegt.", { id: site.id });
  } catch (error) {
    return toFormState(error);
  }
}

export async function deleteSiteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const session = await requireSession();
    const siteId = readString(formData, "siteId");

    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: session.organizationId },
      select: { id: true, customerId: true, _count: { select: { jobs: true } } },
    });
    if (!site) return formError("Baustelle nicht gefunden.");
    if (site._count.jobs > 0) {
      return formError(
        "Zu dieser Baustelle gibt es noch Aufträge. Bitte diese zuerst umziehen oder löschen.",
      );
    }

    await prisma.site.delete({ where: { id: siteId } });
    await audit(session, {
      action: "customer.update",
      entityType: "site",
      entityId: siteId,
    });

    revalidatePath("/baustellen");
    revalidatePath(`/kunden/${site.customerId}`);
    return formSuccess("Baustelle gelöscht.");
  } catch (error) {
    return toFormState(error);
  }
}
