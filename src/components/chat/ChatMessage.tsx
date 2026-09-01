import { Fragment } from "react";
import { motion } from "framer-motion";
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
          className="font-medium underline underline-offset-2 decoration-[color-mix(in_srgb,var(--fg)_40%,transparent)] hover:decoration-[var(--fg)]"
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
    <motion.div
      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
      data-chat-role={message.role}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[86%] whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-[var(--fg)] font-medium text-[var(--bg)]"
            : "border border-[color-mix(in_srgb,var(--fg)_14%,transparent)] text-white-secondary",
        )}
      >
        {isUser ? message.content : linkify(message.content)}
      </div>
    </motion.div>
  );
}
