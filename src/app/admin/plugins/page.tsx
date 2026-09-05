"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import AdminLink from "@/components/admin/AdminLink";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { REVENUE_OS_MODULES } from "@/lib/revenue-os/modules";
import type { PluginReport } from "@/lib/revenue-os/report-plugins";
const plugins = REVENUE_OS_MODULES.filter(
  (moduleDef) => moduleDef.report || moduleDef.workflow,
).sort((a, b) => Number(Boolean(b.workflow)) - Number(Boolean(a.workflow)));
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed";
export default function PluginsPage() {
  const demo = useAdminDemo();
  const cache = useQueryClient();
  const modules = useAdminQuery<{ modules: string[] }>(
    ["admin", "tenant-modules"],
    "/api/admin/tenant/modules",
    { enabled: !demo },
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<Record<string, PluginReport>>({});
  async function perform(id: string, enabled: boolean, run: boolean) {
    setBusy(id);
    setError("");
    setReports((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    try {
      if (run) {
        const report = await fetchJson<PluginReport>("/api/admin/plugins/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pluginId: id }),
        });
        setReports((previous) => ({ ...previous, [id]: report }));
      } else {
        await fetchJson("/api/admin/tenant/modules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleId: id, enabled }),
        });
        await cache.invalidateQueries({ queryKey: ["admin", "tenant-modules"] });
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The plugin could not complete this request.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Plugins"
        subtitle="Business workflows connected to your customers, approvals, and systems."
        actions={
          <AdminLink href="/admin/integrations" className={button}>
            Manage integrations
          </AdminLink>
        }
      />
      {demo ? (
        <AdminSurface padding="lg">
          <h2 className="font-semibold">Live workspace plugins</h2>
          <p className="admin-copy mt-2">
            Plugin execution requires an authenticated workspace and its registered data sources.
            This fictional demo does not run server plugins or connect providers.
          </p>
        </AdminSurface>
      ) : (
        <>
          <AdminSurface padding="lg">
            <div className="flex items-start gap-3">
              <PlugZap aria-hidden="true" className="mt-1 size-5 shrink-0" />
              <div>
                <h2 className="font-semibold">Enable what your business needs</h2>
                <p className="admin-copy mt-2 max-w-3xl text-sm leading-6">
                  Enable a workflow, review its proposed work, then approve the action. Every plugin
                  uses workspace permissions and records its results. Disabling a workflow blocks
                  new execution while preserving history.
                </p>
              </div>
            </div>
          </AdminSurface>
          {(error || modules.error) && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm"
            >
              {error || modules.error?.message}
              <button
                type="button"
                className={`${button} ml-2`}
                onClick={() => void modules.refetch()}
              >
                Refresh plugin status
              </button>
            </p>
          )}
          {modules.isPending && (
            <p role="status" className="admin-copy">
              Loading workspace plugins…
            </p>
          )}
          <div className="grid gap-5 items-start xl:grid-cols-2">
            {plugins.map((plugin) => {
              const enabled = modules.data?.modules.includes(plugin.id) ?? false;
              const report = reports[plugin.id];
              return (
                <AdminSurface
                  key={plugin.id}
                  padding="lg"
                  className="flex min-w-0 flex-col"
                  data-plugin={plugin.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="admin-eyebrow">
                      {plugin.workflow ? "Business workflow" : "Read-only runtime example"}
                    </p>
                    <span className="text-xs font-medium">{enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-balance">{plugin.name}</h2>
                  <p className="admin-copy mt-2 flex-1 text-sm leading-6">{plugin.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={button}
                      disabled={!!busy || !modules.data || !!modules.error}
                      aria-label={`${enabled ? "Disable" : "Enable"} ${plugin.name}`}
                      onClick={() => void perform(plugin.id, !enabled, false)}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </button>
                    {plugin.workflow ? (
                      enabled && (
                        <AdminLink className={button} href={plugin.routes?.[0] || "/admin/plugins"}>
                          Open workflow
                        </AdminLink>
                      )
                    ) : (
                      <button
                        type="button"
                        className={`${button} bg-[var(--admin-ink)] text-[var(--admin-surface)]`}
                        disabled={!enabled || !!busy}
                        onClick={() => void perform(plugin.id, enabled, true)}
                      >
                        <Play aria-hidden="true" className="size-3.5" />
                        {busy === plugin.id ? "Working…" : "Run report"}
                      </button>
                    )}
                  </div>
                  {enabled && report && (
                    <div
                      className="mt-6 border-t border-[var(--admin-border)] pt-5"
                      aria-live="polite"
                    >
                      <p className="text-sm font-semibold">{report.summary}</p>
                      <p className="admin-copy mt-2 text-xs tabular-nums">
                        {report.receipt.inspectedRows} records inspected ·{" "}
                        {new Date(report.receipt.generatedAt).toLocaleString()}
                      </p>
                      {report.receipt.truncated && (
                        <p className="mt-2 text-xs">
                          Partial view: some records or findings are outside this report’s limit.
                        </p>
                      )}
                      {!report.items.length && (
                        <p className="admin-copy mt-3 text-sm">
                          No matching findings in this snapshot.
                        </p>
                      )}
                      <ul className="mt-4 space-y-4">
                        {report.items.map((item) => (
                          <li key={`${item.source}:${item.id}`} className="min-w-0">
                            <p className="text-sm font-medium break-words">{item.title}</p>
                            <p className="admin-copy mt-1 text-xs leading-5 break-words">
                              {item.detail}
                            </p>
                            <details className="admin-copy mt-1 text-xs">
                              <summary className="cursor-pointer py-2">Source reference</summary>
                              <code className="break-all">
                                {item.source} / {item.id}
                              </code>
                            </details>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AdminSurface>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
