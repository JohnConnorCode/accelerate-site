import { cn } from "@/lib/utils";

const statusColorMap: Record<string, string> = {
  // Lead statuses
  new: "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]",
  contacted: "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]",
  qualified: "bg-[var(--admin-success-soft)] text-[var(--admin-success)]",
  proposal: "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]",
  won: "bg-[var(--admin-success-soft)] text-[var(--admin-success)]",
  lost: "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]",
  // Partner / email sequence statuses
  pending: "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]",
  approved: "bg-[var(--admin-success-soft)] text-[var(--admin-success)]",
  declined: "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]",
  onboarding: "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]",
  churned: "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]",
  active: "bg-[var(--admin-success-soft)] text-[var(--admin-success)]",
  completed: "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]",
  paused: "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]",
  unsubscribed: "bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]",
  // Content statuses
  idea: "bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)]",
  outline: "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]",
  draft: "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]",
  review: "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]",
  published: "bg-[var(--admin-success-soft)] text-[var(--admin-success)]",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        statusColorMap[status] || "bg-[var(--admin-surface-subtle)] text-[var(--admin-muted)]",
        className,
      )}
    >
      {status}
    </span>
  );
}
