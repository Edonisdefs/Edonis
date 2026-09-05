import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  if (await getSession()) redirect("/");

  const params = await searchParams;
  const redirectTo =
    params.redirectTo?.startsWith("/") && !params.redirectTo.startsWith("//")
      ? params.redirectTo
      : "/";

  return (
    <>
      <LoginForm redirectTo={redirectTo} />
      {getEnv().ALLOW_SIGNUP ? (
        <p className="mt-6 text-center text-sm text-muted">
          Noch kein Zugang?{" "}
          <Link
            href="/registrieren"
            className="font-semibold text-primary hover:underline"
          >
            Betrieb registrieren
          </Link>
        </p>
      ) : null}
    </>
  );
}
