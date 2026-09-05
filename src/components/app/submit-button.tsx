"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Schaltfläche, die sich während der Server Action selbst sperrt.
 * Verhindert doppelte Buchungen bei langsamer Mobilfunkverbindung.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (
        <>
          <Loader2 className="animate-spin-slow" aria-hidden />
          {pendingLabel ?? "Wird gespeichert …"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
