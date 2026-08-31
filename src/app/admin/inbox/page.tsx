"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "@/components/admin/AdminLink";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  AtSign,
  Check,
  CheckSquare,
  Clock3,
  Copy,
  FileCheck,
  Handshake,
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import { adminListItemVariants, adminListVariants, adminSectionVariants } from "@/lib/admin/motion";
import type { AdminInboxKind, AdminInboxResponse, AdminInboxItem } from "@/lib/admin/inbox";

const filters: { key: AdminInboxKind | "all"; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All", icon: Inbox },
  { key: "lead", label: "Leads", icon: Users },
  { key: "contact", label: "Contacts", icon: AtSign },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "task", label: "Tasks", icon: CheckSquare },
  { key: "proposal", label: "Proposals", icon: FileCheck },
  { key: "partner", label: "Partners", icon: Handshake },
];

const kindMeta: Record<AdminInboxKind, { label: string; icon: LucideIcon }> = {
  lead: { label: "Lead", icon: Users },
  contact: { label: "Contact", icon: AtSign },
  chat: { label: "Chat handoff", icon: MessageCircle },
  task: { label: "Task", icon: CheckSquare },
  proposal: { label: "Proposal", icon: FileCheck },
  partner: { label: "Partner", icon: Handshake },
};

function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminInboxPage() {
  const queryClient = useQueryClient();
  const inboxQuery = useAdminQuery<AdminInboxResponse>(["admin", "inbox"], "/api/admin/inbox");
  const data = inboxQuery.data ?? null;
  const setData = (updater: (current: AdminInboxResponse | null) => AdminInboxResponse | null) => {
    queryClient.setQueryData(["admin", "inbox"], (current: AdminInboxResponse | undefined) => updater(current ?? null) ?? undefined);
  };
  const [kind, setKind] = useState<AdminInboxKind | "all">("all");
  const [query, setQuery] = useState("");
  const loading = inboxQuery.isPending;
  const refreshing = inboxQuery.isFetching && Boolean(data);
  const error = inboxQuery.error?.message || "";

  const load = useCallback(async (background = false) => {
    const result = await inboxQuery.refetch();
    if (result.error && background) toast.error(result.error.message || "Couldn't load the operator inbox");
  }, [inboxQuery]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load(true);
    const onVisibility = () => { if (document.visibilityState === "visible") load(true); };
    window.addEventListener("admin:refresh-inbox", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("admin:refresh-inbox", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const visibleItems = useMemo(() => (data?.items || []).filter((item) => {
    if (kind !== "all" && item.kind !== kind) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return `${item.title} ${item.summary} ${item.meta || ""} ${item.person?.name || ""} ${item.person?.email || ""}`.toLowerCase().includes(needle);
  }), [data, kind, query]);

  const completeTask = async (item: AdminInboxItem) => {
    try {
      await fetchJson("/api/admin/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: "completed" }) });
      setData((current) => current ? { ...current, items: current.items.filter((candidate) => candidate.id !== item.id || candidate.kind !== "task"), counts: { ...current.counts, all: Math.max(0, current.counts.all - 1), task: Math.max(0, current.counts.task - 1) } } : current);
      toast.success("Task completed");
    } catch (taskError) {
      toast.error(taskError instanceof Error ? taskError.message : "Couldn't complete task");
    }
  };

  const markContactRead = async (item: AdminInboxItem) => {
    try {
      await fetchJson("/api/admin/contacts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, read: true }) });
      setData((current) => current ? { ...current, items: current.items.filter((candidate) => candidate.id !== item.id || candidate.kind !== "contact"), counts: { ...current.counts, all: Math.max(0, current.counts.all - 1), contact: Math.max(0, current.counts.contact - 1) } } : current);
      toast.success("Contact cleared from the queue");
    } catch (contactError) {
      toast.error(contactError instanceof Error ? contactError.message : "Couldn't update contact");
    }
  };

  return (
    <motion.div variants={adminListVariants} initial={false} animate="visible">
      <motion.div variants={adminSectionVariants}>
        <PageHeader title="Operator Inbox" subtitle="Every lead, message, follow-up, and stalled deal that needs a human decision." actions={<Button size="sm" variant="secondary" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />{refreshing ? "Refreshing…" : "Refresh"}</Button>} />
      </motion.div>
      <AdminReadBody loading={loading} hasData={Boolean(data)} error={error} onRetry={() => void load()} refreshing={refreshing} loadingFallback={<LoadingSkeleton variant="page" />} label="Loading operator inbox">

      <motion.div variants={adminSectionVariants} className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the queue…" className="admin-field min-h-11 pl-10" type="search" />
        </label>
        <div className="flex items-center gap-2 text-xs text-[var(--admin-muted)] sm:justify-end">
          <Clock3 className="h-3.5 w-3.5" />
          {data?.updatedAt ? `Updated ${timeAgo(data.updatedAt)}` : "Not yet updated"}
        </div>
      </motion.div>

      <motion.div variants={adminSectionVariants} className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => {
          const Icon = filter.icon;
          const active = kind === filter.key;
          return <button key={filter.key} type="button" onClick={() => setKind(filter.key)} className={cn("flex min-h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-xs font-medium transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.96]", active ? "bg-[#0b0b0b] text-white shadow-sm" : "bg-[var(--admin-surface)] text-[var(--admin-muted)] shadow-[var(--admin-shadow)] hover:text-[var(--admin-ink)]")}><Icon className="h-3.5 w-3.5" />{filter.label}<span className={cn("admin-number rounded px-1.5 py-0.5 text-[10px]", active ? "bg-white/12" : "bg-black/5 dark:bg-white/8")}>{data?.counts[filter.key] || 0}</span></button>;
        })}
      </motion.div>

      {error && !data ? (
        <AdminSurface className="py-12 text-center"><AlertCircle className="mx-auto mb-3 h-5 w-5 text-[var(--error)]" /><h2 className="mb-1 text-sm font-semibold">The queue could not be loaded</h2><p className="admin-copy mx-auto mb-4 max-w-md text-sm">{error}</p><Button size="sm" onClick={() => load()}>Try again</Button></AdminSurface>
      ) : visibleItems.length === 0 ? (
        <AdminSurface className="py-14 text-center"><Check className="mx-auto mb-3 h-6 w-6 text-[var(--success)]" /><h2 className="mb-1 text-base font-semibold">Queue clear</h2><p className="admin-copy text-sm">Nothing in this view needs attention right now.</p></AdminSurface>
      ) : (
        <AdminSurface padding="none" className="overflow-hidden">
          <motion.div variants={adminListVariants}>
            {visibleItems.map((item) => {
              const meta = kindMeta[item.kind];
              const Icon = meta.icon;
              return (
                <motion.article key={`${item.kind}-${item.id}`} variants={adminListItemVariants} className="group grid gap-3 border-b border-black/[0.07] p-4 last:border-b-0 dark:border-white/[0.07] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-[11px]", item.priority === "urgent" ? "bg-red-500/10 text-red-600 dark:text-red-400" : item.priority === "important" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-black/5 text-[var(--admin-muted)] dark:bg-white/8")}><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">{meta.label}</span>{item.priority !== "normal" && <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]", item.priority === "urgent" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>{item.priority}</span>}<span className="text-[10px] text-[var(--admin-muted)]">{timeAgo(item.createdAt)}</span></div>
                    <h2 className="truncate text-sm font-semibold text-[var(--admin-ink)]">{item.title}</h2>
                    <p className="admin-copy mt-0.5 line-clamp-2 text-xs">{item.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--admin-muted)]"><span>{item.meta}</span>{item.person?.email && <span className="truncate">{item.person.email}</span>}</div>
                  </div>
                  <div className="flex items-center gap-1 sm:justify-end">
                    {item.person?.email && <a href={`mailto:${item.person.email}`} className="admin-icon-button" aria-label={`Email ${item.person.name || item.person.email}`} title="Email"><Mail className="h-4 w-4" /></a>}
                    {item.person?.phone && <a href={`tel:${item.person.phone}`} className="admin-icon-button" aria-label={`Call ${item.person.name || item.person.phone}`} title="Call"><Phone className="h-4 w-4" /></a>}
                    {item.person?.email && <button type="button" onClick={async () => { await navigator.clipboard.writeText(item.person?.email || ""); toast.success("Email copied"); }} className="admin-icon-button" aria-label="Copy email" title="Copy email"><Copy className="h-4 w-4" /></button>}
                    {item.kind === "task" && <button type="button" onClick={() => completeTask(item)} className="admin-icon-button text-[var(--success)]" aria-label="Complete task" title="Complete"><Check className="h-4 w-4" /></button>}
                    {item.kind === "contact" && <button type="button" onClick={() => markContactRead(item)} className="admin-icon-button" aria-label="Clear contact from queue" title="Mark reviewed"><Check className="h-4 w-4" /></button>}
                    <Link href={item.href} className="ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-[#0b0b0b] px-3 text-xs font-medium text-white transition-[background-color,transform] duration-150 hover:bg-[#252525] active:scale-[0.96]">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </AdminSurface>
      )}
      </AdminReadBody>
    </motion.div>
  );
}
