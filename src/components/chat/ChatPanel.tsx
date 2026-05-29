"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatLeadCapture } from "./ChatLeadCapture";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { trackConversion } from "@/lib/analytics";
import { getUTMParams, clearUTMParams } from "@/lib/utm";

interface ChatPanelProps {
  onClose: () => void;
}

const STORAGE_KEY = "accelerate-chat-v1";
const STORAGE_CAP = 50;

const WELCOME_MESSAGE: ChatMessageType = {
  id: "welcome",
  role: "assistant",
  content:
    "Hey, this is John's team at Accelerate. We build and run custom AI systems for small businesses: every call answered, every follow-up sent, more jobs booked. What are you trying to grow?",
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
    if (!input.trim() || isLoading) return;

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
          content:
            "Sorry, I had trouble responding. Try again, or email john@acceleratewith.us.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
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
      ? `Thanks, ${name}! I sent your note over to John, and he'll reply at ${email} within a business day. Keep asking questions if you'd like.`
      : `Thanks, ${name}! I had trouble saving that on my end, but feel free to email John directly at john@acceleratewith.us so we don't lose track of you.`;

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
    <div className="flex flex-col h-[500px] w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] rounded-2xl overflow-clip border border-border-glass bg-bg-elevated shadow-2xl">
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
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
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
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-gold-gradient p-2 text-black hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
