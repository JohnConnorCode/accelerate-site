import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AccountBilling } from "@/components/billing/AccountBilling";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const context = await resolveActiveTenantSystemContext(tenantSlug, "customer-account");
  if (!context) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/t/${tenantSlug}/account`)}`);
  const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const emailUpdates = user.user_metadata?.billing_emails !== false;
  return (
    <main className="min-h-screen bg-[var(--admin-surface)] px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black/50">Customer account</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Your account</h1><p className="mt-3 text-sm text-black/60">Manage your profile, subscription, and invoices in one place.</p></div>
          <a className="text-sm font-semibold underline" href={`/t/${tenantSlug}/subscribe`}>View plans</a>
        </div>
        <div className="mt-10"><AccountBilling tenantSlug={tenantSlug} userEmail={user.email || ""} userName={name} emailUpdates={emailUpdates} /></div>
        <p className="mt-10 text-sm text-black/55">Need help? Read the <Link className="font-semibold underline" href="/docs/workspace/customer-billing">billing help</Link> or <a className="font-semibold underline" href="mailto:support@acceleratewith.us">contact support</a>.</p>
      </div>
    </main>
  );
}
