"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminSurface } from "@/components/admin/AdminSurface";
import {
  workflowCalendarDays,
  workflowDateKey,
  workflowDayKey,
  type WorkflowViewDescriptor,
} from "@/lib/admin/workflow-views";
import { cn } from "@/lib/utils";

export function WorkflowCalendar<T>({
  descriptor,
  items,
  onOpen,
}: {
  descriptor: WorkflowViewDescriptor<T>;
  items: readonly T[];
  onOpen: (item: T) => void;
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = workflowDayKey(new Date());
  const days = workflowCalendarDays(month);
  const rowsByDay = useMemo(() => {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const day = workflowDateKey(descriptor.dueDate(item));
      if (!day) continue;
      groups.set(day, [...(groups.get(day) ?? []), item]);
    }
    return groups;
  }, [descriptor, items]);
  const unscheduled = items.filter((item) => !workflowDateKey(descriptor.dueDate(item)));
  const dated = items.filter((item) => workflowDateKey(descriptor.dueDate(item)) !== null);
  const overdue = dated.filter((item) => {
    const day = workflowDateKey(descriptor.dueDate(item));
    return day !== null && day < today && !/complete|published|won|lost/i.test(descriptor.status(item));
  }).length;
  const dueToday = dated.filter((item) => workflowDateKey(descriptor.dueDate(item)) === today).length;
  const upcoming = dated.filter((item) => {
    const day = workflowDateKey(descriptor.dueDate(item));
    return day !== null && day > today;
  }).length;
  const scheduled = dated.length;

  return (
    <div className="space-y-4" aria-label={`${descriptor.label} calendar`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--admin-ink)]">{scheduled} scheduled</p>
          <p className="text-xs text-[var(--admin-muted)]">
            {overdue} overdue · {dueToday} due today · {upcoming} upcoming · {unscheduled.length} without a date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="admin-button admin-button-secondary min-h-11" onClick={() => {
            const now = new Date();
            setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          }}>Today</button>
          <button type="button" aria-label="Previous month" className="admin-icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <h2 className="min-w-36 text-center text-sm font-semibold text-[var(--admin-ink)]" aria-live="polite">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <button type="button" aria-label="Next month" className="admin-icon-button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <AdminSurface padding="none" elevation="flat">
        <div role="grid" aria-label={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}>
          <div className="grid grid-cols-7 border-b border-[var(--admin-border)]" role="row">
            {Array.from({ length: 7 }, (_, index) => {
              const day = new Date(2024, 0, 7 + index).toLocaleDateString(undefined, { weekday: "short" });
              return <div key={day} role="columnheader" className="px-1 py-2 text-center text-xs font-medium text-[var(--admin-muted)] sm:px-3">{day}</div>;
            })}
          </div>
          <div className="grid grid-cols-7" role="rowgroup">
          {days.map((day) => {
            const key = workflowDayKey(day);
            const dayItems = rowsByDay.get(key) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            return (
              <div key={key} role="gridcell" aria-label={day.toLocaleDateString(undefined, { dateStyle: "full" })} className={cn("min-h-28 border-b border-r border-[var(--admin-border)] p-1.5 sm:min-h-36 sm:p-2", !inMonth && "bg-[var(--admin-surface-subtle)]/60")}>
                <h3 className={cn("mb-1 grid size-7 place-items-center rounded-full text-xs", key === today ? "bg-[var(--admin-accent)] font-semibold text-white" : "text-[var(--admin-muted)]", !inMonth && "opacity-50")}>
                  {day.getDate()}
                </h3>
                <ul className="space-y-1">
                  {dayItems.map((item, index) => (
                    <li key={`${key}:${index}`}>
                      <button type="button" onClick={() => onOpen(item)} className="min-h-11 w-full overflow-hidden rounded-md bg-[var(--admin-accent-soft)] px-1.5 py-1 text-left text-xs leading-4 text-[var(--admin-ink)] hover:bg-[var(--admin-hover-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]">
                        <span className="block truncate font-medium">{descriptor.title(item)}</span>
                        {descriptor.summary?.(item) && <span className="hidden truncate text-[var(--admin-muted)] sm:block">{descriptor.summary(item)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          </div>
        </div>
      </AdminSurface>
      <section aria-labelledby="workflow-unscheduled-heading" className="space-y-2">
        <h2 id="workflow-unscheduled-heading" className="text-sm font-semibold text-[var(--admin-ink)]">No date</h2>
        {unscheduled.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {unscheduled.map((item, index) => (
              <li key={`${descriptor.title(item)}:${index}`}>
                <button type="button" onClick={() => onOpen(item)} className="min-h-11 w-full rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-left text-sm text-[var(--admin-ink)] hover:bg-[var(--admin-hover-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]">
                  <span className="block font-medium">{descriptor.title(item)}</span>
                  <span className="mt-1 block text-xs text-[var(--admin-muted)]">{descriptor.summary?.(item) || descriptor.status(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[var(--admin-muted)]">All shown work has a date.</p>}
      </section>
    </div>
  );
}
