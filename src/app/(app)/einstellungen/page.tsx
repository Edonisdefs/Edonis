import type { Metadata } from "next";
import { Shield, Trash2, Users } from "lucide-react";

import {
  EmployeeForm,
  MaterialForm,
  MaterialPriceForm,
  OrganizationForm,
} from "./settings-forms";
import { ActionForm } from "@/components/app/action-form";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteEmployeeAction,
  deleteMaterialAction,
} from "@/lib/actions/settings";
import { hasRole, requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { toNumber, toNumberOrNull } from "@/lib/money";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ willkommen?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const isOwner = hasRole(session, "OWNER");
  const env = getEnv();

  const [organization, employees, materials, auditLogs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
    }),
    prisma.employee.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.material.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      where: { organizationId: session.organizationId },
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description="Betriebsdaten, Team, Materialkatalog und Systemstatus."
      />

      <div className="space-y-5">
        {params.willkommen ? (
          <Alert tone="info" title="Willkommen bei Edonis">
            Ergänzen Sie zuerst Anschrift, Steuernummer und Stundensatz – ohne
            diese Angaben lässt sich keine Rechnung erstellen.
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Betriebsdaten</CardTitle>
          </CardHeader>
          <CardContent>
            {isOwner ? (
              <OrganizationForm
                values={{
                  name: organization.name,
                  legalName: organization.legalName,
                  ownerName: organization.ownerName,
                  street: organization.street,
                  zip: organization.zip,
                  city: organization.city,
                  email: organization.email,
                  phone: organization.phone,
                  website: organization.website,
                  taxNumber: organization.taxNumber,
                  vatId: organization.vatId,
                  registerInfo: organization.registerInfo,
                  bankName: organization.bankName,
                  iban: organization.iban,
                  bic: organization.bic,
                  invoiceFooterNote: organization.invoiceFooterNote,
                  defaultHourlyRate: toNumber(organization.defaultHourlyRate),
                  defaultVatRate: toNumber(organization.defaultVatRate),
                  travelFlatRate: toNumber(organization.travelFlatRate),
                  paymentTermsDays: organization.paymentTermsDays,
                  smallBusiness: organization.smallBusiness,
                  trade: organization.trade,
                }}
              />
            ) : (
              <Alert tone="info">
                Betriebsdaten können nur von der Betriebsleitung geändert
                werden.
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted" aria-hidden />
              Mitarbeiter ({employees.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employees.length > 0 ? (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {employees.map((employee) => (
                  <li
                    key={employee.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {employee.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {employee.role ?? "Ohne Funktion"}
                        {employee.hourlyRate
                          ? ` · ${toNumber(employee.hourlyRate)} €/Std.`
                          : ""}
                      </p>
                    </div>
                    {isOwner ? (
                      <ActionForm
                        action={deleteEmployeeAction}
                        fields={{ id: employee.id }}
                        label={<Trash2 aria-hidden />}
                        variant="ghost"
                        size="icon"
                        showMessage={false}
                        confirm="Diesen Mitarbeiter entfernen?"
                        aria-label="Mitarbeiter entfernen"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Noch keine Mitarbeiter hinterlegt.
              </p>
            )}
            {isOwner ? <EmployeeForm /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Materialkatalog ({materials.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted">
              Der Katalog ist die Grundlage dafür, dass die KI gesprochene
              Materialbezeichnungen erkennt und Preise vorschlägt.
            </p>

            {materials.length > 0 ? (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {materials.map((material) => (
                  <li
                    key={material.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {material.name}
                        {material.defaultPrice === null ? (
                          <Badge tone="warning" className="ml-2">
                            Preis fehlt
                          </Badge>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {material.unit}
                        {material.aliases.length > 0
                          ? ` · ${material.aliases.join(", ")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MaterialPriceForm
                        id={material.id}
                        unit={material.unit}
                        defaultPrice={toNumberOrNull(material.defaultPrice)}
                      />
                      <ActionForm
                        action={deleteMaterialAction}
                        fields={{ id: material.id }}
                        label={<Trash2 aria-hidden />}
                        variant="ghost"
                        size="icon"
                        showMessage={false}
                        confirm="Material aus dem Katalog entfernen?"
                        aria-label="Material entfernen"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <details className="rounded-xl border border-border bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-medium text-muted">
                Material hinzufügen
              </summary>
              <div className="mt-3">
                <MaterialForm />
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4 text-muted" aria-hidden />
              System und Datenschutz
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Info label="KI-Provider" value={env.AI_PROVIDER} />
              <Info label="Spracherkennung" value={env.STT_PROVIDER} />
              <Info label="Dateiablage" value={env.STORAGE_DRIVER} />
            </dl>

            <p className="text-sm leading-relaxed text-muted">
              Kundendaten werden ausschließlich für Ihren Betrieb gespeichert
              und nie mit anderen Betrieben geteilt. Sprachaufnahmen und
              Transkripte lassen sich zusammen mit dem Auftrag löschen.
              Kritische Aktionen werden protokolliert – ohne Inhalte, nur mit
              Zeitpunkt, Person und Vorgangsbezug.
            </p>

            {auditLogs.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Letzte protokollierte Aktionen
                </p>
                <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                  {auditLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2"
                    >
                      <span className="truncate font-mono text-xs">
                        {log.action}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {log.user?.name ?? "System"} ·{" "}
                        {formatDateTime(log.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3.5 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
