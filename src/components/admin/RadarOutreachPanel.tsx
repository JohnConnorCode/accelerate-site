"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/admin/fetchJson";
import { AdminSurface } from "./AdminSurface";
import { AdminDialog } from "./AdminDialog";
import AdminLink from "./AdminLink";
import { button, primary, words } from "./RadarUI";
import type { RadarWorkspaceData } from "@/lib/revenue-os/radar-workspace-contract";
import type {
  previewRadarOutreach,
  readRadarOutreachOptions,
} from "@/lib/revenue-os/radar-outreach";
import {
  radarOutreachPurposeSchema,
  type RadarOutreachPreviewInput,
} from "@/lib/revenue-os/radar-outreach-contract";
import type { RadarStoreChange } from "@/lib/revenue-os/radar-store-contract";
const command = <T,>(kind: string, input: unknown) =>
  fetchJson<T>("/api/admin/radar/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, input }),
  });
type Preview = Awaited<ReturnType<typeof previewRadarOutreach>>;
type Options = Awaited<ReturnType<typeof readRadarOutreachOptions>>;
const field =
  "mt-1 min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm";
export function RadarOutreachPanel({
  data,
  onDraft,
}: {
  data: RadarWorkspaceData;
  onDraft: (change: Extract<RadarStoreChange, { operation: "add_asset" }>) => void;
}) {
  const packet = data.packet!,
    id = packet.opportunity.id,
    cache = useQueryClient();
  const [assetId, setAsset] = useState(""),
    [purpose, setPurpose] = useState<RadarOutreachPreviewInput["purpose"]>("partnership"),
    [other, setOther] = useState(""),
    [relationship, setRelationship] = useState(""),
    [claims, setClaims] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [consents, setConsents] = useState<RadarOutreachPreviewInput["consents"]>([]),
    [contribution, setContribution] = useState(""),
    [ask, setAsk] = useState(""),
    [useModel, setUseModel] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false),
    operation = useRef(crypto.randomUUID());
  const options = useQuery({
    queryKey: ["admin", "radar", "outreach-options", id, other],
    queryFn: () =>
      command<Options>("outreach_options", {
        opportunityId: id,
        ...(other ? { otherContactId: other } : {}),
      }),
    enabled: data.enabled,
  });
  const history = useQuery({
    queryKey: ["admin", "radar", "outreach-history", id],
    queryFn: () =>
      command<{
        attempts: Array<{
          action_id: string;
          state: string;
          sent_at: string | null;
          created_at: string;
          provider_id: string | null;
        }>;
      }>("outreach_history", { opportunityId: id }),
  });
  async function perform(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Outreach could not be completed");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function prepare() {
    const result = await command<{
      saveChange: Extract<RadarStoreChange, { operation: "add_asset" }>;
    }>("prepare_outreach", {
      operationId: operation.current,
      opportunityId: id,
      expectedRevision: packet.opportunity.revision,
      purpose: purpose === "introduction" ? "partnership" : purpose,
      sourceVersionIds: packet.sources
        .filter((s) => s.verification === "verified")
        .slice(0, 5)
        .map((s) => s.id),
      approvedClaimIds: claims,
      useModel,
      usefulContribution: contribution,
      exactAsk: ask,
    });
    onDraft(result.saveChange);
    operation.current = crypto.randomUUID();
  }
  async function review() {
    setPreview(
      await command<Preview>("outreach_preview", {
        assetId,
        purpose,
        approvedClaimIds: claims,
        reason,
        relationshipId: purpose === "introduction_request" ? relationship : null,
        introductionContactId: purpose === "introduction" ? other : null,
        consents: purpose === "introduction" ? consents : [],
      }),
    );
  }
  async function queue(approve: boolean) {
    if (!preview) return;
    const action = await command<{ id: string }>("outreach_propose", {
      input: preview.input,
      digest: preview.digest,
    });
    if (approve)
      await fetchJson("/api/admin/revenue-os/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: action.id, decision: "approve" }),
      });
    setPreview(null);
    setNotice(
      approve
        ? "Approval processed. Check the confirmed delivery receipt below. The fictional demo simulates delivery only."
        : "Saved for human approval in Today.",
    );
    await cache.invalidateQueries({ queryKey: ["admin"] });
  }
  return (
    <AdminSurface>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Mail size={18} aria-hidden />
        Reviewed outreach
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
        Prepare a useful message from current sources and earlier conversations. Every send requires
        review of the exact recipient, message and evidence.
      </p>
      {options.data && (
        <p className="mt-2 text-xs tabular-nums">
          {words(options.data.mode)} · {options.data.dailyLimit} reservations per UTC day ·{" "}
          {options.data.cooldownHours} hour contact cooldown
        </p>
      )}
      {options.error && (
        <p role="alert" className="mt-3 text-sm">
          {options.error.message}
        </p>
      )}
      {data.enabled && (
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            Purpose
            <select
              className={field}
              value={purpose}
              onChange={(e) => {
                setPurpose(radarOutreachPurposeSchema.parse(e.target.value));
                setConsents([]);
                setPreview(null);
              }}
            >
              {radarOutreachPurposeSchema.options.map((p) => (
                <option key={p} value={p}>
                  {words(p)}
                </option>
              ))}
            </select>
          </label>
          <details className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
            <summary className="min-h-10 cursor-pointer text-sm font-semibold">
              Prepare a new outreach draft
            </summary>
            <label className="mt-3 block text-sm">
              Useful contribution
              <textarea
                className={field}
                maxLength={600}
                rows={3}
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Specific ask
              <textarea
                className={field}
                maxLength={600}
                rows={2}
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
              />
            </label>
            <label className="my-3 flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useModel}
                onChange={(e) => setUseModel(e.target.checked)}
              />
              Use the configured model budget for wording
            </label>
            <button
              className={button}
              disabled={busy || !contribution.trim() || !ask.trim()}
              onClick={() => void perform(prepare)}
            >
              Prepare draft for review
            </button>
            <p className="mt-2 text-xs leading-5">
              Your text works without a model. Preparing does not save or send. Introduction consent
              is reviewed separately below.
            </p>
          </details>
          <label className="block text-sm font-medium">
            Saved outreach draft
            <select className={field} value={assetId} onChange={(e) => setAsset(e.target.value)}>
              <option value="">Choose a draft</option>
              {packet.assets
                .filter((a) => a.kind === "outreach_draft")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
            </select>
          </label>
          {purpose === "introduction_request" && (
            <label className="block text-sm">
              Current introduction offer
              <select
                className={field}
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
              >
                <option value="">Choose a reviewed offer</option>
                {options.data?.offers.map((o) => (
                  <option key={o.relationshipId} value={o.relationshipId!}>
                    {o.reason}
                  </option>
                ))}
              </select>
            </label>
          )}
          {purpose === "introduction" && (
            <div className="space-y-3">
              <label className="block text-sm">
                Introduce this contact to
                <select
                  className={field}
                  value={other}
                  onChange={(e) => {
                    setOther(e.target.value);
                    setConsents([]);
                  }}
                >
                  <option value="">Choose the second party</option>
                  {options.data?.people
                    .filter((p) => p.id !== options.data.contactId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} · {p.primary_email}
                      </option>
                    ))}
                </select>
              </label>
              <p className="text-xs leading-5">
                Both people must have sent a current, explicit consent message for this
                introduction. A suggested connection or offer alone does not count.
              </p>
              {options.data?.histories.map((h) => (
                <div key={h.contactId} className="rounded-xl bg-[var(--admin-surface-subtle)] p-3">
                  <label className="block text-sm">
                    Consent from{" "}
                    {options.data.people.find((p) => p.id === h.contactId)?.full_name ??
                      "this contact"}
                    <select
                      className={field}
                      value={consents.find((c) => c.contactId === h.contactId)?.messageId ?? ""}
                      onChange={(e) => {
                        const m = h.messages.find((m) => m.id === e.target.value);
                        setConsents((old) => [
                          ...old.filter((c) => c.contactId !== h.contactId),
                          ...(m
                            ? [
                                {
                                  contactId: h.contactId,
                                  messageId: String(m.id),
                                  quotation: String(m.body_excerpt),
                                  validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
                                },
                              ]
                            : []),
                        ]);
                      }}
                    >
                      <option value="">Choose their received message</option>
                      {h.messages
                        .filter((m) => m.direction === "inbound" && m.status === "received")
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {String(m.body_excerpt).slice(0, 100)}
                          </option>
                        ))}
                    </select>
                  </label>
                  {consents
                    .filter((c) => c.contactId === h.contactId)
                    .map((c) => (
                      <div key={c.messageId}>
                        <label className="mt-2 block text-sm">
                          Exact consent quotation
                          <textarea
                            className={field}
                            rows={3}
                            maxLength={1000}
                            value={c.quotation}
                            onChange={(e) =>
                              setConsents((old) =>
                                old.map((v) =>
                                  v.contactId === h.contactId
                                    ? { ...v, quotation: e.target.value }
                                    : v,
                                ),
                              )
                            }
                          />
                        </label>
                        <p className="mt-1 text-xs">
                          Review expires {new Date(c.validUntil).toLocaleDateString()}. Approval
                          still requires confirming these words authorize this exact introduction.
                        </p>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
          {Boolean(options.data?.claims.length) && (
            <fieldset>
              <legend className="text-sm font-medium">Approved facts used in this message</legend>
              {options.data?.claims.map((c) => (
                <label key={c.id} className="flex min-h-10 items-start gap-2 py-2 text-sm">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={claims.includes(c.id)}
                    onChange={(e) =>
                      setClaims((old) =>
                        e.target.checked ? [...old, c.id] : old.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {String(c.proposed_value)}
                </label>
              ))}
            </fieldset>
          )}
          <label className="block text-sm font-medium">
            Why this message is appropriate now
            <textarea
              className={field}
              rows={2}
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            className={primary}
            disabled={
              busy || !assetId || !reason.trim() || options.data?.mode !== "approval-required"
            }
            onClick={() => void perform(review)}
          >
            Review exact message
          </button>
          {options.data?.mode === "draft-only" && (
            <p className="text-sm">
              Sending is off. Configure Approval required in{" "}
              <AdminLink href="/admin/integrations" className="underline">
                Radar settings
              </AdminLink>{" "}
              when the sender and review process are ready.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      <div className="mt-6">
        <h3 className="text-sm font-semibold">Delivery receipts</h3>
        {history.error && (
          <p role="alert" className="mt-2 text-sm">
            {history.error.message}
          </p>
        )}
        {history.data?.attempts.length === 0 && (
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            No outreach has been dispatched for this opportunity.
          </p>
        )}
        {history.data?.attempts.map((a) => (
          <div key={a.action_id} className="mt-3 rounded-xl bg-[var(--admin-surface-subtle)] p-3">
            <p className="text-sm font-semibold">
              {data.model.mode === "simulated" ? "Simulated " : ""}
              {words(a.state)}
            </p>
            <p className="mt-1 text-xs tabular-nums">
              {new Date(a.sent_at ?? a.created_at).toLocaleString()}
            </p>
            {a.state !== "sent" && a.state !== "not_sent" && (
              <>
                <p className="mt-2 text-sm">Do not resend while acceptance is unresolved.</p>
                <button
                  className={button + " mt-2"}
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await command("outreach_reconcile", { actionId: a.action_id });
                      await history.refetch();
                    })
                  }
                >
                  <RefreshCw size={14} aria-hidden />
                  Check existing receipt
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <AdminDialog
        open={Boolean(preview)}
        title="Review outreach before sending"
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        maxWidth="lg"
      >
        {preview && (
          <div className="admin-dialog-surface max-h-[85dvh] overflow-y-auto bg-[var(--admin-surface)] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Review outreach before sending</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-semibold">From</dt>
                <dd className="break-words">
                  {preview.from} · Replies to {preview.replyTo}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">
                  To{preview.recipients.length > 1 ? " and CC" : ""}
                </dt>
                <dd>
                  {preview.recipients.map((r) => (
                    <p className="break-words" key={r.contactId}>
                      {r.name} · {r.email}
                    </p>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Subject</dt>
                <dd>{preview.subject}</dd>
              </div>
            </dl>
            <p className="my-5 whitespace-pre-wrap break-words rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm leading-7">
              {preview.text}
            </p>
            <h3 className="text-sm font-semibold">Cited sources and approved facts</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {preview.sources?.map((s) => (
                <li key={s.id}>
                  {s.title} · {s.verification}
                </li>
              ))}
              {preview.claims.map((c) => (
                <li key={c.id}>{c.proposed_value}</li>
              ))}
            </ul>
            <h3 className="mt-5 text-sm font-semibold">Prior conversations</h3>
            {preview.histories.map((h) => (
              <div className="mt-2 text-sm" key={h.contactId}>
                {h.messages.length ? (
                  h.messages.map((m) => (
                    <p className="mb-2 whitespace-pre-wrap" key={m.id}>
                      {words(String(m.direction))}: {String(m.body_excerpt)}
                    </p>
                  ))
                ) : (
                  <p>No earlier messages in the complete bounded history.</p>
                )}
              </div>
            ))}
            {preview.consent?.consents.map((c) => (
              <blockquote
                className="mt-3 rounded-xl bg-[var(--admin-surface-subtle)] p-3 text-sm"
                key={c.contactId}
              >
                {c.quotation}
                <p className="mt-2 text-xs">
                  Consent expires {new Date(c.validUntil).toLocaleString()}
                </p>
              </blockquote>
            ))}
            <p className="mt-4 text-sm leading-6">
              Approval confirms this exact message, recipient, cited facts and any two-party
              introduction consent. Sending rechecks current restrictions and evidence. The
              fictional demo never sends real messages.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className={primary}
                disabled={busy}
                onClick={() => void perform(() => queue(true))}
              >
                Approve and send
              </button>
              <button
                className={button}
                disabled={busy}
                onClick={() => void perform(() => queue(false))}
              >
                Queue for later review
              </button>
              <button className={button} disabled={busy} onClick={() => setPreview(null)}>
                Back
              </button>
            </div>
          </div>
        )}
      </AdminDialog>
    </AdminSurface>
  );
}
