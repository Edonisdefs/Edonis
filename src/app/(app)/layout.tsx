import Link from "next/link";
import { LogOut, Mic } from "lucide-react";

import { BottomNav, SidebarNav } from "@/components/app/nav-links";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";
import { requireSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { initials } from "@/lib/format";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Inhaber",
  OFFICE: "Büro",
  FIELD: "Monteur",
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const env = getEnv();
  const usingMocks = env.AI_PROVIDER === "mock" || env.STT_PROVIDER === "mock";

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop-Navigation */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mic className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight">Edonis</span>
        </div>

        <div className="flex-1 px-3">
          <SidebarNav />
        </div>

        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
              {initials(session.userName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {session.userName}
              </p>
              <p className="truncate text-xs text-muted">
                {ROLE_LABELS[session.role] ?? session.role} ·{" "}
                {session.organizationName}
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              block
              className="mt-1 justify-start"
            >
              <LogOut aria-hidden />
              Abmelden
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-Kopfzeile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mic className="size-4" aria-hidden />
            </span>
            <span className="text-base font-bold tracking-tight">Edonis</span>
          </Link>
          <span className="truncate text-xs font-medium text-muted">
            {session.organizationName}
          </span>
        </header>

        {usingMocks ? (
          <p className="border-b border-warning/20 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning">
            Demo-Modus: KI und Spracherkennung laufen lokal ohne externe
            Dienste.
          </p>
        ) : null}

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 sm:px-6 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
