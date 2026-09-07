"use client";
import { Check, Loader2, TriangleAlert, X } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import { ADMIN_LAYOUT_SCOPES } from "@/lib/admin/layout-scopes";
import { relativeTime } from "@/lib/admin/work-presentation";
import { cn } from "@/lib/utils";

export interface ActionRow {
  id: string;
  action_type: string;
  title: string;
  description: string | null;
  urgency: string;
  reasoning: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  payload: Record<string, unknown> | null;
}

/**
 * What each action will actually do if approved, in plain language. Approving is
 * irreversible for external actions, so the operator is told the consequence
 * before the button, not after.
 */
const ACTION_CONSEQUENCE: Record<string, string> = {
  send_email: "Sends this email immediately. It cannot be recalled.",
  send_gmail_reply: "Sends this reply from your Gmail account immediately. It cannot be recalled.",
  activate_campaign:
    "Starts this campaign. Enrolled contacts begin receiving email on the next run.",
  transition_opportunity:
    "Moves this opportunity to a new stage and records an immutable stage event.",
  create_task: "Creates a task on your queue.",
  update_next_action: "Changes the next step recorded on this opportunity.",
  admin_layout_change:
    "Reorders or hides an admin layout region immediately. Revert it any time from Settings → Layout.",
  create_founder_note:
    "Saves this note to the timeline immediately, visible wherever this record is reviewed. Notes are permanent: there is no edit or delete once saved.",
};

/** Renders an admin_layout_change payload as a readable order/hidden summary
    instead of raw JSON — the generic payload table can't resolve ids to
    labels or distinguish order from hidden. */
function layoutChangeSummary(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const scopeId = typeof payload.scope === "string" ? payload.scope : null;
  const doc = payload.doc as { order?: unknown; hidden?: unknown } | undefined;
  if (!scopeId || !doc) return null;
  const scope = ADMIN_LAYOUT_SCOPES.find((candidate) => candidate.id === scopeId);
  const labelFor = (id: string) => scope?.regions.find((region) => region.id === id)?.label ?? id;
  const order = Array.isArray(doc.order) ? doc.order.filter((id) => typeof id === "string") : [];
  const hidden = Array.isArray(doc.hidden) ? doc.hidden.filter((id) => typeof id === "string") : [];
  return {
    scopeLabel: scope?.label ?? scopeId,
    orderText: order.length ? order.map(labelFor).join(" → ") : "Default order",
    hiddenText: hidden.length ? hidden.map(labelFor).join(", ") : null,
  };
}

/** Fields worth showing verbatim, in the order an operator reads them. */
const PAYLOAD_FIELD_ORDER = [
  "to",
  "recipient",
  "subject",
  "stage",
  "reason",
  "lossReason",
  "dueDate",
  "priority",
  "campaignId",
  "opportunityId",
  "contactId",
];
const BODY_FIELDS = new Set(["body", "text", "message", "description"]);

function payloadEntries(payload: Record<string, unknown> | null) {
  if (!payload) return { fields: [] as Array<[string, string]>, body: null as string | null };
  const fields: Array<[string, string]> = [];
  let body: string | null = null;
  const keys = Object.keys(payload).sort((a, b) => {
    const ai = PAYLOAD_FIELD_ORDER.indexOf(a),
      bi = PAYLOAD_FIELD_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
  for (const key of keys) {
    const value = payload[key];
    if (value === null || value === undefined || value === "") continue;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (BODY_FIELDS.has(key) && text.length > 120) {
      body = text;
      continue;
    }
    fields.push([key, text]);
  }
  return { fields, body };
}

export function ActionReviewDialog({
  open,
  action,
  busy,
  onClose,
  onApprove,
  onReject,
  error,
}: {
  error?: string;
  open: boolean;
  action: ActionRow | null;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (!action) {
    return (
      <AdminDialog open={false} onClose={onClose} title="Review before approving">
        <span />
      </AdminDialog>
    );
  }
  const { fields, body } = payloadEntries(action.payload);
  const layoutSummary =
    action.action_type === "admin_layout_change" ? layoutChangeSummary(action.payload) : null;
  const consequence =
    ACTION_CONSEQUENCE[action.action_type] ??
    "Executes this action through the same service the admin uses.";
  const external =
    action.action_type === "send_email" ||
    action.action_type === "send_gmail_reply" ||
    action.action_type === "activate_campaign";
  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      title="Review before approving"
      labelledBy="action-review-title"
      maxWidth="sm"
      align="right"
      className="sm:max-w-[420px]"
    >
      <div className="h-dvh w-full overflow-y-auto bg-[var(--admin-surface)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="admin-eyebrow">Approval queue</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                  external
                    ? "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
                    : "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]",
                )}
              >
                {external ? "External Action" : "Internal Mutation"}
              </span>
            </div>
            <h2
              id="action-review-title"
              className="mt-1 text-balance text-xl font-semibold tracking-[-0.03em] text-[var(--admin-ink)]"
            >
              {action.title}
            </h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
              {action.action_type.replace(/_/g, " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review"
            className="grid size-10 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          className={cn(
            "mx-5 mt-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 sm:mx-6",
            external
              ? "border-[var(--admin-warning)]/25 bg-[var(--admin-warning-soft)]"
              : "border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]",
          )}
        >
          <TriangleAlert
            className={cn(
              "mt-px size-4 shrink-0",
              external ? "text-[var(--admin-warning)]" : "text-[var(--admin-muted)]",
            )}
          />
          <div className="admin-copy text-[11px] leading-5">
            <span className="font-semibold text-[var(--admin-ink)]">
              {external ? "Irreversible external consequence:" : "Material consequence:"}
            </span>{" "}
            {consequence}
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="m-5 rounded-lg border border-[var(--admin-danger)]/30 p-3 text-sm text-[var(--admin-danger)]"
          >
            {error}
          </p>
        )}
        <div className="grid gap-4 px-5 py-5 sm:px-6">
          {layoutSummary && (
            <dl className="grid gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3">
              <div className="grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                  scope
                </dt>
                <dd className="break-words text-xs text-[var(--admin-ink)]">
                  {layoutSummary.scopeLabel}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                  new order
                </dt>
                <dd className="break-words text-xs text-[var(--admin-ink)]">
                  {layoutSummary.orderText}
                </dd>
              </div>
              {layoutSummary.hiddenText && (
                <div className="grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                    hidden
                  </dt>
                  <dd className="break-words text-xs text-[var(--admin-ink)]">
                    {layoutSummary.hiddenText}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {!layoutSummary && fields.length > 0 && (
            <dl className="grid gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3">
              {fields.map(([key, value]) => (
                <div key={key} className="grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                    {key.replace(/_/g, " ")}
                  </dt>
                  <dd className="break-words text-xs text-[var(--admin-ink)]">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {body && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                Exact content
              </p>
              <pre className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3 font-sans text-xs leading-6 text-[var(--admin-ink)]">
                {body}
              </pre>
            </div>
          )}

          {!fields.length && !body && (
            <p className="admin-copy text-xs">
              This proposal recorded no payload. Reject it and ask the copilot to restage the
              action.
            </p>
          )}

          {(action.reasoning || action.description) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                Why the copilot proposed this
              </p>
              <p className="admin-copy mt-1.5 text-pretty text-xs leading-5">
                {action.reasoning || action.description}
              </p>
            </div>
          )}

          {action.expires_at && (
            <p className="admin-copy text-[11px]">
              Expires{" "}
              {relativeTime(action.expires_at)
                .replace(/^Due in /, "in ")
                .replace(/^Due today$/, "today")}
              .
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--admin-danger)] transition-[background-color,transform] duration-150 hover:bg-[var(--admin-danger-soft)] active:scale-[0.96] disabled:opacity-50"
          >
            <X className="size-3.5" /> Reject
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {external ? "Approve and send" : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}
