import type { ReactNode } from "react";
import { ChartNoAxesCombined, FolderCheck, Plug, Settings2, Wallet } from "lucide-react";
import type { RevenueOSModule } from "@/lib/revenue-os/modules";
import { AdminSurface } from "./AdminSurface";

const glyphs = {
  revenue: Wallet,
  delivery: FolderCheck,
  intelligence: ChartNoAxesCombined,
  sources: Plug,
  system: Settings2,
};

/** Identity comes from the module registry; runtime receipts are supplied by its caller. */
export function ModuleCard({
  module,
  enabled,
  owner,
  lastAction,
  actions,
  children,
}: {
  module: RevenueOSModule;
  enabled?: boolean;
  owner?: string;
  lastAction?: { text: string; system: boolean; time?: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const Glyph = glyphs[module.category];
  const autonomy = module.report
    ? "Read-only"
    : module.workflow?.policy.trustCeiling === "always-propose"
      ? "Approval required"
      : "Set per action";
  return (
    <AdminSurface
      padding="lg"
      className="flex min-w-0 flex-col"
      data-plugin={module.id}
      data-module-card={module.id}
    >
      <div className="flex items-start gap-3">
        <Glyph className="mt-0.5 size-5 shrink-0 text-[var(--admin-muted)]" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 text-balance text-lg font-semibold text-[var(--admin-ink)]">
          {module.name}
        </h2>
        <span className="shrink-0 text-xs text-[var(--admin-muted)]">
          {enabled === undefined
            ? "Status unavailable"
            : module.isCore
              ? "Always active"
              : enabled
                ? "Enabled"
                : "Disabled"}
        </span>
      </div>
      <p className="admin-copy mt-3 text-pretty text-sm leading-6">{module.description}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[var(--admin-muted)]">Owner</dt>
          <dd className="mt-1 text-[var(--admin-ink)]">{owner || "Not assigned"}</dd>
        </div>
        <div>
          <dt className="text-[var(--admin-muted)]">Autonomy</dt>
          <dd className="mt-1 text-[var(--admin-ink)]">{autonomy}</dd>
        </div>
      </dl>
      <p
        className="mt-5 flex items-baseline gap-2 border-t border-[var(--admin-border)] pt-4 text-xs text-[var(--admin-muted)]"
        data-module-activity
      >
        <span
          aria-hidden="true"
          className={`inline-block size-2 shrink-0 rounded-full ${lastAction?.system ? "bg-[var(--admin-accent)]" : "border border-[var(--admin-muted)]"}`}
        />
        <span className="min-w-0 flex-1 truncate" title={lastAction?.text}>
          {lastAction?.system && <span className="sr-only">System: </span>}
          {lastAction?.text || "No execution receipt loaded"}
        </span>
        {lastAction?.time && (
          <span className="shrink-0 font-mono tabular-nums">{lastAction.time}</span>
        )}
      </p>
      {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      {children}
    </AdminSurface>
  );
}
