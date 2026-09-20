"use client";
import {
  AlarmClock,
  CheckCircle2,
  CircleAlert,
  CalendarDays,
  ListChecks,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Link from "./AdminLink";
import { AdminSurface } from "./AdminSurface";
import {
  ATTENTION_SECTIONS,
  type OperatorAttentionItem,
} from "@/lib/revenue-os/operator-attention";
import { relativeTime } from "@/lib/admin/work-presentation";

const icons = {
  decision: ShieldCheck,
  work: ListChecks,
  watch: CircleAlert,
  upcoming: CalendarDays,
};
export function AttentionList({
  items,
  busyTask,
  onTask,
  onReview,
}: {
  items: OperatorAttentionItem[];
  busyTask: string | null;
  onTask: (id: string, action: "complete" | "snooze") => void;
  onReview: (id: string, trigger: HTMLElement) => void;
}) {
  return (
    <div className="space-y-5" data-today-workspace>
      {ATTENTION_SECTIONS.map((section) => {
        const rows = items.filter((item) => item.attentionKind === section.kind);
        const Icon = icons[section.kind];
        return (
          <section
            key={section.kind}
            aria-labelledby={`attention-${section.kind}`}
            data-attention-kind={section.kind}
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon className="size-4 text-[var(--admin-muted)]" aria-hidden="true" />
              <h2
                id={`attention-${section.kind}`}
                className="text-base font-semibold text-[var(--admin-ink)]"
              >
                {section.title}
              </h2>
              <span className="text-xs tabular-nums text-[var(--admin-muted)]">{rows.length}</span>
            </div>
            <AdminSurface padding="none" elevation="flat" className="overflow-hidden">
              <ul className="divide-y divide-[var(--admin-border)]">
                {rows.map((item) => (
                  <li
                    key={JSON.stringify([item.sourceType, item.sourceId])}
                    data-source-type={item.sourceType}
                    data-source-id={item.sourceId}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    {item.sourceType === "approval" ? (
                      <button
                        type="button"
                        onClick={(event) => onReview(item.sourceId, event.currentTarget)}
                        data-approval-review={item.sourceId}
                        aria-haspopup="dialog"
                        className="min-w-0 flex-1 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
                      >
                        <span className="block min-h-11 text-sm font-semibold text-[var(--admin-ink)] hover:underline">
                          {item.title}
                        </span>
                        <span className="block text-sm leading-5 text-[var(--admin-muted)]">
                          {item.priorityReason || item.summary}
                        </span>
                        {item.dueAt && (
                          <span className="mt-1 block text-xs tabular-nums text-[var(--admin-muted)]">
                            {relativeTime(item.dueAt)}
                          </span>
                        )}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        aria-label={`Open ${item.title}`}
                        className="min-w-0 flex-1 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-action)] focus-visible:ring-offset-2"
                      >
                        <span className="block min-h-11 text-sm font-semibold text-[var(--admin-ink)] hover:underline">
                          {item.title}
                        </span>
                        <span className="block text-sm leading-5 text-[var(--admin-muted)]">
                          {item.priorityReason || item.summary}
                        </span>
                        {item.dueAt && (
                          <span className="mt-1 block text-xs tabular-nums text-[var(--admin-muted)]">
                            {relativeTime(item.dueAt)}
                          </span>
                        )}
                      </Link>
                    )}
                    {item.sourceType === "task" ? (
                      <div className="flex shrink-0 flex-col sm:flex-row">
                        <button
                          type="button"
                          disabled={Boolean(busyTask)}
                          onClick={() => onTask(item.sourceId, "complete")}
                          aria-label={`Complete ${item.title}`}
                          className="grid size-11 place-items-center rounded-lg text-[var(--admin-success)] hover:bg-[var(--admin-success-soft)] disabled:opacity-50"
                        >
                          {busyTask === `${item.sourceId}:complete` ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyTask)}
                          onClick={() => onTask(item.sourceId, "snooze")}
                          aria-label={`Snooze ${item.title} until tomorrow`}
                          className="grid size-11 place-items-center rounded-lg text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)] disabled:opacity-50"
                        >
                          <AlarmClock className="size-4" />
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {!rows.length && (
                <p className="px-4 py-4 text-sm text-[var(--admin-muted)]">
                  {section.kind === "decision"
                    ? "No decisions waiting."
                    : section.kind === "work"
                      ? "No work due in this view."
                      : section.kind === "watch"
                        ? "Nothing to investigate in this view."
                        : "No upcoming items in this view."}
                </p>
              )}
            </AdminSurface>
          </section>
        );
      })}
    </div>
  );
}
