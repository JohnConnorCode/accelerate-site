import Link from "next/link";
import type { CSSProperties } from "react";
import { brandButtonInk, type WorkspaceBrand } from "@/lib/revenue-os/branding-contract";
import { PublicBrandMark } from "./PublicBrandMark";

const fontFor = (font: WorkspaceBrand["font"]) =>
  font === "serif" ? "Georgia, Cambria, serif" : "var(--font-inter), Inter, system-ui, sans-serif";

export function PublicBillingShell({
  tenantSlug,
  brand,
  active,
  children,
}: {
  tenantSlug: string;
  brand: WorkspaceBrand;
  active: "plans" | "account";
  children: React.ReactNode;
}) {
  const style = {
    "--billing-accent": brand.accentColor,
    "--billing-accent-ink": brandButtonInk(brand.accentColor),
    "--billing-bg": brand.backgroundColor,
    "--billing-ink": brand.inkColor,
    "--billing-font": fontFor(brand.font),
  } as CSSProperties;
  return (
    <main
      style={style}
      className="relative min-h-screen overflow-hidden bg-[var(--billing-bg)] font-[var(--billing-font)] text-[var(--billing-ink)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-40 size-[28rem] rounded-full opacity-[0.12] blur-3xl"
        style={{ backgroundColor: brand.accentColor }}
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[color-mix(in_srgb,var(--billing-ink)_14%,transparent)] pb-6">
          <Link
            href={`/t/${tenantSlug}/subscribe`}
            aria-label={`${brand.name} plans`}
            className="group inline-flex min-h-11 items-center gap-3 rounded-xl pr-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)] focus-visible:ring-offset-2"
          >
            <PublicBrandMark brand={brand} />
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold tracking-tight">
                {brand.name}
              </span>
              {brand.tagline && (
                <span className="block max-w-[18rem] truncate text-xs text-[color-mix(in_srgb,var(--billing-ink)_62%,transparent)]">
                  {brand.tagline}
                </span>
              )}
            </span>
          </Link>
          <nav
            aria-label="Billing navigation"
            className="flex items-center gap-1 text-sm font-semibold"
          >
            <Link
              href={`/t/${tenantSlug}/subscribe`}
              aria-current={active === "plans" ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-lg px-3 underline-offset-4 outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--billing-ink)_7%,transparent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
            >
              Plans
            </Link>
            <Link
              href={`/t/${tenantSlug}/account`}
              aria-current={active === "account" ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-lg px-3 underline-offset-4 outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--billing-ink)_7%,transparent)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--billing-accent)]"
            >
              Account
            </Link>
          </nav>
        </header>
        <div className="py-10 sm:py-14">{children}</div>
        <footer className="border-t border-[color-mix(in_srgb,var(--billing-ink)_14%,transparent)] py-6 text-sm leading-6 text-[color-mix(in_srgb,var(--billing-ink)_66%,transparent)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p>
              Payments are handled securely by Stripe. Your card details never pass through this
              site.
            </p>
            {brand.supportEmail && (
              <a
                className="font-semibold underline underline-offset-4"
                href={`mailto:${brand.supportEmail}`}
              >
                Billing help
              </a>
            )}
          </div>
          <p className="mt-3 text-xs text-[color-mix(in_srgb,var(--billing-ink)_52%,transparent)]">
            {brand.legalName || brand.name}
            {brand.businessAddress ? ` · ${brand.businessAddress}` : ""}
          </p>
        </footer>
      </div>
    </main>
  );
}
