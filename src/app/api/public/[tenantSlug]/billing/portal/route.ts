import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { tenantStripeClient } from "@/lib/revenue-os/stripe-adapter";
import { stripeHostedUrl } from "@/lib/revenue-os/subscriptions-contract";
import { z } from "zod";

export async function POST(request: NextRequest, route: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await route.params;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "customer-billing-portal");
  const auth = await createServerSupabaseClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!context || !user) return NextResponse.json({ error: "Sign in to manage billing" }, { status: 401 });
  try {
    const db = createServiceRoleClient(context);
    const { data: customer } = await db.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: "No billing account exists yet" }, { status: 404 });
    const client = await tenantStripeClient(db);
    const returnUrl = `${new URL(request.url).origin}/t/${tenantSlug}/account`;
    const result = await client.billingPortal(new URLSearchParams({ customer: z.string().regex(/^cus_[A-Za-z0-9]{1,80}$/).parse(customer.stripe_customer_id), return_url: returnUrl }), `portal:${user.id}:${Date.now()}`);
    const url = stripeHostedUrl(result.object.url, "billing.stripe.com");
    if (!url) throw new Error("Stripe did not return a billing portal URL");
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Billing portal unavailable" }, { status: 422 });
  }
}
