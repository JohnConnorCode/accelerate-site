"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/lib/types";

interface ChatMessageProps {
  message: ConversationMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 max-w-[85%]",
        isAssistant ? "self-start" : "self-end flex-row-reverse"
      )}
    >
      {/* Avatar */}
      {isAssistant && (
        <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center shrink-0 mt-1">
          <span className="text-xs font-bold text-black">A</span>
        </div>
      )}

      {/* Bubble */}
      <div
        className={cn(
          "px-4 py-3 text-sm leading-relaxed rounded-2xl",
          isAssistant
            ? "glass-prominent rounded-tl-sm text-white-primary"
            : "bg-gold-gradient rounded-tr-sm text-black font-medium"
        )}
      >
        {message.content}
      </div>
    </motion.div>
  );
}
