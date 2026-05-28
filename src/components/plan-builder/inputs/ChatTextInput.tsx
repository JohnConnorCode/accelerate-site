"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatTextInputProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  onSkip?: () => void;
  isOptional?: boolean;
}

export function ChatTextInput({
  placeholder = "Type your answer...",
  onSubmit,
  onSkip,
  isOptional = false,
}: ChatTextInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2"
    >
      <div className="flex-1 glass rounded-xl border border-border-glass focus-within:border-gold transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent px-4 py-3 text-sm text-white-primary placeholder:text-white-muted outline-none min-h-[44px]"
        />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0",
          value.trim()
            ? "bg-gold-gradient text-black shadow-[0_0_16px_rgba(var(--accent-rgb),0.3)]"
            : "glass border border-border-glass text-white-muted"
        )}
        aria-label="Send"
      >
        <Send className="w-4 h-4" />
      </button>
      {isOptional && onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="w-11 h-11 rounded-xl flex items-center justify-center glass border border-border-glass text-white-muted hover:text-white-primary transition-colors cursor-pointer shrink-0"
          aria-label="Skip"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
