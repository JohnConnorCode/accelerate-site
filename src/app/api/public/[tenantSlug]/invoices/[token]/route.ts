import { NextRequest, NextResponse } from "next/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { invoicePaymentDetails } from "@/lib/revenue-os/invoices";
import { rateLimit } from "@/lib/rate-limit";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** Payment Element details for one invoice, addressed only by its link token. */
export async function GET(
  request: NextRequest,
  route: { params: Promise<{ tenantSlug: string; token: string }> },
) {
  const { tenantSlug, token } = await route.params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`invoice-payment:${tenantSlug}:${ip}`, 30, 60000)).success)
    return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429, headers });
  try {
    const context = await resolveActiveTenantSystemContext(tenantSlug, "public-invoice-payment");
    if (!context) return NextResponse.json({ error: "Invoice unavailable" }, { status: 404, headers });
    return NextResponse.json(
      await invoicePaymentDetails(createServiceRoleClient(context), token),
      { headers },
    );
  } catch {
    console.warn("[invoice-payment] Payment details unavailable");
    return NextResponse.json(
      { error: "Payment is temporarily unavailable. Reload the invoice and try again." },
      { status: 422, headers },
    );
  }
}
