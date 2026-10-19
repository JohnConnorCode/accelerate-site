import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import {
  readPublicTicketOrder,
  readTicketPayment,
  readTicketEvent,
  saveTicketBusinessContext,
} from "@/lib/revenue-os/event-ticketing";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function GET(
  request: NextRequest,
  route: { params: Promise<{ tenantSlug: string; slug: string }> },
) {
  const { tenantSlug, slug } = await route.params;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "public-event-read");
  if (!context) return NextResponse.json({ error: "Workshop not found" }, { status: 404, headers });
  const db = createServiceRoleClient(context);
  try {
    const order = request.nextUrl.searchParams.get("order");
    if (order) {
      const admission = await consumeRateLimit(
        db,
        `ticket-status:${order}`,
        10,
        60000,
        context.tenantId,
      );
      if (!admission.success)
        return rateLimitResponse(
          admission,
          { error: "Please wait before checking again" },
          headers,
        );
      const key = request.nextUrl.searchParams.get("key") || "";
      return NextResponse.json(
        request.nextUrl.searchParams.get("payment") === "1"
          ? await readTicketPayment(db, slug, order, key)
          : (await readPublicTicketOrder(db, slug, order, key)).public,
        { headers },
      );
    }
    const event = await readTicketEvent(db, slug);
    return event
      ? NextResponse.json({ event }, { headers })
      : NextResponse.json({ error: "Workshop not found" }, { status: 404, headers });
  } catch (error) {
    console.error(
      "[events] Public workshop read failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      {
        error:
          "Workshop or order details are temporarily unavailable. Keep your confirmation link and try again.",
      },
      { status: 503, headers },
    );
  }
}
export async function PATCH(
  request: NextRequest,
  route: { params: Promise<{ tenantSlug: string; slug: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json(
      { error: "Open this form from your confirmation page" },
      { status: 403, headers },
    );
  const { tenantSlug, slug } = await route.params;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "public-event-details");
  if (!context) return NextResponse.json({ error: "Workshop not found" }, { status: 404, headers });
  const db = createServiceRoleClient(context);
  try {
    return NextResponse.json(
      await saveTicketBusinessContext(db, slug, await readBoundedJson(request, 5000)),
      { headers },
    );
  } catch (error) {
    console.error(
      "[events] Business context save failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      {
        error: "Your business context could not be saved. Check your confirmation link and retry.",
      },
      { status: 422, headers },
    );
  }
}
