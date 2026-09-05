"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/lib/actions/customers";
import { initialFormState } from "@/lib/actions/state";

export type CustomerFormValues = {
  id?: string;
  name: string;
  type: "PRIVATE" | "COMPANY";
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  vatId: string | null;
  notes: string | null;
  hourlyRate: number | null;
};

export function CustomerForm({ values }: { values?: CustomerFormValues }) {
  const router = useRouter();
  const isEdit = Boolean(values?.id);
  const [state, formAction] = useActionState(
    isEdit ? updateCustomerAction : createCustomerAction,
    initialFormState,
  );

  useEffect(() => {
    if (!isEdit && state.status === "success" && state.data?.id) {
      router.push(`/kunden/${state.data.id}`);
    }
  }, [state, router, isEdit]);

  return (
    <Card>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {values?.id ? (
            <input type="hidden" name="customerId" value={values.id} />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Art" htmlFor="type">
              <Select
                id="type"
                name="type"
                defaultValue={values?.type ?? "PRIVATE"}
              >
                <option value="PRIVATE">Privatkunde</option>
                <option value="COMPANY">Firma</option>
              </Select>
            </Field>

            <Field
              label="Name"
              htmlFor="name"
              required
              error={state.fieldErrors?.name}
            >
              <Input
                id="name"
                name="name"
                required
                defaultValue={values?.name}
                placeholder="Müller / Bäckerei Hoffmann GmbH"
              />
            </Field>
          </div>

          <Field label="Ansprechpartner" htmlFor="contactPerson">
            <Input
              id="contactPerson"
              name="contactPerson"
              defaultValue={values?.contactPerson ?? ""}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-Mail" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={values?.email ?? ""}
              />
            </Field>
            <Field label="Telefon" htmlFor="phone">
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={values?.phone ?? ""}
              />
            </Field>
          </div>

          <Field
            label="Straße und Hausnummer"
            htmlFor="street"
            hint="Für die Rechnung erforderlich (§ 14 UStG)."
          >
            <Input
              id="street"
              name="street"
              defaultValue={values?.street ?? ""}
              autoComplete="street-address"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Field label="PLZ" htmlFor="zip">
              <Input
                id="zip"
                name="zip"
                inputMode="numeric"
                defaultValue={values?.zip ?? ""}
                autoComplete="postal-code"
              />
            </Field>
            <Field label="Ort" htmlFor="city">
              <Input
                id="city"
                name="city"
                defaultValue={values?.city ?? ""}
                autoComplete="address-level2"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="USt-IdNr." htmlFor="vatId">
              <Input id="vatId" name="vatId" defaultValue={values?.vatId ?? ""} />
            </Field>
            <Field
              label="Individueller Stundensatz"
              htmlFor="hourlyRate"
              hint="Leer lassen für den Standardsatz."
            >
              <Input
                id="hourlyRate"
                name="hourlyRate"
                inputMode="decimal"
                defaultValue={values?.hourlyRate ?? ""}
              />
            </Field>
          </div>

          <Field label="Notizen" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={values?.notes ?? ""}
              placeholder="Zugang über Hof, Schlüssel beim Nachbarn …"
            />
          </Field>

          <FormMessage state={state} />

          <SubmitButton size="lg" block>
            {isEdit ? "Änderungen speichern" : "Kunde anlegen"}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
