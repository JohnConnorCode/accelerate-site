import "server-only";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import { formatBillingAddress, invoiceKinds, type CommercialInvoice } from "./schema";
import type { InvoiceBrand } from "./brand";
import { invoiceDueLabel } from "./service-dates";
import {
  invoiceFigures,
  invoiceStatusLabel,
  invoiceTaxLabel,
  invoiceTermsLabel,
  invoiceTotalLabel,
} from "./figures";

/**
 * The recipient's downloadable record. It is drawn from the same figures as
 * the invoice page (`invoiceFigures`), so the PDF can never show a different
 * total, discount or percentage from the page the recipient paid on.
 */
const PAGE = { width: 612, height: 792, margin: 54 };
const INK = rgb(0.09, 0.09, 0.09),
  MUTED = rgb(0.38, 0.36, 0.32),
  RULE = rgb(0.9, 0.88, 0.84),
  TINT = rgb(0.973, 0.961, 0.933);
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const longDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" })
    : "Upon issue";

type Pen = { page: PDFPage; y: number };

export async function renderInvoicePdf(
  invoice: CommercialInvoice,
  brand: InvoiceBrand,
  logo?: Uint8Array | null,
): Promise<Uint8Array> {
  const accent: RGB = rgb(0.067, 0.067, 0.067);
  const accentText: RGB = rgb(0.2, 0.2, 0.2);
  const doc = await PDFDocument.create();
  doc.setTitle(`${brand.name} invoice ${invoice.invoice_number || ""}`.trim());
  doc.setAuthor(brand.name);
  doc.setCreator(brand.name);
  doc.setProducer(brand.name);
  const regular = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mark: PDFImage | null = logo ? await doc.embedPng(logo).catch(() => null) : null;
  const { width, margin } = PAGE,
    right = width - margin,
    content = right - margin;

  const pen: Pen = { page: doc.addPage([PAGE.width, PAGE.height]), y: PAGE.height - margin };
  const ensure = (height: number) => {
    if (pen.y - height < margin + 40) {
      pen.page = doc.addPage([PAGE.width, PAGE.height]);
      pen.y = PAGE.height - margin;
    }
  };
  const text = (value: string, x: number, y: number, size: number, font = regular, color = INK) =>
    pen.page.drawText(clean(value, font), { x, y, size, font, color });
  const textRight = (
    value: string,
    x: number,
    y: number,
    size: number,
    font = regular,
    color = INK,
  ) => {
    const v = clean(value, font);
    pen.page.drawText(v, { x: x - font.widthOfTextAtSize(v, size), y, size, font, color });
  };
  const paragraph = (
    value: string,
    x: number,
    maxWidth: number,
    size: number,
    font = regular,
    color = INK,
    leading = size * 1.5,
  ) => {
    for (const line of wrap(clean(value, font), font, size, maxWidth)) {
      ensure(leading);
      text(line, x, pen.y, size, font, color);
      pen.y -= leading;
    }
  };
  const label = (value: string, x: number, y: number) =>
    text(value.toUpperCase(), x, y, 7.5, bold, MUTED);

  // Header: brand, document type and status.
  pen.page.drawRectangle({ x: 0, y: PAGE.height - 6, width, height: 6, color: accent });
  const top = pen.y;
  let brandX = margin;
  if (mark) {
    const h = 30,
      w = (mark.width / mark.height) * h;
    pen.page.drawImage(mark, { x: margin, y: top - h + 6, width: w, height: h });
    brandX += w + 10;
  }
  text(brand.name.toUpperCase(), brandX, top - 8, 15, bold);
  text(`${invoiceKinds[invoice.kind].toUpperCase()} INVOICE`, brandX, top - 21, 7.5, bold, MUTED);
  textRight(invoiceStatusLabel(invoice), right, top - 8, 10, bold, accentText);
  pen.y = top - 64;

  // Title, number and description.
  text("Invoice", margin, pen.y, 28, bold);
  textRight("INVOICE NO.", right, pen.y + 14, 7.5, bold, MUTED);
  textRight(invoice.invoice_number || "Assigned when issued", right, pen.y, 12, bold);
  pen.y -= 22;
  paragraph(invoice.description, margin, content * 0.68, 11, regular, MUTED);
  if (invoice.service_period)
    paragraph(invoice.service_period, margin, content * 0.68, 10, bold, accentText);
  pen.y -= 14;

  // Dates and terms.
  const meta: Array<[string, string]> = [
    [
      "Issued",
      longDate(invoice.invoice_date ? invoice.invoice_date + "T00:00:00Z" : invoice.issued_at),
    ],
    ["Due", invoiceDueLabel(invoice)],
    ["Terms", `${invoiceTermsLabel(invoice)} · USD`],
  ];
  if (invoice.purchase_order) meta.push(["PO number", invoice.purchase_order]);
  if (invoice.paid_at && (invoice.status === "paid" || invoice.status === "paid_external"))
    meta.push(["Paid", longDate(invoice.paid_at)]);
  const column = content / meta.length;
  const metaLines = meta.map(([, value]) => wrap(clean(value, bold), bold, 9.5, column - 24));
  const metaHeight = 34 + Math.max(...metaLines.map((lines) => lines.length)) * 14;
  ensure(metaHeight + 20);
  pen.page.drawRectangle({
    x: margin,
    y: pen.y - metaHeight + 12,
    width: content,
    height: metaHeight,
    color: TINT,
  });
  meta.forEach(([name], index) => {
    label(name, margin + 12 + column * index, pen.y - 6);
    metaLines[index]?.forEach((line, row) =>
      text(line, margin + 12 + column * index, pen.y - 22 - row * 14, 9.5, bold),
    );
  });
  pen.y -= metaHeight + 20;

  // Keep both parties together; long fields wrap without dropping characters.
  const half = content / 2;
  const partyLines = [
    [brand.legalName, brand.address],
    [
      invoice.company_name,
      invoice.billing_line1 ? formatBillingAddress(invoice) : "",
      invoice.contact_name,
      invoice.contact_email,
    ],
  ].map((fields) =>
    fields.filter(Boolean).flatMap((value) => wrap(clean(value, regular), regular, 9.5, half - 20)),
  );
  const partyHeight = 18 + Math.max(...partyLines.map((lines) => lines.length)) * 14;
  ensure(partyHeight + 18);
  const partiesTop = pen.y;
  partyLines.forEach((lines, side) => {
    const x = margin + half * side;
    label(side ? "Bill to" : "Issued by", x, partiesTop);
    lines.forEach((line, row) =>
      text(line, x, partiesTop - 15 - row * 14, 9.5, regular, row ? MUTED : INK),
    );
  });
  pen.y -= partyHeight + 18;

  // Agreement details.
  if (invoice.support_details) {
    ensure(40);
    label("Agreement details", margin, pen.y);
    pen.y -= 15;
    paragraph(invoice.support_details, margin, content, 9.5, regular, INK, 14);
    pen.y -= 6;
  }
  pen.y -= 12;

  // Line items.
  const cols = { qty: right - 190, rate: right - 100, amount: right };
  const tableHead = () => {
    pen.page.drawRectangle({ x: margin, y: pen.y - 8, width: content, height: 24, color: TINT });
    label("Description", margin + 10, pen.y);
    textRight("QTY", cols.qty, pen.y, 7.5, bold, MUTED);
    textRight("RATE", cols.rate, pen.y, 7.5, bold, MUTED);
    textRight("AMOUNT", cols.amount - 10, pen.y, 7.5, bold, MUTED);
    pen.y -= 30;
  };
  ensure(60);
  tableHead();
  invoice.lines.forEach((line, index) => {
    const lines = wrap(clean(line.description, bold), bold, 10, cols.qty - margin - 70);
    const period =
      index === 0 && invoice.service_period
        ? wrap(clean(invoice.service_period, regular), regular, 8.5, cols.qty - margin - 70)
        : [];
    const pageBefore = pen.page;
    ensure(lines.length * 14 + period.length * 13 + 54);
    if (pen.page !== pageBefore) tableHead();
    const rowTop = pen.y;
    textRight(String(line.quantity), cols.qty, rowTop, 10);
    textRight(money(line.unit_cents), cols.rate, rowTop, 10);
    textRight(money(line.quantity * line.unit_cents), cols.amount - 10, rowTop, 10, bold);
    for (const part of lines) {
      text(part, margin + 10, pen.y, 10, bold);
      pen.y -= 14;
    }
    for (const part of period) {
      text(part, margin + 10, pen.y, 8.5, regular, MUTED);
      pen.y -= 13;
    }
    pen.y -= 8;
    pen.page.drawLine({
      start: { x: margin, y: pen.y + 6 },
      end: { x: right, y: pen.y + 6 },
      thickness: 0.6,
      color: RULE,
    });
    pen.y -= 14;
  });
  pen.y -= 10;

  // Totals.
  ensure(180);
  const figures = invoiceFigures(invoice);
  const totalsX = right - 230;
  const row = (name: string, value: string, strong = false) => {
    const size = strong ? 11 : 9.5,
      font = strong ? bold : regular;
    const labelWidth = right - 10 - totalsX - font.widthOfTextAtSize(clean(value, font), size) - 16;
    const lines = wrap(clean(name, font), font, size, labelWidth);
    textRight(value, right - 10, pen.y, size, font);
    lines.forEach((line, index) =>
      text(line, totalsX, pen.y - index * 14, size, font, strong ? INK : MUTED),
    );
    pen.y -= Math.max(strong ? 22 : 17, lines.length * 14 + 3);
  };
  row("Subtotal", money(figures.subtotal));
  if (figures.discount) row(figures.discountLabel, `-${money(figures.discount)}`);
  row("Tax", invoiceTaxLabel(invoice.tax_review));
  ensure(30);
  pen.page.drawLine({
    start: { x: totalsX, y: pen.y + 10 },
    end: { x: right, y: pen.y + 10 },
    thickness: 1,
    color: INK,
  });
  pen.y -= 6;
  row(invoiceTotalLabel(invoice.status), money(invoice.amount_cents), true);
  if (invoice.status === "paid" || invoice.status === "paid_external")
    row("Balance due", money(0), true);
  pen.y -= 10;

  if (invoice.notes) {
    ensure(40);
    label("Notes", margin, pen.y);
    pen.y -= 15;
    paragraph(invoice.notes, margin, content, 9.5, regular, MUTED, 14);
  }

  // Footer on every page.
  for (const page of doc.getPages()) {
    page.drawLine({
      start: { x: margin, y: margin + 14 },
      end: { x: right, y: margin + 14 },
      thickness: 0.6,
      color: RULE,
    });
    const thanks = clean(`Thank you for working with ${brand.name}.`, regular);
    page.drawText(thanks, { x: margin, y: margin, size: 8.5, font: regular, color: MUTED });
    const domain = clean(brand.domain, bold);
    page.drawText(domain, {
      x: right - bold.widthOfTextAtSize(domain, 8.5),
      y: margin,
      size: 8.5,
      font: bold,
      color: accentText,
    });
  }
  return doc.save();
}

/** Never silently remove a client's name or agreed terms to fit a PDF font. */
export class InvoicePdfTextError extends Error {}
const SUBSTITUTES: Record<string, string> = {
  "−": "-",
  "‑": "-",
  " ": " ",
  " ": " ",
  "→": "->",
  " ": " ",
};
function clean(value: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  const normalized = [...value.normalize("NFC").replace(/\r\n?/g, "\n")]
    .map((char) => SUBSTITUTES[char] ?? char)
    .join("");
  if ([...normalized].some((char) => char !== "\n" && !supported.has(char.codePointAt(0)!)))
    throw new InvoicePdfTextError("This invoice contains text the PDF font cannot represent.");
  return normalized;
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  return value.split("\n").flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    return [...lines, line];
  });
}
