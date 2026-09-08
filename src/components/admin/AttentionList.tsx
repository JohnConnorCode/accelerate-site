"use client";
import {
  AlarmClock,
  ArrowRight,
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
  selectVisibleAttentionSections,
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
  hideEmptySections = false,
}: {
  items: OperatorAttentionItem[];
  busyTask: string | null;
  onTask: (id: string, action: "complete" | "snooze") => void;
  onReview: (id: string, trigger: HTMLElement) => void;
  /** When the queue is already filtered (e.g. a Today focus tab), omit
   * empty sections instead of stacking "nothing here" boxes. If every
   * section is empty the full set still renders, so a cleared filter
   * confirms itself ("No approvals waiting.") instead of going blank. */
  hideEmptySections?: boolean;
}) {
  const sectionRows = ATTENTION_SECTIONS.map((section) => ({
    section,
    rows: items.filter((item) => item.attentionKind === section.kind),
  }));
  const visibleKinds = selectVisibleAttentionSections(
    sectionRows.map(({ section, rows }) => ({ kind: section.kind, rows: rows.length })),
    hideEmptySections,
  );
  const visible = sectionRows.filter(({ section }) => visibleKinds.includes(section.kind));
  return (
    <div className="space-y-5" data-today-workspace>
      {visible.map(({ section, rows }) => {
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
            <AdminSurface
              padding="none"
              className="overflow-hidden !shadow-none border border-[var(--admin-border)]"
            >
              <ul className="divide-y divide-[var(--admin-border)]">
                {rows.map((item) => (
                  <li
                    key={JSON.stringify([item.sourceType, item.sourceId])}
                    data-source-type={item.sourceType}
                    data-source-id={item.sourceId}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      {item.sourceType === "approval" ? (
                        <button
                          type="button"
                          onClick={(event) => onReview(item.sourceId, event.currentTarget)}
                          data-approval-review={item.sourceId}
                          aria-haspopup="dialog"
                          className="min-h-11 text-left text-sm font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          {item.title}
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--admin-ink)] hover:underline"
                        >
                          {item.title}
                        </Link>
                      )}
                      <p className="text-sm leading-5 text-[var(--admin-muted)]">
                        {item.priorityReason || item.summary}
                      </p>
                      {item.dueAt && (
                        <p className="mt-1 text-xs tabular-nums text-[var(--admin-muted)]">
                          {relativeTime(item.dueAt)}
                        </p>
                      )}
                    </div>
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
                    ) : item.sourceType === "approval" ? (
                      <button
                        type="button"
                        onClick={(event) => onReview(item.sourceId, event.currentTarget)}
                        aria-label={`Review ${item.title}`}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-[var(--admin-ink)] hover:bg-[var(--admin-surface-subtle)]"
                      >
                        Review
                        <ArrowRight className="size-4" />
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        aria-label={`Open ${item.title}`}
                        className="grid size-11 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] hover:bg-[var(--admin-surface-subtle)]"
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {!rows.length && (
                <p className="px-4 py-4 text-sm text-[var(--admin-muted)]">
                  {section.kind === "decision"
                    ? "No approvals waiting."
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
