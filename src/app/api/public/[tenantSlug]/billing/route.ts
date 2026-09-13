import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { createSubscriptionCheckout, readCustomerBilling, updateCustomerSubscription } from "@/lib/revenue-os/subscriptions";
import { readBoundedJson } from "@/lib/http/bounded-json";

async function contextFor(slug: string) {
  return resolveActiveTenantSystemContext(slug, "customer-billing");
}

async function userFor() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return user;
}

export async function GET(_request: NextRequest, route: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await route.params;
  const context = await contextFor(tenantSlug);
  const user = await userFor();
  if (!context || !user) return NextResponse.json({ error: "Sign in to view billing" }, { status: 401 });
  const db = createServiceRoleClient(context);
  try {
    return NextResponse.json(await readCustomerBilling(db, user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Billing could not be read" }, { status: 422 });
  }
}

export async function POST(request: NextRequest, route: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await route.params;
  const context = await contextFor(tenantSlug);
  const user = await userFor();
  if (!context || !user) return NextResponse.json({ error: "Sign in to manage billing" }, { status: 401 });
  const body = await readBoundedJson(request).catch((error) => {
    console.warn(
      "[public/billing] invalid request body:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }) as Record<string, unknown> | null;
  const db = createServiceRoleClient(context);
  try {
    if (body?.action === "checkout") {
      const origin = new URL(request.url).origin;
      return NextResponse.json(await createSubscriptionCheckout(db, {
        planId: String(body.planId || ""),
        requestId: String(body.requestId || crypto.randomUUID()),
        userId: user.id,
        email: user.email || "",
        name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
        origin,
        tenantSlug,
      }));
    }
    if (body?.action === "cancel" || body?.action === "resume" || body?.action === "change") {
      return NextResponse.json(await updateCustomerSubscription(db, user.id, String(body.subscriptionId || ""), body.action, body.action === "change" ? String(body.planId || "") : null, String(body.requestId || crypto.randomUUID()), user.email || user.id));
    }
    return NextResponse.json({ error: "Unknown billing action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Billing action failed" }, { status: 422 });
  }
}
