"use client";

import { CalendarDays, Columns3, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkflowLayout } from "@/lib/admin/workflow-views";

const options = [
  { id: "list", label: "List", Icon: List },
  { id: "board", label: "Board", Icon: Columns3 },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
] as const;

export function WorkflowLayoutSwitcher({
  value,
  onChange,
  layouts = ["list", "board", "calendar"],
}: {
  value: WorkflowLayout;
  onChange: (layout: WorkflowLayout) => void;
  layouts?: readonly WorkflowLayout[];
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1" role="group" aria-label="Workflow layout">
      {options.filter((option) => layouts.includes(option.id)).map(({ id, label, Icon }) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)} className={cn("inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-[calc(var(--admin-control-radius)-4px)] px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]", value === id ? "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]" : "text-[var(--admin-muted)] hover:text-[var(--admin-ink)]")}>
          <Icon className="size-3.5" aria-hidden="true" />{label}
        </button>
      ))}
    </div>
  );
}
