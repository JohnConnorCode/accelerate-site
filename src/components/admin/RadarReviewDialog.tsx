"use client";
import { Check } from "lucide-react";
import { AdminDialog } from "./AdminDialog";
import { button, primary, words, Pill } from "./RadarUI";
import type { RadarStoreChange } from "@/lib/revenue-os/radar-store-contract";
import type { RadarAssessment } from "@/lib/revenue-os/radar-ranking-contract";
import type { RadarSourceView } from "@/lib/revenue-os/radar-workspace-contract";
export type RadarReview = {
  kind: "store" | "assessment";
  input: Record<string, unknown>;
  digest: string;
  change?: RadarStoreChange;
  assessment?: RadarAssessment;
};
const displayLabel = (key: string) => words(key).replace(/([A-Z])/g, " $1");
export function RadarReviewDialog({
  review,
  sources,
  opportunityTitle,
  error,
  busy,
  onQueue,
  onClose,
  onReadSource,
}: {
  review: RadarReview | null;
  sources: RadarSourceView[];
  opportunityTitle?: string;
  error: string;
  busy: boolean;
  onQueue: (approve: boolean) => void;
  onClose: () => void;
  onReadSource: (id: string) => void;
}) {
  function valueView(value: unknown, key: string): React.ReactNode {
    if (key === "sourceVersionId" || key === "sourceVersionIds")
      return (
        <ul className="space-y-2">
          {(Array.isArray(value) ? value : [value]).map((id) => {
            const source = sources.find((s) => s.id === id);
            return (
              <li key={String(id)} className="rounded-lg bg-[var(--admin-surface-subtle)] p-3">
                <p className="text-xs font-semibold">
                  {source?.title ?? "Referenced source"}{" "}
                  {source ? `· version ${source.version}` : ""}
                </p>
                {source?.canonicalUrl && (
                  <p className="mt-1 break-all text-xs">{source.canonicalUrl}</p>
                )}
                <button
                  className={button + " mt-2"}
                  onClick={() => onReadSource(String(id))}
                  type="button"
                >
                  Read referenced source
                </button>
                <details className="mt-2 text-[10px] text-[var(--admin-muted)]">
                  <summary>Source reference</summary>
                  <code>{String(id)}</code>
                </details>
              </li>
            );
          })}
        </ul>
      );
    if (key === "opportunityId")
      return <p className="text-sm">{opportunityTitle ?? String(value)}</p>;
    if (value === null) return <span className="text-xs text-[var(--admin-muted)]">Not set</span>;
    if (Array.isArray(value))
      return (
        <ul className="space-y-2">
          {value.map((item, i) => (
            <li key={i}>{valueView(item, "")}</li>
          ))}
        </ul>
      );
    if (typeof value === "object")
      return (
        <dl className="space-y-3">
          {Object.entries(value).map(([nested, v]) => (
            <div key={nested}>
              <dt className="text-xs font-semibold capitalize text-[var(--admin-muted)]">
                {displayLabel(nested)}
              </dt>
              <dd className="mt-1">{valueView(v, nested)}</dd>
            </div>
          ))}
        </dl>
      );
    return <p className="whitespace-pre-wrap break-words text-sm leading-6">{String(value)}</p>;
  }
  const record = review?.change ?? review?.assessment;
  return (
    <AdminDialog
      open={Boolean(review)}
      onClose={onClose}
      title="Review before saving"
      maxWidth="lg"
    >
      <div className="max-h-[85dvh] overflow-y-auto rounded-2xl bg-[var(--admin-surface)] p-5 sm:p-6">
        <h2 className="text-base font-semibold">Review before saving</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">
          This changes internal Radar records. It does not send outreach, publish content or
          authorize a commitment.
        </p>
        {review?.change && (
          <div className="mt-3">
            <Pill>{words(review.change.operation)}</Pill>
          </div>
        )}
        <dl className="mt-5 space-y-5">
          {record &&
            Object.entries(record)
              .filter(([key]) => key !== "operation")
              .map(([key, value]) => (
                <div key={key}>
                  <dt className="mb-1 text-xs font-semibold capitalize text-[var(--admin-muted)]">
                    {displayLabel(key)}
                  </dt>
                  <dd>{valueView(value, key)}</dd>
                </div>
              ))}
        </dl>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className={primary} disabled={busy} onClick={() => onQueue(true)}>
            <Check size={15} aria-hidden />
            Approve this change
          </button>
          <button className={button} disabled={busy} onClick={() => onQueue(false)}>
            Queue for later review
          </button>
          <button className={button} disabled={busy} onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    </AdminDialog>
  );
}
