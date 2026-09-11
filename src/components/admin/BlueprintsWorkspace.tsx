"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import AdminLink from "./AdminLink";
import { DemoBusinessNotice } from "./DemoBusinessNotice";
import { EmptyState } from "./EmptyState";
import { useAdminDemo } from "./AdminDemoBoundary";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";

interface BlueprintSummary {
  id: string;
  title: string;
  status: string;
  latest_version: number;
  updated_at: string;
}

const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] hover:bg-[var(--admin-surface-subtle)] disabled:opacity-50";
const field =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm";

export function BlueprintsWorkspace() {
  const query = useAdminQuery<{ blueprints: BlueprintSummary[] }>(
    ["admin", "blueprints"],
    "/api/admin/blueprints",
  );
  const cache = useQueryClient();
  const demo = useAdminDemo();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    let document: unknown;
    try {
      document = JSON.parse(documentText || "null");
    } catch {
      setError("Document must be valid JSON for a WorkspaceBlueprint.");
      return;
    }
    if (!changeSummary.trim()) {
      setError("Describe the change before saving a new Blueprint version.");
      return;
    }
    setSaving(true);
    try {
      const saved = await fetchJson<{ blueprintId: string; version: number }>(
        "/api/admin/blueprints",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document, changeSummary: changeSummary.trim() }),
        },
      );
      setDocumentText("");
      setChangeSummary("");
      setNotice(
        `Saved as version ${saved.version}${demo ? " (simulated in this fictional workspace)" : ""}.`,
      );
      await cache.invalidateQueries({ queryKey: ["admin", "blueprints"] });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const blueprints = query.data?.blueprints ?? [];

  return (
    <div>
      <PageHeader
        title="Workspace Blueprints"
        subtitle="Architect proposals are versioned, validated against live capabilities, and reviewed before anything is applied."
      />
      <DemoBusinessNotice />
      {query.isPending && <p role="status">Loading blueprints…</p>}
      {query.isError && (
        <AdminSurface>
          <p role="alert">Blueprints could not be loaded. Retry from the workspace overview.</p>
        </AdminSurface>
      )}
      {query.data && blueprints.length === 0 && (
        <EmptyState
          title="No blueprints yet"
          description="Paste a WorkspaceBlueprint document below to create the first versioned proposal."
        />
      )}
      {blueprints.length > 0 && (
        <AdminSurface padding="sm">
          <ul className="divide-y divide-[var(--admin-border)]">
            {blueprints.map((blueprint) => (
              <li key={blueprint.id} className="flex items-center justify-between gap-3 px-2 py-3">
                <div className="min-w-0">
                  <AdminLink
                    href={`/admin/blueprints/${blueprint.id}`}
                    className="block truncate text-sm font-semibold underline"
                  >
                    {blueprint.title}
                  </AdminLink>
                  <p className="mt-1 text-xs text-[var(--admin-muted)]">
                    v{blueprint.latest_version} · {blueprint.status} · updated{" "}
                    {new Date(blueprint.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <AdminLink href={`/admin/blueprints/${blueprint.id}`} className={button}>
                  Review
                </AdminLink>
              </li>
            ))}
          </ul>
        </AdminSurface>
      )}
      <AdminSurface>
        <h2 className="mb-1 text-sm font-semibold">Propose a new Blueprint</h2>
        <p className="mb-3 text-xs text-[var(--admin-muted)]">
          Paste the full Blueprint document. Saving creates version 1; saving against an existing
          Blueprint always forks a new version — reviewed versions are never mutated.
        </p>
        <label className="block text-xs font-semibold">
          Blueprint document (JSON)
          <textarea
            aria-label="Blueprint document JSON"
            className={`${field} min-h-40 font-mono text-xs`}
            value={documentText}
            onChange={(event) => setDocumentText(event.target.value)}
            spellCheck={false}
          />
        </label>
        <label className="mt-3 block text-xs font-semibold">
          Change summary
          <input
            aria-label="Change summary"
            className={field}
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            placeholder="Initial setup"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-xs font-semibold text-[var(--admin-danger)]">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-xs font-semibold">
            {notice}
          </p>
        )}
        <button type="button" className={`${button} mt-3`} disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save Blueprint version"}
        </button>
      </AdminSurface>
    </div>
  );
}
