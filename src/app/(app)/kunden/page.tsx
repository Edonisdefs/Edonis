import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatAddress } from "@/lib/format";

export const metadata: Metadata = { title: "Kunden" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const customers = await prisma.customer.findMany({
    where: {
      organizationId: session.organizationId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              {
                customerNumber: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
              { city: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      customerNumber: true,
      name: true,
      type: true,
      street: true,
      zip: true,
      city: true,
      archivedAt: true,
      _count: { select: { jobs: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Kunden"
        description={`${customers.length} ${customers.length === 1 ? "Kunde" : "Kunden"}`}
        actions={
          <Button asChild>
            <Link href="/kunden/neu">
              <Plus aria-hidden />
              Neuer Kunde
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex gap-2" action="/kunden">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Name, Kundennummer oder Ort"
            className="pl-9"
            aria-label="Kunden durchsuchen"
          />
        </div>
        <Button type="submit" variant="secondary" size="lg">
          Suchen
        </Button>
      </form>

      <Card>
        {customers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" aria-hidden />}
            title="Keine Kunden gefunden"
            description={
              query
                ? "Für diese Suche gibt es keine Treffer."
                : "Legen Sie Ihren ersten Kunden an."
            }
            action={
              <Button asChild>
                <Link href="/kunden/neu">
                  <Plus aria-hidden />
                  Kunde anlegen
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/kunden/${customer.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">
                        {customer.name}
                      </span>
                      {customer.type === "COMPANY" ? (
                        <Badge tone="neutral">Firma</Badge>
                      ) : null}
                      {customer.archivedAt ? (
                        <Badge tone="warning">Archiviert</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {customer.customerNumber}
                      {formatAddress(customer)
                        ? ` · ${formatAddress(customer)}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted">
                    {customer._count.jobs}{" "}
                    {customer._count.jobs === 1 ? "Auftrag" : "Aufträge"}
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
