import Link from "@/components/admin/AdminLink";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message = "No data found",
  description,
  icon: Icon = Inbox,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const actionClass =
    "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]";
  return (
    <div
      className="flex flex-col items-center justify-center px-5 py-14 text-center sm:px-8"
      role="status"
    >
      <span
        className="grid size-11 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)] dark:bg-white/[0.06]"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-sm font-semibold text-[var(--admin-ink)]">{title || message}</p>
      {(description || title) && (
        <p className="admin-copy mt-1.5 max-w-md text-pretty text-xs leading-5">
          {description || message}
        </p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`mt-5 ${actionClass}`}>
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button type="button" onClick={onAction} className={`mt-5 ${actionClass}`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
