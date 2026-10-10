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
import { AdminViewSwitcher } from "./AdminViewSwitcher";

type WorkspaceView = "ask" | "runs" | "capabilities";

const views: Array<{ id: WorkspaceView; label: string; description: string; icon: typeof Bot }> = [
  { id: "ask", label: "Ask", description: "Prepare business actions", icon: MessageSquare },
  {
    id: "runs",
    label: "Run history",
    description: "Results and execution receipts",
    icon: History,
  },
  {
    id: "capabilities",
    label: "Capabilities",
    description: "Available tools and permissions",
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
            ? "Keep business instructions, preferences, and source material together for your AI coworkers."
            : "Ask with live business context, inspect the evidence, and approve every consequential action."
        }
      />
      <AdminViewSwitcher
        label="AI workspace views"
        value={view}
        onChange={setView}
        options={views}
        className="mb-4 grid grid-cols-3"
      />
      <div key={view} data-admin-view-panel={view}>
        {view === "ask" && <AskView />}
        {view === "runs" && <AIRunHistory />}
        {view === "capabilities" && <AICapabilities />}
      </div>
    </div>
  );
}

function AskView() {
  return <AdminAIChat />;
}
