import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

interface ChatMessageProps {
  message: ChatMessageType;
}

/* Bot replies are plain text, so a booking URL used to arrive as something the
   visitor had to select and paste. Now it renders as a real link.
   Deliberately narrow: only our own domain, the Calendly booking link and
   email addresses become anchors. Anything else stays inert text, so a
   jailbroken or confused model can never hand a visitor a live link to
   somewhere we didn't choose. */
const LINK_PATTERN =
  /((?:https?:\/\/)?(?:www\.)?(?:acceleratewith\.us|calendly\.com)(?:\/[^\s<>()]*)?|[\w.+-]+@[\w-]+\.[\w.-]+)/gi;

const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

function linkify(text: string) {
  const parts = text.split(LINK_PATTERN);

  return parts.map((part, i) => {
    // split() with a capture group alternates: text, match, text, match...
    if (i % 2 === 0 || !part) return <Fragment key={i}>{part}</Fragment>;

    const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const target = trailing ? part.slice(0, -trailing.length) : part;
    const isEmail = target.includes("@");
    const href = isEmail
      ? `mailto:${target}`
      : target.startsWith("http")
        ? target
        : `https://${target}`;

    return (
      <Fragment key={i}>
        <a
          href={href}
          target={isEmail ? undefined : "_blank"}
          rel={isEmail ? undefined : "noopener noreferrer"}
          data-cursor="link"
          className="font-medium text-gold underline decoration-gold/40 underline-offset-2 transition-colors hover:decoration-gold"
        >
          {target}
        </a>
        {trailing}
      </Fragment>
    );
  });
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
          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-gold-gradient rounded-br-md font-medium"
            : "bg-bg-subtle border border-border-glass text-white-secondary rounded-bl-md"
        )}
      >
        {isUser ? message.content : linkify(message.content)}
      </div>
    </div>
  );
}
