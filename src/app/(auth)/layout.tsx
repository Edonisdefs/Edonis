import { Mic } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Mic className="size-5" aria-hidden />
        </span>
        <span className="text-2xl font-bold tracking-tight">Edonis</span>
      </div>
      <p className="mb-8 max-w-sm text-center text-sm text-muted">
        Der Büroassistent fürs Handwerk. Sprechen statt tippen – vom
        Baustellenbericht zur Rechnung.
      </p>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
