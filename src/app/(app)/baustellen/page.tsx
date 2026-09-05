import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatAddress } from "@/lib/format";

export const metadata: Metadata = { title: "Baustellen" };

export default async function SitesPage() {
  const session = await requireSession();

  const sites = await prisma.site.findMany({
    where: { organizationId: session.organizationId },
    select: {
      id: true,
      label: true,
      street: true,
      zip: true,
      city: true,
      customer: { select: { id: true, name: true } },
      _count: { select: { jobs: true } },
    },
    orderBy: [{ city: "asc" }, { label: "asc" }],
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Baustellen"
        description="Einsatzorte Ihrer Kunden. Baustellen werden beim jeweiligen Kunden angelegt."
      />

      <Card>
        {sites.length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-8" aria-hidden />}
            title="Noch keine Baustellen"
            description="Legen Sie Baustellen direkt beim Kunden an – so lassen sie sich Aufträgen zuordnen."
          />
        ) : (
          <ul className="divide-y divide-border">
            {sites.map((site) => (
              <li key={site.id}>
                <Link
                  href={`/kunden/${site.customer.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{site.label}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {site.customer.name}
                      {formatAddress(site) ? ` · ${formatAddress(site)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted">
                    {site._count.jobs}{" "}
                    {site._count.jobs === 1 ? "Auftrag" : "Aufträge"}
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
