"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import { Bot, History, MessageSquare, Wrench } from "lucide-react";
import { adminPageName } from "@/lib/admin/navigation";
import { PageHeader } from "./PageHeader";
import { AdminAIChat } from "./AdminAIChat";
import { AIRunHistory } from "./AIRunHistory";
import { AICapabilities } from "./AICapabilities";
import { useAdminAI } from "./AdminAIProvider";
import { cn } from "@/lib/utils";

type WorkspaceView = "ask" | "runs" | "capabilities";

const views: Array<{ id: WorkspaceView; label: string; description: string; icon: typeof Bot }> = [
  { id: "ask", label: "Ask", description: "Work with live context", icon: MessageSquare },
  { id: "runs", label: "Run history", description: "Inspect evidence and outcomes", icon: History },
  {
    id: "capabilities",
    label: "Capabilities",
    description: "Understand tools and safeguards",
    icon: Wrench,
  },
];

function validView(value: string | null): WorkspaceView {
  return value === "runs" || value === "capabilities" ? value : "ask";
}

export function AdminAIWorkspace() {
  const searchParams = useSearchParams();
  const router = useAdminNavigation();
  const { activeConversationId, selectConversation, setPurpose, refreshConversations } =
    useAdminAI();
  const view = validView(searchParams.get("view"));
  const conversationId = searchParams.get("conversation");
  const purpose = searchParams.get("purpose") === "architect" ? "architect" : "command";
  useEffect(() => {
    setPurpose(purpose);
    void refreshConversations().catch(() => undefined);
  }, [purpose, refreshConversations, setPurpose]);
  useEffect(() => {
    if (view === "ask" && conversationId && conversationId !== activeConversationId)
      void selectConversation(conversationId);
  }, [activeConversationId, conversationId, selectConversation, view]);
  const setView = (next: WorkspaceView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "ask") params.delete("view");
    else params.set("view", next);
    params.delete("run");
    router.replace(params.size ? `?${params}` : "?", "preserve");
  };

  return (
    <div className="pb-10">
      <PageHeader
        title={purpose === "architect" ? adminPageName("architect") : adminPageName("ai")}
        subtitle={
          purpose === "architect"
            ? "Teach the workspace how the business works. Chat stays the control plane; attachments and connected sources are inspectable evidence, never executable instruction."
            : "Ask with live business context, inspect the evidence, and approve every consequential action."
        }
      />
      <nav
        className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-black/[0.025] p-1.5 shadow-[var(--admin-shadow-border)] dark:bg-white/[0.025]"
        aria-label="AI workspace views"
      >
        {views.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-current={view === id ? "page" : undefined}
            className={cn(
              "flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-left transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.96] sm:justify-start sm:px-3",
              view === id
                ? "bg-[var(--admin-surface)] shadow-[var(--admin-shadow)]"
                : "hover:bg-[var(--admin-surface)]/60",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-[var(--admin-control-radius)]",
                view === id
                  ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                  : "bg-black/[0.045] text-[var(--admin-muted)] dark:bg-white/[0.06]",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-[var(--admin-ink)] sm:text-sm">
                {label}
              </span>
              <span className="hidden truncate text-[10px] text-[var(--admin-muted)] xl:block">
                {description}
              </span>
            </span>
          </button>
        ))}
      </nav>
      {view === "ask" && <AskView />}
      {view === "runs" && <AIRunHistory />}
      {view === "capabilities" && <AICapabilities />}
    </div>
  );
}

function AskView() {
  return <AdminAIChat />;
}
