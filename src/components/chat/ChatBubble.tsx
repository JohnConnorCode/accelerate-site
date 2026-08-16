import { MessageCircle } from "lucide-react";

interface ChatBubbleProps {
  onClick: () => void;
}

export function ChatBubble({ onClick }: ChatBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gold-gradient shadow-lg transition-[filter,transform,box-shadow] hover:brightness-110 hover:shadow-xl active:scale-[0.96] cursor-pointer"
      aria-label="Open chat"
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gold opacity-10 animate-ping" aria-hidden="true" />
      <MessageCircle className="h-6 w-6 text-[var(--bg)]" />
      <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)] bg-emerald-400" aria-hidden="true" />
    </button>
  );
}
