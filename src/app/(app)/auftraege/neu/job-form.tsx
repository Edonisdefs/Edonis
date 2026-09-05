"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { createJobAction, updateJobAction } from "@/lib/actions/jobs";
import { initialFormState } from "@/lib/actions/state";
import { toDateInputValue } from "@/lib/format";

export type CustomerOption = {
  id: string;
  name: string;
  sites: Array<{ id: string; label: string }>;
};

export type JobFormValues = {
  id?: string;
  title: string;
  description: string | null;
  customerId: string;
  siteId: string | null;
  scheduledAt: Date | null;
  performedAt: Date | null;
  hourlyRate: number | null;
  employeeIds: string[];
};

export function JobForm({
  customers,
  employees,
  defaultHourlyRate,
  values,
  presetCustomerId,
}: {
  customers: CustomerOption[];
  employees: Array<{ id: string; name: string }>;
  defaultHourlyRate: number;
  values?: JobFormValues;
  presetCustomerId?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(values?.id);
  const [state, formAction] = useActionState(
    isEdit ? updateJobAction : createJobAction,
    initialFormState,
  );

  const [customerId, setCustomerId] = useState(
    values?.customerId ?? presetCustomerId ?? customers[0]?.id ?? "",
  );

  const sites = customers.find((customer) => customer.id === customerId)?.sites ?? [];

  useEffect(() => {
    if (state.status === "success" && state.data?.id) {
      router.push(`/auftraege/${state.data.id}`);
    }
  }, [state, router]);

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {values?.id ? (
            <input type="hidden" name="jobId" value={values.id} />
          ) : null}

          <Field
            label="Kunde"
            htmlFor="customerId"
            required
            error={state.fieldErrors?.customerId}
          >
            <Select
              id="customerId"
              name="customerId"
              required
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Bitte wählen</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Baustelle"
            htmlFor="siteId"
            hint="Optional – nur, wenn der Einsatzort vom Kundensitz abweicht."
          >
            <Select
              id="siteId"
              name="siteId"
              defaultValue={values?.siteId ?? ""}
              disabled={sites.length === 0}
            >
              <option value="">
                {sites.length === 0
                  ? "Keine Baustelle hinterlegt"
                  : "Keine Zuordnung"}
              </option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Bezeichnung"
            htmlFor="title"
            required
            error={state.fieldErrors?.title}
          >
            <Input
              id="title"
              name="title"
              required
              defaultValue={values?.title}
              placeholder="z. B. Armatur tauschen, Bad OG"
            />
          </Field>

          <Field label="Beschreibung" htmlFor="description">
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={values?.description ?? ""}
              placeholder="Was ist zu tun? Besonderheiten?"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Geplant am" htmlFor="scheduledAt">
              <Input
                id="scheduledAt"
                name="scheduledAt"
                type="date"
                defaultValue={toDateInputValue(values?.scheduledAt)}
              />
            </Field>
            <Field
              label="Ausgeführt am"
              htmlFor="performedAt"
              hint="Pflichtangabe für die Rechnung."
            >
              <Input
                id="performedAt"
                name="performedAt"
                type="date"
                defaultValue={toDateInputValue(values?.performedAt)}
              />
            </Field>
          </div>

          <Field
            label="Stundensatz für diesen Auftrag"
            htmlFor="hourlyRate"
            hint={`Leer lassen für den Standardsatz (${defaultHourlyRate.toLocaleString(
              "de-DE",
              { style: "currency", currency: "EUR" },
            )}).`}
          >
            <Input
              id="hourlyRate"
              name="hourlyRate"
              inputMode="decimal"
              defaultValue={values?.hourlyRate ?? ""}
              placeholder="z. B. 72,00"
            />
          </Field>

          {employees.length > 0 ? (
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-foreground">
                Mitarbeiter
              </legend>
              <div className="flex flex-wrap gap-2">
                {employees.map((employee) => (
                  <label
                    key={employee.id}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-border-strong px-3 py-2.5 text-sm hover:bg-surface-muted"
                  >
                    <Checkbox
                      name="employeeIds"
                      value={employee.id}
                      defaultChecked={values?.employeeIds.includes(employee.id)}
                    />
                    {employee.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <FormMessage state={state} />

          <SubmitButton size="lg" block>
            {isEdit ? "Änderungen speichern" : "Auftrag anlegen"}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
