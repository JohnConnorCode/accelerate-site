import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { tenantStripeClient } from "@/lib/revenue-os/stripe-adapter";

const invoiceSchema = z.object({
  id: z.string().regex(/^in_[A-Za-z0-9]{1,80}$/),
  number: z.string().nullable().optional(),
  status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).nullable().optional(),
  currency: z
    .string()
    .regex(/^[a-z]{3}$/)
    .nullable()
    .optional(),
  amount_due: z.number().nullable().optional(),
  amount_remaining: z.number().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_email: z.string().nullable().optional(),
  created: z.number(),
  due_date: z.number().nullable().optional(),
  hosted_invoice_url: z.string().url().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("stripe-invoicing");
  if (auth instanceof NextResponse) return auth;
  const cursor = request.nextUrl.searchParams.get("starting_after") || undefined;
  if (cursor && !/^in_[A-Za-z0-9]{1,80}$/.test(cursor))
    return NextResponse.json({ error: "Invalid invoice cursor" }, { status: 400 });
  try {
    const { object } = await (await tenantStripeClient(auth.database)).invoices(cursor);
    const response = z
      .object({ data: z.array(z.unknown()), has_more: z.boolean() })
      .safeParse(object);
    if (!response.success) throw new Error("Stripe returned an unexpected invoice list");
    const invoices = response.data.data.map((value) => invoiceSchema.parse(value));
    return NextResponse.json({
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number ?? null,
        status: invoice.status ?? null,
        currency: invoice.currency ?? null,
        amountDue: invoice.amount_due ?? null,
        remaining: invoice.amount_remaining ?? null,
        contactName: invoice.customer_name ?? null,
        contactEmail: invoice.customer_email ?? null,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        createdAt: new Date(invoice.created * 1000).toISOString(),
      })),
      hasMore: response.data.has_more,
      nextCursor: invoices.length ? invoices[invoices.length - 1]!.id : null,
    });
  } catch (error) {
    console.error("[invoicing] Invoice list failed");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invoices could not be loaded" },
      { status: 422 },
    );
  }
}
