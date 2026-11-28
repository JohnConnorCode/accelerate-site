import type { InvoiceDraft } from "./schema";

/** Avoid repeating an identical title/item; preserve every distinct agreement. */
export function invoiceAgreementDetails(
  invoice: Pick<InvoiceDraft, "description" | "support_details" | "lines">,
): string {
  const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
  const details = normalize(invoice.support_details);
  if (
    !details ||
    [invoice.description, ...invoice.lines.map((line) => line.description)].some(
      (text) => normalize(text) === details,
    )
  )
    return "";
  return invoice.support_details;
}
