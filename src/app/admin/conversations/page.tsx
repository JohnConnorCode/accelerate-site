"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Inbox, Loader2, Mail, RefreshCw, Reply, Search, Send, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminRouteSkeleton } from "@/components/admin/AdminRouteSkeleton";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";

interface Conversation { id: string; channel: string; external_id: string | null; subject: string | null; status: string; intent: string | null; unread_count: number; last_message_at: string | null; metadata?: { contact_email?: string } }
interface Message { id: string; direction: "inbound" | "outbound"; sender_email: string | null; recipient_emails: string[]; subject: string | null; body_text: string | null; status: string; sent_at: string | null; received_at: string | null; created_at: string }

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("thread")?.trim() || null);
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (id?: string | null) => {
    setError("");
    try {
      const result = await fetchJson<{ schemaReady: boolean; conversations: Conversation[]; messages: Message[] }>(`/api/admin/revenue-os/conversations${id ? `?id=${encodeURIComponent(id)}` : ""}`);
      setSchemaReady(result.schemaReady);
      setConversations(result.conversations);
      setMessages(result.messages);
      if (!selectedId && result.conversations[0]) setSelectedId(result.conversations[0].id);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load conversations."); }
    finally { setLoading(false); }
  }, [selectedId]);
  useEffect(() => { void load(selectedId); }, [load, selectedId]);

  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => conversations.filter((item) => !search.trim() || [item.subject, item.metadata?.contact_email, item.intent].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())), [conversations, search]);

  const sync = async () => {
    setSyncing(true); setError("");
    try { await fetchJson("/api/admin/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "gmail" }) }); await load(selectedId); }
    catch (syncError) { setError(syncError instanceof Error ? syncError.message : "Gmail sync failed."); }
    finally { setSyncing(false); }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true); setError("");
    try {
      await fetchJson("/api/admin/revenue-os/conversations/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: selectedId, body: reply, confirmed: true }) });
      setReply(""); setReviewing(false); await load(selectedId);
    } catch (sendError) { setError(sendError instanceof Error ? sendError.message : "Gmail reply failed."); }
    finally { setSending(false); }
  };

  if (loading && !conversations.length) return <AdminRouteSkeleton />;
  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Conversations" subtitle="Gmail and system communication in one linked, reply-ready operating inbox." actions={<button type="button" onClick={() => void sync()} disabled={syncing} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] pl-4 pr-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:opacity-50"><RefreshCw className={cn("size-3.5", syncing && "animate-spin")} /> Sync Gmail</button>} />
      {error && <AdminSurface tone="attention" className="flex items-center gap-3"><TriangleAlert className="size-5 shrink-0 text-rose-600" /><p className="text-sm text-[var(--admin-ink)]">{error}</p></AdminSurface>}
      {!schemaReady ? <RevenueSetupGate /> : (
        <AdminSurface padding="none" className="min-h-[650px] overflow-hidden">
          <div className="grid min-h-[650px] lg:grid-cols-[360px_1fr]">
            <aside className={cn("border-r border-[var(--admin-border)]", selectedId && "hidden lg:block")}>
              <div className="border-b border-[var(--admin-border)] p-4"><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-h-11 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] pl-10 pr-3.5 text-sm text-[var(--admin-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)] focus:ring-2 focus:ring-[var(--admin-ink)]/10" /></div></div>
              <div className="max-h-[590px] divide-y divide-[var(--admin-border)] overflow-y-auto">
                {filtered.map((conversation) => <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={cn("flex min-h-[88px] w-full items-start gap-3 px-4 py-4 text-left transition-[background-color] duration-150 hover:bg-black/[0.022] dark:hover:bg-white/[0.025]", selectedId === conversation.id && "bg-black/[0.035] dark:bg-white/[0.04]")}><span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", conversation.unread_count ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]")}><Mail className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className={cn("truncate text-sm text-[var(--admin-ink)]", conversation.unread_count && "font-semibold")}>{conversation.metadata?.contact_email || "Gmail"}</p>{conversation.unread_count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-blue-600 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-white">{conversation.unread_count}</span>}</div><p className="mt-1 truncate text-xs font-medium text-[var(--admin-ink)]">{conversation.subject || "(No subject)"}</p><p className="admin-copy mt-1 text-[10px] tabular-nums">{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleString() : "Not synced"}</p></div></button>)}
                {!filtered.length && <div className="px-5 py-16 text-center"><Inbox className="mx-auto size-5 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">No conversations yet</p><p className="admin-copy mt-1 text-xs">Connect and sync Gmail in Setup Center.</p></div>}
              </div>
            </aside>

            <main className={cn("flex min-w-0 flex-col", !selectedId && "hidden lg:flex")}>
              {selected ? <>
                <header className="flex items-start gap-3 border-b border-[var(--admin-border)] px-4 py-4 sm:px-6"><button type="button" onClick={() => setSelectedId(null)} aria-label="Back to conversations" className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] lg:hidden"><ArrowLeft className="size-4" /></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">{selected.subject || "(No subject)"}</h2><span className="rounded-full bg-black/[0.045] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)] dark:bg-white/[0.06]">{selected.channel}</span></div><p className="admin-copy mt-1 text-xs">{selected.metadata?.contact_email || "Contact not linked"}{selected.intent ? ` · ${selected.intent}` : ""}</p></div><button type="button" onClick={() => void fetchJson("/api/admin/revenue-os/conversations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, status: "resolved" }) }).then(() => load(selected.id))} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,box-shadow,transform] duration-150 hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><CheckCircle2 className="size-3.5" /> Resolve</button></header>
                <div className="flex-1 space-y-4 overflow-y-auto bg-black/[0.012] p-4 dark:bg-white/[0.012] sm:p-6">{messages.map((message) => <article key={message.id} className={cn("max-w-[88%] rounded-2xl px-4 py-3 shadow-[var(--admin-shadow-border)]", message.direction === "outbound" ? "ml-auto rounded-br-md bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "rounded-bl-md bg-[var(--admin-surface)] text-[var(--admin-ink)]")}><div className={cn("flex flex-wrap items-center justify-between gap-2 text-[10px]", message.direction === "outbound" ? "text-white/55" : "text-[var(--admin-muted)]")}><span>{message.direction === "outbound" ? "You" : message.sender_email || "Unknown sender"}</span><span className="tabular-nums">{new Date(message.sent_at || message.received_at || message.created_at).toLocaleString()}</span></div><p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-6">{message.body_text || "(Empty message)"}</p></article>)}{!messages.length && <p className="py-16 text-center text-sm text-[var(--admin-muted)]">Select or sync this thread to load messages.</p>}</div>
                <footer className="border-t border-[var(--admin-border)] p-4 sm:p-5">{reviewing ? <div className="rounded-2xl bg-amber-500/[0.08] p-2"><div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]"><p className="admin-eyebrow">Final confirmation</p><h3 className="mt-1 text-sm font-semibold text-[var(--admin-ink)]">Send this reply through Gmail?</h3><p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-pretty rounded-xl bg-black/[0.025] p-3 text-sm leading-6 text-[var(--admin-ink)] dark:bg-white/[0.025]">{reply}</p><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setReviewing(false)} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-[var(--admin-muted)] transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]">Edit</button><button type="button" onClick={() => void sendReply()} disabled={sending} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--admin-ink)] px-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-50">{sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Confirm send</button></div></div></div> : <div className="flex gap-2 rounded-2xl bg-black/[0.025] p-2 dark:bg-white/[0.025]"><Reply className="ml-2 mt-3 size-4 shrink-0 text-[var(--admin-muted)]" /><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder="Write a reply. Nothing sends until you review and confirm." className="min-w-0 flex-1 resize-none rounded-xl border border-transparent bg-[var(--admin-surface)] px-3.5 py-3 text-sm leading-6 text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)]/30 focus:shadow-[var(--admin-shadow-border-hover)]" /><button type="button" onClick={() => setReviewing(true)} disabled={!reply.trim()} className="self-end min-h-11 rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 active:scale-[0.96] disabled:opacity-35">Review reply</button></div>}</footer>
              </> : <div className="grid flex-1 place-items-center p-6 text-center"><div><Inbox className="mx-auto size-6 text-[var(--admin-muted)]" /><h2 className="mt-4 text-balance text-lg font-semibold text-[var(--admin-ink)]">Choose a conversation</h2><p className="admin-copy mt-1 text-pretty text-sm">Review the full thread, link it to revenue work, and reply through Gmail.</p></div></div>}
            </main>
          </div>
        </AdminSurface>
      )}
    </div>
  );
}
