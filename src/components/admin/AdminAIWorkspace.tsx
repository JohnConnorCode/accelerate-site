"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import { Bot, Command, Database, History, MessageSquare, ShieldCheck, Wrench } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { AdminSurface } from "./AdminSurface";
import { AdminAIChat } from "./AdminAIChat";
import { AIRunHistory } from "./AIRunHistory";
import { AICapabilities } from "./AICapabilities";
import { useAdminAI } from "./AdminAIProvider";
import { cn } from "@/lib/utils";

type WorkspaceView = "ask" | "runs" | "capabilities";

const views: Array<{ id: WorkspaceView; label: string; description: string; icon: typeof Bot }> = [
  { id: "ask", label: "Ask", description: "Work with live context", icon: MessageSquare },
  { id: "runs", label: "Run history", description: "Inspect evidence and outcomes", icon: History },
  { id: "capabilities", label: "Capabilities", description: "Understand tools and safeguards", icon: Wrench },
];

function validView(value: string | null): WorkspaceView {
  return value === "runs" || value === "capabilities" ? value : "ask";
}

export function AdminAIWorkspace() {
  const searchParams = useSearchParams();
  const router = useAdminNavigation();
  const { activeConversationId, selectConversation } = useAdminAI();
  const view = validView(searchParams.get("view"));
  const conversationId = searchParams.get("conversation");
  useEffect(() => {
    if (view === "ask" && conversationId && conversationId !== activeConversationId) void selectConversation(conversationId);
  }, [activeConversationId, conversationId, selectConversation, view]);
  const setView = (next: WorkspaceView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ask") params.delete("view"); else params.set("view", next);
    params.delete("run");
    router.replace(params.size ? `?${params}` : "?", "preserve");
  };

  return <div className="space-y-6 pb-10">
    <PageHeader title="AI Workspace" subtitle="Ask the business, inspect the evidence behind every run, and see which tools are registered and how they are controlled." actions={<div className="hidden items-center gap-2 sm:flex"><span className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]"><Command className="size-3.5" />⌘J anywhere</span><span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><ShieldCheck className="size-3.5" />Actions gated</span></div>} />
    <nav className="grid gap-2 rounded-2xl bg-black/[0.025] p-1.5 shadow-[var(--admin-shadow-border)] dark:bg-white/[0.025] sm:grid-cols-3" aria-label="AI workspace views">
      {views.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" onClick={() => setView(id)} aria-current={view === id ? "page" : undefined} className={cn("flex min-h-[58px] items-center gap-3 rounded-xl px-3 text-left transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.96]", view === id ? "bg-[var(--admin-surface)] shadow-[var(--admin-shadow)]" : "hover:bg-[var(--admin-surface)]/60")}><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", view === id ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]" : "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]")}><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-sm font-semibold text-[var(--admin-ink)]">{label}</span><span className="block truncate text-[10px] text-[var(--admin-muted)]">{description}</span></span></button>)}
    </nav>
    {view === "ask" && <AskView />}
    {view === "runs" && <AIRunHistory />}
    {view === "capabilities" && <AICapabilities />}
  </div>;
}

function AskView() {
  const cards = [
    { icon: Bot, title: "One shared agent", body: "This workspace, the global panel, and record launchers use the same conversation runtime." },
    { icon: Database, title: "Grounded answers", body: "Registered tools read bounded canonical records. Missing data stays missing." },
    { icon: ShieldCheck, title: "Visible control", body: "Reads, tool evidence, failures, and proposed changes remain inspectable." },
  ];
  return <div className="space-y-3"><div className="flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">{cards.map(({ icon: Icon, title, body }) => <AdminSurface key={title} padding="lg" className="min-w-[260px] snap-start sm:min-w-0"><Icon className="size-4 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">{title}</p><p className="admin-copy mt-1 text-xs">{body}</p></AdminSurface>)}</div><AdminAIChat /></div>;
}
