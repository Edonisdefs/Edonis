import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";

import { NAV_ITEMS } from "@/components/app/nav-links";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { logoutAction } from "@/lib/actions/auth";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mehr" };

export default async function MorePage() {
  const session = await requireSession();

  return (
    <>
      <PageHeader title="Mehr" description={session.organizationName} />

      <Card>
        <ul className="divide-y divide-border">
          {NAV_ITEMS.filter(
            (item) => !["/", "/auftraege", "/kunden", "/rechnungen"].includes(item.href),
          ).map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-surface-muted sm:px-5"
                >
                  <Icon className="size-5 text-muted" aria-hidden />
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className="size-4 text-subtle" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-4">
        <p className="text-sm font-semibold">{session.userName}</p>
        <p className="text-sm text-muted">{session.userEmail}</p>
        <form action={logoutAction} className="mt-3">
          <Button type="submit" variant="secondary" block>
            <LogOut aria-hidden />
            Abmelden
          </Button>
        </form>
      </div>
    </>
  );
}
