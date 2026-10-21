"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Play, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ModuleCard } from "@/components/admin/ModuleCard";
import { AdminSurface } from "@/components/admin/AdminSurface";
import AdminLink from "@/components/admin/AdminLink";
import { DemoBusinessNotice } from "@/components/admin/DemoBusinessNotice";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";
import { EXTENSION_MODULES } from "@/lib/revenue-os/extension-modules.generated";
import type { PluginReport } from "@/lib/revenue-os/report-plugins";
const plugins = [...EXTENSION_MODULES].sort((a, b) => a.name.localeCompare(b.name));
const button = "admin-button admin-button--secondary";
export default function PluginsPage() {
  const cache = useQueryClient();
  const modules = useAdminQuery<{ modules: string[] }>(
    ["admin", "tenant-modules"],
    "/api/admin/tenant/modules",
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
      <DemoBusinessNotice />
      <>
        <AdminSurface padding="lg">
          <div className="flex items-start gap-3">
            <PlugZap aria-hidden="true" className="mt-1 size-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Enable what your business needs</h2>
              <p className="admin-copy mt-2 max-w-3xl text-sm leading-6">
                Enable a workflow, review its proposed work, then approve the action. Every plugin
                uses workspace permissions and records its results. Disabling a workflow blocks new
                execution while preserving history.
              </p>
            </div>
          </div>
        </AdminSurface>
        {(error || modules.error) && (
          <p
            role="alert"
            className="rounded-xl border border-[var(--admin-danger)]/30 bg-[var(--admin-danger-soft)] p-4 text-sm"
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
              <ModuleCard
                key={plugin.id}
                module={plugin}
                enabled={modules.data ? enabled : undefined}
                lastAction={
                  report
                    ? {
                        text: report.summary,
                        system: true,
                        time: new Date(report.receipt.generatedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      }
                    : undefined
                }
                actions={
                  <>
                    <button
                      type="button"
                      className={button}
                      disabled={!!busy || !modules.data || !!modules.error}
                      aria-label={`${enabled ? "Disable" : "Enable"} ${plugin.name}`}
                      onClick={() => void perform(plugin.id, !enabled, false)}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </button>
                    {!plugin.report && plugin.routes?.length ? (
                      enabled && (
                        <AdminLink className={button} href={plugin.routes?.[0] || "/admin/plugins"}>
                          {plugin.workflow ? "Open workflow" : "Open workspace"}
                        </AdminLink>
                      )
                    ) : plugin.report ? (
                      <button
                        type="button"
                        className="admin-button admin-button--primary"
                        disabled={!enabled || !!busy}
                        onClick={() => void perform(plugin.id, enabled, true)}
                      >
                        <Play aria-hidden="true" className="size-3.5" />
                        {busy === plugin.id ? "Working…" : "Run report"}
                      </button>
                    ) : (
                      <AdminLink
                        className={button}
                        href={`/admin/integrations?tab=modules&search=${encodeURIComponent(plugin.name)}`}
                      >
                        Configure module
                      </AdminLink>
                    )}
                  </>
                }
              >
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
                          <details className="admin-copy group mt-1 text-xs">
                            <summary className="flex cursor-pointer list-none items-center gap-1.5 py-2 [&::-webkit-details-marker]:hidden">
                              Source reference
                              <ChevronDown
                                className="size-3.5 shrink-0 text-[var(--admin-muted)] transition-transform duration-200 group-open:rotate-180"
                                aria-hidden="true"
                              />
                            </summary>
                            <code className="break-all">
                              {item.source} / {item.id}
                            </code>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </ModuleCard>
            );
          })}
        </div>
      </>
    </div>
  );
}
