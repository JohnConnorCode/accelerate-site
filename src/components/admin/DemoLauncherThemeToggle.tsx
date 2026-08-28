"use client";

import { useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { DEMO_LAUNCHER_THEME_KEY, type DemoLauncherTheme } from "@/lib/admin/demo/launcher-theme";

export function DemoLauncherThemeToggle() {
  const [theme, setTheme] = useState<DemoLauncherTheme>("light");
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    let active = true;
    const saved = window.localStorage.getItem(DEMO_LAUNCHER_THEME_KEY);
    const next: DemoLauncherTheme = saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.demoLauncherTheme = next;
    queueMicrotask(() => {
      if (!active) return;
      setTheme(next);
      setMounted(true);
    });
    return () => { active = false; delete document.documentElement.dataset.demoLauncherTheme; };
  }, []);

  if (!mounted) return <span className="size-11 shrink-0" aria-hidden="true" />;
  const dark = theme === "dark";
  const next = dark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        window.localStorage.setItem(DEMO_LAUNCHER_THEME_KEY, next);
        document.documentElement.dataset.demoLauncherTheme = next;
        setTheme(next);
      }}
      className="demo-launcher-theme-toggle relative grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--demo-launcher-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--demo-launcher-canvas)] active:scale-[0.96]"
      aria-label={`Switch demo selection to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          className="absolute inset-0 grid place-items-center"
          initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
