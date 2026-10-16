import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { siteUrl } from "@/config/tenant";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { createTicketCheckout, TicketCheckoutClosedError } from "@/lib/revenue-os/event-ticketing";
import { consumeRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  route: { params: Promise<{ tenantSlug: string; slug: string }> },
) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Open checkout from the workshop page" }, { status: 403 });
  const { tenantSlug, slug } = await route.params;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "public-event-checkout");
  if (!context) return NextResponse.json({ error: "Workshop not found" }, { status: 404 });
  const db = createServiceRoleClient(context);
  const admission = await consumeRateLimit(
    db,
    `event-checkout:${slug}`,
    60,
    60000,
    context.tenantId,
  );
  if (!admission.success)
    return rateLimitResponse(admission, {
      error: "Please wait a moment before trying checkout again",
    });
  try {
    return NextResponse.json(
      await createTicketCheckout(
        db,
        slug,
        await readBoundedJson(request, 4000),
        new URL(siteUrl()).origin,
        tenantSlug,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be started";
    if (
      error instanceof ZodError ||
      error instanceof SyntaxError ||
      /JSON request body|body exceeds its size limit/.test(message)
    )
      return NextResponse.json(
        { error: "Check your name, email, and ticket quantity before trying again" },
        { status: /size limit/.test(message) ? 413 : 400 },
      );
    const conflict = /changed|remain|closed|no longer|already used/.test(message);
    return NextResponse.json(
      {
        restartCheckout: error instanceof TicketCheckoutClosedError,
        error: conflict
          ? message
          : "Checkout could not be started. Your admission is not confirmed. Retry with the same details; if payment already succeeded, use your confirmation link.",
      },
      { status: conflict ? 409 : 503 },
    );
  }
}
