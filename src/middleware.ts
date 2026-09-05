import { NextResponse, type NextRequest } from "next/server";

// Bewusst dupliziert statt importiert: Die Middleware läuft in der Edge-
// Runtime und darf nichts aus der Server-Only-Schicht (Prisma, node:crypto)
// hereinziehen.
const SESSION_COOKIE = "edonis_session";

/**
 * Vorgelagerte Weiterleitung.
 *
 * Wichtig: Das ist ausdrücklich KEINE Autorisierung – geprüft wird nur, ob
 * überhaupt ein Sitzungs-Cookie vorhanden ist, um unnötige Seitenaufrufe zu
 * sparen. Die echte Prüfung passiert serverseitig in `requireSession()` bzw.
 * `requireApiSession()`, und jede Datenbankabfrage ist zusätzlich auf die
 * Organisation der Sitzung eingeschränkt.
 */

const PUBLIC_PATHS = ["/login", "/registrieren"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasSessionCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("redirectTo", `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }

  if (hasSessionCookie && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Alles außer statischen Dateien und den API-Routen. Die API antwortet
     * bei fehlender Sitzung mit 401 statt mit einer Weiterleitung – das ist
     * für `fetch`-Aufrufe das sinnvollere Verhalten.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};
