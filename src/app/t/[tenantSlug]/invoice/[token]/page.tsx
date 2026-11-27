import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { readPublicInvoice } from "@/lib/revenue-os/invoices";
import { InvoiceDocument, defaultInvoiceDesign } from "@/components/business/InvoiceDocument";
import { InvoicePayment } from "@/components/business/InvoicePayment";
import { rateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Invoice" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const statusForDocument: Record<string, string> = {
  open: "open",
  processing: "processing",
  paid: "paid",
  paid_external: "paid",
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; token: string }>;
}) {
  const { tenantSlug, token } = await params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`invoice-page:${tenantSlug}:${ip}`, 60, 60000)).success) notFound();
  let view: Awaited<ReturnType<typeof readPublicInvoice>> | undefined;
  try {
    const context = await resolveActiveTenantSystemContext(tenantSlug, "public-invoice-page");
    if (context) view = await readPublicInvoice(createServiceRoleClient(context), token);
  } catch {
    console.warn("[invoice-page] Customer page unavailable");
  }
  if (!view) notFound();
  const { invoice, brand } = view;
  const paid = invoice.status === "paid" || invoice.status === "paid_external";
  const dueLabel = invoice.due_date
    ? new Date(`${invoice.due_date}T00:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "Due on receipt";
  return (
    <main className="min-h-screen px-4 py-8 sm:py-14" style={{ backgroundColor: brand.backgroundColor }}>
      <div className="mx-auto max-w-2xl space-y-6">
        {invoice.livemode === false && (
          <p className="rounded-xl bg-white p-4 text-center text-sm text-black">
            Test invoice · No real payment is collected
          </p>
        )}
        <h1 className="sr-only">Invoice from {brand.name}</h1>
        <InvoiceDocument
          brand={brand}
          design={{
            ...defaultInvoiceDesign,
            introduction: invoice.memo || defaultInvoiceDesign.introduction,
          }}
          invoice={{
            number: invoice.number ?? "Invoice",
            customerName: invoice.customer_name,
            customerEmail: invoice.customer_email,
            currency: "usd",
            lines: invoice.lines.map((line) => ({
              description:
                line.quantity > 1
                  ? `${line.description} (${line.quantity} × $${(line.unitCents / 100).toFixed(2)})`
                  : line.description,
              amount: line.quantity * line.unitCents,
            })),
            total: invoice.total_cents,
            amountPaid: paid ? invoice.total_cents : 0,
            amountRemaining: paid ? 0 : invoice.total_cents,
            status: statusForDocument[invoice.status] ?? invoice.status,
            dueLabel,
            paymentUrl: null,
          }}
        />
        {invoice.status === "open" || invoice.status === "processing" ? (
          <InvoicePayment tenantSlug={tenantSlug} token={token} accentColor={brand.accentColor} />
        ) : null}
      </div>
    </main>
  );
}
