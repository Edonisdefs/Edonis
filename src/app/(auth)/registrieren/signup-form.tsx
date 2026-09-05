"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { signupAction } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/actions/state";

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialFormState);

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <h1 className="text-xl font-bold">Betrieb registrieren</h1>
          <p className="mt-1 text-sm text-muted">
            In zwei Minuten startklar. Sie können alles später in den
            Einstellungen ergänzen.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <Field
            label="Betrieb"
            htmlFor="company"
            required
            error={state.fieldErrors?.company}
          >
            <Input
              id="company"
              name="company"
              required
              placeholder="Mustermann Sanitär GmbH"
            />
          </Field>

          <Field
            label="Ihr Name"
            htmlFor="name"
            required
            error={state.fieldErrors?.name}
          >
            <Input id="name" name="name" required placeholder="Max Mustermann" />
          </Field>

          <Field
            label="E-Mail"
            htmlFor="email"
            required
            error={state.fieldErrors?.email}
          >
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              placeholder="name@betrieb.de"
            />
          </Field>

          <Field
            label="Passwort"
            htmlFor="password"
            required
            hint="Mindestens 10 Zeichen."
            error={state.fieldErrors?.password}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </Field>

          <FormMessage state={state} />

          <SubmitButton size="lg" block pendingLabel="Wird angelegt …">
            Betrieb anlegen
          </SubmitButton>

          <p className="text-xs leading-relaxed text-muted">
            Mit der Registrierung bestätigen Sie, dass Sie Kundendaten
            verarbeiten dürfen. Edonis speichert diese ausschließlich für Ihren
            Betrieb.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
