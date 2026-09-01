"use client";

import { tenant } from "@/config/tenant";
import { useEffect, useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Search,
  RefreshCw,
  Mail,
  Copy,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/admin/Pagination";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { EmptyState } from "@/components/admin/EmptyState";
import { toast } from "@/lib/admin/useToast";

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: number;
}

interface ChatLead {
  id: string;
  name: string;
  email: string;
  conversation: ChatMessage[];
  created_at: string;
  utm_source?: string | null;
  utm_campaign?: string | null;
}

function relativeTime(dateString: string) {
  const elapsed = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(dateString).toLocaleDateString();
}

function transcriptFor(lead: ChatLead) {
  return (lead.conversation || [])
    .map(
      (message) => `${message.role === "user" ? lead.name : tenant.brand.name}: ${message.content}`,
    )
    .join("\n\n");
}

export default function ChatLeadsPage() {
  const [leads, setLeads] = useState<ChatLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!loading) setRefreshing(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (debouncedQuery) params.set("q", debouncedQuery);
        const res = await fetch(`/api/admin/chat-leads?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load chat leads");
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setTotalPages(Math.max(1, data.totalPages || 1));
        setExpandedId(null);
        setLastUpdated(Date.now());
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load chat leads");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [page, debouncedQuery, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyTranscript = async (lead: ChatLead) => {
    try {
      await navigator.clipboard.writeText(transcriptFor(lead));
      toast.success("Conversation copied");
    } catch {
      toast.error("Couldn't copy the conversation");
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Chat Leads" subtitle="Conversations that asked for a human follow-up" />
        <LoadingSkeleton variant="table" />
      </div>
    );
  }

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-w-0 max-w-full overflow-x-hidden"
    >
      <PageHeader
        title="Chat Leads"
        subtitle={`${total} conversation${total === 1 ? "" : "s"}${debouncedQuery ? ` matching “${debouncedQuery}”` : ""}`}
        actions={
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-glass bg-bg-subtle px-3 text-xs font-medium text-white-secondary transition-[border-color,color,background-color,transform,opacity] hover:border-white/20 hover:text-white-primary active:scale-[0.96] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white-muted" />
          <Input
            type="search"
            placeholder="Search every chat lead by name or email…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
            aria-label="Search chat leads"
          />
        </div>
        {lastUpdated && (
          <p className="text-xs text-white-muted" aria-live="polite">
            Updated {relativeTime(new Date(lastUpdated).toISOString())}
          </p>
        )}
      </div>

      <GlassCard padding="none" hover="none" className="w-full min-w-0 max-w-full overflow-hidden">
        {error ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="mb-3 h-6 w-6 text-red-300" />
            <p className="text-sm font-medium text-white-primary">Chat leads couldn’t load</p>
            <p className="mt-1 max-w-sm text-xs text-white-muted">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-glass px-3 text-xs text-white-secondary transition-[border-color,color,transform] hover:border-white/20 hover:text-white-primary active:scale-[0.96]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        ) : (
          <div className="w-[calc(100vw-2rem)] max-w-full overflow-x-auto overscroll-x-contain sm:w-full">
            <table className="w-full table-fixed text-sm md:min-w-[720px] md:table-auto">
              <thead>
                <tr className="border-b border-border-glass">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white-muted">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white-muted">
                    Conversation
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-white-muted md:table-cell">
                    Source
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-white-muted md:table-cell">
                    Received
                  </th>
                  <th className="w-12 px-4 py-3">
                    <span className="sr-only">Expand</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, index) => {
                  const expanded = expandedId === lead.id;
                  const panelId = `conversation-${lead.id}`;
                  return (
                    <Fragment key={lead.id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(index, 8) * 0.03 }}
                        className="border-b border-border-glass transition-colors hover:bg-white/[0.025]"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : lead.id)}
                            aria-expanded={expanded}
                            aria-controls={panelId}
                            className="text-left"
                          >
                            <span className="block font-medium text-white-primary">
                              {lead.name}
                            </span>
                            <span className="mt-0.5 block break-all text-xs text-white-muted">
                              {lead.email}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-white-secondary">
                          {lead.conversation?.length || 0} messages
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-white-muted md:table-cell">
                          {lead.utm_source || "Direct"}
                          {lead.utm_campaign && (
                            <span className="block text-[10px] opacity-70">
                              {lead.utm_campaign}
                            </span>
                          )}
                        </td>
                        <td
                          className="hidden px-4 py-3 text-xs text-white-muted md:table-cell"
                          title={new Date(lead.created_at).toLocaleString()}
                        >
                          {relativeTime(lead.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : lead.id)}
                            aria-expanded={expanded}
                            aria-controls={panelId}
                            aria-label={`${expanded ? "Collapse" : "Open"} conversation with ${lead.name}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white-muted transition-[color,background-color,transform] hover:bg-white/5 hover:text-white-primary active:scale-[0.96]"
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </motion.tr>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.tr
                            id={panelId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <td colSpan={5} className="bg-bg-elevated px-4 py-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-white-muted">
                                  Conversation
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void copyTranscript(lead)}
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-glass px-3 text-xs text-white-secondary transition-[border-color,color,transform] hover:border-white/20 hover:text-white-primary active:scale-[0.96]"
                                  >
                                    <Copy className="h-3.5 w-3.5" /> Copy
                                  </button>
                                  <a
                                    href={`mailto:${lead.email}`}
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-glass px-3 text-xs text-white-secondary transition-[border-color,color,transform] hover:border-white/20 hover:text-white-primary active:scale-[0.96]"
                                  >
                                    <Mail className="h-3.5 w-3.5" /> Reply
                                  </a>
                                  <Link
                                    href={`/admin/contacts/${encodeURIComponent(lead.email)}`}
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-gold-gradient px-3 text-xs font-semibold text-black transition-[filter,transform] hover:brightness-110 active:scale-[0.96]"
                                  >
                                    Open contact <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>
                                </div>
                              </div>
                              <GlassCard padding="sm" hover="none">
                                <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                                  {(lead.conversation || []).map((message, messageIndex) => (
                                    <div
                                      key={`${lead.id}-${messageIndex}`}
                                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                      <div
                                        className={`max-w-[84%] rounded-xl px-3 py-2.5 text-sm leading-relaxed ${message.role === "user" ? "bg-white/10 text-white-primary" : "border border-border-glass bg-bg-subtle text-white-secondary"}`}
                                      >
                                        <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-white-muted">
                                          {message.role === "user" ? lead.name : tenant.brand.name}
                                        </p>
                                        <p className="whitespace-pre-wrap break-words">
                                          {message.content}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                  {(!lead.conversation || lead.conversation.length === 0) && (
                                    <p className="py-6 text-center text-sm text-white-muted">
                                      No conversation recorded
                                    </p>
                                  )}
                                </div>
                              </GlassCard>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {leads.length === 0 && (
              <EmptyState
                message={debouncedQuery ? "No chat leads match that search" : "No chat leads yet"}
                icon={MessageCircle}
              />
            )}
          </div>
        )}
      </GlassCard>

      {!error && (
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      )}
    </motion.div>
  );
}
