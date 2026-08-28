"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const STORAGE_KEY = "accelerate:admin-demo:launcher-theme:v1";

export function DemoLauncherThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const next = saved === "dark" || saved === "light"
      ? saved
      : theme === "dark"
        ? "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(next);
    // next-themes resolves browser storage only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, [setTheme, theme]);

  if (!mounted) return <span className="size-11 shrink-0" aria-hidden="true" />;
  const dark = theme === "dark";
  const next = dark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        window.localStorage.setItem(STORAGE_KEY, next);
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
