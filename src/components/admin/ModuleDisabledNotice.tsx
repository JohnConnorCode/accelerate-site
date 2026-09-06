import Link from "@/components/admin/AdminLink";
import { PlugZap } from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import type { RevenueOSModule } from "@/lib/revenue-os/modules";

/**
 * Rendered by src/app/admin/layout.tsx in place of a page's children when
 * the owning module is disabled for the current workspace. This is display
 * gating and defense in depth, not authorization: Next renders layout and
 * page in parallel, so this notice does not stop the page's own data
 * fetching. The real gate is requireAdminForModule() in the page's API
 * routes; see src/lib/admin/module-guard.ts.
 *
 * A notice rather than a 404, because a module the operator can switch back
 * on from /admin/integrations is not missing.
 */
export function ModuleDisabledNotice({ module: mod }: { module: RevenueOSModule }) {
  return (
    <div className="mx-auto max-w-lg py-14">
      <AdminSurface tone="subtle" padding="lg" elevation="outlined" className="text-center">
        <span
          className="mx-auto grid size-11 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] dark:bg-white/[0.06]"
          aria-hidden="true"
        >
          <PlugZap className="size-5" />
        </span>
        <p className="mt-4 text-sm font-semibold text-[var(--admin-ink)]">
          {mod.name} is turned off
        </p>
        <p className="admin-copy mt-1.5 text-pretty text-xs leading-5">
          This workspace has disabled the {mod.name} module. Turn it back on from Integrations &amp;
          Modules to use this page again.
        </p>
        <Link
          href="/admin/integrations"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]"
        >
          Go to Integrations &amp; Modules
        </Link>
      </AdminSurface>
    </div>
  );
}
