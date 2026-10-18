"use client";

import type { ReactNode } from "react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { cn } from "@/lib/utils";

export type ChartState = "ready" | "loading" | "empty" | "error";

export interface ChartFrameProps {
  title: string;
  eyebrow?: string;
  caption?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  state?: ChartState;
  emptyMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
  /** Chart viewport height in pixels. Defaults to 240. */
  height?: number;
  className?: string;
  children: ReactNode;
}

function StateMessage({
  tone,
  children,
}: {
  tone: "loading" | "empty" | "error";
  children: ReactNode;
}) {
  const role = tone === "error" ? "alert" : "status";
  return (
    <div
      role={role}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-2 rounded-[var(--admin-radius-surface)] border border-dashed px-6 text-center",
        tone === "error"
          ? "border-[var(--admin-danger)] text-[var(--admin-danger)]"
          : "border-[var(--admin-border)] text-[var(--admin-muted)]",
        tone === "loading" && "animate-pulse motion-reduce:animate-none",
      )}
    >
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}

/**
 * One chart shell: heading, context, actions, states and freshness.
 *
 * Use this instead of hand-rolling a card around a chart so every dashboard
 * surface shares the same anatomy and empty/error behaviour.
 */
export function ChartFrame({
  title,
  eyebrow,
  caption,
  actions,
  footer,
  state = "ready",
  emptyMessage = "No data for this period.",
  errorMessage = "This chart could not be loaded.",
  loadingMessage = "Loading chart…",
  height = 240,
  className,
  children,
}: ChartFrameProps) {
  return (
    <AdminSurface className={className} role="group" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="admin-eyebrow">{eyebrow}</p> : null}
          <h3 className="font-display text-sm font-semibold text-[var(--admin-ink)]">{title}</h3>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {caption ? <p className="admin-copy mt-1 text-xs">{caption}</p> : null}
      <div className="mt-4" style={{ height }}>
        {state === "ready" ? (
          children
        ) : state === "loading" ? (
          <StateMessage tone="loading">{loadingMessage}</StateMessage>
        ) : state === "error" ? (
          <StateMessage tone="error">{errorMessage}</StateMessage>
        ) : (
          <StateMessage tone="empty">{emptyMessage}</StateMessage>
        )}
      </div>
      {footer ? <div className="mt-3 text-xs text-[var(--admin-muted)]">{footer}</div> : null}
    </AdminSurface>
  );
}
