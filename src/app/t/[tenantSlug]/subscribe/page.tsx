import { notFound } from "next/navigation";
import { SubscriptionPlanGrid } from "@/components/billing/SubscriptionPlanGrid";
import { PublicBillingShell } from "@/components/billing/PublicBillingShell";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { readWorkspaceBrand } from "@/lib/revenue-os/branding";
import { isModuleEnabled } from "@/lib/revenue-os/modules";

export const dynamic = "force-dynamic";

export default async function SubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { tenantSlug } = await params;
  const { checkout } = await searchParams;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "customer-subscribe");
  if (!context) notFound();
  const db = createServiceRoleClient(context);
  const [{ brand }, { data: tenant }, { data: plans, error }] = await Promise.all([
    readWorkspaceBrand(db),
    db.from("tenants").select("config").eq("id", context.tenantId).maybeSingle(),
    db
      .from("billing_plans")
      .select("id,name,description,currency,interval,amount")
      .eq("active", true)
      .order("amount"),
  ]);
  const billingEnabled = isModuleEnabled(
    "stripe-invoicing",
    tenant?.config as { modules?: Record<string, boolean> } | null,
  );
  return (
    <PublicBillingShell tenantSlug={tenantSlug} brand={brand} active="plans">
      <div className="max-w-3xl">
        {checkout === "cancelled" && (
          <div
            role="status"
            className="mb-8 rounded-2xl border border-[color-mix(in_srgb,var(--billing-ink)_14%,transparent)] bg-white/80 p-4 text-sm leading-6 shadow-sm"
          >
            <p className="font-semibold">Checkout was cancelled.</p>
            <p className="mt-1 text-[color-mix(in_srgb,var(--billing-ink)_68%,transparent)]">
              No subscription was started and no charge was made. Your selected plan is still
              available below.
            </p>
          </div>
        )}
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--billing-accent)]">
          {brand.name} · Plans
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Choose the plan that fits your next stage.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[color-mix(in_srgb,var(--billing-ink)_68%,transparent)]">
          {brand.tagline ||
            "Simple recurring billing, with a clear account for payment details and renewals."}
        </p>
        <div className="mt-10">
          <SubscriptionPlanGrid
            tenantSlug={tenantSlug}
            plans={billingEnabled && !error ? (plans ?? []) : []}
            billingEnabled={billingEnabled}
            plansAvailable={!error}
          />
        </div>
        <p className="mt-8 text-sm text-[color-mix(in_srgb,var(--billing-ink)_60%,transparent)]">
          Already subscribed?{" "}
          <a
            className="font-semibold underline underline-offset-4"
            href={`/t/${tenantSlug}/account`}
          >
            Open your account
          </a>
          .
        </p>
      </div>
    </PublicBillingShell>
  );
}
