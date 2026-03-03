"use client";

import { cn } from "@/lib/utils";

type DividerVariant = "line" | "glow" | "fade" | "none";

interface SectionDividerProps {
  variant?: DividerVariant;
  className?: string;
}

export function SectionDivider({
  variant = "line",
  className,
}: SectionDividerProps) {
  if (variant === "none") return null;

  if (variant === "fade") {
    return (
      <div
        className={cn("h-10 pointer-events-none", className)}
        style={{
          background:
            "linear-gradient(to bottom, var(--bg-base), transparent 40%, transparent 60%, var(--bg-base))",
        }}
        aria-hidden="true"
      />
    );
  }

  if (variant === "glow") {
    return (
      <div
        className={cn("section-divider-glow", className)}
        aria-hidden="true"
      />
    );
  }

  // Default: "line"
  return (
    <div
      className={cn("section-divider", className)}
      aria-hidden="true"
    />
  );
}
