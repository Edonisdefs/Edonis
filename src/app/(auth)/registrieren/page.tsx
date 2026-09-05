import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "./signup-form";
import { getSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Betrieb registrieren" };

export default async function SignupPage() {
  if (await getSession()) redirect("/");
  if (!getEnv().ALLOW_SIGNUP) redirect("/login");

  return (
    <>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted">
        Bereits registriert?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Zur Anmeldung
        </Link>
      </p>
    </>
  );
}
