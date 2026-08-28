"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { AdminSurface } from "./AdminSurface";
import { useAdminAI } from "./AdminAIProvider";

const starters = ["What should I do next?", "Show pipeline risk", "Draft follow-up ideas"];

export function RevenueAICommand({ compact = false, onProposed }: { compact?: boolean; onProposed?: () => void }) {
  const ai = useAdminAI();
  const [input, setInput] = useState("");
  const observedProposalCount = useRef(ai.proposals.length);
  useEffect(() => {
    if (ai.proposals.length > observedProposalCount.current) onProposed?.();
    observedProposalCount.current = ai.proposals.length;
  }, [ai.proposals.length, onProposed]);

  const submit = (event?: FormEvent, suggested?: string) => {
    event?.preventDefault();
    const command = (suggested ?? input).trim();
    if (!command || ai.running || ai.schemaReady === false) return;
    setInput("");
    ai.openWithPrompt();
    void ai.send(command);
  };

  return <AdminSurface padding="none" className="overflow-hidden" data-revenue-ai-card>
    <div className="flex items-start justify-between gap-4 p-5 sm:p-6" data-ai-card-header>
      <div className="min-w-0"><p className="admin-eyebrow">AI Workspace</p><h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">Ask the business. Inspect the evidence.</h2><p className="admin-copy mt-1 text-pretty text-xs">Your question opens the shared conversation. Reads run directly; consequential changes remain staged for approval.</p></div>
      <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300 sm:flex"><CheckCircle2 className="size-3" />Gated</span>
    </div>
    <form onSubmit={(event) => submit(event)} className="p-4 pt-0 sm:p-5 sm:pt-0">
      {!compact && <div className="mb-3 flex flex-wrap gap-2">{starters.map((starter) => <button key={starter} type="button" onClick={() => submit(undefined, starter)} disabled={ai.running || ai.schemaReady === false} className="min-h-10 rounded-full px-3 text-xs font-medium text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,box-shadow,transform] hover:text-[var(--admin-ink)] hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:opacity-40">{starter}</button>)}</div>}
      <div className="admin-composer"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about pipeline, replies, campaigns, or next actions…" className="admin-composer-field" /><button type="submit" disabled={!input.trim() || ai.running || ai.schemaReady === false} aria-label="Send command" className="admin-composer-action">{ai.running ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</button></div>
      {ai.schemaReady === false && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">AI history is not ready. Apply the AI command runtime migration from Setup to enable shared conversations.</p>}
    </form>
  </AdminSurface>;
}
