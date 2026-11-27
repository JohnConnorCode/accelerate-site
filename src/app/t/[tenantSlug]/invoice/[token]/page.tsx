import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { readPublicInvoice } from "@/lib/revenue-os/invoices";
import { InvoiceExperience } from "@/components/invoices/InvoiceExperience";
import { rateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Private invoice" },
  description: "Review your invoice and pay securely.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/** Customer invoice page, ported from SuperDebate's client invoice experience. */
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
  return (
    <main className="min-h-screen bg-[#eeece7] px-4 py-8 text-[#171717] sm:py-12">
      {invoice.mode === "test" && (
        <p className="mx-auto mb-4 max-w-[1060px] rounded-xl bg-white p-3 text-center text-sm">
          Test invoice · No real payment is collected
        </p>
      )}
      <InvoiceExperience
        invoice={invoice}
        brand={brand}
        apiUrl={`/api/public/${encodeURIComponent(tenantSlug)}/invoices/${encodeURIComponent(token)}`}
        amount={invoice.amount_cents}
      />
    </main>
  );
}
