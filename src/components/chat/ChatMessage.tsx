import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-gold-gradient text-black rounded-br-md font-medium"
            : "bg-[var(--bg-subtle)] border border-[var(--border-glass)] text-[var(--white-secondary)] rounded-bl-md"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
