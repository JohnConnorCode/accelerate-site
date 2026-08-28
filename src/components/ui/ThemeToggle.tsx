"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface ThemeToggleProps {
  /** The sidebar treatment uses the existing global theme preference but
   * visually belongs to the always-dark operator navigation. */
  variant?: "default" | "admin-sidebar";
  collapsed?: boolean;
}

export function ThemeToggle({ variant = "default", collapsed = false }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const adminSidebar = variant === "admin-sidebar";
  const isLight = resolvedTheme !== "dark";
  const nextLabel = `Switch to ${isLight ? "dark" : "light"} mode`;

  const sizeClass = adminSidebar
    ? collapsed
      ? "size-10 justify-center px-0"
      : "min-h-10 w-full justify-start gap-3 px-2.5"
    : "h-9 w-9 min-h-[44px] min-w-[44px] justify-center";
  const appearanceClass = adminSidebar
    ? "rounded-[10px] border border-transparent bg-transparent text-white/42 hover:bg-white/7 hover:text-white focus-visible:ring-white/60"
    : "rounded-lg border border-border-glass bg-[var(--glass-default-bg)] hover:border-[var(--border-glass-hover)] hover:bg-[var(--glass-default-hover)] active:bg-[var(--glass-default-hover)] focus-visible:ring-[var(--fg)]";

  // SSR hydration guard for next-themes — must flip to mounted on client
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={adminSidebar ? (collapsed ? "size-10" : "min-h-10 w-full") : "h-9 w-9 min-h-[44px] min-w-[44px]"} />;
  }

  return (
    <button
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={`relative inline-flex items-center ${sizeClass} ${appearanceClass} active:scale-[0.96] transition-[transform,background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2`}
      aria-label={nextLabel}
      title={collapsed ? nextLabel : undefined}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isLight ? "moon" : "sun"}
          initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          className={adminSidebar ? "flex size-4 shrink-0 items-center justify-center" : "absolute inset-0 flex items-center justify-center"}
        >
          {isLight ? (
            <Moon className={`h-4 w-4 ${adminSidebar ? "text-white/72" : "text-white-primary"}`} />
          ) : (
            <Sun className={`h-4 w-4 ${adminSidebar ? "text-amber-200" : "text-[var(--fg)]"}`} />
          )}
        </motion.span>
      </AnimatePresence>
      {adminSidebar && !collapsed && <span className="text-xs font-medium">{isLight ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
