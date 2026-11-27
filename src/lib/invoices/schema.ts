import { z } from "zod";

/** Invoice draft shape, ported from SuperDebate's invoicing (client invoices
 * only). Accelerate adds the payment methods the customer may use. */
export const INVOICE_PAYMENT_METHODS = ["us_bank_account", "card"] as const;
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];
export const invoicePaymentMethodLabels: Record<InvoicePaymentMethod, string> = {
  us_bank_account: "Bank transfer (ACH)",
  card: "Card",
};

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "Add a description.").max(240),
  quantity: z.number().int().min(1).max(1000),
  unit_cents: z.number().int().min(1, "Enter a rate.").max(100_000_000),
});

export const invoiceKinds = { services: "Services", general: "General" } as const;
const country = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Use a two-letter country code.");

export const invoiceDraftSchema = z
  .object({
    contact_id: z.uuid().nullable().default(null),
    kind: z.enum(["services", "general"]).default("services"),
    due_days: z.number().int().min(0).max(365).default(15),
    invoice_date: z.iso
      .date("Enter a valid invoice date.")
      .nullish()
      .transform((v) => v ?? null),
    due_date: z.iso
      .date("Enter a valid due date.")
      .nullish()
      .transform((v) => v ?? null),
    discount_cents: z.number().int().min(0).max(100_000_000).default(0),
    discount_label: z.string().trim().max(40).default("Agreed discount"),
    company_name: z.string().trim().min(1, "Enter the client name.").max(160),
    contact_name: z.string().trim().min(1, "Enter the contact name.").max(120),
    contact_email: z.string().trim().email("Enter a valid email address.").max(254),
    billing_line1: z.string().trim().max(160).default(""),
    billing_line2: z.string().trim().max(160).default(""),
    billing_city: z.string().trim().max(100).default(""),
    billing_region: z.string().trim().max(100).default(""),
    billing_postal: z.string().trim().max(20).default(""),
    billing_country: country.default("US"),
    purchase_order: z.string().trim().max(100).default(""),
    description: z.string().trim().min(1, "Describe what this invoice covers.").max(240),
    support_details: z.string().trim().max(240).default(""),
    service_period: z.string().trim().max(160).default(""),
    notes: z.string().trim().max(500).default(""),
    tax_review: z.enum(["pending", "no_tax", "tax_included"]).default("no_tax"),
    lines: z.array(invoiceLineSchema).min(1).max(20),
    payment_methods: z
      .array(z.enum(INVOICE_PAYMENT_METHODS))
      .min(1, "Allow at least one payment method.")
      .max(2)
      .default(["us_bank_account", "card"]),
  })
  .superRefine((draft, context) => {
    if (draft.invoice_date && draft.due_date && draft.due_date < draft.invoice_date)
      context.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "Due date cannot precede the invoice date.",
      });
    if (new Set(draft.payment_methods).size !== draft.payment_methods.length)
      context.addIssue({
        code: "custom",
        path: ["payment_methods"],
        message: "Choose each payment method once.",
      });
    const percent = discountPercent(draft.discount_cents, invoiceSubtotal(draft.lines));
    for (const field of ["notes", "support_details", "description", "discount_label"] as const) {
      const stale = [
        ...draft[field].matchAll(/(\d+(?:\.\d+)?)\s*%\s+(?:[a-z]+\s+)?(?:discount|off)\b/gi),
      ].find((match) => percent === null || Number.parseFloat(match[1]!) !== percent);
      if (stale)
        context.addIssue({
          code: "custom",
          path: [field],
          message:
            percent === null
              ? `Remove "${stale[0]}": this invoice has no discount.`
              : `"${stale[0]}" does not match this invoice. The discount is ${percent}% of the full price.`,
        });
    }
    try {
      invoiceTotal(draft.lines, draft.discount_cents);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: [
          invoiceSubtotal(draft.lines) < 1 || invoiceSubtotal(draft.lines) > 100_000_000
            ? "lines"
            : "discount_cents",
        ],
        message: error instanceof Error ? error.message : "Invalid invoice total.",
      });
    }
  });

export type InvoiceDraft = z.infer<typeof invoiceDraftSchema>;
export const INVOICE_STATUSES = [
  "draft",
  "open",
  "processing",
  "paid",
  "paid_external",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  open: "Unpaid",
  processing: "Payment processing",
  paid: "Paid",
  paid_external: "Paid externally",
  void: "Void",
};

/** One saved invoice as the admin workspace sees it. */
export type CommercialInvoice = InvoiceDraft & {
  id: string;
  mode: "test" | "live" | null;
  status: InvoiceStatus;
  amount_cents: number;
  invoice_number: string | null;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  refunded_cents: number;
  external_payment_note: string;
  revision: number;
  created_at: string;
  updated_at: string;
  share_url: string | null;
};

/** Whole percent unless the split is genuinely fractional (12.5%). */
export function discountPercent(discountCents: number, subtotalCents: number): number | null {
  if (!discountCents || !Number.isSafeInteger(subtotalCents) || subtotalCents <= 0) return null;
  const exact = (discountCents / subtotalCents) * 100;
  return Math.abs(exact - Math.round(exact)) < 0.05
    ? Math.round(exact)
    : Math.round(exact * 10) / 10;
}
export function invoiceSubtotal(lines: InvoiceDraft["lines"]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unit_cents, 0);
}
export function invoiceTotal(lines: InvoiceDraft["lines"], discountCents = 0): number {
  const total = invoiceSubtotal(lines);
  if (!Number.isSafeInteger(total) || total < 1 || total > 100_000_000)
    throw new Error("Invoice total must be between $0.01 and $1,000,000.");
  if (!Number.isSafeInteger(discountCents) || discountCents < 0 || discountCents >= total)
    throw new Error("Discount must be less than the full price and cannot be negative.");
  const amountDue = total - discountCents;
  if (amountDue > 99_999_999) throw new Error("Amount due cannot exceed $999,999.99.");
  if (amountDue < 50) throw new Error("Invoice amount due must be at least $0.50.");
  return amountDue;
}
export function formatBillingAddress(
  draft: Pick<
    InvoiceDraft,
    | "billing_line1"
    | "billing_line2"
    | "billing_city"
    | "billing_region"
    | "billing_postal"
    | "billing_country"
  >,
): string {
  if (!draft.billing_line1) return "";
  return [
    draft.billing_line1,
    draft.billing_line2,
    [draft.billing_city, [draft.billing_region, draft.billing_postal].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    draft.billing_country,
  ]
    .filter(Boolean)
    .join("\n");
}
export const emptyInvoiceDraft = (): InvoiceDraft => ({
  contact_id: null,
  kind: "services",
  due_days: 15,
  invoice_date: null,
  due_date: null,
  discount_cents: 0,
  discount_label: "Agreed discount",
  company_name: "",
  contact_name: "",
  contact_email: "",
  billing_line1: "",
  billing_line2: "",
  billing_city: "",
  billing_region: "",
  billing_postal: "",
  billing_country: "US",
  purchase_order: "",
  description: "",
  support_details: "",
  service_period: "",
  notes: "",
  tax_review: "no_tax",
  lines: [{ description: "", quantity: 1, unit_cents: 0 }],
  payment_methods: ["us_bank_account", "card"],
});
export const invoiceLinkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const invoicePath = (tenantSlug: string, token: string) =>
  `/t/${encodeURIComponent(tenantSlug)}/invoice/${token}`;
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
