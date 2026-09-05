import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { readPublicInvoicePage } from "@/lib/revenue-os/invoice-pages";
import { InvoiceDocument } from "@/components/business/InvoiceDocument";
import { rateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Customer invoice" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; token: string }>;
}) {
  const { tenantSlug, token } = await params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`invoice-page:${tenantSlug}:${ip}`, 60, 60000).success) notFound();
  let document;
  try {
    const context = await resolveActiveTenantSystemContext(tenantSlug, "public-invoice-page");
    if (context) document = await readPublicInvoicePage(createServiceRoleClient(context), token);
  } catch {
    console.warn("[invoice-page] Customer page unavailable");
  }
  if (!document) notFound();
  return (
    <main
      className="min-h-screen px-4 py-8 sm:py-14"
      style={{ backgroundColor: document.brand.backgroundColor }}
    >
      <div className="mx-auto max-w-2xl">
        {document.testMode && (
          <p className="mb-4 rounded-xl bg-white p-4 text-center text-sm text-black">
            Test invoice · No real payment is collected
          </p>
        )}
        <h1 className="sr-only">Invoice from {document.brand.name}</h1>
        <InvoiceDocument
          brand={document.brand}
          invoice={document.document}
          design={document.design}
        />
      </div>
    </main>
  );
}
