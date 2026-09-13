import { notFound } from "next/navigation";
import { SubscriptionPlanGrid } from "@/components/billing/SubscriptionPlanGrid";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";

export const dynamic = "force-dynamic";

export default async function SubscribePage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "customer-subscribe");
  if (!context) notFound();
  const db = createServiceRoleClient(context);
  const [{ data: tenant }, { data: plans, error }] = await Promise.all([
    db.from("tenants").select("name").eq("id", context.tenantId).maybeSingle(),
    db.from("billing_plans").select("id,name,description,currency,interval,amount").eq("active", true).order("amount"),
  ]);
  if (error) throw new Error("Subscription plans could not be loaded");
  return (
    <main className="min-h-screen bg-[var(--admin-surface)] px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/50">{tenant?.name || "Workspace"} · Plans</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Choose the plan that fits your next stage.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-black/60">Simple recurring billing. You can change or cancel at your next renewal from your account.</p>
        <div className="mt-10"><SubscriptionPlanGrid tenantSlug={tenantSlug} plans={plans ?? []} /></div>
        <p className="mt-8 text-sm text-black/50">Already subscribed? <a className="font-semibold underline" href={`/t/${tenantSlug}/account`}>Open your account</a>.</p>
      </div>
    </main>
  );
}
