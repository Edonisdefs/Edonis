"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  createEmployeeAction,
  createMaterialAction,
  updateMaterialAction,
  updateOrganizationAction,
} from "@/lib/actions/settings";
import { initialFormState } from "@/lib/actions/state";
import { COMMON_UNITS, TRADE_CONFIGS } from "@/lib/domain/trades";

export type OrganizationValues = {
  name: string;
  legalName: string | null;
  ownerName: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxNumber: string | null;
  vatId: string | null;
  registerInfo: string | null;
  bankName: string | null;
  iban: string | null;
  bic: string | null;
  invoiceFooterNote: string | null;
  defaultHourlyRate: number;
  defaultVatRate: number;
  travelFlatRate: number;
  paymentTermsDays: number;
  smallBusiness: boolean;
  trade: string;
};

export function OrganizationForm({ values }: { values: OrganizationValues }) {
  const [state, formAction] = useActionState(
    updateOrganizationAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Betrieb
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Anzeigename"
            htmlFor="name"
            required
            error={state.fieldErrors?.name}
          >
            <Input id="name" name="name" required defaultValue={values.name} />
          </Field>
          <Field
            label="Firmierung für Rechnungen"
            htmlFor="legalName"
            hint="Vollständiger Name laut Handelsregister."
          >
            <Input
              id="legalName"
              name="legalName"
              defaultValue={values.legalName ?? ""}
            />
          </Field>
          <Field label="Inhaber / Geschäftsführung" htmlFor="ownerName">
            <Input
              id="ownerName"
              name="ownerName"
              defaultValue={values.ownerName ?? ""}
            />
          </Field>
          <Field label="Gewerk" htmlFor="trade">
            <Select id="trade" name="trade" defaultValue={values.trade}>
              {Object.entries(TRADE_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Straße und Hausnummer" htmlFor="street" required>
          <Input id="street" name="street" defaultValue={values.street ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="PLZ" htmlFor="zip" required>
            <Input
              id="zip"
              name="zip"
              inputMode="numeric"
              defaultValue={values.zip ?? ""}
            />
          </Field>
          <Field label="Ort" htmlFor="city" required>
            <Input id="city" name="city" defaultValue={values.city ?? ""} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="E-Mail" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={values.email ?? ""}
            />
          </Field>
          <Field label="Telefon" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={values.phone ?? ""} />
          </Field>
          <Field label="Website" htmlFor="website">
            <Input
              id="website"
              name="website"
              defaultValue={values.website ?? ""}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Steuer und Bank
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Steuernummer"
            htmlFor="taxNumber"
            hint="Steuernummer oder USt-IdNr. ist Pflicht auf jeder Rechnung."
          >
            <Input
              id="taxNumber"
              name="taxNumber"
              defaultValue={values.taxNumber ?? ""}
            />
          </Field>
          <Field label="USt-IdNr." htmlFor="vatId">
            <Input id="vatId" name="vatId" defaultValue={values.vatId ?? ""} />
          </Field>
          <Field
            label="Register / Kammer"
            htmlFor="registerInfo"
            className="sm:col-span-2"
          >
            <Input
              id="registerInfo"
              name="registerInfo"
              placeholder="z. B. HRB 12345 Amtsgericht München · HWK München"
              defaultValue={values.registerInfo ?? ""}
            />
          </Field>
          <Field label="Bank" htmlFor="bankName">
            <Input
              id="bankName"
              name="bankName"
              defaultValue={values.bankName ?? ""}
            />
          </Field>
          <Field label="IBAN" htmlFor="iban">
            <Input id="iban" name="iban" defaultValue={values.iban ?? ""} />
          </Field>
          <Field label="BIC" htmlFor="bic">
            <Input id="bic" name="bic" defaultValue={values.bic ?? ""} />
          </Field>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-strong px-3.5 py-3">
          <Checkbox
            name="smallBusiness"
            defaultChecked={values.smallBusiness}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed">
            Kleinunternehmer nach § 19 UStG – auf Rechnungen wird keine
            Umsatzsteuer ausgewiesen.
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Kalkulation
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Stundensatz"
            htmlFor="defaultHourlyRate"
            required
            error={state.fieldErrors?.defaultHourlyRate}
          >
            <Input
              id="defaultHourlyRate"
              name="defaultHourlyRate"
              inputMode="decimal"
              required
              defaultValue={values.defaultHourlyRate}
            />
          </Field>
          <Field label="USt-Satz in %" htmlFor="defaultVatRate">
            <Input
              id="defaultVatRate"
              name="defaultVatRate"
              inputMode="decimal"
              defaultValue={values.defaultVatRate}
            />
          </Field>
          <Field label="Anfahrtspauschale" htmlFor="travelFlatRate">
            <Input
              id="travelFlatRate"
              name="travelFlatRate"
              inputMode="decimal"
              defaultValue={values.travelFlatRate}
            />
          </Field>
          <Field label="Zahlungsziel in Tagen" htmlFor="paymentTermsDays">
            <Input
              id="paymentTermsDays"
              name="paymentTermsDays"
              inputMode="numeric"
              defaultValue={values.paymentTermsDays}
            />
          </Field>
        </div>

        <Field label="Schlusstext auf Rechnungen" htmlFor="invoiceFooterNote">
          <Textarea
            id="invoiceFooterNote"
            name="invoiceFooterNote"
            rows={2}
            defaultValue={values.invoiceFooterNote ?? ""}
            placeholder="z. B. Hinweis auf Gewährleistung oder Steuerermäßigung nach § 35a EStG"
          />
        </Field>
      </section>

      <FormMessage state={state} />
      <SubmitButton size="lg">Einstellungen speichern</SubmitButton>
    </form>
  );
}

export function EmployeeForm() {
  const [state, formAction] = useActionState(
    createEmployeeAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Name"
          htmlFor="employee-name"
          required
          error={state.fieldErrors?.name}
        >
          <Input id="employee-name" name="name" required />
        </Field>
        <Field label="Funktion" htmlFor="employee-role">
          <Input
            id="employee-role"
            name="role"
            placeholder="Anlagenmechaniker SHK"
          />
        </Field>
        <Field label="Telefon" htmlFor="employee-phone">
          <Input id="employee-phone" name="phone" />
        </Field>
        <Field label="Stundensatz" htmlFor="employee-rate">
          <Input id="employee-rate" name="hourlyRate" inputMode="decimal" />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">
        <Plus aria-hidden />
        Mitarbeiter hinzufügen
      </SubmitButton>
    </form>
  );
}

export function MaterialForm() {
  const [state, formAction] = useActionState(
    createMaterialAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Bezeichnung"
          htmlFor="material-name"
          required
          error={state.fieldErrors?.name}
        >
          <Input id="material-name" name="name" required />
        </Field>
        <Field label="Artikelnummer" htmlFor="material-sku">
          <Input id="material-sku" name="sku" />
        </Field>
        <Field label="Einheit" htmlFor="material-unit-new">
          <Select id="material-unit-new" name="unit" defaultValue="Stück">
            {COMMON_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Preis (netto)" htmlFor="material-price-new">
          <Input
            id="material-price-new"
            name="defaultPrice"
            inputMode="decimal"
          />
        </Field>
      </div>
      <Field
        label="Synonyme"
        htmlFor="material-aliases"
        hint="Komma-getrennt. Hilft der KI, gesprochene Begriffe zuzuordnen."
      >
        <Input
          id="material-aliases"
          name="aliases"
          placeholder="Panzerschlauch, Anschlussschlauch"
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">
        <Plus aria-hidden />
        Material hinzufügen
      </SubmitButton>
    </form>
  );
}

export function MaterialPriceForm({
  id,
  unit,
  defaultPrice,
}: {
  id: string;
  unit: string;
  defaultPrice: number | null;
}) {
  const [state, formAction] = useActionState(
    updateMaterialAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="unit" value={unit} />
      <Input
        name="defaultPrice"
        inputMode="decimal"
        defaultValue={defaultPrice ?? ""}
        placeholder="Preis"
        aria-label="Katalogpreis"
        className="h-10 w-28"
      />
      <SubmitButton size="sm" variant="secondary" pendingLabel="…">
        Speichern
      </SubmitButton>
      {state.status === "error" ? (
        <span className="text-xs text-danger">{state.message}</span>
      ) : null}
    </form>
  );
}
