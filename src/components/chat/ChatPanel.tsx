"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { X, Send, Loader2, CalendarDays, ArrowRight, RotateCcw, Square, WifiOff } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatLeadCapture } from "./ChatLeadCapture";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { trackConversion } from "@/lib/analytics";
import { getUTMParams, clearUTMParams } from "@/lib/utm";
import { BOOKING_PATH } from "@/lib/booking";
import { ERROR_REPLY } from "@/lib/chat/fallbacks";
import { homeFaqs } from "@/content/home-faq";

// A handful of quick-reply prompts so a visitor who doesn't know what to
// ask gets a real, specific, already-vetted answer instantly instead of
// having to type — and so the chat still feels genuinely useful while the
// live model is unconfigured (demo mode). Reuses the same FAQ copy already
// approved for the homepage rather than writing new answers to keep in
// sync by hand.
const PAGE_QUESTIONS: { matches: (pathname: string) => boolean; questions: string[] }[] = [
  {
    matches: (pathname) => pathname.startsWith("/command-center"),
    questions: ["Is our data safe?", "Who owns what you build?", "How soon would we see a result?"],
  },
  {
    matches: (pathname) => pathname.startsWith("/services") || pathname.startsWith("/industries"),
    questions: ["What does this cost?", "How soon would we see a result?", "Nobody here is technical. Is that a problem?"],
  },
  {
    matches: () => true,
    questions: ["What does this cost?", "How soon would we see a result?", "Is our data safe?"],
  },
];

interface ChatPanelProps {
  onClose: () => void;
}

const STORAGE_KEY = "accelerate-chat-v1";
const STORAGE_CAP = 50;

const WELCOME_MESSAGE: ChatMessageType = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey, this is John's team at Accelerate. We build and run custom AI systems for small businesses so nothing slips through and more jobs get booked, from first inquiry to repeat client. What are you trying to grow?",
  timestamp: Date.now(),
};

interface StoredChatState {
  messages: ChatMessageType[];
  messageCount: number;
  leadCaptured: boolean;
  leadCaptureDismissed: boolean;
}

function loadStoredState(): StoredChatState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.messages)) return null;
    return {
      messages: parsed.messages.slice(-STORAGE_CAP),
      messageCount: typeof parsed.messageCount === "number" ? parsed.messageCount : 0,
      leadCaptured: !!parsed.leadCaptured,
      leadCaptureDismissed: !!parsed.leadCaptureDismissed,
    };
  } catch {
    return null;
  }
}

function persistState(state: StoredChatState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: state.messages.slice(-STORAGE_CAP),
        messageCount: state.messageCount,
        leadCaptured: state.leadCaptured,
        leadCaptureDismissed: state.leadCaptureDismissed,
      }),
    );
  } catch {
    // Storage full / disabled — non-critical.
  }
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const pathname = usePathname();
  const quickQuestions = useMemo(() => {
    const selected = PAGE_QUESTIONS.find((group) => group.matches(pathname)) ?? PAGE_QUESTIONS[PAGE_QUESTIONS.length - 1];
    return homeFaqs.filter((faq) => selected?.questions.includes(faq.question));
  }, [pathname]);
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadCaptureDismissed, setLeadCaptureDismissed] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const quickReplyTimerRef = useRef<number | null>(null);

  // Hydrate from sessionStorage on mount (client-only).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = loadStoredState();
    if (stored && stored.messages.length > 0) {
      setMessages(stored.messages);
      setMessageCount(stored.messageCount);
      setLeadCaptured(stored.leadCaptured);
      setLeadCaptureDismissed(stored.leadCaptureDismissed);
    }
  }, []);

  // Persist on every change (after hydration).
  useEffect(() => {
    if (!hydratedRef.current) return;
    persistState({ messages, messageCount, leadCaptured, leadCaptureDismissed });
  }, [messages, messageCount, leadCaptured, leadCaptureDismissed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const syncOnlineState = () => setIsOnline(window.navigator.onLine);
    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  useEffect(() => () => {
    requestControllerRef.current?.abort();
    if (quickReplyTimerRef.current) window.clearTimeout(quickReplyTimerRef.current);
  }, []);

  const requestReply = async (prompt: string, conversation: ChatMessageType[]) => {
    if (!isOnline || isLoading || isTyping) return;

    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    setIsLoading(true);
    setLastFailedPrompt(null);

    let assistantId: string | null = null;
    let assistantContent = "";

    try {
      const context = conversation
        .filter((message) => !message.id.startsWith("error-") && !message.id.startsWith("rate-"))
        .slice(-20)
        .map((message) => ({ role: message.role, content: message.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: context }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const body = await res.text();
        setMessages((prev) => [
          ...prev,
          {
            id: `rate-${Date.now()}`,
            role: "assistant",
            content: body || "You're sending messages too fast. Give it a few seconds.",
            timestamp: Date.now(),
          },
        ]);
        setLastFailedPrompt(prompt);
        return;
      }

      if (!res.ok) throw new Error(`Chat request failed (${res.status})`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      assistantId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId!,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        const content = assistantContent;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId ? { ...message, content } : message,
          ),
        );
      }

      assistantContent += decoder.decode();
      if (!assistantContent.trim()) throw new Error("Empty response stream");
    } catch (err) {
      if (controller.signal.aborted) {
        if (assistantId && !assistantContent.trim()) {
          setMessages((prev) => prev.filter((message) => message.id !== assistantId));
        }
        return;
      }

      console.error("[chat-panel] send error:", err);
      setLastFailedPrompt(prompt);
      setMessages((prev) => {
        if (assistantId && !assistantContent.trim()) {
          return prev.map((message) =>
            message.id === assistantId
              ? { ...message, id: `error-${Date.now()}`, content: ERROR_REPLY }
              : message,
          );
        }
        return [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: ERROR_REPLY,
            timestamp: Date.now(),
          },
        ];
      });
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading || isTyping || !isOnline) return;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setInput("");

    const newCount = messageCount + 1;
    setMessageCount(newCount);
    if (newCount >= 3 && !leadCaptured && !leadCaptureDismissed) setShowLeadCapture(true);

    await requestReply(content, conversation);
  };

  const handleRetry = () => {
    if (!lastFailedPrompt) return;
    void requestReply(lastFailedPrompt, messages);
  };

  const handleStop = () => requestControllerRef.current?.abort();

  // Quick-reply prompts skip the network entirely — the answer is already
  // known and vetted, so there's nothing to call the model for. A short
  // typing pause keeps it from feeling like a static FAQ accordion instead
  // of a conversation.
  const handleQuickQuestion = (faq: { question: string; answer: string }) => {
    if (isLoading || isTyping) return;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: faq.question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);
    setLastFailedPrompt(null);

    const newCount = messageCount + 1;
    setMessageCount(newCount);
    if (newCount >= 3 && !leadCaptured && !leadCaptureDismissed) {
      setShowLeadCapture(true);
    }

    quickReplyTimerRef.current = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: faq.answer,
          timestamp: Date.now(),
        },
      ]);
      setIsTyping(false);
      quickReplyTimerRef.current = null;
    }, 550);
  };

  const handleLeadSubmit = async (name: string, email: string): Promise<boolean> => {
    const utm = getUTMParams();
    try {
      const res = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          conversation: messages,
          utm,
        }),
      });
      if (!res.ok) throw new Error(`Lead save failed (${res.status})`);
    } catch (err) {
      console.error("[chat-panel] lead save error:", err);
      return false;
    }

    trackConversion("Chat Lead Captured");
    clearUTMParams();
    setLeadCaptured(true);
    setShowLeadCapture(false);

    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        role: "assistant",
        content: `Thanks, ${name}! I sent your note over to John, and he'll reply at ${email} within a business day. If you'd rather not wait, grab a time on his calendar with the link below: 30 minutes, free, no catch. Keep asking questions in the meantime.`,
        timestamp: Date.now(),
      },
    ]);
    return true;
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-glass bg-bg-subtle px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <h3 className="text-sm font-display font-semibold text-white-primary">
            Accelerate AI
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white-muted" aria-live="polite">
            {!isOnline ? (
              <><WifiOff className="h-3 w-3" /> Offline. Reconnect to send</>
            ) : isLoading || isTyping ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-[var(--fg)] animate-pulse" /> Drafting a response…</>
            ) : (
              <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready when you are</>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-white-muted transition-colors hover:bg-white/5 hover:text-white-primary active:scale-[0.96] cursor-pointer"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-label="Chat messages" aria-live="polite">
        {messages.map((msg) => msg.content ? <ChatMessage key={msg.id} message={msg} /> : null)}
        {/* Quick-reply prompts — only while the conversation is still just
            the welcome message, so a visitor who doesn't know what to type
            has somewhere to start. Disappears the moment any message (typed
            or a quick reply) actually goes out. */}
        {messages.length === 1 && (
          <div className="pt-1">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white-muted">Good places to start</p>
            <div className="flex flex-wrap gap-2">
            {quickQuestions.map((faq) => (
              <button
                key={faq.question}
                type="button"
                onClick={() => handleQuickQuestion(faq)}
                className="min-h-10 border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-bg-subtle px-3 py-2 text-left text-xs leading-4 text-white-secondary transition-[border-color,color,background-color,transform] hover:border-[var(--fg)] hover:text-white-primary active:scale-[0.96] cursor-pointer"
              >
                {faq.question}
              </button>
            ))}
            </div>
          </div>
        )}
        {(isTyping || (isLoading && (!messages[messages.length - 1] || messages[messages.length - 1]?.role !== "assistant" || !messages[messages.length - 1]?.content))) && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-2.5 bg-bg-subtle border border-border-glass">
              <Loader2 className="h-4 w-4 animate-spin text-white-muted" />
              <span className="text-xs text-white-muted">Thinking through that</span>
            </div>
          </div>
        )}
        {lastFailedPrompt && !isLoading && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex min-h-10 items-center gap-2 border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] bg-bg-subtle px-3 py-2 text-xs font-medium text-white-secondary transition-[border-color,color,background-color,transform] hover:border-[var(--fg)] hover:text-white-primary active:scale-[0.96]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry that response
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Lead Capture */}
      {showLeadCapture && !leadCaptured && (
        <ChatLeadCapture
          onSubmit={handleLeadSubmit}
          onDismiss={() => {
            setLeadCaptureDismissed(true);
            setShowLeadCapture(false);
          }}
        />
      )}

      {/* The offer, always one click away. The bot points at the same page in
          conversation, but a visitor who never types a word can still get to
          the calendar from here. */}
      <a
        href={BOOKING_PATH}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor="link"
        onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "chat" })}
        className="group flex min-h-11 items-center justify-center gap-2 border-t border-border-glass bg-bg-subtle px-4 py-2.5 text-xs transition-colors hover:bg-bg-elevated"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--fg)]" strokeWidth={1.75} />
        <span className="font-medium text-white-primary">Book a free 30-minute strategy session</span>
        <ArrowRight className="h-3 w-3 shrink-0 text-white-muted transition-transform group-hover:translate-x-0.5" />
      </a>

      {/* Input */}
      <div className="border-t border-border-glass bg-bg-subtle p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            rows={1}
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={isOnline ? "Ask about your business…" : "Reconnect to keep chatting"}
            aria-label="Chat message"
            className="min-h-10 max-h-24 flex-1 resize-none rounded-lg bg-bg-base border border-border-glass px-3 py-2.5 text-sm leading-5 text-white-primary placeholder:text-white-muted focus:outline-none focus:border-[var(--fg)] transition-colors"
            disabled={isLoading || isTyping || !isOnline}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-glass bg-bg-elevated text-white-secondary transition-[background-color,color,transform] hover:bg-white/5 hover:text-white-primary active:scale-[0.96]"
              aria-label="Stop response"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isTyping || !isOnline || !input.trim()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--fg)] text-[var(--bg)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
        <p className="mt-1.5 px-0.5 text-[10px] text-white-muted">Enter to send · Shift + Enter for a new line</p>
      </div>
    </div>
  );
}
