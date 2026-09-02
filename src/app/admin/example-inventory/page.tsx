import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";

/**
 * The page half of the extension example.
 *
 * extensions/example-inventory.module.json registers this route, its nav
 * entry, and its module identity without editing any core array. This file is
 * what a third party would replace with a real feature; between the two, it is
 * a complete working demonstration of the seam described in
 * docs/contributing/EXTENDING.md.
 *
 * The module ships defaultEnabled: false, so this page is unreachable from
 * navigation in a real workspace until someone turns it on in
 * /admin/integrations.
 */
export default function ExampleInventoryPage() {
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Inventory"
        subtitle="An example extension module. Its manifest, nav entry, and module toggle are all registered from extensions/example-inventory.module.json, with no change to any core file."
      />
      <AdminSurface padding="lg">
        <p className="admin-eyebrow">Extension example</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
          This page is registered by a manifest
        </h2>
        <p className="admin-copy mt-3 max-w-2xl text-sm leading-6">
          Everything that made this route appear in navigation, in the modules console, and in the
          per-workspace enable and disable switch came from a single JSON file. Replace this page
          with a real feature and the module keeps the approval queue, the audit ledger, and the
          module gating it already inherits.
        </p>
        <p className="admin-copy mt-3 max-w-2xl text-sm leading-6">
          Read{" "}
          <code className="rounded bg-[var(--admin-surface-subtle)] px-1 py-0.5 text-xs">
            docs/contributing/EXTENDING.md
          </code>{" "}
          for the field reference and the rules a manifest has to follow.
        </p>
      </AdminSurface>
    </div>
  );
}
