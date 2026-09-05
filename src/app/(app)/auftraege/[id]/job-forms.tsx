"use client";

import { useActionState, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { extractFromTextAction } from "@/lib/actions/ai";
import {
  addActivityAction,
  addMaterialAction,
  addNoteAction,
  addTimeEntryAction,
} from "@/lib/actions/jobs";
import { initialFormState } from "@/lib/actions/state";
import { COMMON_UNITS } from "@/lib/domain/trades";
import { toDateInputValue } from "@/lib/format";

export type CatalogItem = {
  id: string;
  name: string;
  unit: string;
  defaultPrice: number | null;
};

export function AddActivityForm({ jobId }: { jobId: string }) {
  const [state, formAction] = useActionState(
    addActivityAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <input type="hidden" name="jobId" value={jobId} />
      <Input
        name="description"
        placeholder="z. B. Anlage geprüft, dicht"
        aria-label="Tätigkeit"
        required
        className="flex-1"
      />
      <SubmitButton variant="secondary" size="lg" pendingLabel="Speichern …">
        <Plus aria-hidden />
        Hinzufügen
      </SubmitButton>
      {state.status === "error" ? (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}

export function AddTimeEntryForm({
  jobId,
  employees,
  defaultDate,
}: {
  jobId: string;
  employees: Array<{ id: string; name: string }>;
  defaultDate: Date | null;
}) {
  const [state, formAction] = useActionState(
    addTimeEntryAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Datum" htmlFor="time-date">
          <Input
            id="time-date"
            name="date"
            type="date"
            defaultValue={toDateInputValue(defaultDate ?? new Date())}
          />
        </Field>
        <Field label="Von" htmlFor="time-start">
          <Input id="time-start" name="startTime" type="time" />
        </Field>
        <Field label="Bis" htmlFor="time-end">
          <Input id="time-end" name="endTime" type="time" />
        </Field>
        <Field
          label="Stunden"
          htmlFor="time-hours"
          required
          error={state.fieldErrors?.hours}
        >
          <Input
            id="time-hours"
            name="hours"
            inputMode="decimal"
            required
            placeholder="2"
          />
        </Field>
      </div>
      {employees.length > 0 ? (
        <Field label="Mitarbeiter" htmlFor="time-employee">
          <Select id="time-employee" name="employeeId">
            <option value="">Nicht zugeordnet</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="lg" block>
        <Plus aria-hidden />
        Arbeitszeit erfassen
      </SubmitButton>
    </form>
  );
}

export function AddMaterialForm({
  jobId,
  catalog,
}: {
  jobId: string;
  catalog: CatalogItem[];
}) {
  const [state, formAction] = useActionState(
    addMaterialAction,
    initialFormState,
  );
  const [materialId, setMaterialId] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("Stück");
  const [price, setPrice] = useState("");

  function selectCatalogItem(id: string) {
    setMaterialId(id);
    const item = catalog.find((entry) => entry.id === id);
    if (item) {
      setDescription(item.name);
      setUnit(item.unit);
      setPrice(item.defaultPrice !== null ? `${item.defaultPrice}` : "");
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="materialId" value={materialId} />

      {catalog.length > 0 ? (
        <Field label="Aus dem Katalog" htmlFor="material-catalog">
          <Select
            id="material-catalog"
            value={materialId}
            onChange={(event) => selectCatalogItem(event.target.value)}
          >
            <option value="">Freie Eingabe</option>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field
          label="Menge"
          htmlFor="material-quantity"
          required
          error={state.fieldErrors?.quantity}
        >
          <Input
            id="material-quantity"
            name="quantity"
            inputMode="decimal"
            required
            defaultValue="1"
          />
        </Field>
        <Field label="Einheit" htmlFor="material-unit">
          <Select
            id="material-unit"
            name="unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          >
            {COMMON_UNITS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Bezeichnung"
          htmlFor="material-description"
          required
          className="col-span-2"
          error={state.fieldErrors?.description}
        >
          <Input
            id="material-description"
            name="description"
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="z. B. Eckventil"
          />
        </Field>
      </div>

      <Field label="Einzelpreis (netto)" htmlFor="material-price">
        <Input
          id="material-price"
          name="unitPrice"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="0,00"
        />
      </Field>

      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="lg" block>
        <Plus aria-hidden />
        Material erfassen
      </SubmitButton>
    </form>
  );
}

export function AddNoteForm({ jobId }: { jobId: string }) {
  const [state, formAction] = useActionState(addNoteAction, initialFormState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <Textarea
        name="text"
        rows={3}
        required
        placeholder="Notiz zum Auftrag …"
        aria-label="Notiz"
      />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="md">
        Notiz speichern
      </SubmitButton>
    </form>
  );
}

/** Alternative zur Sprachaufnahme: getippter Text, den die KI strukturiert. */
export function TextExtractForm({ jobId }: { jobId: string }) {
  const [state, formAction] = useActionState(
    extractFromTextAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="jobId" value={jobId} />
      <Textarea
        name="text"
        rows={3}
        required
        minLength={10}
        placeholder="Baustelle Müller. Heute von 8 bis 10 Uhr. Alte Armatur ausgebaut, neue eingebaut. Zwei Flexschläuche und ein Eckventil verwendet."
        aria-label="Bericht als Text"
      />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="KI wertet aus …">
        <Sparkles aria-hidden />
        Text auswerten lassen
      </SubmitButton>
    </form>
  );
}
