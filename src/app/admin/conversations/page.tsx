"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  Inbox,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";
import type {
  ConversationItem,
  ConversationMessage,
  ConversationDetail,
  InboxStats,
  ConversationStatus,
  ConversationChannel,
} from "@/lib/revenue-os/conversations";

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  gmail: Mail,
  resend: Mail,
  form: Layers,
  chat: MessageSquare,
  manual: User,
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  contacted: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  qualified: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  meeting: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  proposal: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  won: "bg-green-600/15 text-green-700 dark:text-green-300 border-green-600/30",
  lost: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
  nurture: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
};

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("thread")?.trim() || null,
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("open");
  const [channelFilter, setChannelFilter] = useState<ConversationChannel | "all">("all");
  const [recordFilter, setRecordFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");

  // Action / Composer states
  const [reply, setReply] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");

  // Modal states
  const [showCreateOppModal, setShowCreateOppModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [oppName, setOppName] = useState("");
  const [oppValue, setOppValue] = useState("0");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Query builder
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedId) params.set("id", selectedId);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (channelFilter !== "all") params.set("channel", channelFilter);
    if (recordFilter !== "all") params.set("record", recordFilter);
    if (unreadOnly) params.set("unread", "1");
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [selectedId, statusFilter, channelFilter, recordFilter, unreadOnly, search]);

  const conversationQuery = useAdminQuery<{
    schemaReady: boolean;
    conversations: ConversationItem[];
    stats: InboxStats;
    detail: ConversationDetail | null;
    messages: ConversationMessage[];
  }>(["admin", "conversations", queryString], `/api/admin/revenue-os/conversations?${queryString}`);

  const conversations = useMemo(
    () => conversationQuery.data?.conversations ?? [],
    [conversationQuery.data?.conversations],
  );
  const stats = conversationQuery.data?.stats ?? {
    total: 0,
    open: 0,
    unread: 0,
    waiting: 0,
    resolved: 0,
    archived: 0,
  };
  const detail = conversationQuery.data?.detail ?? null;
  const messages = useMemo(
    () => detail?.messages ?? conversationQuery.data?.messages ?? [],
    [detail?.messages, conversationQuery.data?.messages],
  );
  const schemaReady = conversationQuery.data?.schemaReady ?? true;
  const loading = conversationQuery.isPending;
  const readError = conversationQuery.error?.message || "";
  const refetchConversations = conversationQuery.refetch;

  const load = useCallback(async () => {
    setActionError("");
    const result = await refetchConversations();
    if (result.error) setActionError(result.error.message || "Could not load conversations.");
  }, [refetchConversations]);

  useEffect(() => {
    if (!selectedId && conversations[0]) setSelectedId(conversations[0].id);
  }, [conversations, selectedId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return detail?.conversation || conversations.find((item) => item.id === selectedId) || null;
  }, [selectedId, detail?.conversation, conversations]);

  const sync = async () => {
    setSyncing(true);
    setActionError("");
    try {
      await fetchJson("/api/admin/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "gmail" }),
      });
      toast.success("Gmail sync triggered.");
      await load();
    } catch (syncError) {
      const msg = syncError instanceof Error ? syncError.message : "Gmail sync failed.";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const updateStatus = async (newStatus: ConversationStatus) => {
    if (!selectedId) return;
    try {
      await fetchJson("/api/admin/revenue-os/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, status: newStatus }),
      });
      toast.success(`Conversation marked as ${newStatus}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed.");
    }
  };

  const handleCreateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !oppName.trim()) return;
    setIsSubmittingModal(true);
    try {
      await fetchJson("/api/admin/revenue-os/conversations/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "create_opportunity",
          conversationId: selectedId,
          opportunityName: oppName.trim(),
          estimatedValue: Number(oppValue) || 0,
        }),
      });
      toast.success("Opportunity created and linked.");
      setShowCreateOppModal(false);
      setOppName("");
      setOppValue("0");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create opportunity.");
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !taskTitle.trim()) return;
    setIsSubmittingModal(true);
    try {
      await fetchJson("/api/admin/revenue-os/conversations/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "create_task",
          conversationId: selectedId,
          taskTitle: taskTitle.trim(),
          taskDueDate: taskDueDate || undefined,
        }),
      });
      toast.success("Follow-up task created.");
      setShowCreateTaskModal(false);
      setTaskTitle("");
      setTaskDueDate("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setActionError("");
    try {
      await fetchJson("/api/admin/revenue-os/conversations/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, body: reply, confirmed: true }),
      });
      toast.success("Reply recorded and dispatched.");
      setReply("");
      setReviewing(false);
      await load();
    } catch (sendError) {
      const msg = sendError instanceof Error ? sendError.message : "Reply failed.";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const applySuggestedReply = (body: string) => {
    setReply(body);
    toast.info("Suggested draft inserted into composer.");
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Conversations"
        subtitle="Omnichannel inbox unifying Gmail, inbound forms, chat leads, and voice transcripts into one reply-ready cockpit."
        utilityActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing}
              aria-label={syncing ? "Syncing Gmail" : "Sync Gmail"}
              className="admin-icon-button shadow-[var(--admin-shadow-border)] disabled:opacity-50"
              title="Sync Gmail Workspace"
            >
              <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
            </button>
          </div>
        }
      />

      <AdminReadBody
        loading={loading}
        hasData={Boolean(conversationQuery.data)}
        error={readError}
        onRetry={() => void load()}
        refreshing={conversationQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="detail" />}
        label="Loading conversations"
      >
        {actionError && (
          <AdminSurface tone="attention" className="flex items-center gap-3">
            <TriangleAlert className="size-5 shrink-0 text-rose-600" />
            <p className="text-sm text-[var(--admin-ink)]">{actionError}</p>
          </AdminSurface>
        )}

        {!schemaReady ? (
          <RevenueSetupGate />
        ) : (
          <AdminSurface padding="none" className="min-h-[700px] overflow-hidden">
            {/* Filter Toolbar */}
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] p-3 sm:px-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Status Tabs */}
                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { key: "open", label: "Open", count: stats.open },
                      { key: "waiting", label: "Waiting", count: stats.waiting },
                      { key: "resolved", label: "Resolved", count: stats.resolved },
                      { key: "archived", label: "Archived", count: stats.archived },
                      { key: "all", label: "All", count: stats.total },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-[background-color,color] duration-150",
                        statusFilter === tab.key
                          ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                          : "text-[var(--admin-muted)] hover:bg-black/[0.04] hover:text-[var(--admin-ink)] dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums",
                          statusFilter === tab.key
                            ? "bg-white/20 text-[var(--admin-surface)]"
                            : "bg-black/[0.06] text-[var(--admin-muted)] dark:bg-white/[0.08]",
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Secondary Filters */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* Unread Toggle */}
                  <button
                    type="button"
                    onClick={() => setUnreadOnly(!unreadOnly)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium transition-[background-color,color] duration-150",
                      unreadOnly
                        ? "border-[var(--admin-ink)] bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]"
                        : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-muted)] hover:text-[var(--admin-ink)]",
                    )}
                  >
                    <span className="size-2 rounded-full bg-[var(--admin-ink)]" />
                    Unread ({stats.unread})
                  </button>

                  {/* Channel Dropdown */}
                  <select
                    value={channelFilter}
                    onChange={(e) =>
                      setChannelFilter(e.target.value as ConversationChannel | "all")
                    }
                    className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--admin-ink)] outline-none"
                  >
                    <option value="all">All Channels</option>
                    <option value="gmail">Gmail</option>
                    <option value="form">Inbound Form</option>
                    <option value="chat">Website Chat</option>
                    <option value="resend">Resend / Email</option>
                    <option value="manual">Manual Notes</option>
                  </select>

                  {/* Record Link Dropdown */}
                  <select
                    value={recordFilter}
                    onChange={(e) =>
                      setRecordFilter(e.target.value as "all" | "linked" | "unlinked")
                    }
                    className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--admin-ink)] outline-none"
                  >
                    <option value="all">All Records</option>
                    <option value="linked">Linked to Opportunity</option>
                    <option value="unlinked">Unlinked</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Main Layout Grid */}
            <div className="grid min-h-[650px] lg:grid-cols-[340px_1fr]">
              {/* Thread List Sidebar */}
              <aside
                className={cn(
                  "border-r border-[var(--admin-border)] bg-[var(--admin-surface)]",
                  selectedId && "hidden lg:block",
                )}
              >
                <div className="flex min-h-[68px] items-center border-b border-[var(--admin-border)] p-3">
                  <div className="relative w-full">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-muted)]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search inbox..."
                      className="min-h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-9 pr-3 text-xs text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)] focus:ring-1 focus:ring-[var(--admin-ink)]"
                    />
                  </div>
                </div>

                <div className="max-h-[600px] divide-y divide-[var(--admin-border)] overflow-y-auto">
                  {conversations.map((conv) => {
                    const ChannelIcon = CHANNEL_ICONS[conv.channel] || MessageSquare;
                    const contactName =
                      conv.contact?.full_name ||
                      (conv.metadata?.contact_email as string) ||
                      "Inquiry";
                    const isUnread = conv.unread_count > 0;

                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => setSelectedId(conv.id)}
                        className={cn(
                          "relative flex w-full flex-col gap-1.5 p-3.5 text-left transition-[background-color] duration-150 hover:bg-black/[0.022] dark:hover:bg-white/[0.025]",
                          selectedId === conv.id &&
                            "bg-black/[0.035] dark:bg-white/[0.04] border-l-2 border-l-[var(--admin-ink)]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ChannelIcon className="size-3.5 shrink-0 text-[var(--admin-muted)]" />
                            <span
                              className={cn(
                                "truncate text-xs text-[var(--admin-ink)]",
                                isUnread ? "font-bold" : "font-semibold",
                              )}
                            >
                              {contactName}
                            </span>
                          </div>
                          {isUnread && (
                            <span className="grid size-2 place-items-center rounded-full bg-[var(--admin-ink)]" />
                          )}
                        </div>

                        <p
                          className={cn(
                            "line-clamp-1 text-xs text-[var(--admin-ink)]",
                            isUnread
                              ? "font-medium text-[var(--admin-ink)]"
                              : "text-[var(--admin-muted)]",
                          )}
                        >
                          {conv.subject || "(No subject)"}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                          <div className="flex items-center gap-1">
                            {conv.opportunity && (
                              <span
                                className={cn(
                                  "rounded px-1 py-0.5 border font-medium text-[9px]",
                                  STAGE_COLORS[conv.opportunity.stage] ||
                                    "bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)] border-[var(--admin-border)]",
                                )}
                              >
                                {conv.opportunity.stage}
                              </span>
                            )}
                            {conv.intent && (
                              <span className="rounded bg-black/[0.04] px-1 py-0.5 text-[9px] text-[var(--admin-muted)] dark:bg-white/[0.05]">
                                {conv.intent}
                              </span>
                            )}
                          </div>
                          <span className="tabular-nums text-[var(--admin-muted)]">
                            {conv.last_message_at
                              ? new Date(conv.last_message_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Recent"}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {!conversations.length && (
                    <div className="px-5 py-16 text-center">
                      <Inbox className="mx-auto size-5 text-[var(--admin-muted)]" />
                      <p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">
                        No conversations found
                      </p>
                      <p className="admin-copy mt-1 text-xs">
                        Try changing your search or status filter.
                      </p>
                    </div>
                  )}
                </div>
              </aside>

              {/* Thread Content & Opportunity Cockpit */}
              <main className={cn("flex min-w-0 flex-col", !selectedId && "hidden lg:flex")}>
                {selected ? (
                  <div className="flex flex-1 flex-col xl:grid xl:grid-cols-[1fr_300px]">
                    {/* Main Conversation Column */}
                    <div className="flex min-w-0 flex-1 flex-col border-b xl:border-b-0 xl:border-r border-[var(--admin-border)]">
                      {/* Thread Header */}
                      <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedId(null)}
                            aria-label="Back to conversations"
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] hover:bg-black/[0.04] hover:text-[var(--admin-ink)] lg:hidden"
                          >
                            <ArrowLeft className="size-4" />
                          </button>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="truncate text-base font-semibold tracking-[-0.01em] text-[var(--admin-ink)]">
                                {selected.subject || "(No subject)"}
                              </h2>
                              <span className="rounded-full bg-black/[0.045] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)] dark:bg-white/[0.06]">
                                {selected.channel}
                              </span>
                            </div>
                            <p className="admin-copy mt-0.5 text-xs">
                              {selected.contact?.full_name ||
                                (selected.metadata?.contact_email as string) ||
                                "Visitor"}{" "}
                              ·{" "}
                              {selected.contact?.primary_email ||
                                (selected.metadata?.contact_email as string) ||
                                "No email"}
                            </p>
                          </div>
                        </div>

                        {/* Status Actions */}
                        <div className="flex items-center gap-1.5">
                          {selected.status !== "resolved" && (
                            <button
                              type="button"
                              onClick={() => void updateStatus("resolved")}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--admin-border)] px-2.5 text-xs font-semibold text-[var(--admin-ink)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                            >
                              <CheckCircle2 className="size-3.5 text-[var(--admin-success)]" />
                              Resolve
                            </button>
                          )}
                          {selected.status === "resolved" && (
                            <button
                              type="button"
                              onClick={() => void updateStatus("open")}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--admin-border)] px-2.5 text-xs font-semibold text-[var(--admin-ink)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                            >
                              Reopen
                            </button>
                          )}
                          {selected.status !== "archived" && (
                            <button
                              type="button"
                              onClick={() => void updateStatus("archived")}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[var(--admin-border)] px-2.5 text-xs font-semibold text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-danger)]"
                              title="Archive conversation"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </header>

                      {/* Messages Timeline */}
                      <div className="flex-1 space-y-4 overflow-y-auto bg-black/[0.012] p-4 dark:bg-white/[0.012] sm:p-6 max-h-[calc(100vh-360px)] min-h-[320px]">
                        {messages.map((message) => (
                          <article
                            key={message.id}
                            className={cn(
                              "max-w-[85%] rounded-2xl px-4 py-3 shadow-[var(--admin-shadow-border)]",
                              message.direction === "outbound"
                                ? "ml-auto rounded-br-md bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                                : "rounded-bl-md bg-[var(--admin-surface)] text-[var(--admin-ink)]",
                            )}
                          >
                            <div
                              className={cn(
                                "flex flex-wrap items-center justify-between gap-2 text-[10px]",
                                message.direction === "outbound"
                                  ? "text-[var(--admin-surface)]/60"
                                  : "text-[var(--admin-muted)]",
                              )}
                            >
                              <span className="font-medium">
                                {message.direction === "outbound"
                                  ? "Operator"
                                  : message.sender_email || "Customer"}
                              </span>
                              <span className="tabular-nums">
                                {new Date(
                                  message.sent_at || message.received_at || message.created_at,
                                ).toLocaleString()}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-6">
                              {message.body_text || "(Empty message)"}
                            </p>
                          </article>
                        ))}
                        {!messages.length && (
                          <p className="py-16 text-center text-xs text-[var(--admin-muted)]">
                            No messages recorded yet for this thread.
                          </p>
                        )}
                      </div>

                      {/* Suggested AI Draft Banner */}
                      {detail?.suggestedReply && (
                        <div className="border-t border-[var(--admin-border)] bg-[var(--admin-accent-soft)] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-ink)]">
                              <Sparkles className="size-3.5" />
                              <span>
                                AI Suggested Response (
                                {Math.round(detail.suggestedReply.confidence * 100)}% match)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => applySuggestedReply(detail.suggestedReply!.body)}
                              className="inline-flex items-center gap-1 rounded bg-[var(--admin-ink)] px-2 py-1 text-[11px] font-semibold text-[var(--admin-surface)] hover:opacity-85"
                            >
                              Insert Draft
                            </button>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--admin-ink)]/80">
                            {detail.suggestedReply.body}
                          </p>
                        </div>
                      )}

                      {/* Composer Footer */}
                      <footer className="border-t border-[var(--admin-border)] p-4 sm:p-5">
                        {reviewing ? (
                          <div className="rounded-2xl bg-[var(--admin-warning-soft)] p-2">
                            <div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]">
                              <p className="admin-eyebrow">Final review & confirmation</p>
                              <h3 className="mt-1 text-sm font-semibold text-[var(--admin-ink)]">
                                Confirm dispatch for this message?
                              </h3>
                              <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-pretty rounded-xl bg-black/[0.025] p-3 text-sm leading-6 text-[var(--admin-ink)] dark:bg-white/[0.025]">
                                {reply}
                              </p>
                              <div className="mt-4 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setReviewing(false)}
                                  className="min-h-9 rounded-lg px-3 text-xs font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void sendReply()}
                                  disabled={sending}
                                  className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] disabled:opacity-50"
                                >
                                  {sending ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Send className="size-3.5" />
                                  )}
                                  Confirm send
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-composer">
                            <textarea
                              value={reply}
                              onChange={(event) => setReply(event.target.value)}
                              rows={3}
                              placeholder="Write a reply or notes. Nothing sends without confirmation."
                              className="admin-composer-field text-xs"
                            />
                            <div className="flex items-center justify-between border-t border-[var(--admin-border)] pt-2">
                              <span className="text-[11px] text-[var(--admin-muted)]">
                                Replies create audited receipts on the activity ledger.
                              </span>
                              <button
                                type="button"
                                onClick={() => setReviewing(true)}
                                disabled={!reply.trim()}
                                className="admin-composer-action px-3.5 py-1.5 text-xs font-semibold"
                              >
                                Review & Send
                              </button>
                            </div>
                          </div>
                        )}
                      </footer>
                    </div>

                    {/* Opportunity Cockpit Sidebar */}
                    <aside className="bg-[var(--admin-surface-subtle)] p-4 space-y-4 text-xs">
                      <div>
                        <p className="admin-eyebrow mb-2">Linked Business Record</p>
                        {selected.opportunity ? (
                          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[var(--admin-ink)] truncate">
                                {selected.opportunity.name}
                              </span>
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 border font-medium text-[10px]",
                                  STAGE_COLORS[selected.opportunity.stage] ||
                                    "bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)] border-[var(--admin-border)]",
                                )}
                              >
                                {selected.opportunity.stage}
                              </span>
                            </div>
                            <p className="text-[var(--admin-muted)] tabular-nums">
                              Est. Value: $
                              {selected.opportunity.estimated_value?.toLocaleString() ?? 0}
                            </p>
                            <Link
                              href={`/admin/pipeline`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-ink)] hover:underline"
                            >
                              Open in Pipeline <ExternalLink className="size-3" />
                            </Link>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-[var(--admin-border)] p-3 text-center">
                            <p className="text-[var(--admin-muted)]">No opportunity linked</p>
                            <button
                              type="button"
                              onClick={() => {
                                setOppName(selected.subject || "New Opportunity");
                                setShowCreateOppModal(true);
                              }}
                              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[var(--admin-ink)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--admin-surface)]"
                            >
                              <Plus className="size-3" /> Create Opportunity
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Contact & Company Details */}
                      <div>
                        <p className="admin-eyebrow mb-2">Contact & Account</p>
                        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-medium text-[var(--admin-ink)]">
                            <User className="size-3.5 text-[var(--admin-muted)]" />
                            <span>{selected.contact?.full_name || "Unidentified Contact"}</span>
                          </div>
                          {selected.contact?.primary_email && (
                            <p className="text-[var(--admin-muted)] truncate">
                              {selected.contact.primary_email}
                            </p>
                          )}
                          {selected.contact?.phone && (
                            <p className="text-[var(--admin-muted)]">{selected.contact.phone}</p>
                          )}
                          {selected.company && (
                            <div className="pt-2 border-t border-[var(--admin-border)] flex items-center gap-1.5">
                              <Briefcase className="size-3.5 text-[var(--admin-muted)]" />
                              <span className="font-medium text-[var(--admin-ink)]">
                                {selected.company.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Open Follow-up Tasks */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="admin-eyebrow">Tasks & Follow-ups</p>
                          <button
                            type="button"
                            onClick={() => {
                              setTaskTitle(`Follow up on "${selected.subject || "conversation"}"`);
                              setShowCreateTaskModal(true);
                            }}
                            className="text-[11px] font-semibold text-[var(--admin-ink)] hover:underline inline-flex items-center gap-0.5"
                          >
                            <Plus className="size-3" /> Add Task
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(detail?.tasks || []).map((t) => (
                            <div
                              key={String(t.id || "")}
                              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2.5"
                            >
                              <p className="font-medium text-[var(--admin-ink)] truncate">
                                {String(t.title || "")}
                              </p>
                              {Boolean(t.due_date) && (
                                <p className="mt-1 text-[10px] text-[var(--admin-muted)] flex items-center gap-1">
                                  <Clock className="size-3" /> Due: {String(t.due_date)}
                                </p>
                              )}
                            </div>
                          ))}
                          {!detail?.tasks?.length && (
                            <p className="text-[11px] text-[var(--admin-muted)] italic">
                              No open tasks for this thread.
                            </p>
                          )}
                        </div>
                      </div>
                    </aside>
                  </div>
                ) : (
                  <div className="grid flex-1 place-items-center p-6 text-center">
                    <div>
                      <Inbox className="mx-auto size-6 text-[var(--admin-muted)]" />
                      <h2 className="mt-4 text-base font-semibold text-[var(--admin-ink)]">
                        Select a conversation
                      </h2>
                      <p className="admin-copy mt-1 text-xs">
                        Review customer messages, link opportunities, and send replies.
                      </p>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </AdminSurface>
        )}
      </AdminReadBody>

      {/* Modal: Create Opportunity */}
      {showCreateOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-ink)]">
                Create Opportunity from Conversation
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateOppModal(false)}
                className="text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleCreateOpportunity} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Opportunity Name
                </label>
                <input
                  type="text"
                  required
                  value={oppName}
                  onChange={(e) => setOppName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3 py-2 text-xs text-[var(--admin-ink)] outline-none"
                  placeholder="e.g. Acme Commercial Retainer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Estimated Value ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={oppValue}
                  onChange={(e) => setOppValue(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3 py-2 text-xs text-[var(--admin-ink)] outline-none"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateOppModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingModal || !oppName.trim()}
                  className="rounded-lg bg-[var(--admin-ink)] px-3.5 py-1.5 text-xs font-semibold text-[var(--admin-surface)] disabled:opacity-50"
                >
                  {isSubmittingModal ? "Creating..." : "Create & Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Task */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--admin-ink)]">
                Add Follow-up Task
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateTaskModal(false)}
                className="text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3 py-2 text-xs text-[var(--admin-ink)] outline-none"
                  placeholder="e.g. Send proposal follow-up"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3 py-2 text-xs text-[var(--admin-ink)] outline-none"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTaskModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--admin-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingModal || !taskTitle.trim()}
                  className="rounded-lg bg-[var(--admin-ink)] px-3.5 py-1.5 text-xs font-semibold text-[var(--admin-surface)] disabled:opacity-50"
                >
                  {isSubmittingModal ? "Adding..." : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
