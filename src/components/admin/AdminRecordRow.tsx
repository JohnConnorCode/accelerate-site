"use client";

import type { ReactNode } from "react";
import Link from "./AdminLink";
import { cn } from "@/lib/utils";

interface AdminRecordRowProps {
  label: string;
  href?: string;
  onOpen?: () => void;
  selected?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared list row contract: one primary opener, with independent secondary
 * controls kept outside that opener. Use links for navigation and buttons for
 * local detail panes.
 */
export function AdminRecordRow({
  label,
  href,
  onOpen,
  selected = false,
  children,
  actions,
  className,
}: AdminRecordRowProps) {
  const openerClass =
    "min-w-0 flex-1 rounded-[var(--admin-control-radius)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2";
  const opener = href ? (
    <Link href={href} aria-label={label} className={cn(openerClass, "block")}>
      {children}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={onOpen}
      className={openerClass}
    >
      {children}
    </button>
  );

  return (
    <div
      className={cn(
        "group flex min-h-16 items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 transition-[background-color,box-shadow] duration-150 hover:bg-[var(--admin-accent-soft)]",
        selected && "bg-[var(--admin-accent-soft)] shadow-[inset_3px_0_0_var(--admin-action)]",
        className,
      )}
      data-record-row
      data-selected={selected || undefined}
    >
      {opener}
      {actions && (
        <div className="flex shrink-0 items-center gap-1" data-row-actions>
          {actions}
        </div>
      )}
    </div>
  );
}
