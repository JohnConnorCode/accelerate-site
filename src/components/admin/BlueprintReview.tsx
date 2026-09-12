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
  compile?: {
    canApply: boolean;
    customAppBriefs: Array<{
      id: string;
      title: string;
      missingKey: string;
      why: string;
      boundary: string;
    }>;
    approvals: Array<{ ref: string; key: string; reason: string }>;
    blocked: Array<{ ref: string; key: string; reason: string }>;
  };
  operations?: {
    navigation: Array<{ ref: string; label: string; status: string; reason: string | null }>;
    boards: Array<{
      ref: string;
      name: string;
      sourceType: string;
      targetBoardKey: string | null;
      status: string;
      reason: string | null;
    }>;
    views: Array<{ ref: string; name: string; sourceType: string; status: string; reason: string | null }>;
    workflows: Array<{ ref: string; name: string; approvalRequired: boolean; status: string }>;
    coworkers: Array<{
      ref: string;
      name: string;
      requiredCapabilities: string[];
      missingCapabilities: string[];
      status: string;
    }>;
    customAppBriefs: Array<{ id: string; title: string; missingKey: string; why: string; boundary: string }>;
    canApply: boolean;
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
  const [notice, setNotice] = useState("");

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

  const approve = async () => {
    if (!query.data) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      await fetchJson(`/api/admin/blueprints/${blueprintId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: query.data.version }),
      });
      setNotice("Blueprint approved. Apply still goes through existing approval services.");
      await cache.invalidateQueries({ queryKey: ["admin", "blueprint", blueprintId] });
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Approve failed.");
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    if (!query.data) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const result = await fetchJson<{ replayed?: boolean }>(
        `/api/admin/blueprints/${blueprintId}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: query.data.version,
            requestKey: crypto.randomUUID(),
          }),
        },
      );
      setNotice(
        result.replayed
          ? "This apply request was already recorded."
          : "Apply recorded. Approval-gated steps are staged in the existing action queue.",
      );
      await cache.invalidateQueries({ queryKey: ["admin", "blueprint", blueprintId] });
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Apply failed.");
    } finally {
      setSaving(false);
    }
  };

  const generateOperations = async () => {
    if (!query.data) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const result = await fetchJson<{ replayed?: boolean }>(
        `/api/admin/blueprints/${blueprintId}/generate-operations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: query.data.version,
            requestKey: crypto.randomUUID(),
          }),
        },
      );
      setNotice(
        result.replayed
          ? "Operations for this version were already generated."
          : "Boards, views, workflow and Coworker proposals staged in the existing action queue.",
      );
      await cache.invalidateQueries({ queryKey: ["admin", "blueprint", blueprintId] });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Generate failed.");
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
        {notice && (
          <p role="status" className="mt-2 text-xs font-semibold">
            {notice}
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
          <button type="button" className={button} disabled={saving} onClick={() => void approve()}>
            Approve
          </button>
          <button
            type="button"
            className={button}
            disabled={saving || detail.compile?.canApply === false}
            onClick={() => void apply()}
          >
            Apply approved version
          </button>
          <button
            type="button"
            className={button}
            disabled={saving || detail.operations?.canApply === false}
            onClick={() => void generateOperations()}
          >
            Generate boards, views &amp; Coworkers
          </button>
        </div>
      </AdminSurface>
      {detail.compile?.customAppBriefs && detail.compile.customAppBriefs.length > 0 && (
        <AdminSurface>
          <h2 className="mb-3 text-sm font-semibold">Custom App Briefs</h2>
          <ul className="space-y-3">
            {detail.compile.customAppBriefs.map((brief) => (
              <li key={brief.id}>
                <p className="text-sm font-semibold">{brief.title}</p>
                <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{brief.why}</p>
                <p className="mt-0.5 text-xs">{brief.boundary}</p>
              </li>
            ))}
          </ul>
        </AdminSurface>
      )}

      {detail.operations && (
        <AdminSurface>
          <h2 className="mb-3 text-sm font-semibold">Generated operations</h2>
          <p className="mb-2 text-xs text-[var(--admin-muted)]">
            Boards reuse the existing Kanban board/column primitive; workflow and Coworker
            recommendations reuse the existing approval queue. Nothing here is applied
            automatically.
          </p>
          <ul className="space-y-2 text-xs">
            {detail.operations.boards.map((board) => (
              <li key={board.ref}>
                Board · {board.name} → {board.targetBoardKey ?? "no existing board"} ·{" "}
                <span className="font-semibold">{board.status}</span>
                {board.reason ? ` (${board.reason})` : ""}
              </li>
            ))}
            {detail.operations.views.map((view) => (
              <li key={view.ref}>
                View · {view.name} ({view.sourceType}) · <span className="font-semibold">{view.status}</span>
              </li>
            ))}
            {detail.operations.workflows.map((workflow) => (
              <li key={workflow.ref}>
                Workflow · {workflow.name} ·{" "}
                {workflow.approvalRequired ? "needs approval" : "automatic where policy allows"} ·{" "}
                <span className="font-semibold">{workflow.status}</span>
              </li>
            ))}
            {detail.operations.coworkers.map((coworker) => (
              <li key={coworker.ref}>
                Coworker · {coworker.name} · required: {coworker.requiredCapabilities.join(", ") || "none"}
                {coworker.missingCapabilities.length > 0
                  ? ` · missing: ${coworker.missingCapabilities.join(", ")}`
                  : ""}{" "}
                · <span className="font-semibold">{coworker.status}</span>
              </li>
            ))}
          </ul>
          {detail.operations.customAppBriefs.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-2 text-xs font-semibold">Custom App Briefs (unsupported requirements)</h3>
              <ul className="space-y-2 text-xs">
                {detail.operations.customAppBriefs.map((brief) => (
                  <li key={brief.id}>
                    {brief.title} — {brief.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AdminSurface>
      )}

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
