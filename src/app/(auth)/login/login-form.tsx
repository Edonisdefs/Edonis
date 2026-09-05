"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/app/form-message";
import { SubmitButton } from "@/components/app/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { loginAction } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/actions/state";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useActionState(loginAction, initialFormState);

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <h1 className="text-xl font-bold">Anmelden</h1>
          <p className="mt-1 text-sm text-muted">
            Mit Ihrer geschäftlichen E-Mail-Adresse.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />

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
              autoComplete="username"
              inputMode="email"
              required
              placeholder="name@betrieb.de"
            />
          </Field>

          <Field
            label="Passwort"
            htmlFor="password"
            required
            error={state.fieldErrors?.password}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <FormMessage state={state} />

          <SubmitButton size="lg" block pendingLabel="Anmelden …">
            Anmelden
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
