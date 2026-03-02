"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9 min-w-[44px] min-h-[44px]" />;
  }

  const isLight = theme === "light";

  return (
    <button
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="relative w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-[var(--border-glass)] hover:border-[var(--border-glass-hover)] bg-[var(--glass-default-bg)] hover:bg-[var(--glass-default-hover)] transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)]"
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
    >
      {isLight ? (
        <Moon className="w-4 h-4 text-[var(--white-primary)]" />
      ) : (
        <Sun className="w-4 h-4 text-[var(--gold-base)]" />
      )}
    </button>
  );
}
