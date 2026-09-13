import { Suspense } from "react";
import type { CSSProperties } from "react";
import { CustomerAuthForm, type AuthMode } from "./CustomerAuthForm";
import { PublicBrandMark } from "./PublicBrandMark";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { resolveActiveTenantSystemContext } from "@/lib/tenancy/system";
import { readWorkspaceBrand } from "@/lib/revenue-os/branding";
import { resolveWorkspaceBrand, type WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
import { tenant } from "@/config/tenant";

function defaultBrand() {
  return resolveWorkspaceBrand({ brand: tenant.brand, founder: tenant.founder }, tenant.brand.name);
}

export async function CustomerAuthPage({
  mode,
  searchParams,
}: {
  mode: AuthMode;
  searchParams: Promise<{ tenant?: string; next?: string }>;
}) {
  const params = await searchParams;
  let brand: WorkspaceBrand = defaultBrand();
  if (params.tenant) {
    const context = await resolveActiveTenantSystemContext(params.tenant, "customer-auth-brand");
    if (context) {
      try {
        brand = (await readWorkspaceBrand(createServiceRoleClient(context))).brand;
      } catch {
        // The bootstrap identity keeps account recovery available if a tenant
        // has an incomplete legacy brand record.
      }
    }
  }
  const style = {
    "--billing-accent": brand.accentColor,
    "--billing-bg": brand.backgroundColor,
    "--billing-ink": brand.inkColor,
    fontFamily:
      brand.font === "serif"
        ? "Georgia, Cambria, serif"
        : "var(--font-inter), Inter, system-ui, sans-serif",
  } as CSSProperties;
  return (
    <main
      style={style}
      className="min-h-screen bg-[var(--billing-bg)] px-5 py-8 text-[var(--billing-ink)] sm:px-8 sm:py-12"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <PublicBrandMark brand={brand} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{brand.name}</p>
            <p className="truncate text-xs text-[color-mix(in_srgb,var(--billing-ink)_60%,transparent)]">
              Secure customer account
            </p>
          </div>
        </div>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-black/5" />}>
          <CustomerAuthForm mode={mode} brand={brand} />
        </Suspense>
      </div>
    </main>
  );
}
