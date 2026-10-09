"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "@/components/admin/AdminLink";
import {
  Archive,
  ArrowDown,
  Bot,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  NotebookPen,
  Octagon,
  Paperclip,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import { useAdminAI, type AdminAIMessage } from "./AdminAIProvider";
import { ActionReviewDialog } from "./ActionReviewDialog";
import { ArchitectEvidencePanel } from "./ArchitectEvidencePanel";
import { ArchitectUnderstandingPanel } from "./ArchitectUnderstandingPanel";
import { cn } from "@/lib/utils";

const starters = [
  { label: "Attention", prompt: "What needs my attention today?" },
  { label: "Prepare", prompt: "What follow-ups should I prepare?" },
  { label: "Analyze", prompt: "Show me pipeline risk and explain why." },
];

const architectStarters = [
  {
    label: "Business",
    prompt: "Here is how this business actually makes money and delivers work.",
  },
  { label: "Customers", prompt: "These are the kinds of customers we serve and how they find us." },
  {
    label: "Rules",
    prompt: "These are the decisions a coworker should never make without asking.",
  },
];

function toolLabel(name: string) {
  return name
    .replace(/^get_/, "Read ")
    .replace(/^search_/, "Search ")
    .replace(/^propose_/, "Stage ")
    .replace(/_/g, " ");
}

function InlineText({ value }: { value: string }) {
  return (
    <>
      {value
        .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
        .filter(Boolean)
        .map((part, index) =>
          part.startsWith("`") && part.endsWith("`") ? (
            <code
              key={index}
              className="rounded bg-black/[0.055] px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/[0.08]"
            >
              {part.slice(1, -1)}
            </code>
          ) : part.startsWith("**") && part.endsWith("**") ? (
            <strong key={index} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={index}>{part}</span>
          ),
        )}
    </>
  );
}

function StructuredAnswer({ value }: { value: string }) {
  const blocks = value
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean);
  return (
    <div className="space-y-3 text-pretty">
      {blocks.map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.every((line) => /^[-*]\s+/.test(line)))
          return (
            <ul key={index} className="space-y-1.5 pl-4">
              {lines.map((line, item) => (
                <li key={item} className="list-disc pl-1">
                  <InlineText value={line.replace(/^[-*]\s+/, "")} />
                </li>
              ))}
            </ul>
          );
        if (lines.every((line) => /^\d+[.)]\s+/.test(line)))
          return (
            <ol key={index} className="space-y-1.5 pl-4">
              {lines.map((line, item) => (
                <li key={item} className="list-decimal pl-1">
                  <InlineText value={line.replace(/^\d+[.)]\s+/, "")} />
                </li>
              ))}
            </ol>
          );
        if (lines[0]?.startsWith("### "))
          return (
            <h3 key={index} className="pt-1 text-sm font-semibold">
              <InlineText value={lines.join(" ").slice(4)} />
            </h3>
          );
        if (lines[0]?.startsWith("## "))
          return (
            <h3 key={index} className="pt-1 text-base font-semibold tracking-[-0.02em]">
              <InlineText value={lines.join(" ").slice(3)} />
            </h3>
          );
        return (
          <p key={index}>
            <InlineText value={lines.join(" ")} />
          </p>
        );
      })}
    </div>
  );
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
      const response = await fetch("/api/admin/revenue-os/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: message.runId, rating: next }),
      });
      if (!response.ok) throw new Error("Could not record feedback");
      setRating(next);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[var(--admin-border)] pt-2">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(message.content);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
        className="admin-icon-button"
        aria-label="Copy answer"
        title="Copy answer"
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("admin:add-note", {
              detail: { initialNote: message.content, captureSource: "ai_answer" },
            }),
          )
        }
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,transform] hover:text-[var(--admin-ink)] active:scale-[0.96]"
        aria-label="Save answer as founder note"
      >
        <NotebookPen className="size-3.5" />
        Save note
      </button>
      <Link
        href={`/admin/ai?view=runs&run=${encodeURIComponent(message.runId)}`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] transition-[color,transform] hover:text-[var(--admin-ink)] active:scale-[0.96]"
        aria-label="Inspect this AI run"
      >
        <ExternalLink className="size-3.5" />
        Inspect run
      </Link>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="admin-icon-button"
          aria-label="Retry this command"
          title="Retry command"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
      <span className="mx-1 h-4 w-px bg-[var(--admin-border)]" />
      <button
        type="button"
        disabled={busy || Boolean(rating)}
        onClick={() => void rate("helpful")}
        className={cn(
          "admin-icon-button",
          rating === "helpful" && "bg-emerald-500/10 text-emerald-700",
        )}
        aria-label="Mark answer helpful"
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        disabled={busy || Boolean(rating)}
        onClick={() => void rate("not_helpful")}
        className={cn(
          "admin-icon-button",
          rating === "not_helpful" && "bg-rose-500/10 text-rose-700",
        )}
        aria-label="Mark answer not helpful"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ThumbsDown className="size-3.5" />}
      </button>
    </div>
  );
}

export function AdminAIChat({ mode = "page" }: { mode?: "page" | "panel" }) {
  const ai = useAdminAI();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const followingRef = useRef(true);
  const scrollSizeRef = useRef({ viewport: 0, content: 0 });
  const lastUserRef = useRef<string | undefined>(undefined);
  const latestUserId = ai.messages.filter((message) => message.role === "user").at(-1)?.id;
  const readingKey = `${ai.activeConversationId ?? "new"}:${latestUserId ?? "empty"}`;
  const [readingPosition, setReadingPosition] = useState({ key: readingKey, away: false });
  const awayFromLatest = readingPosition.key === readingKey && readingPosition.away;

  useEffect(() => {
    followingRef.current = true;
  }, [ai.activeConversationId, ai.loadingHistory]);

  useEffect(() => {
    if (latestUserId !== lastUserRef.current) {
      lastUserRef.current = latestUserId;
      followingRef.current = true;
    }
    if (followingRef.current && scrollRef.current) {
      const scroll = scrollRef.current;
      scroll.scrollTop = scroll.scrollHeight;
      scrollSizeRef.current = { viewport: scroll.clientHeight, content: scroll.scrollHeight };
    }
  }, [
    ai.messages,
    ai.tools,
    ai.running,
    ai.proposals,
    ai.workProgress,
    ai.loadingHistory,
    latestUserId,
  ]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (!scroll || !content) return;
    const observer = new ResizeObserver(() => {
      if (followingRef.current) scroll.scrollTop = scroll.scrollHeight;
      scrollSizeRef.current = { viewport: scroll.clientHeight, content: scroll.scrollHeight };
    });
    observer.observe(scroll);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    const conversation = scrollRef.current;
    const conversationTop = conversation?.scrollTop ?? 0;
    const previousScroll = composer.scrollTop;
    composer.style.height = "0px";
    composer.style.height = `${Math.min(composer.scrollHeight, 128)}px`;
    composer.scrollTop =
      composer.selectionStart === ai.draft.length ? composer.scrollHeight : previousScroll;
    // Measuring the input temporarily enlarges the conversation viewport.
    // Restore its position after sizing, including when the final height is unchanged.
    if (conversation) {
      conversation.scrollTop = followingRef.current ? conversation.scrollHeight : conversationTop;
      scrollSizeRef.current = {
        viewport: conversation.clientHeight,
        content: conversation.scrollHeight,
      };
    }
  }, [ai.draft]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ai.send();
  };

  const conversationList = (
    <aside
      className={cn(
        "border-[var(--admin-border)]",
        mode === "page" ? "border-r pr-4" : "border-b px-3 pb-3",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="admin-eyebrow">
          {ai.purpose === "architect" ? "Architect sessions" : "Conversations"}
        </p>
        <button
          type="button"
          onClick={ai.startNew}
          className="admin-icon-button"
          aria-label="New AI conversation"
          title="New conversation"
        >
          <MessageSquarePlus className="size-4" />
        </button>
      </div>
      {mode === "panel" ? (
        <select
          value={ai.activeConversationId ?? ""}
          onChange={(event) => void ai.selectConversation(event.target.value || null)}
          aria-label="AI conversation"
          className="admin-field mt-2 min-h-10 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
        >
          <option value="">New conversation</option>
          {ai.conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversation.title}
            </option>
          ))}
        </select>
      ) : (
        <div className="mt-3 space-y-1">
          <button
            type="button"
            onClick={ai.startNew}
            className={cn(
              "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold",
              !ai.activeConversationId
                ? "bg-[var(--admin-ink)] text-[var(--admin-surface)]"
                : "text-[var(--admin-muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
            )}
          >
            <MessageSquarePlus className="size-3.5" />
            New conversation
          </button>
          {ai.conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => void ai.selectConversation(conversation.id)}
              className={cn(
                "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-xs",
                ai.activeConversationId === conversation.id
                  ? "bg-black/[0.06] font-semibold text-[var(--admin-ink)] dark:bg-white/[0.07]"
                  : "text-[var(--admin-muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
              )}
            >
              <span className="truncate">{conversation.title}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );

  const mobileConversationBar =
    mode === "page" ? (
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] p-3 md:hidden">
        <label className="min-w-0 flex-1">
          <span className="sr-only">AI conversation</span>
          <select
            value={ai.activeConversationId ?? ""}
            onChange={(event) => void ai.selectConversation(event.target.value || null)}
            className="admin-field min-h-11 w-full rounded-xl bg-[var(--admin-surface)] px-3 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]"
          >
            <option value="">New conversation</option>
            {ai.conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={ai.startNew}
          className="admin-icon-button !size-11"
          aria-label="New AI conversation"
        >
          <MessageSquarePlus className="size-4" />
        </button>
      </div>
    ) : null;

  const chat = (
    <section className="flex min-h-0 flex-1 flex-col">
      {ai.schemaReady === false && (
        <div className="m-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <CircleAlert className="mr-2 inline size-4" />
          AI history is not ready. Apply the AI command runtime migration from Setup before using
          this workspace.
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5 text-[11px] text-[var(--admin-muted)]">
        {ai.purpose === "architect" ? (
          <NotebookPen className="size-3.5" />
        ) : (
          <Bot className="size-3.5" />
        )}
        {ai.purpose === "architect" ? (
          <>
            <span>Architect session</span>
            <span aria-hidden="true">·</span>
            <span>Sources are evidence</span>
            <span aria-hidden="true">·</span>
            <span>Never executed as instructions</span>
          </>
        ) : (
          <>
            <span>Live records</span>
            <span aria-hidden="true">·</span>
            <span>Visible evidence</span>
            <span aria-hidden="true">·</span>
            <span>Changes staged for approval</span>
          </>
        )}
      </div>
      {ai.purpose === "architect" && <ArchitectEvidencePanel />}
      {ai.purpose === "architect" && <ArchitectUnderstandingPanel />}
      {mobileConversationBar}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          tabIndex={0}
          onScroll={(event) => {
            const scroll = event.currentTarget;
            // A resize can dispatch scroll before ResizeObserver. Keep following
            // through layout changes without treating them as a reader scrolling up.
            if (
              followingRef.current &&
              (scroll.clientHeight !== scrollSizeRef.current.viewport ||
                scroll.scrollHeight !== scrollSizeRef.current.content)
            )
              scroll.scrollTop = scroll.scrollHeight;
            scrollSizeRef.current = { viewport: scroll.clientHeight, content: scroll.scrollHeight };
            const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 48;
            followingRef.current = nearBottom;
            setReadingPosition((current) =>
              current.key === readingKey && current.away === !nearBottom
                ? current
                : { key: readingKey, away: !nearBottom },
            );
          }}
          style={{ overflowAnchor: "none" }}
          className={cn(
            "flex-1 overflow-y-auto",
            mode === "page" ? "min-h-0 px-3 py-4 sm:px-6" : "min-h-0 px-4 py-4",
          )}
          role="log"
          aria-label="AI conversation"
        >
          {ai.loadingHistory && (
            <div className="grid min-h-48 place-items-center text-xs text-[var(--admin-muted)]">
              <Loader2 className="mb-2 size-5 animate-spin" />
              Loading conversation
            </div>
          )}
          {!ai.loadingHistory && ai.messages.length === 0 && (
            <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center py-8 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--admin-ink)] text-[var(--admin-surface)]">
                {ai.purpose === "architect" ? (
                  <NotebookPen className="size-5" />
                ) : (
                  <Bot className="size-5" />
                )}
              </span>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.035em] text-[var(--admin-ink)]">
                {ai.purpose === "architect"
                  ? "Teach the workspace"
                  : "What would you like to work on?"}
              </h2>
              <p className="admin-copy mt-2 max-w-md text-sm">
                {ai.purpose === "architect"
                  ? "This session keeps chat, attachments and scoped sources together. Reloading restores the same evidence. Sources stay inspectable and are never run as instructions."
                  : "Choose a starting question or name a customer, record, or result you need."}
              </p>
              <div className="mt-5 grid w-full gap-2 sm:grid-cols-3">
                {(ai.purpose === "architect" ? architectStarters : starters).map((starter) => (
                  <button
                    key={starter.label}
                    type="button"
                    disabled={ai.schemaReady === false}
                    onClick={() => void ai.send(starter.prompt)}
                    className="min-h-12 rounded-xl px-3 py-2 text-left shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.96] disabled:opacity-40"
                  >
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--admin-muted)]">
                      {starter.label}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-[var(--admin-ink)]">
                      {starter.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={contentRef} className="space-y-5">
            {ai.messages.map((message, index) => {
              const isLatestAssistant =
                message.role === "assistant" &&
                !ai.messages.slice(index + 1).some((item) => item.role === "assistant");
              return (
                <article
                  key={message.id}
                  className={cn(
                    "text-sm leading-6",
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--admin-ink)] px-4 py-3 text-[var(--admin-surface)] shadow-[var(--admin-shadow-border)]"
                      : "max-w-3xl border-l-2 border-[var(--admin-border)] py-1 pl-4 text-[var(--admin-ink)]",
                  )}
                >
                  {message.role === "assistant" && !message.content && ai.running ? (
                    <span className="inline-flex items-center gap-2 text-xs text-[var(--admin-muted)]">
                      <Loader2 className="size-3.5 animate-spin" />
                      Reading live data
                    </span>
                  ) : message.role === "assistant" ? (
                    <StructuredAnswer value={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap text-pretty">{message.content}</p>
                  )}
                  {isLatestAssistant && (ai.tools.length > 0 || ai.model) && (
                    <div className="mt-3 rounded-xl bg-black/[0.025] p-3 shadow-[var(--admin-shadow-border)] dark:bg-white/[0.035]">
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted)]">
                        <Wrench className="size-3.5" />
                        {ai.running ? "Working" : "Run evidence"}
                        {ai.model && (
                          <span
                            className="ml-auto max-w-[55%] truncate normal-case tracking-normal"
                            title={ai.model}
                          >
                            {ai.pack || "core"} · {ai.model}
                          </span>
                        )}
                      </div>
                      <ol className="mt-2 space-y-1">
                        {ai.tools.map((tool) => (
                          <li
                            key={`${tool.index}-${tool.name}`}
                            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs"
                          >
                            <span className="mt-0.5 text-[var(--admin-muted)]">
                              {tool.status === "running" ? (
                                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                              ) : tool.status === "failed" ? (
                                <CircleAlert className="size-3 text-rose-600" aria-hidden="true" />
                              ) : (
                                <Check className="size-3 text-emerald-600" aria-hidden="true" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="font-semibold capitalize text-[var(--admin-ink)]">
                                {toolLabel(tool.name)}
                              </span>
                              {tool.summary && (
                                <span className="ml-2 text-[var(--admin-muted)]">
                                  {tool.summary}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {isLatestAssistant &&
                    ai.workProgress.map((work) => (
                      <section
                        key={work.workItemId}
                        className="mt-3 rounded-xl bg-[var(--admin-surface)] p-3 shadow-[var(--admin-shadow-border)]"
                        aria-label="Delegated work progress"
                      >
                        <h3 className="text-sm font-semibold">
                          {work.plan?.objective ?? "Your delegated work"}
                        </h3>
                        <p className="mt-1 text-xs text-[var(--admin-muted)]">
                          {work.status.replaceAll("_", " ")}
                          {work.plan?.control === "paused" ? " · paused" : ""}
                        </p>
                        {work.plan && (
                          <ol className="mt-2 space-y-2 text-xs">
                            {work.plan.steps.map((step, index) => (
                              <li key={index}>
                                <strong>
                                  {index + 1}. {step.title}
                                </strong>{" "}
                                · {step.status.replaceAll("_", " ")}
                                {step.receipt && (
                                  <p className="mt-1 whitespace-pre-wrap text-[var(--admin-muted)]">
                                    {step.receipt}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="admin-button"
                            onClick={() => void ai.readWorkProgress(work.workItemId)}
                          >
                            Read current progress
                          </button>
                          {work.plan &&
                            !["completed", "failed", "cancelled"].includes(work.status) && (
                              <>
                                <button
                                  type="button"
                                  className="admin-button"
                                  onClick={() =>
                                    void ai.controlWork(
                                      work.workItemId,
                                      work.plan!.control === "paused" ? "resume" : "pause",
                                      work.revision,
                                    )
                                  }
                                >
                                  {work.plan.control === "paused" ? "Resume" : "Pause"}
                                </button>
                                <button
                                  type="button"
                                  className="admin-button"
                                  onClick={() =>
                                    void ai.controlWork(work.workItemId, "cancel", work.revision)
                                  }
                                >
                                  Cancel future steps
                                </button>
                              </>
                            )}
                        </div>
                      </section>
                    ))}
                  {isLatestAssistant && ai.proposals.length > 0 && (
                    <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
                      <p className="text-xs font-semibold text-[var(--admin-ink)]">
                        {ai.proposals.length} change{ai.proposals.length === 1 ? "" : "s"} staged.
                        Review each exact change below.
                      </p>
                      <ul className="mt-2 space-y-1">
                        {ai.proposals.map((proposal) => (
                          <li
                            key={proposal.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[var(--admin-surface)] px-3 py-2 text-xs shadow-[var(--admin-shadow-border)]"
                          >
                            <button
                              type="button"
                              className="min-h-10 text-left font-semibold underline underline-offset-4"
                              onClick={() => {
                                // Exact-change review owns the reading position until the reader resumes.
                                followingRef.current = false;
                                void ai.reviewProposal(proposal.id);
                              }}
                            >
                              Review: {proposal.title}
                            </button>
                            <span className="text-[10px] uppercase tracking-[0.07em] text-[var(--admin-muted)]">
                              {proposal.impact.replace(/_/g, " ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <ActionReviewDialog
                        inline
                        open={Boolean(ai.reviewedAction)}
                        action={ai.reviewedAction}
                        busy={ai.reviewing}
                        error={ai.error}
                        onClose={() => void ai.reviewProposal(null)}
                        onApprove={() => void ai.decideProposal("approve")}
                        onReject={() => void ai.decideProposal("reject")}
                      />
                      {ai.reviewedAction && (
                        <p className="mt-2 text-xs text-[var(--admin-muted)]">
                          You can also type “approve” or “reject” for this exact proposal.
                        </p>
                      )}
                    </div>
                  )}
                  {message.role === "assistant" && message.content && (
                    <MessageActions
                      message={message}
                      onRetry={
                        !ai.running && ai.messages[index - 1]?.role === "user"
                          ? () => void ai.send(ai.messages[index - 1]!.content)
                          : undefined
                      }
                    />
                  )}
                </article>
              );
            })}
          </div>
        </div>
        {awayFromLatest && !ai.reviewedAction && (
          <button
            type="button"
            onClick={() => {
              followingRef.current = true;
              setReadingPosition({ key: readingKey, away: false });
              const scroll = scrollRef.current;
              if (scroll) {
                scroll.scrollTop = scroll.scrollHeight;
                scroll.focus({ preventScroll: true });
              }
            }}
            className="absolute bottom-3 left-1/2 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--admin-surface)] px-4 text-xs font-semibold text-[var(--admin-ink)] shadow-[var(--admin-shadow)] transition-[color,box-shadow] hover:text-[var(--admin-action)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-action)]"
          >
            <ArrowDown className="size-4" aria-hidden="true" />
            Jump to latest
          </button>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-[var(--admin-border)] p-3 sm:p-4">
        {ai.error && (
          <p className="mb-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {ai.error}
          </p>
        )}
        <div className="admin-composer">
          {ai.purpose === "architect" && (
            <label className="admin-icon-button !size-11 shrink-0 cursor-pointer">
              <span className="sr-only">Attach source as evidence</span>
              <Paperclip className="size-4" />
              <input
                type="file"
                multiple
                className="sr-only"
                disabled={ai.schemaReady === false}
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  event.currentTarget.value = "";
                  if (files.length) void ai.attachSources(files);
                }}
              />
            </label>
          )}
          <textarea
            ref={composerRef}
            aria-label={ai.purpose === "architect" ? "Teach the workspace" : "Ask the business"}
            value={ai.draft}
            onChange={(event) => ai.setDraft(event.target.value.slice(0, 8000))}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing &&
                event.nativeEvent.keyCode !== 229
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder={
              ai.purpose === "architect"
                ? "Describe the business, attach notes, or name a scoped source…"
                : "Ask about priorities, pipeline, conversations, or next actions…"
            }
            className="admin-composer-field max-h-32"
          />
          {ai.running ? (
            <button
              type="button"
              onClick={ai.stop}
              className="admin-composer-action !bg-rose-600 !text-white"
              aria-label="Stop AI run"
            >
              <Octagon className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!ai.draft.trim() || ai.schemaReady === false}
              className="admin-composer-action"
              aria-label="Send AI command"
            >
              <Send className="size-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--admin-muted)]">
          <span>Enter sends · Shift+Enter adds a line</span>
          {ai.activeConversationId && (
            <button
              type="button"
              onClick={() => void ai.archiveActive()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 hover:text-[var(--admin-ink)]"
            >
              <Archive className="size-3" />
              Archive
            </button>
          )}
        </div>
      </form>
    </section>
  );

  if (mode === "panel")
    return (
      <div className="flex h-full min-h-0 flex-col">
        {conversationList}
        {chat}
      </div>
    );
  return (
    <div className="grid h-[clamp(440px,calc(100dvh-19rem),720px)] min-h-0 overflow-hidden rounded-2xl bg-[var(--admin-surface)] shadow-[var(--admin-shadow)] md:grid-cols-[228px_minmax(0,1fr)]">
      <div className="hidden p-4 md:block">{conversationList}</div>
      {chat}
    </div>
  );
}
