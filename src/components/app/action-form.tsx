"use client";

import * as React from "react";
import { useActionState } from "react";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { initialFormState, type FormState } from "@/lib/actions/state";
import type { ButtonProps } from "@/components/ui/button";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Kleines Formular für eine einzelne Aktion (löschen, Status setzen …)
 * inklusive Rückmeldung.
 */
export function ActionForm({
  action,
  fields,
  label,
  pendingLabel,
  confirm,
  showMessage = true,
  className,
  ...buttonProps
}: {
  action: Action;
  fields: Record<string, string>;
  label: React.ReactNode;
  pendingLabel?: string;
  confirm?: string;
  showMessage?: boolean;
  className?: string;
} & Omit<ButtonProps, "children">) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton pendingLabel={pendingLabel} {...buttonProps}>
        {label}
      </SubmitButton>
      {showMessage && state.status === "error" ? (
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}
