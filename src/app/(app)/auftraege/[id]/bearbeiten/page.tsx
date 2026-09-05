import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobForm } from "../../neu/job-form";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toNumber, toNumberOrNull } from "@/lib/money";

export const metadata: Metadata = { title: "Auftrag bearbeiten" };

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [job, customers, employees, organization] = await Promise.all([
    prisma.job.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { assignments: { select: { employeeId: true } } },
    }),
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

  if (!job) notFound();

  return (
    <>
      <PageHeader
        title="Auftrag bearbeiten"
        description={job.jobNumber}
        backHref={`/auftraege/${job.id}`}
        backLabel="Zum Auftrag"
      />
      <JobForm
        customers={customers}
        employees={employees}
        defaultHourlyRate={toNumber(organization.defaultHourlyRate)}
        values={{
          id: job.id,
          title: job.title,
          description: job.description,
          customerId: job.customerId,
          siteId: job.siteId,
          scheduledAt: job.scheduledAt,
          performedAt: job.performedAt,
          hourlyRate: toNumberOrNull(job.hourlyRate),
          employeeIds: job.assignments.map((a) => a.employeeId),
        }}
      />
    </>
  );
}
