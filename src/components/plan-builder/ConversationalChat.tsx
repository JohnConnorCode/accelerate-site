"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useConversation } from "./useConversation";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { InputPanel } from "./InputPanel";
import { GeneratingStep } from "@/components/solution-generator/steps/GeneratingStep";
import { ResultsStep } from "@/components/solution-generator/steps/ResultsStep";

export function ConversationalChat() {
  const {
    messages,
    formData,
    phase,
    isTyping,
    plan,
    shareToken,
    error,
    smartDefaults,
    lastAssistantMessage,
    isLastAnswered,
    startConversation,
    answerQuestion,
    submitPlan,
  } = useConversation();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);

  // Start conversation on mount
  useEffect(() => {
    startConversation();
  }, [startConversation]);

  // Track user interaction — only auto-scroll after user has answered something
  useEffect(() => {
    if (messages.some((m) => m.role === "user")) {
      hasInteracted.current = true;
    }
  }, [messages]);

  // Auto-scroll to bottom only after user has interacted
  useEffect(() => {
    if (!hasInteracted.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, phase]);

  // Generating / Results phases
  if (phase === "generating") {
    const noop = () => {};
    return (
      <div className="max-w-2xl mx-auto">
        <GeneratingStep
          formData={formData}
          onUpdate={noop}
          onNext={noop}
          onBack={noop}
          error={error}
        />
      </div>
    );
  }

  if (phase === "results") {
    const noop = () => {};
    return (
      <div className="max-w-2xl mx-auto">
        <ResultsStep
          formData={formData}
          onUpdate={noop}
          onNext={noop}
          onBack={noop}
          plan={plan}
          shareToken={shareToken}
        />
      </div>
    );
  }

  // Chat phase
  const showInput = lastAssistantMessage && !isLastAnswered && !isTyping;

  return (
    <div className="max-w-2xl mx-auto flex flex-col">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-col gap-4 pb-4"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {isTyping && <TypingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Input panel */}
      {showInput && lastAssistantMessage && (
        <div className="pt-2 pb-4">
          <InputPanel
            message={lastAssistantMessage}
            formData={formData}
            smartDefaults={smartDefaults}
            onAnswer={answerQuestion}
            onSubmit={submitPlan}
          />
        </div>
      )}
    </div>
  );
}
