import type { Metadata } from "next";

import { CustomerForm } from "./customer-form";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Neuer Kunde" };

export default async function NewCustomerPage() {
  await requireSession();
  return (
    <>
      <PageHeader title="Neuer Kunde" backHref="/kunden" backLabel="Kunden" />
      <CustomerForm />
    </>
  );
}
