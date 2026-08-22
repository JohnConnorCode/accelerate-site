"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // SSR hydration guard for next-themes — must flip to mounted on client
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9 min-w-[44px] min-h-[44px]" />;
  }

  const isLight = theme === "light";

  return (
    <button
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="relative w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-border-glass hover:border-[var(--border-glass-hover)] bg-[var(--glass-default-bg)] hover:bg-[var(--glass-default-hover)] active:bg-[var(--glass-default-hover)] active:scale-[0.96] transition-[transform,background-color,border-color] duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)]"
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isLight ? "moon" : "sun"}
          initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isLight ? (
            <Moon className="h-4 w-4 text-white-primary" />
          ) : (
            <Sun className="h-4 w-4 text-[var(--fg)]" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
