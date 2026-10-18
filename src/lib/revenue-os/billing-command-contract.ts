import { z } from "zod";

export const billingCommandSchema = z.discriminatedUnion("operation", [
  z
    .object({ operation: z.literal("create_customer"), contactId: z.uuid(), requestId: z.uuid() })
    .strict(),
  z
    .object({
      operation: z.literal("void_invoice"),
      invoiceId: z.string().regex(/^in_[A-Za-z0-9]{1,80}$/),
      requestId: z.uuid(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("refund_payment"),
      chargeId: z.string().regex(/^ch_[A-Za-z0-9]{1,120}$/),
      amount: z.number().int().positive().max(100000000),
      reason: z.enum(["requested_by_customer", "duplicate"]),
      requestId: z.uuid(),
    })
    .strict(),
]);
export type BillingCommand = z.infer<typeof billingCommandSchema>;
export const billingPreviewInputSchema = z.object({ command: billingCommandSchema }).strict();
export const billingProposalInputSchema = billingPreviewInputSchema
  .extend({ digest: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const billingApprovalSchema = z
  .object({
    command: billingCommandSchema,
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    snapshot: z.record(z.string(), z.unknown()),
    review: z.record(z.string(), z.string()),
  })
  .strict();
export type BillingPreview = z.infer<typeof billingApprovalSchema>;
export type BillingReceipt = {
  operation: BillingCommand["operation"];
  providerId: string;
  status: string;
  message: string;
  testMode: boolean;
  providerRequestId: string | null;
  reconciled?: boolean;
};

export const paymentEntrySchema = z.object({
  id: z.string().regex(/^ch_[A-Za-z0-9]{1,120}$/),
  amount: z.number().int().nonnegative(),
  captured: z.number().int().nonnegative(),
  refunded: z.number().int().nonnegative(),
  currency: z.string().regex(/^[a-z]{3}$/),
  status: z.enum(["succeeded", "pending", "failed"]),
  createdAt: z.iso.datetime(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  description: z.string().nullable(),
  receiptUrl: z.url().nullable(),
  refundable: z.boolean(),
  workspaceOwned: z.boolean(),
  ownershipNeedsCheck: z.boolean().optional(),
  disputed: z.boolean(),
});
export type BillingPayment = z.infer<typeof paymentEntrySchema>;
export const paymentPageSchema = z
  .object({
    payments: z.array(paymentEntrySchema).max(50),
    hasMore: z.boolean(),
    nextCursor: z
      .string()
      .regex(/^ch_[A-Za-z0-9]{1,120}$/)
      .nullable(),
    connection: z.string(),
    testMode: z.boolean(),
  })
  .refine((page) => !page.hasMore || (page.payments.length > 0 && page.nextCursor !== null));

export function paymentOverview(payments: BillingPayment[]) {
  const balances = new Map<string, { captured: number; refunded: number; retained: number }>();
  for (const payment of payments) {
    if (payment.status !== "succeeded") continue;
    const row = balances.get(payment.currency) ?? { captured: 0, refunded: 0, retained: 0 };
    row.captured += payment.captured;
    row.refunded += payment.refunded;
    row.retained += payment.captured - payment.refunded;
    balances.set(payment.currency, row);
  }
  return [...balances].sort(([a], [b]) => a.localeCompare(b));
}

export function paymentsCsv(payments: BillingPayment[]) {
  const cell = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@\-]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return [
    [
      "Payment",
      "Created",
      "Customer",
      "Email",
      "Currency",
      "Captured minor units",
      "Refunded minor units",
      "Retained before fees minor units",
      "Status",
      "Disputed",
    ],
    ...payments.map((p) => [
      p.id,
      p.createdAt,
      p.name,
      p.email,
      p.currency.toUpperCase(),
      p.captured,
      p.refunded,
      p.captured - p.refunded,
      p.status,
      p.disputed,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}

export const billingReadInputSchema = z
  .object({
    kind: z.enum(["invoices", "payments"]),
    cursor: z.string().max(124).optional(),
    connection: z.string().max(160).optional(),
  })
  .strict();
export const BILLING_OPERATION_BINDINGS = {
  get_billing_records: {
    id: "billing.records.read",
    version: 1,
    scope: "workspace",
    entrypoints: [
      { path: "/api/admin/invoicing/list", method: "GET" },
      { path: "/api/admin/invoicing/payments", method: "GET" },
    ],
    verification: ["scripts/test-billing-workspace.ts"],
  },
  preview_billing_change: {
    id: "billing.change.preview",
    version: 1,
    scope: "workspace",
    entrypoints: [{ path: "/api/admin/invoicing/commands", method: "POST", variant: "preview" }],
    verification: ["scripts/test-billing-workspace.ts"],
  },
  propose_billing_change: {
    id: "billing.change.propose",
    version: 1,
    scope: "workspace",
    entrypoints: [{ path: "/api/admin/invoicing/commands", method: "POST", variant: "propose" }],
    verification: ["scripts/test-billing-workspace.ts"],
  },
} as const;
