import type { Metadata } from "next";
import Link from "next/link";
import { Camera, FileText, Files, Mic } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime, formatFileSize } from "@/lib/format";

export const metadata: Metadata = { title: "Dokumente" };

export default async function DocumentsPage() {
  const session = await requireSession();

  const [documents, photos, voiceNotes] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId: session.organizationId },
      select: {
        id: true,
        title: true,
        filename: true,
        storageKey: true,
        kind: true,
        size: true,
        createdAt: true,
        customer: { select: { name: true } },
        invoiceId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.jobPhoto.count({ where: { organizationId: session.organizationId } }),
    prisma.voiceNote.count({
      where: { organizationId: session.organizationId },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Dokumente"
        description="Rechnungen als PDF sowie alle Medien, die an Aufträgen hängen."
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat icon={<FileText className="size-4" aria-hidden />} label="PDF" value={documents.length} />
        <Stat icon={<Camera className="size-4" aria-hidden />} label="Fotos" value={photos} />
        <Stat icon={<Mic className="size-4" aria-hidden />} label="Aufnahmen" value={voiceNotes} />
      </div>

      <Card>
        {documents.length === 0 ? (
          <EmptyState
            icon={<Files className="size-8" aria-hidden />}
            title="Noch keine Dokumente"
            description="Sobald Sie eine Rechnung freigeben, wird das PDF hier abgelegt."
          />
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/files/${document.storageKey}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-medium text-primary hover:underline"
                    >
                      {document.title}
                    </a>
                    {document.kind === "INVOICE_PDF" ? (
                      <Badge tone="info">Rechnung</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {document.customer?.name ?? "–"} ·{" "}
                    {formatDateTime(document.createdAt)} ·{" "}
                    {formatFileSize(document.size)}
                  </p>
                </div>
                {document.invoiceId ? (
                  <Link
                    href={`/rechnungen/${document.invoiceId}`}
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    Öffnen
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
