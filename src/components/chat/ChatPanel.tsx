"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, CalendarDays, ArrowRight } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatLeadCapture } from "./ChatLeadCapture";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { trackConversion } from "@/lib/analytics";
import { getUTMParams, clearUTMParams } from "@/lib/utm";
import { BOOKING_PATH, CONTACT_EMAIL } from "@/lib/booking";
import { ERROR_REPLY } from "@/lib/chat/fallbacks";
import { homeFaqs } from "@/content/home-faq";

// A handful of quick-reply prompts so a visitor who doesn't know what to
// ask gets a real, specific, already-vetted answer instantly instead of
// having to type — and so the chat still feels genuinely useful while the
// live model is unconfigured (demo mode). Reuses the same FAQ copy already
// approved for the homepage rather than writing new answers to keep in
// sync by hand.
const QUICK_QUESTION_TEXT = [
  "What does this cost?",
  "How soon would we see a result?",
  "Is our data safe?",
  "Who owns what you build?",
];
const QUICK_QUESTIONS = homeFaqs.filter((faq) => QUICK_QUESTION_TEXT.includes(faq.question));

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
      }),
    );
  } catch {
    // Storage full / disabled — non-critical.
  }
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  // Hydrate from sessionStorage on mount (client-only).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = loadStoredState();
    if (stored && stored.messages.length > 0) {
      setMessages(stored.messages);
      setMessageCount(stored.messageCount);
      setLeadCaptured(stored.leadCaptured);
    }
  }, []);

  // Persist on every change (after hydration).
  useEffect(() => {
    if (!hydratedRef.current) return;
    persistState({ messages, messageCount, leadCaptured });
  }, [messages, messageCount, leadCaptured]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isTyping) return;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    const newCount = messageCount + 1;
    setMessageCount(newCount);

    if (newCount >= 3 && !leadCaptured) {
      setShowLeadCapture(true);
    }

    try {
      const context = [...messages, userMessage]
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: context }),
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
        return;
      }

      if (!res.ok) throw new Error(`Chat request failed (${res.status})`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const assistantId = `assistant-${Date.now()}`;
      let assistantContent = "";

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: assistantContent }
              : m,
          ),
        );
      }
    } catch (err) {
      console.error("[chat-panel] send error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: ERROR_REPLY,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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

    const newCount = messageCount + 1;
    setMessageCount(newCount);
    if (newCount >= 3 && !leadCaptured) {
      setShowLeadCapture(true);
    }

    window.setTimeout(() => {
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
    }, 550);
  };

  const handleLeadSubmit = async (name: string, email: string) => {
    trackConversion("Chat Lead Captured");
    clearUTMParams();
    setLeadCaptured(true);
    setShowLeadCapture(false);

    let saved = true;
    try {
      const res = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          conversation: messages,
          utm: getUTMParams(),
        }),
      });
      if (!res.ok) saved = false;
    } catch (err) {
      console.error("[chat-panel] lead save error:", err);
      saved = false;
    }

    const ackContent = saved
      ? `Thanks, ${name}! I sent your note over to John, and he'll reply at ${email} within a business day. If you'd rather not wait, grab a time on his calendar with the link below: 30 minutes, free, no catch. Keep asking questions in the meantime.`
      : `Thanks, ${name}! I had trouble saving that on my end, so email John directly at ${CONTACT_EMAIL} and he'll pick it up from there. You can also book a time with the link below.`;

    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        role: "assistant",
        content: ackContent,
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[min(600px,calc(100dvh-2rem))] w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] rounded-2xl overflow-clip border border-border-glass bg-bg-elevated shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-glass bg-bg-subtle">
        <div>
          <h3 className="text-sm font-display font-semibold text-white-primary">
            Accelerate AI
          </h3>
          <p className="text-xs text-white-muted">Ask us anything</p>
        </div>
        <button
          onClick={onClose}
          className="text-white-muted hover:text-white-primary transition-colors cursor-pointer"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-label="Chat messages" aria-live="polite">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {/* Quick-reply prompts — only while the conversation is still just
            the welcome message, so a visitor who doesn't know what to type
            has somewhere to start. Disappears the moment any message (typed
            or a quick reply) actually goes out. */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_QUESTIONS.map((faq) => (
              <button
                key={faq.question}
                type="button"
                onClick={() => handleQuickQuestion(faq)}
                className="rounded-full border border-border-glass bg-bg-subtle px-3 py-1.5 text-xs text-white-secondary transition-colors hover:border-gold hover:text-white-primary cursor-pointer"
              >
                {faq.question}
              </button>
            ))}
          </div>
        )}
        {(isLoading || isTyping) && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-2.5 bg-bg-subtle border border-border-glass">
              <Loader2 className="h-4 w-4 animate-spin text-white-muted" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Lead Capture */}
      {showLeadCapture && !leadCaptured && (
        <ChatLeadCapture onSubmit={handleLeadSubmit} />
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
        className="group flex items-center justify-center gap-2 border-t border-border-glass bg-bg-subtle px-4 py-2.5 text-xs transition-colors hover:bg-bg-elevated"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={1.75} />
        <span className="font-medium text-white-primary">Book a free 30-minute strategy session</span>
        <span className="text-white-muted">· no catch</span>
        <ArrowRight className="h-3 w-3 shrink-0 text-white-muted transition-transform group-hover:translate-x-0.5" />
      </a>

      {/* Input */}
      <div className="border-t border-border-glass p-3 bg-bg-subtle">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            aria-label="Chat message"
            className="flex-1 rounded-lg bg-bg-base border border-border-glass px-3 py-2 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold transition-colors"
            disabled={isLoading || isTyping}
          />
          <button
            type="submit"
            disabled={isLoading || isTyping || !input.trim()}
            className="rounded-lg bg-gold-gradient p-2 hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
