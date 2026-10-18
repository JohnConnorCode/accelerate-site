"use client";
import { contentCalendarCommandApprovalSchema } from "@/lib/revenue-os/content-calendar-contract";
import { billingApprovalSchema } from "@/lib/revenue-os/billing-command-contract";
import {
  ticketAdminCommandSchema,
  eventTiming,
  ticketMoney,
} from "@/lib/revenue-os/event-ticketing-contract";
import { useEffect, useRef } from "react";
import { Check, ChevronDown, Loader2, TriangleAlert, X } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import { ADMIN_LAYOUT_SCOPES } from "@/lib/admin/layout-scopes";
import { relativeTime } from "@/lib/admin/work-presentation";
import { cn } from "@/lib/utils";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { TODAY_MODULES, type TodayDocument } from "@/lib/admin/today-workspace";

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
  evidence?: Record<string, unknown> | null;
  /** Triage receipt recorded when this proposal passed the operator-queue gate. */
  triage?: Record<string, unknown> | null;
}

/** Plain-language triage reason, or null when the row predates the gate. */
function triageReason(triage: Record<string, unknown> | null | undefined): string | null {
  const reason = triage?.reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

/**
 * What each action will actually do if approved, in plain language. Approving is
 * irreversible for external actions, so the operator is told the consequence
 * before the button, not after.
 */
const ACTION_CONSEQUENCE: Record<string, string> = {
  event_ticketing_change:
    "Applies the exact event operation below. Publishing opens ticket sales. Existing orders keep their agreed price and terms. Payment history remains unchanged.",
  content_calendar_change:
    "Applies only the exact calendar command below after checking current records and statuses. Delete permanently removes the calendar item. Website pages and approval history remain; no website content is published.",
  update_content_calendar_item:
    "Saves these editorial values after checking the item revision. A calendar status or date does not publish a website page.",
  update_collection_policy:
    "Updates this collection case and its follow-up work after rechecking current invoice and recipient facts. No reminder is sent and no invoice is changed.",
  today_view_change:
    "Saves the exact Today arrangement and preferences shown below. Business records are unchanged. Only the proposing member can approve it.",
  send_email: "Sends this email immediately. It cannot be recalled.",
  send_gmail_reply: "Sends this reply from your Gmail account immediately. It cannot be recalled.",
  create_debate_invitation:
    "Sends one Google Calendar invitation to both named participants immediately. They will be notified. The event is read back and recorded before success is claimed.",
  create_gmail_draft:
    "Saves this exact reply as an editable Gmail draft. It is not sent. You can review, edit, or send it in Gmail Drafts.",
  activate_campaign:
    "Starts this campaign. Enrolled contacts begin receiving email on the next run.",
  duplicate_campaign:
    "Creates a new draft copy of this campaign with no members enrolled. Nothing sends until the copy is enrolled and activated.",
  bulk_tag_contacts: "Adds or removes tags on the selected contacts. No email sends.",
  bulk_suppress_contacts:
    "Stops all pending campaign email to the selected contacts and marks them suppressed. Suppression cannot be undone automatically.",
  bulk_enroll_contacts:
    "Stages the selected contacts as queued members of a draft campaign. Nothing sends until the campaign is activated.",
  transition_opportunity:
    "Moves this opportunity to a new stage and records an immutable stage event.",
  create_task: "Creates a task on your queue.",
  update_next_action: "Changes the next step recorded on this opportunity.",
  internal_permission_change:
    "Replaces the previous workspace permission for this operation with permission for the requesting member on only the records, fields, expiry and daily limit shown below. Only that member can approve it. Messages, publishing, billing and permission changes keep human approval.",
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

function payloadEntries(payload: Record<string, unknown> | null, actionType: string) {
  if (
    !payload ||
    actionType === "blueprint_draft_change" ||
    actionType === "billing_change" ||
    actionType === "content_calendar_change" ||
    actionType === "event_ticketing_change"
  )
    return { fields: [] as Array<[string, string]>, body: null as string | null };
  const fields: Array<[string, string]> = [];
  let body: string | null = null;
  const keys = Object.keys(payload).sort((a, b) => {
    const ai = PAYLOAD_FIELD_ORDER.indexOf(a),
      bi = PAYLOAD_FIELD_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });
  for (const key of keys) {
    // The task snapshot fences execution; proposed fields and the explicit
    // clearing summary are the human-facing change, not this internal JSON.
    if (actionType === "update_task" && key === "expectedState") continue;
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
  onExitComplete,
  onApprove,
  onReject,
  error,
  inline = false,
}: {
  inline?: boolean;
  error?: string;
  open: boolean;
  action: ActionRow | null;
  busy: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isConfiguration = action?.action_type === "workspace_configuration_change";
  const isToday = action?.action_type === "today_view_change";
  const todayPreview = useAdminQuery<{
    before: TodayDocument;
    after: TodayDocument;
    change: { scope: string; revision: number };
  }>(
    ["today-proposal", action?.id],
    "/api/admin/revenue-os/today/views?proposal=" +
      encodeURIComponent(String(action?.payload?.digest || "")),
    { enabled: Boolean(open && isToday), retry: false },
  );
  if (!action) {
    return (
      <AdminDialog open={false} onClose={onClose} title="Review before approving">
        <span />
      </AdminDialog>
    );
  }
  const isCalendar = action.action_type === "content_calendar_change";
  const isTicket = action.action_type === "event_ticketing_change";
  const billing =
    action.action_type === "billing_change"
      ? billingApprovalSchema.safeParse(action.payload)
      : null;
  const ticket = isTicket ? ticketAdminCommandSchema.safeParse(action.payload) : null;
  const calendar = isCalendar
    ? contentCalendarCommandApprovalSchema.safeParse(action.payload)
    : null;
  const policy = action.action_type === "update_collection_policy" ? action.payload : null;
  const policyFacts = policy?.facts as
    { name?: string; email?: string; currency?: string } | undefined;
  const { fields, body } = payloadEntries(
    policy
      ? {
          customer: policyFacts?.name,
          email: policyFacts?.email,
          currency: policyFacts?.currency?.toUpperCase(),
          description: action.description,
        }
      : action.action_type === "internal_permission_change"
        ? {
            ...(action.payload?.permission as Record<string, unknown>),
            description: action.description,
          }
        : action.payload,
    action.action_type,
  );
  const layoutSummary =
    action.action_type === "admin_layout_change" ? layoutChangeSummary(action.payload) : null;
  const blueprintReview =
    action.action_type === "blueprint_draft_change"
      ? (action.payload?.review as Record<string, string> | undefined)
      : undefined;
  const consequence =
    (typeof blueprintReview?.Consequence === "string" ? blueprintReview.Consequence : null) ??
    (billing?.success ? billing.data.review.Consequence : null) ??
    (ticket?.success
      ? ticket.data.operation === "save_event"
        ? ticket.data.event.status === "published"
          ? "Saves these event settings and opens ticket sales. Existing orders retain their agreed price and refund terms."
          : "Saves these event settings. New checkouts follow the saved sales status; existing orders retain their agreed price and terms."
        : ticket.data.operation === "reconcile"
          ? "Checks expired reservations against Stripe. Places are released only when the provider confirms expiry or the complete receipt lookup proves checkout was never created."
          : "Checks the existing email receipt and retries an eligible failed confirmation using its original provider key. Paid admission remains recorded."
      : null) ??
    (isConfiguration && typeof action.payload?.consequences === "string"
      ? action.payload.consequences
      : null) ??
    (calendar?.success
      ? calendar.data.command.operation === "delete"
        ? "Permanently deletes the named calendar item after checking its current state. Approval history and audit receipts remain. Website pages stay live."
        : "Saves only the calendar changes shown below after checking current items and columns. Website publication is a separate step."
      : null) ??
    ACTION_CONSEQUENCE[action.action_type] ??
    "Executes this action through the same service the admin uses.";
  const external =
    action.action_type === "billing_change" ||
    action.action_type === "send_email" ||
    action.action_type === "send_gmail_reply" ||
    action.action_type === "create_debate_invitation" ||
    action.action_type === "activate_campaign";
  const invitation = action.action_type === "create_debate_invitation" ? action.payload : null;
  const milestone = action.action_type === "record_debate_milestone" ? action.payload : null;
  const acceptances = Array.isArray(invitation?.acceptances)
    ? (invitation.acceptances as Array<{
        sender?: string;
        excerpt?: string;
        messageId?: string;
        conversationId?: string;
      }>)
    : [];
  const consequenceBanner = (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border",
        inline ? "mx-3 mt-3 px-3 py-2" : "mx-5 mt-5 px-3.5 py-3 sm:mx-6",
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
  );
  const Surface = inline ? InlineReviewSurface : AdminDialog;
  return (
    <Surface
      key={action.id}
      open={open}
      onClose={onClose}
      onExitComplete={onExitComplete}
      title="Review before approving"
      labelledBy="action-review-title"
      maxWidth="sm"
      align="right"
      className="sm:max-w-[420px]"
    >
      <div
        className={cn(
          inline
            ? "w-full bg-[var(--admin-surface)]"
            : "h-dvh w-full overflow-y-auto bg-[var(--admin-surface)] shadow-2xl",
          isConfiguration && "flex flex-col [&>*]:shrink-0",
        )}
      >
        <div
          className={cn(
            "sticky top-0 z-10 flex items-start justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 backdrop-blur-xl",
            inline ? "gap-2 px-3 py-3" : "gap-4 px-5 py-4 sm:px-6",
          )}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className={cn("admin-eyebrow", inline && "sr-only")}>Approval queue</p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                  inline && "whitespace-nowrap",
                  external
                    ? "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
                    : "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]",
                )}
              >
                {action.action_type === "create_gmail_draft"
                  ? "Gmail Draft"
                  : external
                    ? "External Action"
                    : isConfiguration
                      ? "Configuration"
                      : "Internal Mutation"}
              </span>
            </div>
            <h2
              id="action-review-title"
              className={cn(
                "mt-1 text-balance font-semibold tracking-[-0.03em] text-[var(--admin-ink)]",
                inline ? "text-base" : "text-xl",
              )}
            >
              {action.title}
            </h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
              {isCalendar ? "Editorial calendar" : action.action_type.replace(/_/g, " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review"
            className={cn(
              "grid shrink-0 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]",
              inline ? "size-8" : "size-10",
            )}
          >
            <X className="size-4" />
          </button>
        </div>

        {!inline && consequenceBanner}

        {error && (
          <p
            role="alert"
            className="m-5 rounded-lg border border-[var(--admin-danger)]/30 p-3 text-sm text-[var(--admin-danger)]"
          >
            {error}
          </p>
        )}
        <div className={cn("grid gap-4", inline ? "px-3 py-3" : "px-5 py-5 sm:px-6")}>
          {isConfiguration &&
            (["before", "after"] as const).map((phase) => {
              const values = action.payload?.[phase];
              const labels: Record<string, string> = {
                provider: "Provider",
                status: "Connection",
                accountEmail: "Account",
                scopes: "Granted permissions",
                folderIds: "Drive folders",
                key: "Preference",
                value: "Value",
                source: "Sources",
                maxGmailThreads: "Maximum Gmail threads",
                operation: "Operation",
              };
              return (
                <section
                  key={phase}
                  className="grid gap-3 rounded-xl border border-[var(--admin-border)] p-4 text-xs text-[var(--admin-ink)]"
                  aria-label={
                    phase === "before" ? "Current configuration" : "Exact new configuration"
                  }
                >
                  <h3 className="font-semibold">
                    {phase === "before" ? "Current configuration" : "Exact new configuration"}
                  </h3>
                  <dl className="grid gap-3">
                    {values !== null &&
                      typeof values === "object" &&
                      Object.entries(values)
                        .filter(
                          ([key]) =>
                            key in labels &&
                            (key !== "scopes" ||
                              (action.payload?.change as { operation?: string } | undefined)
                                ?.operation === "disconnect_provider"),
                        )
                        .map(([key, value]) => (
                          <div key={key} className="grid gap-1">
                            <dt className="text-[var(--admin-muted)]">{labels[key]}</dt>
                            <dd className="whitespace-pre-wrap break-words leading-5">
                              {Array.isArray(value)
                                ? value.length
                                  ? value.join("\n")
                                  : "None selected"
                                : value === "true"
                                  ? "On"
                                  : value === "false"
                                    ? "Off"
                                    : value === null
                                      ? "Not set"
                                      : String(value)
                                          .replace(/^NOTIFY_/, "")
                                          .replaceAll("_", " ")}
                            </dd>
                          </div>
                        ))}
                  </dl>
                </section>
              );
            })}
          {action.action_type === "content_calendar_change" && (
            <ContentCalendarReview payload={action.payload} />
          )}
          {isTicket && <EventTicketReview command={ticket?.success ? ticket.data : null} />}
          {blueprintReview && (
            <section aria-label="Exact Blueprint draft change">
              <dl className="space-y-3 text-sm">
                {Object.entries(blueprintReview)
                  .filter(([label]) => !["Consequence", "Operation"].includes(label))
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[var(--admin-muted)]">{label}</dt>
                      <dd className="min-w-0 whitespace-pre-wrap break-words font-medium">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          )}
          {billing &&
            (billing.success ? (
              <section aria-label="Exact billing operation">
                <dl className="grid gap-3 text-sm">
                  {Object.entries(billing.data.review)
                    .filter(([label]) => label !== "Consequence")
                    .map(([label, value]) => (
                      <div key={label} className="grid gap-1 sm:grid-cols-[120px_minmax(0,1fr)]">
                        <dt className="text-[var(--admin-muted)]">{label}</dt>
                        <dd className="min-w-0 break-words font-medium">{value}</dd>
                      </div>
                    ))}
                </dl>
              </section>
            ) : (
              <p role="alert">
                This billing proposal is incomplete. Reject it and prepare a new review.
              </p>
            ))}
          {isToday && (
            <section className="grid gap-3 text-xs text-[var(--admin-ink)]">
              {todayPreview.isPending && <p>Loading the private exact preview…</p>}
              {todayPreview.error && (
                <p role="alert">
                  {todayPreview.error.message} Only the proposing member can open this preview.
                </p>
              )}
              {todayPreview.data && (
                <>
                  <p>
                    Save for:{" "}
                    {todayPreview.data.change.scope === "personal"
                      ? "Just me"
                      : "Everyone in this workspace"}{" "}
                    · Expected revision {todayPreview.data.change.revision}
                  </p>
                  {(["before", "after"] as const).map((phase) => (
                    <div key={phase} className="rounded-xl border border-[var(--admin-border)] p-3">
                      <h3 className="mb-2 font-semibold">
                        {phase === "before" ? "Current arrangement" : "Exact new arrangement"}
                      </h3>
                      {todayPreview.data![phase].views.map((view) => (
                        <p key={view.id} className="mb-2">
                          <strong>{view.name}</strong> · {view.density}
                          <br />
                          {view.modules
                            .map((m) => TODAY_MODULES.find((t) => t.id === m.type)?.name)
                            .join(" → ")}
                        </p>
                      ))}
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 py-2 [&::-webkit-details-marker]:hidden">
                          Inspect all settings and preferences
                          <ChevronDown
                            className="size-3.5 shrink-0 text-[var(--admin-muted)] transition-transform duration-200 group-open:rotate-180"
                            aria-hidden="true"
                          />
                        </summary>
                        <pre className="overflow-auto whitespace-pre-wrap break-all text-[10px]">
                          {JSON.stringify(todayPreview.data![phase], null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </>
              )}
            </section>
          )}
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

          {invitation && (
            <section className="space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-4 text-xs">
              <h3 className="font-semibold">Exact invitation</h3>
              <p>
                <strong>Recipients:</strong>{" "}
                {Array.isArray(invitation.attendees) ? invitation.attendees.join(", ") : "Missing"}
              </p>
              <p>
                <strong>Start:</strong> {String(invitation.startAt ?? "")} · <strong>End:</strong>{" "}
                {String(invitation.endAt ?? "")} · {String(invitation.timeZone ?? "")}
              </p>
              <p>
                <strong>Title:</strong> {String(invitation.summary ?? "")}
              </p>
              <p>
                <strong>Location:</strong>{" "}
                {String(
                  invitation.location || (invitation.createMeet ? "Google Meet requested" : "None"),
                )}
              </p>
              <p className="whitespace-pre-wrap">
                <strong>Invitation text:</strong>
                <br />
                {String(invitation.description ?? "")}
              </p>
              <h4 className="font-semibold">Participant acceptance sources</h4>
              {acceptances.map((acceptance) => (
                <p
                  key={acceptance.messageId}
                  className="rounded-lg border border-[var(--admin-border)] p-2"
                >
                  <strong>{acceptance.sender}</strong> · message {acceptance.messageId}
                  <br />
                  {acceptance.excerpt}
                  {acceptance.conversationId && (
                    <>
                      <br />
                      <a
                        className="underline"
                        href={`/admin/conversations?thread=${acceptance.conversationId}`}
                      >
                        Read full thread
                      </a>
                    </>
                  )}
                </p>
              ))}
            </section>
          )}

          {milestone && (
            <section className="space-y-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-4 text-xs">
              <h3 className="font-semibold">Commitment to record</h3>
              <p>
                <strong>{String(milestone.milestone ?? "").replaceAll("_", " ")}:</strong>{" "}
                {String(milestone.status ?? "")} · {String(milestone.value ?? "")}
              </p>
              <p>
                <strong>Source:</strong> {String(milestone.sourceType ?? "").replaceAll("_", " ")} ·{" "}
                {String(milestone.sourceId ?? "")}
              </p>
              <p>
                <strong>Observed:</strong> {String(milestone.observedAt ?? "")}
              </p>
              {typeof action.evidence?.excerpt === "string" && (
                <p className="whitespace-pre-wrap">
                  <strong>Source excerpt:</strong>
                  <br />
                  {action.evidence.excerpt}
                </p>
              )}
              {typeof action.evidence?.sourceHref === "string" && (
                <a className="underline" href={action.evidence.sourceHref}>
                  Open cited source
                </a>
              )}
            </section>
          )}

          {!isConfiguration &&
            !isToday &&
            !layoutSummary &&
            !invitation &&
            !milestone &&
            fields.length > 0 && (
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

          {body && !invitation && !milestone && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                Exact content
              </p>
              <pre className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-4 py-3 font-sans text-xs leading-6 text-[var(--admin-ink)]">
                {body}
              </pre>
            </div>
          )}

          {!billing &&
            !blueprintReview &&
            !isCalendar &&
            !isTicket &&
            !isConfiguration &&
            !fields.length &&
            !body &&
            !invitation &&
            !milestone && (
              <p className="admin-copy text-xs">
                This proposal recorded no payload. Reject it and ask the copilot to restage the
                action.
              </p>
            )}

          {(action.reasoning || action.description) &&
            (!billing || action.reasoning || action.description !== consequence) &&
            (!blueprintReview || action.reasoning || action.description !== consequence) &&
            (!isCalendar || action.reasoning) &&
            (!isConfiguration || action.reasoning || action.description !== consequence) && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                  Why the copilot proposed this
                </p>
                <p className="admin-copy mt-1.5 text-pretty text-xs leading-5">
                  {action.reasoning || action.description}
                </p>
              </div>
            )}

          {triageReason(action.triage) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                Why this reached you
              </p>
              <p className="admin-copy mt-1.5 text-pretty text-xs leading-5">
                {triageReason(action.triage)}
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

        <div
          className={cn(
            "sticky bottom-0 mt-auto border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 backdrop-blur-xl",
            inline
              ? "z-20 grid grid-cols-3 gap-1 px-2 py-2"
              : "flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6",
          )}
        >
          {inline && (
            <div className="col-span-3 [&>div]:mx-0 [&>div]:mt-0">{consequenceBanner}</div>
          )}
          <button
            type="button"
            data-review-decision="reject"
            disabled={busy}
            onClick={onReject}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-[var(--admin-danger)] transition-[background-color,transform] duration-150 hover:bg-[var(--admin-danger-soft)] active:scale-[0.96] disabled:opacity-50",
              inline ? "px-2" : "px-3",
            )}
          >
            <X className="size-3.5" /> Reject
          </button>
          <div className={inline ? "contents" : "flex gap-2"}>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "min-h-11 rounded-xl text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]",
                inline ? "px-2" : "px-4",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              data-review-decision="approve"
              disabled={
                busy ||
                action.status !== "pending" ||
                Boolean(isToday && !todayPreview.data) ||
                Boolean(isCalendar && !calendar?.success) ||
                Boolean(isTicket && !ticket?.success) ||
                Boolean(billing && !billing.success)
              }
              onClick={onApprove}
              className={cn(
                "admin-button admin-button--primary",
                inline && "!whitespace-normal !px-2 !text-xs",
              )}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className={cn("size-3.5", inline && "hidden")} />
              )}
              {action.action_type === "create_gmail_draft"
                ? "Save draft to Gmail"
                : external && !billing
                  ? "Approve and send"
                  : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function EventTicketReview({
  command,
}: {
  command: ReturnType<typeof ticketAdminCommandSchema.parse> | null;
}) {
  if (!command)
    return (
      <p role="alert">This event proposal is incomplete. Reject it and request a new proposal.</p>
    );
  const event = command.operation === "save_event" ? command.event : null;
  const values: Array<[string, string]> = event
    ? [
        ["Event", event.title],
        ["Page headline", event.headline],
        ["Page address", event.slug],
        ["Introduction", event.description],
        ["When", `${eventTiming(event).date}, ${eventTiming(event).time}`],
        ["Time zone", event.timezone],
        ["Venue", `${event.venue_name}, ${event.venue_address}`],
        ["Ticket price", ticketMoney(event.price_cents)],
        ["Capacity", `${event.capacity} tickets`],
        ["Sales status", event.status],
        [
          "Refund cutoff",
          new Intl.DateTimeFormat("en-US", {
            timeZone: event.timezone,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(event.refund_cutoff)),
        ],
        ["Refund terms", event.refund_policy],
        ["Implementation support", event.support_description],
        ["Expected revision", String(command.operation === "save_event" ? command.revision : "")],
      ]
    : [
        [
          "Operation",
          command.operation === "reconcile"
            ? "Check expired reservations against Stripe receipts"
            : "Retry the recorded confirmation for this paid order",
        ],
        [
          command.operation === "reconcile" ? "Event reference" : "Order reference",
          command.operation === "reconcile"
            ? command.eventId
            : command.operation === "retry_confirmation"
              ? command.orderId
              : "",
        ],
      ];
  return (
    <section role="region" aria-label="Exact event operation">
      <h3 className="font-semibold">
        {event ? "Event settings to save" : "Requested ticket operation"}
      </h3>
      <dl className="mt-3 grid gap-3 text-xs">
        {values.map(([label, value]) => (
          <div className="grid gap-1 sm:grid-cols-[140px_1fr]" key={label}>
            <dt className="text-[var(--admin-muted)]">{label}</dt>
            <dd className="whitespace-pre-wrap break-words text-[var(--admin-ink)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function InlineReviewSurface({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  labelledBy: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    sectionRef.current?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [open]);
  return open ? (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label="Review exact changes"
      className="mt-3 overflow-clip rounded-xl bg-[var(--admin-surface)] shadow-[var(--admin-shadow-border)] outline-none"
    >
      {children}
    </section>
  ) : null;
}

function ContentCalendarReview({ payload }: { payload: Record<string, unknown> | null }) {
  const parsed = contentCalendarCommandApprovalSchema.safeParse(payload);
  if (!parsed.success)
    return (
      <p role="alert">This calendar proposal is invalid. Request a new preview before approving.</p>
    );
  const { command, items, columns } = parsed.data;
  const statusLabel = (key: string) => columns.find((column) => column.key === key)?.label ?? key;
  const labels: Record<string, string> = {
    title: "Title",
    slug: "Slug",
    status: "Editorial stage",
    category: "Category",
    target_keywords: "Keywords",
    pillar: "Content pillar",
    funnel_stage: "Funnel stage",
    target_publish_date: "Target publication date",
    actual_publish_date: "Recorded publication date",
    author: "Author",
    notes: "Notes",
    seo_title: "SEO title",
    seo_description: "SEO description",
    word_count_target: "Target word count",
  };
  return (
    <section
      aria-label="Exact calendar changes"
      className="grid gap-4 text-sm text-[var(--admin-ink)]"
    >
      {command.operation === "create" ? (
        <dl className="grid gap-3">
          {Object.entries(command.values).map(([key, value]) => (
            <div key={key} className="grid gap-1">
              <dt className="text-xs text-[var(--admin-muted)]">{labels[key] ?? key}</dt>
              <dd className="whitespace-pre-wrap break-words">
                {value === null
                  ? "Not set"
                  : key === "status"
                    ? statusLabel(String(value))
                    : Array.isArray(value)
                      ? value.join(", ")
                      : String(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        items.map((item) => {
          const update =
            command.operation === "reorder"
              ? command.updates.find((row) => row.id === item.id)!
              : null;
          return (
            <div
              key={item.id}
              className="grid gap-2 rounded-xl bg-[var(--admin-surface-subtle)] p-4"
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-xs">
                {update
                  ? `${statusLabel(item.status)} → ${statusLabel(update.column_key)}`
                  : `Current stage: ${statusLabel(item.status)}`}
              </p>
              {update && (
                <p className="text-xs tabular-nums">
                  Position: {item.sortOrder} → {update.sort_order}
                </p>
              )}
              <p className="break-all text-xs text-[var(--admin-muted)]">Item: {item.id}</p>
            </div>
          );
        })
      )}
    </section>
  );
}
