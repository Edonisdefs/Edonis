"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Field, Input } from "@/components/ui/field";
import { createSiteAction } from "@/lib/actions/customers";
import { initialFormState } from "@/lib/actions/state";

export function SiteForm({ customerId }: { customerId: string }) {
  const [state, formAction] = useActionState(createSiteAction, initialFormState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />

      <Field
        label="Bezeichnung"
        htmlFor="site-label"
        required
        error={state.fieldErrors?.label}
      >
        <Input
          id="site-label"
          name="label"
          required
          placeholder="z. B. Bad Obergeschoss"
        />
      </Field>

      <Field label="Straße und Hausnummer" htmlFor="site-street">
        <Input id="site-street" name="street" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="PLZ" htmlFor="site-zip">
          <Input id="site-zip" name="zip" inputMode="numeric" />
        </Field>
        <Field label="Ort" htmlFor="site-city">
          <Input id="site-city" name="city" />
        </Field>
      </div>

      <Field label="Hinweise" htmlFor="site-notes">
        <Input
          id="site-notes"
          name="notes"
          placeholder="Zugang, Schlüssel, Ansprechpartner vor Ort"
        />
      </Field>

      <FormMessage state={state} />
      <SubmitButton variant="secondary" block>
        Baustelle speichern
      </SubmitButton>
    </form>
  );
}
