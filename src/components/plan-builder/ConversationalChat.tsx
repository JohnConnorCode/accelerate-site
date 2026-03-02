"use client";

import { useEffect, useRef, useCallback } from "react";
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

  const inputRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);

  // Start conversation on mount
  useEffect(() => {
    startConversation();
  }, [startConversation]);

  // Track user interaction
  useEffect(() => {
    if (messages.some((m) => m.role === "user")) {
      hasInteracted.current = true;
    }
  }, [messages]);

  // Smart scroll: keep the input panel visible without jumping past content
  const scrollToInput = useCallback(() => {
    if (!hasInteracted.current) return;
    // Small delay to let the DOM update after new messages render
    requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  useEffect(() => {
    scrollToInput();
  }, [messages, isTyping, scrollToInput]);

  // Generating / Results phases
  if (phase === "generating") {
    const noop = () => {};
    return (
      <div className="max-w-3xl mx-auto">
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
      <div className="max-w-3xl mx-auto">
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
    <div className="max-w-3xl mx-auto flex flex-col">
      {/* Messages */}
      <div className="flex flex-col gap-4 pb-4">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </AnimatePresence>

        {isTyping && <TypingIndicator />}
      </div>

      {/* Input panel */}
      <div ref={inputRef}>
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
    </div>
  );
}
