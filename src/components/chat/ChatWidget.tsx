"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChatBubble } from "./ChatBubble";
import { ChatPanel } from "./ChatPanel";

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

  // Hide on admin pages
  if (pathname.startsWith("/admin")) return null;

  return (
    <div className="chat-widget-root fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[80] transition-[bottom] duration-300">
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[-1] bg-black/5 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="relative">
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(12px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 15, scale: 0.98, filter: "blur(8px)" }}
              transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
              className="absolute bottom-0 right-0 origin-bottom-right"
            >
              <ChatPanel onClose={() => setIsOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isOpen && hasScrolled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-0 right-0 origin-bottom-right"
            >
              <ChatBubble onClick={() => setIsOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
