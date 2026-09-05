"use client";

import { useActionState, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  ListChecks,
  Package,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { ActionForm } from "@/components/app/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import {
  confirmExtractionAction,
  rejectExtractionAction,
} from "@/lib/actions/ai";
import { initialFormState } from "@/lib/actions/state";
import { CONFIDENCE_THRESHOLD } from "@/lib/ai/schema";
import { COMMON_UNITS } from "@/lib/domain/trades";
import { formatCurrency } from "@/lib/format";

export type ReviewMaterial = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  materialId: string | null;
};

export type ReviewData = {
  extractionId: string;
  customer: string | null;
  date: string | null;
  workDurationHours: number | null;
  startTime: string | null;
  endTime: string | null;
  activities: string[];
  materials: ReviewMaterial[];
  notes: string | null;
  confidence: number;
  missingInformation: string[];
  transcript: string | null;
};

/**
 * Prüf- und Bestätigungsschritt.
 *
 * Solange hier nicht bestätigt wurde, existieren die erkannten Daten nur als
 * Vorschlag. Alles ist editierbar, einzelne Zeilen lassen sich entfernen.
 */
export function ExtractionReview({
  data,
  employees,
}: {
  data: ReviewData;
  employees: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(
    confirmExtractionAction,
    initialFormState,
  );

  const [date, setDate] = useState(data.date ?? "");
  const [hours, setHours] = useState(
    data.workDurationHours !== null ? `${data.workDurationHours}` : "",
  );
  const [startTime, setStartTime] = useState(data.startTime ?? "");
  const [endTime, setEndTime] = useState(data.endTime ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [activities, setActivities] = useState<string[]>(data.activities);
  const [materials, setMaterials] = useState<ReviewMaterial[]>(data.materials);
  const [notes, setNotes] = useState(data.notes ?? "");
  const [showTranscript, setShowTranscript] = useState(false);

  const lowConfidence = data.confidence < CONFIDENCE_THRESHOLD;
  const missingPrices = materials.filter(
    (material) => material.unitPrice === null,
  ).length;

  const payload = JSON.stringify({
    date: date || null,
    work_duration_hours: hours ? Number(hours.replace(",", ".")) : null,
    start_time: startTime || null,
    end_time: endTime || null,
    employeeId: employeeId || null,
    activities: activities
      .map((activity) => activity.trim())
      .filter((activity) => activity.length > 0),
    materials: materials
      .filter((material) => material.description.trim() && material.quantity > 0)
      .map((material) => ({
        description: material.description.trim(),
        quantity: material.quantity,
        unit: material.unit || "Stück",
        unitPrice: material.unitPrice,
        materialId: material.materialId,
      })),
    notes: notes.trim() || null,
  });

  const updateMaterial = (index: number, patch: Partial<ReviewMaterial>) => {
    setMaterials((current) =>
      current.map((material, position) =>
        position === index ? { ...material, ...patch } : material,
      ),
    );
  };

  return (
    <Card className="border-primary/30 ring-1 ring-primary/10">
      <CardHeader className="bg-primary-soft">
        <div className="flex min-w-0 items-start gap-2.5">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <CardTitle>KI hat folgende Informationen erkannt</CardTitle>
            <p className="mt-0.5 text-sm text-muted">
              Bitte prüfen und bei Bedarf korrigieren. Erst nach Ihrer
              Bestätigung werden die Daten übernommen.
            </p>
          </div>
        </div>
        <Badge tone={lowConfidence ? "warning" : "success"}>
          {Math.round(data.confidence * 100)} % sicher
        </Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        {lowConfidence ? (
          <Alert tone="warning" title="Die KI war sich unsicher">
            Bitte besonders sorgfältig prüfen – Zeiten und Mengen können
            abweichen.
          </Alert>
        ) : null}

        {data.missingInformation.length > 0 ? (
          <Alert tone="warning" title="Diese Angaben fehlen noch">
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {data.missingInformation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {data.customer ? (
          <p className="text-sm text-muted">
            Erkannter Kunde:{" "}
            <span className="font-semibold text-foreground">
              {data.customer}
            </span>
          </p>
        ) : null}

        {data.transcript ? (
          <div className="rounded-xl border border-border bg-surface-muted">
            <button
              type="button"
              onClick={() => setShowTranscript((value) => !value)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-muted"
            >
              Aufnahme im Wortlaut
              <ChevronDown
                className={`size-4 transition-transform ${
                  showTranscript ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
            {showTranscript ? (
              <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-foreground">
                „{data.transcript}“
              </p>
            ) : null}
          </div>
        ) : null}

        {/* --- Zeit --- */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="size-4 text-muted" aria-hidden />
            Arbeitszeit
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Leistungsdatum" htmlFor="review-date">
              <Input
                id="review-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label="Stunden gesamt" htmlFor="review-hours">
              <Input
                id="review-hours"
                inputMode="decimal"
                value={hours}
                placeholder="z. B. 2"
                onChange={(event) => setHours(event.target.value)}
              />
            </Field>
            <Field label="Von" htmlFor="review-start">
              <Input
                id="review-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </Field>
            <Field label="Bis" htmlFor="review-end">
              <Input
                id="review-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </Field>
            {employees.length > 0 ? (
              <Field
                label="Mitarbeiter"
                htmlFor="review-employee"
                className="sm:col-span-2"
              >
                <Select
                  id="review-employee"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                >
                  <option value="">Nicht zugeordnet</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
        </section>

        {/* --- Tätigkeiten --- */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ListChecks className="size-4 text-muted" aria-hidden />
            Tätigkeiten ({activities.length})
          </h3>
          <div className="space-y-2">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={activity}
                  aria-label={`Tätigkeit ${index + 1}`}
                  onChange={(event) =>
                    setActivities((current) =>
                      current.map((item, position) =>
                        position === index ? event.target.value : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Tätigkeit entfernen"
                  onClick={() =>
                    setActivities((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setActivities((current) => [...current, ""])}
            >
              <Plus aria-hidden />
              Tätigkeit ergänzen
            </Button>
          </div>
        </section>

        {/* --- Material --- */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="size-4 text-muted" aria-hidden />
            Material ({materials.length})
          </h3>

          {missingPrices > 0 ? (
            <Alert tone="warning">
              Für {missingPrices}{" "}
              {missingPrices === 1 ? "Position" : "Positionen"} fehlt der
              Einzelpreis. Ohne Preis kann später keine Rechnung erstellt
              werden.
            </Alert>
          ) : null}

          <div className="space-y-3">
            {materials.map((material, index) => (
              <div
                key={index}
                className="rounded-xl border border-border bg-surface-muted p-3"
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[90px_110px_1fr_130px]">
                  <Field label="Menge" htmlFor={`material-qty-${index}`}>
                    <Input
                      id={`material-qty-${index}`}
                      inputMode="decimal"
                      value={`${material.quantity}`}
                      onChange={(event) =>
                        updateMaterial(index, {
                          quantity:
                            Number(event.target.value.replace(",", ".")) || 0,
                        })
                      }
                    />
                  </Field>
                  <Field label="Einheit" htmlFor={`material-unit-${index}`}>
                    <Select
                      id={`material-unit-${index}`}
                      value={material.unit}
                      onChange={(event) =>
                        updateMaterial(index, { unit: event.target.value })
                      }
                    >
                      {[
                        material.unit,
                        ...COMMON_UNITS.filter(
                          (unit) => unit !== material.unit,
                        ),
                      ].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Bezeichnung"
                    htmlFor={`material-desc-${index}`}
                    className="col-span-2 sm:col-span-1"
                  >
                    <Input
                      id={`material-desc-${index}`}
                      value={material.description}
                      onChange={(event) =>
                        updateMaterial(index, {
                          description: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Einzelpreis"
                    htmlFor={`material-price-${index}`}
                    className="col-span-2 sm:col-span-1"
                    error={
                      material.unitPrice === null ? "Preis fehlt" : undefined
                    }
                  >
                    <Input
                      id={`material-price-${index}`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={
                        material.unitPrice !== null
                          ? `${material.unitPrice}`
                          : ""
                      }
                      onChange={(event) => {
                        const raw = event.target.value.replace(",", ".");
                        updateMaterial(index, {
                          unitPrice: raw === "" ? null : Number(raw) || 0,
                        });
                      }}
                    />
                  </Field>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted">
                    {material.unitPrice !== null
                      ? `Summe: ${formatCurrency(
                          material.quantity * material.unitPrice,
                        )}`
                      : "Ohne Preis"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setMaterials((current) =>
                        current.filter((_, position) => position !== index),
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                    Entfernen
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setMaterials((current) => [
                  ...current,
                  {
                    description: "",
                    quantity: 1,
                    unit: "Stück",
                    unitPrice: null,
                    materialId: null,
                  },
                ])
              }
            >
              <Plus aria-hidden />
              Material ergänzen
            </Button>
          </div>
        </section>

        {/* --- Notiz --- */}
        <Field label="Notiz" htmlFor="review-notes">
          <Input
            id="review-notes"
            value={notes}
            placeholder="z. B. Kunde war vor Ort, alles dicht"
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>

        <FormMessage state={state} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={formAction} className="sm:flex-1">
            <input
              type="hidden"
              name="extractionId"
              value={data.extractionId}
            />
            <input type="hidden" name="payload" value={payload} />
            <SubmitButton
              size="lg"
              block
              pendingLabel="Wird übernommen …"
              variant="success"
            >
              <Check aria-hidden />
              Bestätigen und übernehmen
            </SubmitButton>
          </form>

          <ActionForm
            action={rejectExtractionAction}
            fields={{ extractionId: data.extractionId }}
            label={
              <>
                <X aria-hidden />
                Verwerfen
              </>
            }
            pendingLabel="Wird verworfen …"
            confirm="Diesen KI-Vorschlag wirklich verwerfen?"
            variant="secondary"
            size="lg"
          />
        </div>
      </CardContent>
    </Card>
  );
}
