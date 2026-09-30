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
import type { ActionRow } from "./ActionReviewDialog";
import type { AiCommandStreamEvent } from "@/lib/revenue-os/ai-stream-contract";

export interface AdminAIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  runId: string | null;
  createdAt: string;
  metadata?: { proposal_ids?: string[]; work_item_ids?: string[] };
}

export interface AdminAIConversation {
  id: string;
  title: string;
  lastMessageAt: string;
}

export interface AdminAISource {
  id: string;
  filename: string;
  contentType: string;
  excerpt: string;
  provenance: {
    capturedAt: string;
    executable: false;
    permission: string;
    scope: string;
    source: string;
  };
}

export type AdminAIPurpose = "command" | "architect";

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

export interface AdminAIWorkProgress {
  workItemId: string;
  status: string;
  revision: number;
  plan?: {
    objective: string;
    control: string;
    steps: Array<{ title: string; status: string; receipt: string; actionIds: string[] }>;
  };
}
interface AdminAIContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  draft: string;
  setDraft: (draft: string) => void;
  purpose: AdminAIPurpose;
  setPurpose: (purpose: AdminAIPurpose) => void;
  conversations: AdminAIConversation[];
  activeConversationId: string | null;
  messages: AdminAIMessage[];
  sources: AdminAISource[];
  connectedContext: Array<{
    source: string;
    scope: string;
    permission: string;
    resourceId: string;
  }>;
  assumptions: string[];
  tools: AdminAIToolStep[];
  proposals: AdminAIProposal[];
  workProgress: AdminAIWorkProgress[];
  readWorkProgress: (id: string) => Promise<void>;
  controlWork: (
    id: string,
    control: "pause" | "resume" | "cancel",
    revision: number,
  ) => Promise<void>;
  reviewedAction: ActionRow | null;
  reviewing: boolean;
  reviewProposal: (id: string | null) => Promise<void>;
  decideProposal: (decision: "approve" | "reject") => Promise<void>;
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
  attachSource: (file: File) => Promise<void>;
  attachSources: (files: File[]) => Promise<void>;
  addConnectedSource: (input: {
    source: string;
    scope: string;
    resourceId: string;
  }) => Promise<void>;
  addAssumption: (text: string) => Promise<void>;
  send: (text?: string) => Promise<void>;
  stop: () => void;
  openWithPrompt: (prompt?: string) => void;
}

const AdminAIContext = createContext<AdminAIContextValue | null>(null);
const ACTIVE_KEY = "accelerate:admin-ai-conversation";
const ARCHITECT_KEY = "accelerate:admin-architect-conversation";

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
  const [purpose, setPurposeState] = useState<AdminAIPurpose>("command");
  const purposeRef = useRef<AdminAIPurpose>("command");
  const [conversations, setConversations] = useState<AdminAIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminAIMessage[]>([]);
  const [sources, setSources] = useState<AdminAISource[]>([]);
  const [connectedContext, setConnectedContext] = useState<
    Array<{ source: string; scope: string; permission: string; resourceId: string }>
  >([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [tools, setTools] = useState<AdminAIToolStep[]>([]);
  const [proposals, setProposals] = useState<AdminAIProposal[]>([]);
  const [workProgress, setWorkProgress] = useState<AdminAIWorkProgress[]>([]);
  const [reviewedAction, setReviewedAction] = useState<ActionRow | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const decisionLock = useRef(false);
  const [running, setRunning] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [pack, setPack] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const setPurpose = useCallback((next: AdminAIPurpose) => {
    purposeRef.current = next;
    setPurposeState(next);
  }, []);

  const refreshConversations = useCallback(async () => {
    const query = new URLSearchParams({ limit: "30", purpose: purposeRef.current });
    const response = await fetch(`/api/admin/revenue-os/ai/conversations?${query}`, {
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
    setReviewedAction(null);
    setWorkProgress([]);
    setError("");
    if (!id) {
      setMessages([]);
      setSources([]);
      setConnectedContext([]);
      setAssumptions([]);
      window.localStorage.removeItem(
        purposeRef.current === "architect" ? ARCHITECT_KEY : ACTIVE_KEY,
      );
      return;
    }
    window.localStorage.setItem(
      purposeRef.current === "architect" ? ARCHITECT_KEY : ACTIVE_KEY,
      id,
    );
    setLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/admin/revenue-os/ai/conversations/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        messages?: AdminAIMessage[];
        sources?: AdminAISource[];
        connectedContext?: AdminAIContextValue["connectedContext"];
        assumptions?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not load AI conversation");
      setMessages(payload.messages ?? []);
      const ids = [
        ...new Set(
          (payload.messages ?? []).flatMap((message) => message.metadata?.proposal_ids ?? []),
        ),
      ].slice(-16);
      const restored = await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(
            `/api/admin/revenue-os/actions?id=${encodeURIComponent(id)}`,
            { cache: "no-store" },
          );
          const payload = response.ok ? await response.json() : null;
          return payload?.actions?.find((action: ActionRow) => action.id === id) as
            ActionRow | undefined;
        }),
      );
      setProposals(
        restored
          .filter((row): row is ActionRow => Boolean(row) && row?.status === "pending")
          .map((row) => ({
            id: row.id,
            title: row.title,
            actionType: row.action_type,
            impact: "review_required",
            entityType: null,
            entityId: null,
          })),
      );
      const receipts = restored.filter(
        (row): row is ActionRow => Boolean(row) && row?.status !== "pending",
      );
      if (receipts.length)
        setMessages((current) => [
          ...current,
          ...receipts.map((row) => ({
            id: `receipt-${row.id}`,
            role: "assistant" as const,
            content: `Recorded result: ${row.title}. Status: ${row.status}. ${row.status === "executed" ? "Check the saved action receipt in Work for delivery or partial results." : "This proposal will not run automatically."}`,
            runId: null,
            createdAt: new Date().toISOString(),
          })),
        ]);
      setWorkProgress(
        [
          ...new Set(
            (payload.messages ?? []).flatMap((message) => message.metadata?.work_item_ids ?? []),
          ),
        ]
          .slice(-8)
          .map((workItemId) => ({ workItemId, revision: 0, status: "Read current progress" })),
      );
      setSources(payload.sources ?? []);
      setConnectedContext(payload.connectedContext ?? []);
      setAssumptions(payload.assumptions ?? []);
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
        const stored = window.localStorage.getItem(
          purposeRef.current === "architect" ? ARCHITECT_KEY : ACTIVE_KEY,
        );
        if (stored) void selectConversation(stored);
      })
      .catch((issue) =>
        setError(issue instanceof Error ? issue.message : "AI history is unavailable"),
      );
  }, [refreshConversations, selectConversation]);

  const readWorkProgress = useCallback(async (id: string) => {
    setError("");
    try {
      const response = await fetch(
        `/api/admin/revenue-os/agent-work?id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const work = await response.json();
      if (!response.ok) throw new Error(work.error || "Could not read current work progress");
      setWorkProgress((current) => [...current.filter((item) => item.workItemId !== id), work]);
      for (const action of work.actionReceipts ?? []) {
        if (action.status !== "pending") continue;
        setProposals((current) =>
          current.some((item) => item.id === action.id)
            ? current
            : [
                ...current,
                {
                  id: action.id,
                  actionType: action.action_type,
                  title: action.title,
                  impact: "review_required",
                  entityType: null,
                  entityId: null,
                },
              ],
        );
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Work progress is unavailable");
    }
  }, []);
  const controlWork = useCallback(
    async (id: string, control: "pause" | "resume" | "cancel", revision: number) => {
      setError("");
      try {
        const response = await fetch("/api/admin/revenue-os/agent-work", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workItemId: id, control, revision }),
        });
        const receipt = await response.json();
        if (!response.ok) throw new Error(receipt.error || "Work control failed");
        await readWorkProgress(id);
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "Work control failed");
      }
    },
    [readWorkProgress],
  );

  const reviewProposal = useCallback(async (id: string | null) => {
    setReviewedAction(null);
    if (!id) return;
    setError("");
    setReviewing(true);
    try {
      const response = await fetch(`/api/admin/revenue-os/actions?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      const action = payload.actions?.find((item: ActionRow) => item.id === id);
      if (!response.ok || !action || action.status !== "pending")
        throw new Error(
          payload.error ||
            "This proposal is no longer awaiting approval. Refresh the conversation.",
        );
      setReviewedAction(action);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not load the exact proposal");
    } finally {
      setReviewing(false);
    }
  }, []);
  const decideProposal = useCallback(
    async (decision: "approve" | "reject") => {
      if (!reviewedAction || decisionLock.current) return;
      decisionLock.current = true;
      setReviewing(true);
      setError("");
      try {
        const response = await fetch("/api/admin/revenue-os/actions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: reviewedAction.id, decision }),
        });
        const receipt = await response.json();
        if (!response.ok) throw new Error(receipt.error || "The decision could not be completed");
        const result = receipt.result;
        const incomplete =
          result?.complete === false ||
          ["partial", "failed", "denied", "pending"].includes(result?.status);
        const content =
          decision === "reject"
            ? `Rejected: ${reviewedAction.title}. It will not run.`
            : `${receipt.simulated ? "Simulated result" : incomplete ? "Action needs attention" : "Action receipt"}: ${reviewedAction.title}. ${receipt.simulated ? "Saved in this fictional workspace; no real message or payment was sent." : "Open the action receipt in Work to inspect delivery and any partial result."}`;
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            runId: null,
            createdAt: new Date().toISOString(),
          },
        ]);
        setProposals((current) => current.filter((item) => item.id !== reviewedAction.id));
        setReviewedAction(null);
        window.dispatchEvent(new Event("admin:refresh"));
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "Could not apply your decision");
      } finally {
        decisionLock.current = false;
        setReviewing(false);
      }
    },
    [reviewedAction],
  );

  const send = useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || running || reviewing) return;
      const decision = text.match(/^(approve|reject)(?:\s+([0-9a-f-]{36}))?[.!]?$/i);
      if (decision) {
        setDraft("");
        if (reviewedAction && (!decision[2] || decision[2] === reviewedAction.id)) {
          await decideProposal(decision[1]!.toLowerCase() as "approve" | "reject");
        } else {
          setError(
            "Open the exact proposal in this conversation first, then approve or reject it. Name one proposal when several are pending.",
          );
        }
        return;
      }
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
            purpose: purposeRef.current,
            pageContext: pageContext(pathname),
          }),
          signal: controller.signal,
        });
        await readEventStream(response, (event) => {
          if (event.type === "conversation") {
            setActiveConversationId(event.conversationId);
            window.localStorage.setItem(
              purposeRef.current === "architect" ? ARCHITECT_KEY : ACTIVE_KEY,
              event.conversationId,
            );
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
          if (event.type === "assistant_reset") {
            streamed = "";
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: "" } : message,
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
          if (event.type === "work_progress")
            setWorkProgress((current) => [
              ...current.filter((item) => item.workItemId !== event.workItemId),
              event,
            ]);
          if (event.type === "action_receipt")
            setTools((current) => [
              ...current,
              {
                name: "internal_action_receipt",
                index: current.length,
                status: event.status === "executed" ? "completed" : "failed",
                summary: `Action ${event.actionId}: ${event.status}`,
              },
            ]);
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
    [
      activeConversationId,
      draft,
      pathname,
      refreshConversations,
      running,
      reviewing,
      reviewedAction,
      decideProposal,
    ],
  );

  const startNew = useCallback(() => {
    void selectConversation(null);
    setDraft("");
    setSources([]);
    setConnectedContext([]);
    setAssumptions([]);
  }, [selectConversation]);
  const ensureArchitectSession = useCallback(async () => {
    if (activeConversationId) return activeConversationId;
    const created = await fetch("/api/admin/revenue-os/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "architect" }),
    });
    const createdPayload = (await created.json().catch(() => null)) as {
      conversation?: AdminAIConversation;
      error?: string;
    } | null;
    if (!created.ok || !createdPayload?.conversation)
      throw new Error(createdPayload?.error || "Could not open Architect session");
    const conversationId = createdPayload.conversation.id;
    setActiveConversationId(conversationId);
    window.localStorage.setItem(ARCHITECT_KEY, conversationId);
    await refreshConversations();
    return conversationId;
  }, [activeConversationId, refreshConversations]);
  const attachSource = useCallback(
    async (file: File) => {
      if (purposeRef.current !== "architect") return;
      setError("");
      try {
        const conversationId = await ensureArchitectSession();
        const excerpt = (await file.text()).slice(0, 8000);
        const response = await fetch(
          `/api/admin/revenue-os/ai/conversations/${encodeURIComponent(conversationId)}/sources`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientSourceId: crypto.randomUUID(),
              kind: "upload",
              filename: file.name,
              contentType: file.type || "text/plain",
              excerpt,
            }),
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          source?: AdminAISource;
          error?: string;
        } | null;
        if (!response.ok || !payload?.source)
          throw new Error(payload?.error || "Could not attach source");
        setSources((current) =>
          current.some((item) => item.id === payload.source!.id)
            ? current
            : [...current, payload.source!],
        );
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "Could not attach source");
      }
    },
    [ensureArchitectSession],
  );
  const attachSources = useCallback(
    async (files: File[]) => {
      for (const file of files) await attachSource(file);
    },
    [attachSource],
  );
  const addConnectedSource = useCallback(
    async (input: { source: string; scope: string; resourceId: string }) => {
      if (purposeRef.current !== "architect") return;
      setError("");
      try {
        const conversationId = await ensureArchitectSession();
        const next = [...connectedContext, { ...input, permission: "read" as const }];
        const response = await fetch(
          `/api/admin/revenue-os/ai/conversations/${encodeURIComponent(conversationId)}/context`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectedContext: next }),
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          connectedContext?: AdminAIContextValue["connectedContext"];
          error?: string;
        } | null;
        if (!response.ok || !payload?.connectedContext)
          throw new Error(payload?.error || "Could not add scoped source");
        setConnectedContext(payload.connectedContext);
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "Could not add scoped source");
      }
    },
    [connectedContext, ensureArchitectSession],
  );
  const addAssumption = useCallback(
    async (text: string) => {
      if (purposeRef.current !== "architect") return;
      const assumption = text.trim();
      if (!assumption) return;
      setError("");
      try {
        const conversationId = await ensureArchitectSession();
        const next = [...assumptions, assumption];
        const response = await fetch(
          `/api/admin/revenue-os/ai/conversations/${encodeURIComponent(conversationId)}/context`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assumptions: next }),
          },
        );
        const payload = (await response.json().catch(() => null)) as {
          assumptions?: string[];
          error?: string;
        } | null;
        if (!response.ok || !payload?.assumptions)
          throw new Error(payload?.error || "Could not record assumption");
        setAssumptions(payload.assumptions);
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : "Could not record assumption");
      }
    },
    [assumptions, ensureArchitectSession],
  );
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

  useEffect(() => {
    const request = new URLSearchParams(window.location.search).get("agent");
    if (!request || !window.location.pathname.includes("demo/command-center")) return;
    const prompts: Record<string, string> = {
      priorities:
        "What needs attention today? Explain why and link the records. Prepare the next useful follow-up.",
      inquiry:
        "Find unanswered customer inquiries, prepare a reply using the thread and create a follow-up task.",
      onboarding:
        "Find a won client engagement and prepare onboarding tasks linked to it. Ask me for any missing owner or due dates.",
      invoice: "Find overdue invoices and prepare a reminder for my review. Do not send anything.",
    };
    if (prompts[request]) openWithPrompt(prompts[request]);
  }, [pathname, openWithPrompt]);

  const value = useMemo<AdminAIContextValue>(
    () => ({
      open,
      setOpen,
      draft,
      setDraft,
      purpose,
      setPurpose,
      conversations,
      activeConversationId,
      messages,
      sources,
      connectedContext,
      assumptions,
      tools,
      proposals,
      workProgress,
      readWorkProgress,
      controlWork,
      reviewedAction,
      reviewing,
      reviewProposal,
      decideProposal,
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
      attachSource,
      attachSources,
      addConnectedSource,
      addAssumption,
      send,
      stop,
      openWithPrompt,
    }),
    [
      open,
      draft,
      purpose,
      setPurpose,
      conversations,
      activeConversationId,
      messages,
      sources,
      connectedContext,
      assumptions,
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
      attachSource,
      attachSources,
      addConnectedSource,
      addAssumption,
      send,
      stop,
      openWithPrompt,
      reviewedAction,
      reviewing,
      reviewProposal,
      decideProposal,
      workProgress,
      readWorkProgress,
      controlWork,
    ],
  );

  return <AdminAIContext.Provider value={value}>{children}</AdminAIContext.Provider>;
}

export function useAdminAI() {
  const context = useContext(AdminAIContext);
  if (!context) throw new Error("useAdminAI must be used inside AdminAIProvider");
  return context;
}
