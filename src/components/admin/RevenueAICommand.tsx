"use client";

import { FormEvent, useState } from "react";
import { Bot, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
import { AdminSurface } from "./AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { cn } from "@/lib/utils";

interface Message { role: "user" | "assistant"; content: string }

const starters = ["What should I do next?", "Show pipeline risk", "Draft follow-up ideas"];

export function RevenueAICommand({ compact = false, onProposed }: { compact?: boolean; onProposed?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event?: FormEvent, suggested?: string) => {
    event?.preventDefault();
    const command = (suggested ?? input).trim();
    if (!command || loading) return;
    const next = [...messages, { role: "user" as const, content: command }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const result = await fetchJson<{ text: string; proposedActions?: string[] }>("/api/admin/revenue-os/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      setMessages([...next, { role: "assistant", content: result.text }]);
      if (result.proposedActions?.length) onProposed?.();
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : "Revenue copilot failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminSurface padding="none" className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--admin-ink)] text-[var(--admin-surface)]"><Bot className="size-[18px]" /></span>
          <div><p className="admin-eyebrow">Revenue copilot</p><h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Ask the business. Stage the next move.</h2><p className="admin-copy mt-1 text-pretty text-xs">Reads run directly. Emails, stage changes, tasks, and campaign activation enter the approval queue.</p></div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300 sm:flex"><CheckCircle2 className="size-3" /> Gated</span>
      </div>
      {!compact && messages.length > 0 && (
        <div className="max-h-96 space-y-3 overflow-y-auto border-y border-[var(--admin-border)] bg-black/[0.015] p-4 dark:bg-white/[0.015] sm:p-5">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={cn("max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-[var(--admin-shadow-border)]", message.role === "user" ? "ml-auto rounded-br-md bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "rounded-bl-md bg-[var(--admin-surface)] text-[var(--admin-ink)]")}>
              <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
            </div>
          ))}
          {loading && <div className="flex items-center gap-2 text-xs text-[var(--admin-muted)]"><Loader2 className="size-3.5 animate-spin" /> Reading live Revenue OS data…</div>}
        </div>
      )}
      <form onSubmit={(event) => void submit(event)} className="p-4 sm:p-5">
        {messages.length === 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {starters.map((starter) => <button key={starter} type="button" onClick={() => void submit(undefined, starter)} className="min-h-10 rounded-full px-3 text-xs font-medium text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,box-shadow,transform] duration-150 hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96]"><Sparkles className="mr-1.5 inline size-3" />{starter}</button>)}
          </div>
        )}
        <div className="flex gap-2 rounded-2xl bg-black/[0.025] p-2 dark:bg-white/[0.025]">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about pipeline, replies, campaigns, or next actions…" className="min-h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-[var(--admin-surface)] px-3.5 text-sm text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--admin-muted)]/70 focus:border-[var(--admin-ink)]/30 focus:shadow-[var(--admin-shadow-border-hover)]" />
          <button type="submit" disabled={!input.trim() || loading} aria-label="Send command" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--admin-ink)] text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35">{loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="ml-px size-4" />}</button>
        </div>
        {error && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
      </form>
    </AdminSurface>
  );
}
