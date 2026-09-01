import { cn } from "@/lib/utils";

const statusColorMap: Record<string, string> = {
  // Lead statuses
  new: "bg-blue-500/20 text-blue-300",
  contacted: "bg-yellow-500/20 text-yellow-300",
  qualified: "bg-green-500/20 text-green-300",
  proposal: "bg-purple-500/20 text-purple-300",
  won: "bg-emerald-500/20 text-emerald-300",
  lost: "bg-red-500/20 text-red-300",
  // Partner / email sequence statuses
  pending: "bg-yellow-500/20 text-yellow-300",
  approved: "bg-emerald-500/20 text-emerald-300",
  declined: "bg-red-500/20 text-red-300",
  active: "bg-emerald-500/20 text-emerald-300",
  completed: "bg-blue-500/20 text-blue-300",
  paused: "bg-yellow-500/20 text-yellow-300",
  unsubscribed: "bg-red-500/20 text-red-300",
  // Content statuses
  idea: "bg-slate-500/20 text-slate-300",
  outline: "bg-blue-500/20 text-blue-300",
  draft: "bg-yellow-500/20 text-yellow-300",
  review: "bg-purple-500/20 text-purple-300",
  published: "bg-emerald-500/20 text-emerald-300",
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
        statusColorMap[status] || "bg-white/10 text-white-secondary",
        className,
      )}
    >
      {status}
    </span>
  );
}
