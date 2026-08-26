interface ChatBubbleProps {
  onClick: () => void;
}

export function ChatBubble({ onClick }: ChatBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--fg)] text-[var(--bg)] shadow-[0_10px_28px_-12px_rgba(11,11,11,0.55)] transition-[transform,opacity] duration-200 hover:opacity-90 active:scale-[0.96] cursor-pointer"
      aria-label="Open chat"
    >
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden="true">
        <path
          d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H10l-4 3v-3.2A2.5 2.5 0 0 1 5 13.5v-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
    </button>
  );
}
