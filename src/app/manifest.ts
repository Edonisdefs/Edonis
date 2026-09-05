import type { MetadataRoute } from "next";

/** PWA-Manifest: Die App lässt sich auf dem Baustellen-Smartphone ablegen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Edonis – Büroassistent fürs Handwerk",
    short_name: "Edonis",
    description:
      "Sprachnachricht aufnehmen, KI strukturiert, Rechnung erstellen.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f9",
    theme_color: "#1d4ed8",
    lang: "de",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
