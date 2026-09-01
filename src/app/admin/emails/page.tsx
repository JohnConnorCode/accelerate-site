"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Edit3,
  Eye,
  History,
  Loader2,
  Mail,
  Monitor,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Smartphone,
  TestTube2,
  TriangleAlert,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";
import { EmailBlockComposer } from "@/components/admin/EmailBlockComposer";
import { emailBlocksToText, type EmailBlock } from "@/lib/email/blocks";

interface EmailEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  subject: string;
  delayDays?: number;
  variables: string[];
  hasDraft: boolean;
  source: "published" | "built_in";
  updatedAt: string | null;
}

interface EmailDetail {
  schemaReady: boolean;
  id: string;
  name: string;
  description: string;
  category: string;
  variables: string[];
  sampleData: Record<string, string>;
  subjectTemplate: string;
  bodyTemplate: string;
  blocks: EmailBlock[];
  previewText: string;
  subject: string;
  html: string;
  source: "draft" | "published" | "built_in";
  hasDraft: boolean;
  updatedAt: string | null;
}

interface HistoryItem {
  id: string;
  to: string;
  toName: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  providerId: string | null;
  template: string | null;
  sentAt: string;
  source: string;
}

type StudioTab = "templates" | "history";

export default function EmailsPage() {
  const [tab, setTab] = useState<StudioTab>("templates");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  const [working, setWorking] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [actionError, setActionError] = useState("");
  const listQuery = useAdminQuery<{ schemaReady: boolean; emails: EmailEntry[] }>(
    ["admin", "emails"],
    "/api/admin/emails/preview",
  );
  const historyQuery = useAdminQuery<{ history: HistoryItem[] }>(
    ["admin", "emails-history"],
    "/api/admin/emails/history",
  );
  const emails = useMemo(() => listQuery.data?.emails ?? [], [listQuery.data?.emails]);
  const history = useMemo(() => historyQuery.data?.history ?? [], [historyQuery.data?.history]);
  const selectedEmailId = selectedId || emails[0]?.id || null;
  const detailQuery = useAdminQuery<EmailDetail>(
    ["admin", "emails", selectedEmailId],
    `/api/admin/emails/preview?id=${encodeURIComponent(selectedEmailId || "")}`,
    { enabled: Boolean(selectedEmailId) },
  );
  const detail = detailQuery.data ?? null;
  const loading = listQuery.isPending;

  const loadList = useCallback(async () => {
    setActionError("");
    await listQuery.refetch();
  }, [listQuery]);
  const loadHistory = useCallback(async () => {
    await historyQuery.refetch();
  }, [historyQuery]);
  const loadDetail = useCallback(
    async (id: string) => {
      setActionError("");
      setSelectedId(id);
      await detailQuery.refetch();
    },
    [detailQuery],
  );

  useEffect(() => {
    if (!detail || editing) return;
    setSubject(detail.subjectTemplate);
    setPreviewText(detail.previewText);
    setBlocks(detail.blocks);
  }, [detail, editing]);

  const filteredEmails = useMemo(
    () =>
      emails.filter(
        (email) =>
          !query.trim() ||
          `${email.name} ${email.description} ${email.category} ${email.subject}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [emails, query],
  );
  const filteredHistory = useMemo(
    () =>
      history.filter(
        (item) =>
          !query.trim() ||
          `${item.to} ${item.subject || ""} ${item.template || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [history, query],
  );
  const dirty = Boolean(
    detail &&
    (subject !== detail.subjectTemplate ||
      previewText !== detail.previewText ||
      JSON.stringify(blocks) !== JSON.stringify(detail.blocks)),
  );

  const saveDraft = async () => {
    if (!detail) return;
    setWorking(true);
    try {
      await fetchJson("/api/admin/emails/preview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detail.id, subjectTemplate: subject, previewText, blocks }),
      });
      await Promise.all([loadList(), loadDetail(detail.id)]);
      setEditing(false);
      toast.success("Draft saved. Live email is unchanged until you publish.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save the draft.");
    } finally {
      setWorking(false);
    }
  };

  const templateAction = async (action: "publish" | "test") => {
    if (!detail) return;
    setWorking(true);
    try {
      const result = await fetchJson<{ to?: string }>("/api/admin/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detail.id, action }),
      });
      setConfirmPublish(false);
      await Promise.all([loadList(), loadDetail(detail.id)]);
      toast.success(
        action === "publish"
          ? "Draft published to the live sending system."
          : `Test sent to ${result.to}.`,
      );
    } catch (actionError) {
      toast.error(
        actionError instanceof Error ? actionError.message : `Could not ${action} this template.`,
      );
    } finally {
      setWorking(false);
    }
  };

  const resetDraft = async () => {
    if (!detail) return;
    setWorking(true);
    try {
      await fetchJson(`/api/admin/emails/preview?id=${encodeURIComponent(detail.id)}`, {
        method: "DELETE",
      });
      await Promise.all([loadList(), loadDetail(detail.id)]);
      setEditing(false);
      toast.success("Draft discarded. The published or built-in email remains live.");
    } catch (resetError) {
      toast.error(
        resetError instanceof Error ? resetError.message : "Could not discard the draft.",
      );
    } finally {
      setWorking(false);
    }
  };

  const compose = () => {
    if (!detail) return;
    window.dispatchEvent(
      new CustomEvent("admin:compose-email", {
        detail: {
          subject: detail.subject,
          body: emailBlocksToText(detail.blocks, detail.sampleData || {}),
        },
      }),
    );
  };

  const currentListHidden =
    (tab === "templates" && selectedEmailId) || (tab === "history" && selectedHistory);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Email Studio"
        subtitle="Edit live email copy safely, inspect what was sent, and compose a direct follow-up from one workspace."
        utilityActions={
          <button
            type="button"
            onClick={() => {
              void loadList();
              void loadHistory();
            }}
            disabled={listQuery.isFetching}
            className="admin-icon-button shadow-[var(--admin-shadow-border)]"
            aria-label="Refresh Email Studio"
          >
            <RefreshCw className={cn("size-4", listQuery.isFetching && "animate-spin")} />
          </button>
        }
      />

      <AdminReadBody
        loading={loading}
        hasData={Boolean(listQuery.data)}
        error={listQuery.error?.message || historyQuery.error?.message || ""}
        onRetry={() => {
          void loadList();
          void loadHistory();
        }}
        refreshing={listQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="detail" />}
        label="Loading Email Studio"
      >
        {actionError && (
          <AdminSurface tone="attention" className="flex items-center gap-3">
            <TriangleAlert className="size-5 shrink-0 text-rose-600" />
            <p className="text-sm text-[var(--admin-ink)]">{actionError}</p>
          </AdminSurface>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.055]"
            role="tablist"
            aria-label="Email Studio views"
          >
            {[
              { id: "templates" as const, label: "Templates", icon: Mail },
              { id: "history" as const, label: "Sent history", icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => {
                  setTab(id);
                  setQuery("");
                }}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96]",
                  tab === id
                    ? "bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]"
                    : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === "templates" ? "Search templates" : "Search recipients or subjects"
              }
              className="admin-field pl-10"
            />
          </div>
        </div>

        <AdminSurface padding="none" className="min-h-[680px] overflow-hidden">
          <div className="grid min-h-[680px] lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside
              className={cn(
                "border-r border-[var(--admin-border)]",
                currentListHidden && "hidden lg:block",
              )}
            >
              <div className="border-b border-[var(--admin-border)] px-4 py-3">
                <p className="admin-eyebrow mb-0">
                  {tab === "templates"
                    ? `${filteredEmails.length} messages`
                    : `${filteredHistory.length} deliveries`}
                </p>
              </div>
              <div className="max-h-[635px] divide-y divide-[var(--admin-border)] overflow-y-auto">
                {tab === "templates"
                  ? filteredEmails.map((email) => (
                      <button
                        key={email.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(email.id);
                          setEditing(false);
                        }}
                        className={cn(
                          "group w-full px-4 py-3.5 text-left transition-[background-color] duration-150 hover:bg-black/[0.022] dark:hover:bg-white/[0.025]",
                          selectedEmailId === email.id && "bg-black/[0.035] dark:bg-white/[0.04]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">
                              {email.name}
                            </p>
                            <p className="admin-copy mt-1 line-clamp-2 text-[11px] leading-4">
                              {email.description}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "mt-0.5 size-2 shrink-0 rounded-full",
                              email.hasDraft
                                ? "bg-amber-500"
                                : email.source === "published"
                                  ? "bg-emerald-500"
                                  : "bg-slate-400",
                            )}
                          />
                        </div>
                        <div className="mt-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                          <span>{email.category}</span>
                          {email.delayDays != null && (
                            <span>
                              · {email.delayDays ? `Day ${email.delayDays}` : "Immediate"}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  : filteredHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedHistory(item)}
                        className={cn(
                          "w-full px-4 py-3.5 text-left transition-[background-color] duration-150 hover:bg-black/[0.022] dark:hover:bg-white/[0.025]",
                          selectedHistory?.id === item.id &&
                            "bg-black/[0.035] dark:bg-white/[0.04]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--admin-ink)]">
                            {item.to}
                          </p>
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              item.status === "sent" || item.status === "delivered"
                                ? "bg-emerald-500"
                                : item.status === "failed"
                                  ? "bg-rose-500"
                                  : "bg-amber-500",
                            )}
                          />
                        </div>
                        <p className="mt-1 truncate text-xs text-[var(--admin-ink)]">
                          {item.subject || "(No subject)"}
                        </p>
                        <p className="admin-copy mt-1 font-mono text-[9px] tabular-nums">
                          {new Date(item.sentAt).toLocaleString()}
                        </p>
                      </button>
                    ))}
              </div>
            </aside>

            <main className={cn("min-w-0", !currentListHidden && "hidden lg:block")}>
              {tab === "templates" && detail ? (
                <motion.div
                  key={detail.id}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                >
                  <header className="flex flex-wrap items-start gap-3 border-b border-[var(--admin-border)] px-4 py-4 sm:px-6">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="admin-icon-button lg:hidden"
                      aria-label="Back to templates"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-balance text-lg font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">
                          {detail.name}
                        </h2>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                            detail.source === "draft"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : detail.source === "published"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-black/[0.05] text-[var(--admin-muted)] dark:bg-white/[0.06]",
                          )}
                        >
                          {detail.source === "built_in" ? "Built-in live" : detail.source}
                        </span>
                      </div>
                      <p className="admin-copy mt-1 text-xs">{detail.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={compose}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"
                      >
                        <Send className="size-3.5" /> Compose
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing((current) => !current)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]"
                      >
                        {editing ? <Eye className="size-3.5" /> : <Edit3 className="size-3.5" />}
                        {editing ? "Preview" : "Edit"}
                      </button>
                    </div>
                  </header>
                  {editing ? (
                    <div>
                      <section className="space-y-4 border-b border-[var(--admin-border)] p-4 sm:p-6">
                        <label className="admin-field-label">
                          <span>Subject</span>
                          <input
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                            className="admin-field"
                          />
                        </label>
                        <label className="admin-field-label">
                          <span>Inbox preview text</span>
                          <input
                            value={previewText}
                            onChange={(event) => setPreviewText(event.target.value)}
                            className="admin-field"
                          />
                        </label>
                        <div>
                          <p className="admin-eyebrow">Available variables</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {detail.variables.map((variable) => (
                              <span
                                key={variable}
                                className="rounded-[var(--admin-control-radius)] bg-[var(--admin-surface-subtle)] px-2 py-1 font-mono text-[10px] text-[var(--admin-muted)]"
                              >{`{{${variable}}}`}</span>
                            ))}
                          </div>
                        </div>
                      </section>
                      <EmailBlockComposer
                        templateId={detail.id}
                        subject={subject}
                        previewText={previewText}
                        blocks={blocks}
                        onChange={setBlocks}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--admin-border)] p-4 sm:px-6">
                        <button
                          type="button"
                          onClick={() => void resetDraft()}
                          disabled={working || !detail.hasDraft}
                          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-control-radius)] px-3 text-xs font-semibold text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] disabled:opacity-35"
                        >
                          <RotateCcw className="size-3.5" /> Discard draft
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveDraft()}
                          disabled={working || !dirty}
                          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--admin-control-radius)] bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-35"
                        >
                          {working ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Save className="size-3.5" />
                          )}{" "}
                          Save draft
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
                        <p className="text-sm font-medium text-[var(--admin-ink)]">
                          {detail.subject}
                        </p>
                        <div className="flex items-center gap-2">
                          {detail.hasDraft && (
                            <>
                              <button
                                type="button"
                                onClick={() => void templateAction("test")}
                                disabled={working}
                                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] active:scale-[0.96]"
                              >
                                <TestTube2 className="size-3.5" /> Test
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPublish(true)}
                                disabled={working}
                                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white transition-[opacity,transform] active:scale-[0.96]"
                              >
                                <Check className="size-3.5" /> Publish
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <PreviewPanel
                        detail={detail}
                        width={previewWidth}
                        onWidth={setPreviewWidth}
                      />
                    </div>
                  )}
                </motion.div>
              ) : tab === "history" && selectedHistory ? (
                <div>
                  <header className="flex items-start gap-3 border-b border-[var(--admin-border)] px-4 py-4 sm:px-6">
                    <button
                      type="button"
                      onClick={() => setSelectedHistory(null)}
                      className="admin-icon-button lg:hidden"
                      aria-label="Back to sent history"
                    >
                      <ArrowLeft className="size-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-[var(--admin-ink)]">
                          {selectedHistory.subject || "(No subject)"}
                        </h2>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                          {selectedHistory.status}
                        </span>
                      </div>
                      <p className="admin-copy mt-1 text-xs">To {selectedHistory.to}</p>
                    </div>
                  </header>
                  <div className="p-4 sm:p-6">
                    <div className="mx-auto max-w-3xl rounded-2xl bg-[var(--admin-surface-subtle)] p-2">
                      <div className="rounded-xl bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow-border)]">
                        <div className="flex flex-wrap justify-between gap-3 border-b border-[var(--admin-border)] pb-4 text-xs text-[var(--admin-muted)]">
                          <span>{selectedHistory.template || "Direct message"}</span>
                          <span className="tabular-nums">
                            {new Date(selectedHistory.sentAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-5 whitespace-pre-wrap text-pretty text-sm leading-7 text-[var(--admin-ink)]">
                          {selectedHistory.body || "Message body was not recorded."}
                        </p>
                        {selectedHistory.providerId && (
                          <p className="mt-6 font-mono text-[9px] text-[var(--admin-muted)]">
                            Provider receipt {selectedHistory.providerId}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[650px] place-items-center text-center">
                  <div>
                    <Mail className="mx-auto size-6 text-[var(--admin-muted)]" />
                    <h2 className="mt-4 text-lg font-semibold text-[var(--admin-ink)]">
                      Choose an email
                    </h2>
                    <p className="admin-copy mt-1 text-sm">
                      View the exact copy, delivery, and available actions.
                    </p>
                  </div>
                </div>
              )}
            </main>
          </div>
        </AdminSurface>
      </AdminReadBody>

      <AdminDialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        title="Publish this email draft?"
        labelledBy="publish-email-title"
        maxWidth="sm"
      >
        <AdminSurface padding="lg" className="admin-dialog-surface">
          <p className="admin-eyebrow">External behavior change</p>
          <h2 id="publish-email-title" className="admin-dialog-title">
            Publish this email draft?
          </h2>
          <p className="admin-copy mt-2 text-pretty text-sm">
            New sends will use this exact subject and body. Previously sent email will not change.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmPublish(false)}
              className="min-h-10 rounded-lg px-3 text-xs font-semibold text-[var(--admin-muted)] active:scale-[0.96]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void templateAction("publish")}
              disabled={working}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] active:scale-[0.96] disabled:opacity-50"
            >
              {working ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}{" "}
              Publish live
            </button>
          </div>
        </AdminSurface>
      </AdminDialog>
    </div>
  );
}

function PreviewPanel({
  detail,
  width,
  onWidth,
}: {
  detail: EmailDetail;
  width: "desktop" | "mobile";
  onWidth: (width: "desktop" | "mobile") => void;
}) {
  return (
    <section className="min-w-0 bg-black/[0.018] p-3 dark:bg-white/[0.018] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="admin-eyebrow mb-0">Rendered preview</p>
        <div className="inline-flex rounded-lg bg-[var(--admin-surface)] p-1 shadow-[var(--admin-shadow-border)]">
          <button
            type="button"
            onClick={() => onWidth("desktop")}
            className={cn(
              "grid size-9 place-items-center rounded-md transition-[background-color,color,transform] active:scale-[0.96]",
              width === "desktop"
                ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                : "text-[var(--admin-muted)]",
            )}
            aria-label="Desktop preview"
          >
            <Monitor className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onWidth("mobile")}
            className={cn(
              "grid size-9 place-items-center rounded-md transition-[background-color,color,transform] active:scale-[0.96]",
              width === "mobile"
                ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                : "text-[var(--admin-muted)]",
            )}
            aria-label="Mobile preview"
          >
            <Smartphone className="size-3.5" />
          </button>
        </div>
      </div>
      <div
        className={cn(
          "mx-auto overflow-hidden rounded-2xl bg-[#0a0a0a] p-1 shadow-[0_22px_60px_-30px_rgba(0,0,0,0.45)] transition-[max-width] duration-300",
          width === "mobile" ? "max-w-[390px]" : "max-w-[760px]",
        )}
      >
        <iframe
          srcDoc={detail.html}
          sandbox=""
          className="h-[560px] w-full rounded-[12px] border-0 bg-[#0a0a0a] outline outline-1 -outline-offset-1 outline-white/10"
          title={`Email preview: ${detail.name}`}
        />
      </div>
    </section>
  );
}
