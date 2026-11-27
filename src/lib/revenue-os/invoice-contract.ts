import { z } from "zod";

/** Browser-safe invoice shapes. Invoices belong to this workspace; Stripe only
 * moves the money through one PaymentIntent per issued invoice. */
export const INVOICE_PAYMENT_METHODS = ["us_bank_account", "card"] as const;
export type InvoicePaymentMethod = (typeof INVOICE_PAYMENT_METHODS)[number];
export const invoicePaymentMethodLabels: Record<InvoicePaymentMethod, string> = {
  us_bank_account: "Bank transfer (ACH)",
  card: "Card",
};

export const invoiceLineSchema = z
  .object({
    description: z.string().trim().min(1, "Describe each line.").max(240),
    quantity: z.number().int().min(1).max(10000),
    unitCents: z.number().int().min(1).max(99_999_999),
  })
  .strict();

export const invoiceDraftSchema = z
  .object({
    contactId: z.uuid().nullable(),
    customerName: z.string().trim().min(1, "Enter who the invoice is for.").max(160),
    customerEmail: z.email("Enter a valid billing email.").max(254),
    lines: z.array(invoiceLineSchema).min(1).max(20),
    memo: z.string().trim().max(1000),
    dueDate: z.iso.date().nullable(),
    paymentMethods: z
      .array(z.enum(INVOICE_PAYMENT_METHODS))
      .min(1, "Allow at least one payment method.")
      .max(2),
  })
  .strict()
  .superRefine((draft, context) => {
    const total = invoiceTotal(draft.lines);
    if (total < 50 || total > 99_999_999)
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Invoice total must be between $0.50 and $999,999.99.",
      });
    if (new Set(draft.paymentMethods).size !== draft.paymentMethods.length)
      context.addIssue({ code: "custom", path: ["paymentMethods"], message: "Duplicate method." });
  });
export type InvoiceDraft = z.infer<typeof invoiceDraftSchema>;
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

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
  open: "Awaiting payment",
  processing: "Payment processing",
  paid: "Paid",
  paid_external: "Paid outside Stripe",
  void: "Void",
};

/** The admin view of one invoice. Never includes the customer link secret
 * except as the full share URL for the workspace's own administrators. */
export type InvoiceRecord = {
  id: string;
  number: string | null;
  contactId: string | null;
  customerName: string;
  customerEmail: string;
  currency: "usd";
  lines: InvoiceLine[];
  totalCents: number;
  amountPaidCents: number;
  refundedCents: number;
  memo: string;
  dueDate: string | null;
  paymentMethods: InvoicePaymentMethod[];
  status: InvoiceStatus;
  testMode: boolean | null;
  issuedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  externalPaymentNote: string;
  revision: number;
  createdAt: string;
  shareUrl: string | null;
};

export const invoiceCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("save_draft"),
      id: z.uuid().nullable(),
      revision: z.number().int().positive().nullable(),
      draft: invoiceDraftSchema,
    })
    .strict(),
  z
    .object({ operation: z.literal("issue"), id: z.uuid(), revision: z.number().int().positive() })
    .strict(),
  z
    .object({ operation: z.literal("void"), id: z.uuid(), revision: z.number().int().positive() })
    .strict(),
  z
    .object({
      operation: z.literal("record_external_payment"),
      id: z.uuid(),
      revision: z.number().int().positive(),
      note: z.string().trim().min(1, "Say how it was paid.").max(300),
    })
    .strict(),
  z.object({ operation: z.literal("refresh_payment"), id: z.uuid() }).strict(),
]);
export type InvoiceCommand = z.infer<typeof invoiceCommandSchema>;

export function invoiceTotal(lines: Pick<InvoiceLine, "quantity" | "unitCents">[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0);
}

export function invoiceMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
}

/** Dollars typed by a person, e.g. "2000" or "1,500.50", to integer cents. */
export function parseDollars(value: string): number {
  const match = value
    .trim()
    .replace(/[$,\s]/g, "")
    .match(/^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error("Enter an amount like 2000 or 1500.50");
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export const invoiceLinkTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const invoicePath = (tenantSlug: string, token: string) =>
  `/t/${encodeURIComponent(tenantSlug)}/invoice/${token}`;
