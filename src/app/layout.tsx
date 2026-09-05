import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Edonis – KI-Büroassistent fürs Handwerk",
    template: "%s · Edonis",
  },
  description:
    "Sprachnachricht statt Papierkram: Edonis erstellt aus Baustellenberichten Leistungsnachweise und Rechnungen.",
  applicationName: "Edonis",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Edonis",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
