"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";

import { ActionForm } from "@/components/app/action-form";
import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import {
  deleteInvoiceItemAction,
  releaseInvoiceAction,
  updateInvoiceItemAction,
  updateInvoiceMetaAction,
} from "@/lib/actions/invoices";
import { initialFormState } from "@/lib/actions/state";
import { formatCurrency, formatNumber, toDateInputValue } from "@/lib/format";

export type EditableItem = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  netAmount: number;
};

export function InvoiceItemRow({
  item,
  editable,
}: {
  item: EditableItem;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(
    updateInvoiceItemAction,
    initialFormState,
  );

  if (!editing) {
    return (
      <tr className="border-b border-border last:border-0">
        <td className="px-3 py-3 text-sm text-muted tabular-nums">
          {item.position}
        </td>
        <td className="px-3 py-3 text-sm">{item.description}</td>
        <td className="px-3 py-3 text-right text-sm tabular-nums">
          {formatNumber(item.quantity)}
        </td>
        <td className="px-3 py-3 text-sm text-muted">{item.unit}</td>
        <td className="px-3 py-3 text-right text-sm tabular-nums">
          {formatCurrency(item.unitPrice)}
        </td>
        <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums">
          {formatCurrency(item.netAmount)}
        </td>
        {editable ? (
          <td className="px-2 py-3">
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Position bearbeiten"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden />
              </Button>
              <ActionForm
                action={deleteInvoiceItemAction}
                fields={{ itemId: item.id }}
                label={<Trash2 aria-hidden />}
                variant="ghost"
                size="icon"
                showMessage={false}
                aria-label="Position entfernen"
              />
            </div>
          </td>
        ) : null}
      </tr>
    );
  }

  return (
    <tr className="border-b border-border bg-surface-muted last:border-0">
      <td colSpan={7} className="px-3 py-3">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="itemId" value={item.id} />
          <div className="grid gap-2 sm:grid-cols-[1fr_90px_90px_110px]">
            <Field label="Bezeichnung" htmlFor={`desc-${item.id}`}>
              <Input
                id={`desc-${item.id}`}
                name="description"
                defaultValue={item.description}
                required
              />
            </Field>
            <Field label="Menge" htmlFor={`qty-${item.id}`}>
              <Input
                id={`qty-${item.id}`}
                name="quantity"
                inputMode="decimal"
                defaultValue={item.quantity}
                required
              />
            </Field>
            <Field label="Einheit" htmlFor={`unit-${item.id}`}>
              <Input
                id={`unit-${item.id}`}
                name="unit"
                defaultValue={item.unit}
              />
            </Field>
            <Field label="Einzelpreis" htmlFor={`price-${item.id}`}>
              <Input
                id={`price-${item.id}`}
                name="unitPrice"
                inputMode="decimal"
                defaultValue={item.unitPrice}
                required
              />
            </Field>
          </div>
          <FormMessage state={state} />
          <div className="flex gap-2">
            <SubmitButton size="sm">Speichern</SubmitButton>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export function InvoiceMetaForm({
  invoiceId,
  serviceDate,
  dueDate,
  introText,
  outroText,
}: {
  invoiceId: string;
  serviceDate: Date;
  dueDate: Date | null;
  introText: string | null;
  outroText: string | null;
}) {
  const [state, formAction] = useActionState(
    updateInvoiceMetaAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Leistungsdatum" htmlFor="serviceDate" required>
          <Input
            id="serviceDate"
            name="serviceDate"
            type="date"
            defaultValue={toDateInputValue(serviceDate)}
            required
          />
        </Field>
        <Field label="Fällig am" htmlFor="dueDate">
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={toDateInputValue(dueDate)}
          />
        </Field>
      </div>
      <Field label="Einleitungstext" htmlFor="introText">
        <Input
          id="introText"
          name="introText"
          defaultValue={introText ?? ""}
        />
      </Field>
      <Field label="Schlusstext" htmlFor="outroText">
        <Textarea
          id="outroText"
          name="outroText"
          rows={2}
          defaultValue={outroText ?? ""}
          placeholder="z. B. Hinweis auf Gewährleistung oder Skonto"
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Rechnungsdaten speichern</SubmitButton>
    </form>
  );
}

/**
 * Freigabe mit ausdrücklicher Bestätigung.
 * Ohne gesetztes Häkchen wird die Aktion serverseitig abgelehnt – eine
 * Rechnung verlässt den Entwurfsstatus nie automatisch.
 */
export function ReleaseInvoiceForm({
  invoiceId,
  grossTotal,
  customerName,
}: {
  invoiceId: string;
  grossTotal: number;
  customerName: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction] = useActionState(
    releaseInvoiceAction,
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="confirm" value={confirmed ? "ja" : "nein"} />

      <Alert tone="warning" title="Vor der Freigabe prüfen">
        Nach der Freigabe erhält die Rechnung den Status „offen“ und kann nicht
        mehr bearbeitet, sondern nur noch storniert werden.
      </Alert>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-strong px-3.5 py-3">
        <Checkbox
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm leading-relaxed">
          Ich habe Positionen, Mengen und Preise geprüft und gebe die Rechnung
          über <strong>{formatCurrency(grossTotal)}</strong> an{" "}
          <strong>{customerName}</strong> frei.
        </span>
      </label>

      <FormMessage state={state} />

      <SubmitButton
        size="lg"
        block
        variant="success"
        disabled={!confirmed}
        pendingLabel="Wird freigegeben …"
      >
        <Check aria-hidden />
        Rechnung freigeben
      </SubmitButton>
    </form>
  );
}
