"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { AiCommandStreamEvent } from "@/lib/revenue-os/ai-stream-contract";

export interface AdminAIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  runId: string | null;
  createdAt: string;
}

export interface AdminAIConversation {
  id: string;
  title: string;
  lastMessageAt: string;
}

export interface AdminAIToolStep {
  name: string;
  index: number;
  status: "running" | "completed" | "failed";
  summary: string;
}

export interface AdminAIProposal {
  id: string;
  actionType: string;
  title: string;
  impact: string;
  entityType: string | null;
  entityId: string | null;
}

interface AdminAIContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  draft: string;
  setDraft: (draft: string) => void;
  conversations: AdminAIConversation[];
  activeConversationId: string | null;
  messages: AdminAIMessage[];
  tools: AdminAIToolStep[];
  proposals: AdminAIProposal[];
  running: boolean;
  loadingHistory: boolean;
  schemaReady: boolean | null;
  error: string;
  model: string;
  pack: string;
  refreshConversations: () => Promise<void>;
  selectConversation: (id: string | null) => Promise<void>;
  startNew: () => void;
  archiveActive: () => Promise<void>;
  send: (text?: string) => Promise<void>;
  stop: () => void;
  openWithPrompt: (prompt?: string) => void;
}

const AdminAIContext = createContext<AdminAIContextValue | null>(null);
const ACTIVE_KEY = "accelerate:admin-ai-conversation";

async function readEventStream(response: Response, onEvent: (event: AiCommandStreamEvent) => void) {
  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `AI command failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block.split(/\r?\n/).find((line) => line.startsWith("data:"));
      if (!data) continue;
      onEvent(JSON.parse(data.slice(5).trim()) as AiCommandStreamEvent);
    }
  }
}

function pageContext(pathname: string) {
  const match = pathname.match(/^\/admin\/pipeline\/([0-9a-f-]{36})/i);
  return match
    ? { pathname, entity: { type: "opportunity" as const, id: match[1]! } }
    : { pathname };
}

export function AdminAIProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [conversations, setConversations] = useState<AdminAIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminAIMessage[]>([]);
  const [tools, setTools] = useState<AdminAIToolStep[]>([]);
  const [proposals, setProposals] = useState<AdminAIProposal[]>([]);
  const [running, setRunning] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [pack, setPack] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    const response = await fetch("/api/admin/revenue-os/ai/conversations?limit=30", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as {
      schemaReady?: boolean;
      conversations?: AdminAIConversation[];
      error?: string;
    } | null;
    if (!response.ok) {
      setSchemaReady(payload?.schemaReady ?? false);
      throw new Error(payload?.error || "Could not load AI conversations");
    }
    setSchemaReady(true);
    setConversations(payload?.conversations ?? []);
  }, []);

  const selectConversation = useCallback(async (id: string | null) => {
    abortRef.current?.abort();
    setActiveConversationId(id);
    setTools([]);
    setProposals([]);
    setError("");
    if (!id) {
      setMessages([]);
      window.localStorage.removeItem(ACTIVE_KEY);
      return;
    }
    window.localStorage.setItem(ACTIVE_KEY, id);
    setLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/admin/revenue-os/ai/conversations/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { messages?: AdminAIMessage[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load AI conversation");
      setMessages(payload.messages ?? []);
      setSchemaReady(true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not load AI conversation");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    const show = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) setDraft(prompt);
      setOpen(true);
    };
    window.addEventListener("admin:open-ai", show);
    return () => window.removeEventListener("admin:open-ai", show);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isCommandJ = event.code === "KeyJ" || event.key.toLowerCase() === "j";
      if (!event.repeat && (event.metaKey || event.ctrlKey) && isCommandJ) {
        event.preventDefault();
        event.stopPropagation();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    void refreshConversations()
      .then(() => {
        const stored = window.localStorage.getItem(ACTIVE_KEY);
        if (stored) void selectConversation(stored);
      })
      .catch((issue) =>
        setError(issue instanceof Error ? issue.message : "AI history is unavailable"),
      );
  }, [refreshConversations, selectConversation]);

  const send = useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || running) return;
      const clientMessageId = crypto.randomUUID();
      const optimisticUser: AdminAIMessage = {
        id: clientMessageId,
        role: "user",
        content: text,
        runId: null,
        createdAt: new Date().toISOString(),
      };
      const assistantId = `pending-${clientMessageId}`;
      setMessages((current) => [
        ...current,
        optimisticUser,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          runId: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft("");
      setTools([]);
      setProposals([]);
      setError("");
      setRunning(true);
      setModel("");
      setPack("");
      const controller = new AbortController();
      abortRef.current = controller;
      let streamed = "";
      try {
        const response = await fetch("/api/admin/revenue-os/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConversationId,
            text,
            clientMessageId,
            pageContext: pageContext(pathname),
          }),
          signal: controller.signal,
        });
        await readEventStream(response, (event) => {
          if (event.type === "conversation") {
            setActiveConversationId(event.conversationId);
            window.localStorage.setItem(ACTIVE_KEY, event.conversationId);
          }
          if (event.type === "run_started") {
            setModel(event.model);
            setPack(event.pack);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, runId: event.runId } : message,
              ),
            );
          }
          if (event.type === "assistant_delta") {
            streamed += event.delta;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: streamed } : message,
              ),
            );
          }
          if (event.type === "tool_started")
            setTools((current) => [...current, { ...event, status: "running", summary: "" }]);
          if (event.type === "tool_completed")
            setTools((current) =>
              current.map((tool) =>
                tool.index === event.index
                  ? {
                      ...tool,
                      status: event.failed ? "failed" : "completed",
                      summary: event.summary,
                    }
                  : tool,
              ),
            );
          if (event.type === "proposal_staged")
            setProposals((current) =>
              current.some((proposal) => proposal.id === event.proposal.id)
                ? current
                : [...current, event.proposal],
            );
          if (event.type === "final") {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, id: event.messageId, runId: event.runId, content: event.text }
                  : message,
              ),
            );
          }
          if (event.type === "error") setError(event.error);
        });
        await refreshConversations();
      } catch (issue) {
        if (issue instanceof DOMException && issue.name === "AbortError") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId && !item.content
                ? { ...item, content: "Run stopped before an answer was completed." }
                : item,
            ),
          );
        } else {
          const message = issue instanceof Error ? issue.message : "AI command failed";
          setError(message);
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId && !item.content
                ? { ...item, content: "The run failed before an answer was produced." }
                : item,
            ),
          );
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setRunning(false);
      }
    },
    [activeConversationId, draft, pathname, refreshConversations, running],
  );

  const startNew = useCallback(() => {
    void selectConversation(null);
    setDraft("");
  }, [selectConversation]);
  const archiveActive = useCallback(async () => {
    if (!activeConversationId) return;
    const response = await fetch(
      `/api/admin/revenue-os/ai/conversations/${encodeURIComponent(activeConversationId)}`,
      { method: "DELETE" },
    );
    if (!response.ok) throw new Error("Could not archive conversation");
    await selectConversation(null);
    await refreshConversations();
  }, [activeConversationId, refreshConversations, selectConversation]);
  const stop = useCallback(() => abortRef.current?.abort(), []);
  const openWithPrompt = useCallback((prompt?: string) => {
    if (prompt) setDraft(prompt);
    setOpen(true);
  }, []);

  const value = useMemo<AdminAIContextValue>(
    () => ({
      open,
      setOpen,
      draft,
      setDraft,
      conversations,
      activeConversationId,
      messages,
      tools,
      proposals,
      running,
      loadingHistory,
      schemaReady,
      error,
      model,
      pack,
      refreshConversations,
      selectConversation,
      startNew,
      archiveActive,
      send,
      stop,
      openWithPrompt,
    }),
    [
      open,
      draft,
      conversations,
      activeConversationId,
      messages,
      tools,
      proposals,
      running,
      loadingHistory,
      schemaReady,
      error,
      model,
      pack,
      refreshConversations,
      selectConversation,
      startNew,
      archiveActive,
      send,
      stop,
      openWithPrompt,
    ],
  );

  return <AdminAIContext.Provider value={value}>{children}</AdminAIContext.Provider>;
}

export function useAdminAI() {
  const context = useContext(AdminAIContext);
  if (!context) throw new Error("useAdminAI must be used inside AdminAIProvider");
  return context;
}
