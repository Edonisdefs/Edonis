import "server-only";

import PDFDocument from "pdfkit";

import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { BillingSnapshot, InvoiceDetail } from "./invoice-service";

/**
 * Serverseitige PDF-Erzeugung mit PDFKit – kein Headless-Browser, damit die
 * Anwendung auch in serverlosen Umgebungen (Vercel) funktioniert.
 *
 * Die Pflichtangaben nach § 14 UStG sind vollständig abgebildet:
 * Name und Anschrift beider Seiten, Steuernummer bzw. USt-IdNr.,
 * Rechnungsnummer, Rechnungsdatum, Leistungsdatum, Menge und Art der
 * Leistung, Entgelt je Steuersatz, Steuersatz und Steuerbetrag.
 * Die inhaltliche Prüfung bleibt Sache des Betriebs bzw. der Steuerberatung.
 */

const PAGE_MARGIN = 56;
const COLOR_TEXT = "#111827";
const COLOR_MUTED = "#6b7280";
const COLOR_LINE = "#d1d5db";
const COLOR_ACCENT = "#1d4ed8";

type Column = {
  label: string;
  width: number;
  align: "left" | "right";
};

const COLUMNS: Column[] = [
  { label: "Pos.", width: 32, align: "left" },
  { label: "Bezeichnung", width: 215, align: "left" },
  { label: "Menge", width: 58, align: "right" },
  { label: "Einheit", width: 52, align: "left" },
  { label: "Einzelpreis", width: 72, align: "right" },
  { label: "Betrag", width: 74, align: "right" },
];

function addressLines(party: {
  name: string;
  contactPerson?: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
}): string[] {
  return [
    party.name,
    party.contactPerson ?? null,
    party.street,
    [party.zip, party.city].filter(Boolean).join(" ") || null,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

export function renderInvoicePdf(invoice: InvoiceDetail): Promise<Buffer> {
  const snapshot: BillingSnapshot = invoice.snapshot;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      info: {
        Title: `Rechnung ${invoice.invoiceNumber}`,
        Author: snapshot.seller.name,
        Subject: `Rechnung ${invoice.invoiceNumber}`,
      },
    });

    // Entwürfe werden deutlich als solche gekennzeichnet – ein Entwurf darf
    // nie versehentlich als fertige Rechnung beim Kunden landen.
    if (invoice.status === "DRAFT") {
      doc.save();
      doc
        .rotate(-32, { origin: [300, 420] })
        .fillColor("#dc2626")
        .opacity(0.12)
        .font("Helvetica-Bold")
        .fontSize(96)
        .text("ENTWURF", 40, 380, { width: 520, align: "center" });
      doc.restore();
      doc.opacity(1);
    }

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    // --- Kopf: Absender ----------------------------------------------------
    doc
      .fillColor(COLOR_ACCENT)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(snapshot.seller.legalName || snapshot.seller.name, left, 50, {
        width: contentWidth * 0.6,
      });

    const sellerContact = [
      [snapshot.seller.street, [snapshot.seller.zip, snapshot.seller.city]
        .filter(Boolean)
        .join(" ")]
        .filter(Boolean)
        .join(" · "),
      snapshot.seller.phone ? `Tel. ${snapshot.seller.phone}` : null,
      snapshot.seller.email,
      snapshot.seller.website,
    ].filter((value): value is string => Boolean(value));

    doc
      .fillColor(COLOR_MUTED)
      .font("Helvetica")
      .fontSize(8.5)
      .text(sellerContact.join("\n"), left + contentWidth * 0.6, 50, {
        width: contentWidth * 0.4,
        align: "right",
      });

    // --- Empfängerfeld -----------------------------------------------------
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(7)
      .text(
        [
          snapshot.seller.name,
          snapshot.seller.street,
          [snapshot.seller.zip, snapshot.seller.city].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(" · "),
        left,
        130,
        { width: contentWidth * 0.55 },
      );

    doc
      .moveTo(left, 142)
      .lineTo(left + contentWidth * 0.55, 142)
      .strokeColor(COLOR_LINE)
      .lineWidth(0.5)
      .stroke();

    doc
      .fillColor(COLOR_TEXT)
      .font("Helvetica")
      .fontSize(11)
      .text(addressLines(snapshot.buyer).join("\n"), left, 152, {
        width: contentWidth * 0.55,
        lineGap: 2,
      });

    // --- Metadaten rechts --------------------------------------------------
    const metaLeft = left + contentWidth * 0.6;
    const metaWidth = contentWidth * 0.4;
    const meta: Array<[string, string]> = [
      ["Rechnungsnummer", invoice.invoiceNumber],
      ["Rechnungsdatum", formatDate(invoice.issueDate)],
      ["Leistungsdatum", formatDate(invoice.serviceDate)],
      ["Kundennummer", snapshot.buyer.customerNumber],
    ];
    if (snapshot.job?.jobNumber) {
      meta.push(["Auftrag", snapshot.job.jobNumber]);
    }
    if (snapshot.seller.taxNumber) {
      meta.push(["Steuernummer", snapshot.seller.taxNumber]);
    }
    if (snapshot.seller.vatId) {
      meta.push(["USt-IdNr.", snapshot.seller.vatId]);
    }

    let metaY = 152;
    for (const [label, value] of meta) {
      doc
        .fillColor(COLOR_MUTED)
        .font("Helvetica")
        .fontSize(8.5)
        .text(label, metaLeft, metaY, { width: metaWidth * 0.5 });
      doc
        .fillColor(COLOR_TEXT)
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .text(value, metaLeft + metaWidth * 0.5, metaY, {
          width: metaWidth * 0.5,
          align: "right",
        });
      metaY += 14;
    }

    // --- Betreff und Anrede ------------------------------------------------
    let y = Math.max(260, metaY + 20);
    doc
      .fillColor(COLOR_TEXT)
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(`Rechnung ${invoice.invoiceNumber}`, left, y);
    y = doc.y + 10;

    if (snapshot.job?.siteLabel || snapshot.job?.title) {
      doc
        .fillColor(COLOR_MUTED)
        .font("Helvetica")
        .fontSize(9)
        .text(
          [
            snapshot.job.title,
            snapshot.job.siteLabel ? `Baustelle: ${snapshot.job.siteLabel}` : null,
            snapshot.job.siteAddress,
          ]
            .filter(Boolean)
            .join(" · "),
          left,
          y,
          { width: contentWidth },
        );
      y = doc.y + 8;
    }

    doc
      .fillColor(COLOR_TEXT)
      .font("Helvetica")
      .fontSize(10)
      .text(
        `Sehr geehrte Damen und Herren,\n${
          invoice.introText ??
          "für die von uns ausgeführten Arbeiten berechnen wir Ihnen wie folgt:"
        }`,
        left,
        y,
        { width: contentWidth, lineGap: 2 },
      );
    y = doc.y + 16;

    // --- Positionstabelle --------------------------------------------------
    const drawTableHeader = (top: number): number => {
      doc
        .rect(left, top - 4, contentWidth, 20)
        .fillColor("#f3f4f6")
        .fill();

      let x = left + 4;
      doc.fillColor(COLOR_TEXT).font("Helvetica-Bold").fontSize(8.5);
      for (const column of COLUMNS) {
        doc.text(column.label, x, top + 1, {
          width: column.width - 8,
          align: column.align,
        });
        x += column.width;
      }
      return top + 22;
    };

    y = drawTableHeader(y);
    doc.font("Helvetica").fontSize(9).fillColor(COLOR_TEXT);

    for (const item of invoice.items) {
      const values = [
        `${item.position}`,
        item.description,
        formatNumber(item.quantity),
        item.unit,
        formatCurrency(item.unitPrice),
        formatCurrency(item.netAmount),
      ];

      const descriptionHeight = doc.heightOfString(item.description, {
        width: (COLUMNS[1]?.width ?? 200) - 8,
      });
      const rowHeight = Math.max(16, descriptionHeight + 6);

      if (y + rowHeight > doc.page.height - 150) {
        doc.addPage();
        y = drawTableHeader(doc.page.margins.top);
        doc.font("Helvetica").fontSize(9).fillColor(COLOR_TEXT);
      }

      let x = left + 4;
      COLUMNS.forEach((column, index) => {
        doc.text(values[index] ?? "", x, y, {
          width: column.width - 8,
          align: column.align,
        });
        x += column.width;
      });

      y += rowHeight;
      doc
        .moveTo(left, y - 3)
        .lineTo(left + contentWidth, y - 3)
        .strokeColor(COLOR_LINE)
        .lineWidth(0.4)
        .stroke();
    }

    // --- Summen ------------------------------------------------------------
    y += 12;
    const totalsLeft = left + contentWidth - 240;
    const totalsWidth = 240;

    const totalRow = (label: string, value: string, bold = false) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 11 : 9.5)
        .fillColor(bold ? COLOR_TEXT : COLOR_MUTED)
        .text(label, totalsLeft, y, { width: totalsWidth * 0.55 });
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor(COLOR_TEXT)
        .text(value, totalsLeft + totalsWidth * 0.55, y, {
          width: totalsWidth * 0.45,
          align: "right",
        });
      y += bold ? 20 : 15;
    };

    totalRow("Nettobetrag", formatCurrency(invoice.netTotal));

    if (invoice.smallBusiness) {
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLOR_MUTED)
        .text(
          "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
          left,
          y,
          { width: contentWidth - 250 },
        );
    } else {
      totalRow(
        `zzgl. ${formatNumber(invoice.vatRate)} % USt.`,
        formatCurrency(invoice.vatTotal),
      );
    }

    doc
      .moveTo(totalsLeft, y - 4)
      .lineTo(totalsLeft + totalsWidth, y - 4)
      .strokeColor(COLOR_TEXT)
      .lineWidth(0.8)
      .stroke();
    y += 4;
    totalRow("Gesamtbetrag", formatCurrency(invoice.grossTotal), true);

    // --- Leistungsbeschreibung --------------------------------------------
    if (snapshot.activities.length > 0) {
      y += 10;
      if (y > doc.page.height - 220) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor(COLOR_TEXT)
        .text("Ausgeführte Arbeiten", left, y);
      y = doc.y + 4;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR_MUTED)
        .text(
          snapshot.activities.map((activity) => `• ${activity}`).join("\n"),
          left,
          y,
          { width: contentWidth, lineGap: 1.5 },
        );
      y = doc.y + 10;
    }

    // --- Zahlungshinweis ---------------------------------------------------
    if (y > doc.page.height - 170) {
      doc.addPage();
      y = doc.page.margins.top;
    }

    const paymentNote = invoice.dueDate
      ? `Bitte überweisen Sie den Gesamtbetrag bis zum ${formatDate(
          invoice.dueDate,
        )} ohne Abzug.`
      : "Bitte überweisen Sie den Gesamtbetrag ohne Abzug.";

    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(COLOR_TEXT)
      .text(paymentNote, left, y + 6, { width: contentWidth });
    y = doc.y + 6;

    if (invoice.outroText) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR_MUTED)
        .text(invoice.outroText, left, y, { width: contentWidth });
      y = doc.y + 6;
    }

    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(COLOR_TEXT)
      .text("Mit freundlichen Grüßen", left, y + 4, { width: contentWidth });
    doc.text(snapshot.seller.ownerName || snapshot.seller.name, {
      width: contentWidth,
    });

    // --- Fußzeile ----------------------------------------------------------
    const footerY = doc.page.height - doc.page.margins.bottom - 42;
    const footerColumns = [
      [
        snapshot.seller.legalName || snapshot.seller.name,
        snapshot.seller.street,
        [snapshot.seller.zip, snapshot.seller.city].filter(Boolean).join(" "),
      ],
      [
        snapshot.seller.taxNumber ? `Steuernummer: ${snapshot.seller.taxNumber}` : null,
        snapshot.seller.vatId ? `USt-IdNr.: ${snapshot.seller.vatId}` : null,
        snapshot.seller.registerInfo,
      ],
      [
        snapshot.seller.bankName,
        snapshot.seller.iban ? `IBAN: ${snapshot.seller.iban}` : null,
        snapshot.seller.bic ? `BIC: ${snapshot.seller.bic}` : null,
      ],
    ];

    doc
      .moveTo(left, footerY - 8)
      .lineTo(left + contentWidth, footerY - 8)
      .strokeColor(COLOR_LINE)
      .lineWidth(0.5)
      .stroke();

    footerColumns.forEach((column, index) => {
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(COLOR_MUTED)
        .text(
          column.filter(Boolean).join("\n"),
          left + (contentWidth / 3) * index,
          footerY,
          { width: contentWidth / 3 - 10 },
        );
    });

    doc.end();
  });
}
