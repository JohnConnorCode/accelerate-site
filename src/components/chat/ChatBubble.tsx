import { MessageCircle } from "lucide-react";

interface ChatBubbleProps {
  onClick: () => void;
}

export function ChatBubble({ onClick }: ChatBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="h-14 w-14 rounded-full bg-gold-gradient flex items-center justify-center shadow-lg hover:brightness-110 transition-all cursor-pointer animate-[float-bob_3s_ease-in-out_infinite]"
      aria-label="Open chat"
    >
      <MessageCircle className="h-6 w-6 text-black" />
    </button>
  );
}
