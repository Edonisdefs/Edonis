import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/actions/state";

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <Alert tone={state.status === "success" ? "success" : "danger"}>
      {state.message}
    </Alert>
  );
}
