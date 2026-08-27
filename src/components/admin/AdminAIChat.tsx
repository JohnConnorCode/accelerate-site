"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "@/components/admin/AdminLink";
import { Archive, Bot, Check, CircleAlert, Copy, ExternalLink, History, Loader2, MessageSquarePlus, NotebookPen, Octagon, RotateCcw, Send, Sparkles, ThumbsDown, ThumbsUp, Wrench } from "lucide-react";
import { useAdminAI, type AdminAIMessage } from "./AdminAIProvider";
import { cn } from "@/lib/utils";

const starters = [
  { label: "Attention", prompt: "What needs my attention today?" },
  { label: "Prepare", prompt: "What follow-ups should I prepare?" },
  { label: "Analyze", prompt: "Show me pipeline risk and explain why." },
];

function toolLabel(name: string) {
  return name.replace(/^get_/, "Read ").replace(/^search_/, "Search ").replace(/^propose_/, "Stage ").replace(/_/g, " ");
}

function InlineText({ value }: { value: string }) {
  return <>{value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("`") && part.endsWith("`") ? <code key={index} className="rounded bg-black/[0.055] px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/[0.08]">{part.slice(1, -1)}</code> : part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>)}</>;
}

function StructuredAnswer({ value }: { value: string }) {
  const blocks = value.trim().split(/\n{2,}/).filter(Boolean);
  return <div className="space-y-3 text-pretty">{blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => /^[-*]\s+/.test(line))) return <ul key={index} className="space-y-1.5 pl-4">{lines.map((line, item) => <li key={item} className="list-disc pl-1"><InlineText value={line.replace(/^[-*]\s+/, "")} /></li>)}</ul>;
    if (lines.every((line) => /^\d+[.)]\s+/.test(line))) return <ol key={index} className="space-y-1.5 pl-4">{lines.map((line, item) => <li key={item} className="list-decimal pl-1"><InlineText value={line.replace(/^\d+[.)]\s+/, "")} /></li>)}</ol>;
    if (lines[0]?.startsWith("### ")) return <h3 key={index} className="pt-1 text-sm font-semibold"><InlineText value={lines.join(" ").slice(4)} /></h3>;
    if (lines[0]?.startsWith("## ")) return <h3 key={index} className="pt-1 text-base font-semibold tracking-[-0.02em]"><InlineText value={lines.join(" ").slice(3)} /></h3>;
    return <p key={index}><InlineText value={lines.join(" ")} /></p>;
  })}</div>;
}

function MessageActions({ message, onRetry }: { message: AdminAIMessage; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"helpful" | "not_helpful" | null>(null);
  const [busy, setBusy] = useState(false);
  if (!message.runId) return null;
  const rate = async (next: "helpful" | "not_helpful") => {
    if (rating || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/revenue-os/ai/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: message.runId, rating: next }) });
      if (!response.ok) throw new Error("Could not record feedback");
      setRating(next);
    } finally { setBusy(false); }
  };
  return <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[var(--admin-border)] pt-2">
    <button type="button" onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }} className="admin-icon-button" aria-label="Copy answer" title="Copy answer">{copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}</button>
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("admin:add-note", { detail: { initialNote: message.content } }))} className="admin-icon-button" aria-label="Save answer as founder note" title="Save as note"><NotebookPen className="size-3.5" /></button>
    <Link href={`/admin/ai?view=runs&run=${encodeURIComponent(message.runId)}`} className="admin-icon-button" aria-label="Inspect this AI run" title="Inspect run"><ExternalLink className="size-3.5" /></Link>
    {onRetry && <button type="button" onClick={onRetry} className="admin-icon-button" aria-label="Retry this command" title="Retry command"><RotateCcw className="size-3.5" /></button>}
    <span className="mx-1 h-4 w-px bg-[var(--admin-border)]" />
    <button type="button" disabled={busy || Boolean(rating)} onClick={() => void rate("helpful")} className={cn("admin-icon-button", rating === "helpful" && "bg-emerald-500/10 text-emerald-700")} aria-label="Mark answer helpful"><ThumbsUp className="size-3.5" /></button>
    <button type="button" disabled={busy || Boolean(rating)} onClick={() => void rate("not_helpful")} className={cn("admin-icon-button", rating === "not_helpful" && "bg-rose-500/10 text-rose-700")} aria-label="Mark answer not helpful">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <ThumbsDown className="size-3.5" />}</button>
  </div>;
}

export function AdminAIChat({ mode = "page" }: { mode?: "page" | "panel" }) {
  const ai = useAdminAI();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ai.messages.length && !ai.tools.length && !ai.running) return;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [ai.messages, ai.tools, ai.running]);
  const submit = (event: FormEvent) => { event.preventDefault(); void ai.send(); };

  const conversationList = <aside className={cn("border-[var(--admin-border)]", mode === "page" ? "border-r pr-4" : "border-b px-3 pb-3")}>
    <div className="flex items-center justify-between gap-2">
      <p className="admin-eyebrow">Conversations</p>
      <button type="button" onClick={ai.startNew} className="admin-icon-button" aria-label="New AI conversation" title="New conversation"><MessageSquarePlus className="size-4" /></button>
    </div>
    {mode === "panel" ? <select value={ai.activeConversationId ?? ""} onChange={(event) => void ai.selectConversation(event.target.value || null)} className="mt-2 min-h-10 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]">
      <option value="">New conversation</option>{ai.conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}
    </select> : <div className="mt-3 space-y-1">
      <button type="button" onClick={ai.startNew} className={cn("flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold", !ai.activeConversationId ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "text-[var(--admin-muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]")}><Sparkles className="size-3.5" />New conversation</button>
      {ai.conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => void ai.selectConversation(conversation.id)} className={cn("flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs", ai.activeConversationId === conversation.id ? "bg-black/[0.06] font-semibold text-[var(--admin-ink)] dark:bg-white/[0.07]" : "text-[var(--admin-muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]")}><History className="size-3.5 shrink-0" /><span className="truncate">{conversation.title}</span></button>)}
    </div>}
  </aside>;

  const chat = <section className="flex min-h-0 flex-1 flex-col">
    {ai.schemaReady === false && <div className="m-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200"><CircleAlert className="mr-2 inline size-4" />AI history is not ready. Apply the AI command runtime migration from Setup before using this workspace.</div>}
    <div ref={scrollRef} className={cn("flex-1 overflow-y-auto", mode === "page" ? "min-h-[52vh] max-h-[68vh] px-2 py-3 sm:px-5" : "min-h-0 px-4 py-4")} aria-live="polite">
      {ai.loadingHistory && <div className="grid min-h-48 place-items-center text-xs text-[var(--admin-muted)]"><Loader2 className="mb-2 size-5 animate-spin" />Loading conversation</div>}
      {!ai.loadingHistory && ai.messages.length === 0 && <div className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-[var(--admin-ink)] text-[var(--admin-surface)]"><Bot className="size-5" /></span>
        <h2 className="mt-4 text-xl font-semibold tracking-[-0.035em] text-[var(--admin-ink)]">Ask the operating system</h2>
        <p className="admin-copy mt-2 max-w-md text-sm">It reads bounded live records, shows its work, and stages consequential changes for your approval.</p>
        <div className="mt-5 grid w-full gap-2 sm:grid-cols-3">{starters.map((starter) => <button key={starter.label} type="button" disabled={ai.schemaReady === false} onClick={() => void ai.send(starter.prompt)} className="min-h-12 rounded-xl px-3 py-2 text-left shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.98] disabled:opacity-40"><span className="block text-[9px] font-semibold uppercase tracking-[0.09em] text-[var(--admin-muted)]">{starter.label}</span><span className="mt-0.5 block text-xs font-medium text-[var(--admin-ink)]">{starter.prompt}</span></button>)}</div>
      </div>}
      <div className="space-y-4">{ai.messages.map((message, index) => { const isLatestAssistant = message.role === "assistant" && !ai.messages.slice(index + 1).some((item) => item.role === "assistant"); return <article key={message.id} className={cn("max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-[var(--admin-shadow-border)]", message.role === "user" ? "ml-auto rounded-br-md bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "rounded-bl-md bg-[var(--admin-surface)] text-[var(--admin-ink)]")}>
        {message.role === "assistant" && !message.content && ai.running ? <span className="inline-flex items-center gap-2 text-xs text-[var(--admin-muted)]"><Loader2 className="size-3.5 animate-spin" />Reading live data</span> : message.role === "assistant" ? <StructuredAnswer value={message.content} /> : <p className="whitespace-pre-wrap text-pretty">{message.content}</p>}
        {isLatestAssistant && (ai.tools.length > 0 || ai.model) && <div className="mt-3 rounded-xl bg-black/[0.025] p-3 shadow-[var(--admin-shadow-border)] dark:bg-white/[0.035]"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]"><Wrench className="size-3.5" />{ai.running ? "Working" : "Run evidence"}{ai.model && <span className="ml-auto max-w-[55%] truncate normal-case tracking-normal" title={ai.model}>{ai.pack || "core"} · {ai.model}</span>}</div><ol className="mt-2 space-y-1">{ai.tools.map((tool) => <li key={`${tool.index}-${tool.name}`} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs"><span className="mt-0.5 text-[var(--admin-muted)]">{tool.status === "running" ? <Loader2 className="size-3 animate-spin" /> : tool.status === "failed" ? <CircleAlert className="size-3 text-rose-600" /> : <Check className="size-3 text-emerald-600" />}</span><span className="min-w-0"><span className="font-semibold capitalize text-[var(--admin-ink)]">{toolLabel(tool.name)}</span>{tool.summary && <span className="ml-2 text-[var(--admin-muted)]">{tool.summary}</span>}</span></li>)}</ol></div>}
        {isLatestAssistant && ai.proposals.length > 0 && <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3"><p className="text-xs font-semibold text-[var(--admin-ink)]">{ai.proposals.length} change{ai.proposals.length === 1 ? "" : "s"} staged. Nothing has executed.</p><ul className="mt-2 space-y-1">{ai.proposals.map((proposal) => <li key={proposal.id} className="rounded-lg bg-[var(--admin-surface)] px-3 py-2 text-xs shadow-[var(--admin-shadow-border)]"><span className="block truncate font-semibold">{proposal.title}</span><span className="text-[10px] uppercase tracking-[0.07em] text-[var(--admin-muted)]">{proposal.impact.replace(/_/g, " ")}</span></li>)}</ul><Link href="/admin/today?focus=approvals" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[var(--admin-ink)] px-3 text-xs font-semibold text-[var(--admin-surface)]">Review exact changes</Link></div>}
        {message.role === "assistant" && message.content && <MessageActions message={message} onRetry={!ai.running && ai.messages[index - 1]?.role === "user" ? () => void ai.send(ai.messages[index - 1]!.content) : undefined} />}
      </article>; })}</div>
    </div>

    <form onSubmit={submit} className="border-t border-[var(--admin-border)] p-3 sm:p-4">
      {ai.error && <p className="mb-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{ai.error}</p>}
      <div className="flex items-end gap-2 rounded-2xl bg-black/[0.025] p-2 dark:bg-white/[0.035]">
        <textarea value={ai.draft} onChange={(event) => ai.setDraft(event.target.value.slice(0, 8000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="Ask about priorities, pipeline, conversations, or next actions…" className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl bg-[var(--admin-surface)] px-3.5 py-3 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none placeholder:text-[var(--admin-muted)]/70 focus:shadow-[var(--admin-shadow-border-hover)]" />
        {ai.running ? <button type="button" onClick={ai.stop} className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-600 text-white" aria-label="Stop AI run"><Octagon className="size-4" /></button> : <button type="submit" disabled={!ai.draft.trim() || ai.schemaReady === false} className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--admin-ink)] text-[var(--admin-surface)] transition-[opacity,transform] hover:opacity-85 active:scale-[0.96] disabled:opacity-35" aria-label="Send AI command"><Send className="size-4" /></button>}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--admin-muted)]"><span>Enter sends · Shift+Enter adds a line</span>{ai.activeConversationId && <button type="button" onClick={() => void ai.archiveActive()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 hover:text-[var(--admin-ink)]"><Archive className="size-3" />Archive</button>}</div>
    </form>
  </section>;

  if (mode === "panel") return <div className="flex h-full min-h-0 flex-col">{conversationList}{chat}</div>;
  return <div className="grid min-h-[68vh] overflow-hidden rounded-2xl bg-[var(--admin-surface)] shadow-[var(--admin-shadow)] md:grid-cols-[248px_minmax(0,1fr)]"><div className="hidden p-4 md:block">{conversationList}</div>{chat}</div>;
}
