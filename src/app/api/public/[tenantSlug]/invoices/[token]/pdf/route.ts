import { NextRequest, NextResponse } from "next/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { invoicePdf } from "@/lib/revenue-os/invoices";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  route: { params: Promise<{ tenantSlug: string; token: string }> },
) {
  const { tenantSlug, token } = await route.params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`invoice-pdf:${tenantSlug}:${ip}`, 20, 60000)).success)
    return NextResponse.json({ error: "Too many downloads. Wait a minute." }, { status: 429 });
  try {
    const context = await resolveActiveTenantSystemContext(tenantSlug, "public-invoice-pdf");
    if (!context) return NextResponse.json({ error: "Invoice unavailable" }, { status: 404 });
    const { bytes, filename } = await invoicePdf(createServiceRoleClient(context), token);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    console.warn("[invoice-pdf] PDF unavailable");
    return NextResponse.json({ error: "The PDF could not be prepared. Try again shortly." }, { status: 422 });
  }
}
