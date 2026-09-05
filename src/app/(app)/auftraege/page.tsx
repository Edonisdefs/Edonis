import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Wrench } from "lucide-react";
import type { JobStatus } from "@prisma/client";

import { PageHeader } from "@/components/app/page-header";
import { JobStatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { JOB_STATUS_LABELS } from "@/lib/domain/job-status";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Aufträge" };

const STATUS_VALUES = Object.keys(JOB_STATUS_LABELS) as JobStatus[];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const status = STATUS_VALUES.includes(params.status as JobStatus)
    ? (params.status as JobStatus)
    : undefined;
  const query = params.q?.trim() ?? "";

  const jobs = await prisma.job.findMany({
    where: {
      organizationId: session.organizationId,
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { jobNumber: { contains: query, mode: "insensitive" as const } },
              {
                customer: {
                  name: { contains: query, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      jobNumber: true,
      title: true,
      status: true,
      scheduledAt: true,
      performedAt: true,
      customer: { select: { name: true } },
      site: { select: { label: true } },
      _count: { select: { extractions: true } },
    },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Aufträge"
        description={`${jobs.length} ${jobs.length === 1 ? "Auftrag" : "Aufträge"}`}
        actions={
          <Button asChild>
            <Link href="/auftraege/neu">
              <Plus aria-hidden />
              Neuer Auftrag
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/auftraege">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Kunde, Auftragsnummer oder Bezeichnung"
            className="pl-9"
            aria-label="Aufträge durchsuchen"
          />
        </div>
        <Select
          name="status"
          defaultValue={status ?? ""}
          aria-label="Nach Status filtern"
          className="sm:w-52"
        >
          <option value="">Alle Status</option>
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {JOB_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="lg">
          Filtern
        </Button>
      </form>

      <Card>
        {jobs.length === 0 ? (
          <EmptyState
            icon={<Wrench className="size-8" aria-hidden />}
            title="Keine Aufträge gefunden"
            description={
              query || status
                ? "Für diese Filter gibt es keine Treffer."
                : "Legen Sie Ihren ersten Auftrag an."
            }
            action={
              <Button asChild>
                <Link href="/auftraege/neu">
                  <Plus aria-hidden />
                  Auftrag anlegen
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/auftraege/${job.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">
                        {job.customer.name}
                      </span>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {job.jobNumber} · {job.title}
                      {job.site?.label ? ` · ${job.site.label}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted">
                    {formatDate(job.performedAt ?? job.scheduledAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
