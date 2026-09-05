import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { JobForm } from "./job-form";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";

export const metadata: Metadata = { title: "Neuer Auftrag" };

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ kunde?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const [customers, employees, organization] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: session.organizationId, archivedAt: null },
      select: {
        id: true,
        name: true,
        sites: { select: { id: true, label: true }, orderBy: { label: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { organizationId: session.organizationId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { defaultHourlyRate: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Neuer Auftrag"
        backHref="/auftraege"
        backLabel="Aufträge"
      />

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            title="Zuerst wird ein Kunde gebraucht"
            description="Ein Auftrag gehört immer zu einem Kunden. Legen Sie zuerst einen Kunden an."
            action={
              <Button asChild>
                <Link href="/kunden/neu">
                  <Plus aria-hidden />
                  Kunde anlegen
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <JobForm
          customers={customers}
          employees={employees}
          defaultHourlyRate={toNumber(organization.defaultHourlyRate)}
          presetCustomerId={params.kunde}
        />
      )}
    </>
  );
}
