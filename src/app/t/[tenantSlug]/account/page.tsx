import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AccountBilling } from "@/components/billing/AccountBilling";
import { PublicBillingShell } from "@/components/billing/PublicBillingShell";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { readWorkspaceBrand } from "@/lib/revenue-os/branding";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { tenantSlug } = await params;
  const { checkout } = await searchParams;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "customer-account");
  if (!context) notFound();
  const db = createServiceRoleClient(context);
  const [{ brand }, supabase] = await Promise.all([
    readWorkspaceBrand(db),
    createServerSupabaseClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(
      `/login?tenant=${encodeURIComponent(tenantSlug)}&next=${encodeURIComponent(`/t/${tenantSlug}/account`)}`,
    );
  const name =
    typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const emailUpdates = user.user_metadata?.billing_emails !== false;
  return (
    <PublicBillingShell tenantSlug={tenantSlug} brand={brand} active="account">
      <div className="max-w-4xl">
        {checkout === "success" && (
          <div
            role="status"
            className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"
          >
            <p className="font-semibold">Payment complete.</p>
            <p className="mt-1">
              Stripe is confirming your subscription now. If it does not appear within a minute,
              refresh this page.
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--billing-accent)]">
              Customer account
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--billing-ink)_68%,transparent)]">
              Manage your plan, payment method, and invoices from one secure place.
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
            href={`/t/${tenantSlug}/subscribe`}
          >
            View plans
          </a>
        </div>
        <div className="mt-10">
          <AccountBilling
            tenantSlug={tenantSlug}
            userEmail={user.email || ""}
            userName={name}
            emailUpdates={emailUpdates}
          />
        </div>
        <p className="mt-10 text-sm text-[color-mix(in_srgb,var(--billing-ink)_60%,transparent)]">
          Need help? Read the{" "}
          <Link
            className="font-semibold underline underline-offset-4"
            href="/docs/workspace/customer-billing"
          >
            billing help
          </Link>
          {brand.supportEmail ? (
            <>
              {" "}
              or{" "}
              <a
                className="font-semibold underline underline-offset-4"
                href={`mailto:${brand.supportEmail}`}
              >
                contact support
              </a>
            </>
          ) : null}
          .
        </p>
      </div>
    </PublicBillingShell>
  );
}
