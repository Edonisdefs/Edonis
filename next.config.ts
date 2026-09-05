import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFKit lädt seine AFM-Metriken zur Laufzeit vom Dateisystem und darf
  // deshalb nicht gebundlet werden.
  serverExternalPackages: ["pdfkit", "@prisma/client"],
  experimental: {
    serverActions: {
      // Sprachaufnahmen und Fotos werden über Route Handler geladen,
      // Server Actions bleiben klein.
      bodySizeLimit: "2mb",
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
