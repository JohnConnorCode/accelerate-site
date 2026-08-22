"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChatBubble } from "./ChatBubble";
import { ChatPanel } from "./ChatPanel";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  // Hidden until the visitor has actually scrolled — a floating bubble
  // sitting over the hero the instant the page loads, before anyone's
  // had a chance to read anything, reads as intrusive rather than
  // helpful. Once shown, stays shown for the rest of the session (no
  // toggling back off if they scroll back up).
  const [hasScrolled, setHasScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 120) setHasScrolled(true);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Hide on admin pages
  if (pathname.startsWith("/admin") || pathname.startsWith("/roofing")) return null;

  return (
    <div
      className={cn(
        "chat-widget-root fixed z-[80] transition-[bottom,right] duration-300",
        isOpen && "is-open"
      )}
    >
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="fixed inset-0 z-[-1] hidden bg-black/5 backdrop-blur-md sm:block"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className={cn("relative", isOpen && "h-full w-full sm:h-auto sm:w-auto")}>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full origin-bottom-right sm:h-auto sm:w-auto"
            >
              <ChatPanel onClose={() => setIsOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isOpen && hasScrolled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.86 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="origin-bottom-right"
            >
              <ChatBubble onClick={() => setIsOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
