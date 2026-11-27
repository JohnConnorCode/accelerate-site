import { discountPercent, invoiceStatusLabels, invoiceSubtotal, type InvoiceDraft } from "./schema";

type FigureSource = Pick<InvoiceDraft, "lines" | "discount_cents" | "discount_label">;

/** The discount line always states the percentage the amounts produce; a typed
 * percentage in the label is replaced rather than trusted. */
export function discountLabel(invoice: FigureSource): string {
  const percent = discountPercent(invoice.discount_cents || 0, invoiceSubtotal(invoice.lines));
  const stored = (invoice.discount_label || "").trim();
  if (percent === null) return stored || "Agreed discount";
  if (/\d+(?:\.\d+)?\s*%/.test(stored)) return stored.replace(/\d+(?:\.\d+)?\s*%/g, `${percent}%`);
  if (!stored || stored.toLowerCase() === "agreed discount") return `${percent}% discount`;
  return `${stored} (${percent}%)`;
}

/** One calculation for the recipient page, the admin preview and the PDF. */
export function invoiceFigures(invoice: FigureSource) {
  const total = invoiceSubtotal(invoice.lines);
  const subtotal = Number.isSafeInteger(total) ? total : 0;
  const discount = invoice.discount_cents || 0;
  return { subtotal, discount, due: subtotal - discount, discountLabel: discountLabel(invoice) };
}

type StatusSource = { status?: string | null };
export function invoiceStatusLabel(invoice: StatusSource, preview = false): string {
  if (!invoice.status || invoice.status === "draft") return preview ? "DRAFT PREVIEW" : "DRAFT";
  return (
    invoiceStatusLabels[invoice.status as keyof typeof invoiceStatusLabels] ?? "Status unavailable"
  ).toUpperCase();
}
export function invoiceTotalLabel(status?: string | null): string {
  return status === "paid" || status === "paid_external"
    ? "Total paid"
    : status === "void"
      ? "Original total"
      : "Total due";
}
export function invoiceTermsLabel(invoice: Pick<InvoiceDraft, "due_date" | "due_days">): string {
  return invoice.due_date
    ? "Due on stated date"
    : invoice.due_days === 0
      ? "Due upon receipt"
      : `Net ${invoice.due_days || 15}`;
}
export function invoiceTaxLabel(review: InvoiceDraft["tax_review"]): string {
  return review === "pending"
    ? "Review required"
    : review === "tax_included"
      ? "Included"
      : "Not applied";
}
