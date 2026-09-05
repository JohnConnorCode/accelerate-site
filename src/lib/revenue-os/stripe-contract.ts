import { z } from "zod";
export const invoiceLineSchema = z
  .object({
    description: z.string().trim().min(1).max(200),
    quantity: z.number().int().min(1).max(10000),
    unitAmount: z.number().int().min(1).max(100000000),
  })
  .strict();
export const stripeInvoiceInputSchema = z
  .object({
    contactId: z.uuid(),
    customerId: z.string().regex(/^cus_[A-Za-z0-9]{1,80}$/),
    currency: z.enum(["usd", "eur", "gbp", "cad", "aud"]),
    daysUntilDue: z.number().int().min(1).max(90),
    memo: z.string().trim().max(500),
    lines: z.array(invoiceLineSchema).min(1).max(10),
  })
  .strict()
  .refine(
    (input) =>
      input.lines.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0) <= 100000000,
    { message: "Invoice total must not exceed 100,000,000 minor currency units" },
  );
export type StripeInvoiceInput = z.infer<typeof stripeInvoiceInputSchema>;
export type StripeInvoiceReceipt = {
  invoiceId: string;
  status: string;
  currency: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  customerEmail: string | null;
  testMode: boolean;
  hostedInvoiceUrl: string | null;
  providerRequestId: string | null;
  delivery: "not_requested" | "not_sent_test_mode" | "requested";
  complete: boolean;
};
