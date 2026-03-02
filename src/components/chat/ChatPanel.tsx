"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatLeadCapture } from "./ChatLeadCapture";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I am the Accelerate AI assistant. I can help you learn about our AI solutions for small businesses. What can I help you with?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Show lead capture after 3 user messages
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

      if (!res.ok) throw new Error("Chat request failed");

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
              : m
          )
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I had trouble responding. Please try again or contact us directly at john@acceleratewith.us.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadSubmit = async (name: string, email: string) => {
    setLeadCaptured(true);
    setShowLeadCapture(false);

    // Save lead
    try {
      await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          conversation: messages,
        }),
      });
    } catch {
      // Non-critical
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        role: "assistant",
        content: `Thanks, ${name}! We will follow up at ${email} with personalized recommendations. In the meantime, feel free to keep asking questions.`,
        timestamp: Date.now(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[500px] w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] glass-prominent rounded-2xl overflow-clip border border-border-glass">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-glass">
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
            <div className="glass rounded-2xl rounded-bl-md px-4 py-2.5">
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
      <div className="border-t border-border-glass p-3">
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
            className="flex-1 rounded-lg bg-bg-subtle border border-border-glass px-3 py-2 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-gold"
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
