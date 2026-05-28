"use client";

import type { ReactNode } from "react";

/**
 * Shared console surface — the unifying visual language across the page (matches
 * the Hero ops feed + the Watch-it-work sequence): glass panel, window chrome
 * header, dot-grid content stage, soft accent glow, live status footer. Labelled
 * "built for you" (not a platform brand) to match the custom-solutions positioning.
 */
export function ConsoleChrome({
  children,
  status,
  label = "built for you",
  className,
  contentClassName,
}: {
  children: ReactNode;
  status?: ReactNode;
  label?: string;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={`glass-prominent relative overflow-hidden rounded-[1.75rem] ${className ?? ""}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 -z-10 h-56 w-56 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(var(--accent-rgb),0.18), transparent 70%)", filter: "blur(24px)" }}
      />
      {/* header chrome */}
      <div className="flex items-center justify-between border-b border-border-glass px-5 py-3.5">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--white-muted)_50%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[color-mix(in_srgb,var(--white-muted)_50%,transparent)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        </span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white-muted">{label}</span>
        <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Live
        </span>
      </div>
      {/* content stage */}
      <div className={`dot-grid relative ${contentClassName ?? "p-6"}`}>{children}</div>
      {/* footer status */}
      {status != null && (
        <div className="flex items-center gap-2 border-t border-border-glass px-5 py-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          <span className="truncate font-mono text-[0.65rem] uppercase tracking-[0.14em] text-white-muted">{status}</span>
        </div>
      )}
    </div>
  );
}
