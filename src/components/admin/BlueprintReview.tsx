"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import AdminLink from "./AdminLink";
import { DemoBusinessNotice } from "./DemoBusinessNotice";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { fetchJson } from "@/lib/admin/fetchJson";

type ItemStatus = "ready" | "blocked" | "approval" | "info";

interface ReviewItem {
  ref: string;
  title: string;
  detail: string;
  status: ItemStatus;
  statusReason: string | null;
  impact: string | null;
}

interface GateItem {
  ref: string;
  label: string;
  level: string;
}

interface BlueprintDetail {
  blueprintId: string;
  version: number;
  parentVersion: number | null;
  changeSummary: string;
  createdAt: string;
  document: Record<string, unknown>;
  review: {
    businessSummary: string;
    businessModel: ReviewItem[];
    workflows: ReviewItem[];
    boards: ReviewItem[];
    coworkers: ReviewItem[];
    integrations: ReviewItem[];
    questions: ReviewItem[];
    gates: {
      blueprintLevel: GateItem[];
      explicitWorkspaceChange: GateItem[];
      externalAuthority: GateItem[];
    };
    preflight: Record<string, number>;
    blockedCount: number;
    approvalCount: number;
  };
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  ready: "Ready",
  blocked: "Blocked",
  approval: "Approval",
  info: "Info",
};

function StatusBadge({ status, reason }: { status: ItemStatus; reason: string | null }) {
  return (
    <span
      className="inline-flex min-h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold shadow-[var(--admin-shadow-border)]"
      title={reason ?? STATUS_LABEL[status]}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function Section({ title, items }: { title: string; items: ReviewItem[] }) {
  if (!items.length) return null;
  return (
    <AdminSurface>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.ref} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{item.detail}</p>
              {item.statusReason && (
                <p className="mt-0.5 text-xs font-medium">{item.statusReason}</p>
              )}
            </div>
            <StatusBadge status={item.status} reason={item.statusReason} />
          </li>
        ))}
      </ul>
    </AdminSurface>
  );
}

const field =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm";
const button =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold shadow-[var(--admin-shadow-border)] hover:bg-[var(--admin-surface-subtle)] disabled:opacity-50";

export function BlueprintReview({ blueprintId }: { blueprintId: string }) {
  const query = useAdminQuery<BlueprintDetail>(
    ["admin", "blueprint", blueprintId],
    `/api/admin/blueprints/${blueprintId}`,
  );
  const cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data && !editing) setSummary(query.data.review.businessSummary);
  }, [query.data, editing]);

  const saveRevision = async () => {
    setError("");
    if (!query.data) return;
    if (!summary.trim() || summary.trim() === query.data.review.businessSummary) {
      setError("Edit the summary before saving a revision.");
      return;
    }
    setSaving(true);
    try {
      const document = { ...query.data.document, businessSummary: summary.trim() };
      const saved = await fetchJson<{ blueprintId: string; version: number }>(
        "/api/admin/blueprints",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blueprintId: query.data.blueprintId,
            document,
            changeSummary: `Review edit: ${query.data.changeSummary}`,
          }),
        },
      );
      setEditing(false);
      await cache.invalidateQueries({ queryKey: ["admin", "blueprint", blueprintId] });
      await cache.invalidateQueries({ queryKey: ["admin", "blueprints"] });
      setSummary("");
      void saved;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (query.isPending) return <p role="status">Loading Blueprint review…</p>;
  if (query.isError || !query.data) {
    return (
      <div>
        <PageHeader title="Blueprint review" />
        <AdminSurface>
          <p role="alert">This Blueprint could not be loaded in this workspace.</p>
          <AdminLink href="/admin/blueprints" className="mt-3 inline-block text-sm underline">
            Back to Blueprints
          </AdminLink>
        </AdminSurface>
      </div>
    );
  }

  const detail = query.data;
  const gates = detail.review.gates;

  return (
    <div>
      <PageHeader
        title={`Blueprint v${detail.version}`}
        subtitle={detail.changeSummary}
        eyebrow="Workspace Architect review"
      />
      <DemoBusinessNotice />
      <AdminSurface>
        <h2 className="mb-1 text-sm font-semibold">Business summary</h2>
        {!editing ? (
          <p className="text-sm">{detail.review.businessSummary}</p>
        ) : (
          <label className="block text-xs font-semibold">
            Business summary
            <textarea
              aria-label="Business summary"
              className={`${field} min-h-24`}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
        )}
        <p className="mt-2 text-xs text-[var(--admin-muted)]">
          Version {detail.version}
          {detail.parentVersion
            ? ` · revises v${detail.parentVersion}`
            : " · initial proposal"} · {detail.review.blockedCount} blocked ·{" "}
          {detail.review.approvalCount} need approval
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs font-semibold text-[var(--admin-danger)]">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              className={button}
              onClick={() => {
                setEditing(true);
                setSummary(detail.review.businessSummary);
                setError("");
              }}
            >
              Edit blueprint
            </button>
          ) : (
            <>
              <button type="button" className={button} disabled={saving} onClick={saveRevision}>
                {saving ? "Saving…" : "Save as new version"}
              </button>
              <button
                type="button"
                className={button}
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </AdminSurface>

      <Section title="Business model" items={detail.review.businessModel} />
      <Section title="Workflows" items={detail.review.workflows} />
      <Section title="Boards" items={detail.review.boards} />
      <Section title="Coworkers" items={detail.review.coworkers} />
      <Section title="Integrations" items={detail.review.integrations} />
      <Section title="Questions and assumptions" items={detail.review.questions} />

      <AdminSurface>
        <h2 className="mb-3 text-sm font-semibold">Approval gates</h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">
              Build-my-workspace approval ({gates.blueprintLevel.length})
            </p>
            <p className="text-xs text-[var(--admin-muted)]">
              {gates.blueprintLevel.map((item) => item.label).join(" · ") || "Nothing low-risk."}
            </p>
          </div>
          <div>
            <p className="font-semibold">
              Explicit workspace-change approval ({gates.explicitWorkspaceChange.length})
            </p>
            <p className="text-xs text-[var(--admin-muted)]">
              {gates.explicitWorkspaceChange.map((item) => item.label).join(" · ") || "None."}
            </p>
          </div>
          <div>
            <p className="font-semibold">
              External authority, never covered here ({gates.externalAuthority.length})
            </p>
            <p className="text-xs text-[var(--admin-muted)]">
              {gates.externalAuthority.map((item) => item.label).join(" · ") || "None."}
            </p>
          </div>
        </div>
      </AdminSurface>

      <AdminSurface>
        <h2 className="mb-1 text-sm font-semibold">Preflight</h2>
        <p className="text-xs text-[var(--admin-muted)]">
          {Object.entries(detail.review.preflight)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")}
        </p>
      </AdminSurface>
    </div>
  );
}
