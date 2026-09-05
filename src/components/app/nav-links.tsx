"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Files,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Receipt,
  Settings,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard },
  { href: "/auftraege", label: "Aufträge", icon: Wrench },
  { href: "/kunden", label: "Kunden", icon: Users },
  { href: "/baustellen", label: "Baustellen", icon: MapPin },
  { href: "/rechnungen", label: "Rechnungen", icon: Receipt },
  { href: "/dokumente", label: "Dokumente", icon: Files },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
] as const;

/** Auf dem Smartphone zählt jeder Millimeter – nur vier Ziele plus „Mehr“. */
const MOBILE_ITEMS = [
  { href: "/", label: "Übersicht", icon: LayoutDashboard },
  { href: "/auftraege", label: "Aufträge", icon: Wrench },
  { href: "/kunden", label: "Kunden", icon: Users },
  { href: "/rechnungen", label: "Rechnungen", icon: Receipt },
  { href: "/mehr", label: "Mehr", icon: MoreHorizontal },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Hauptnavigation">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Hauptnavigation"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="size-6" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
