"use client";
import { useEffect, useState, useCallback } from "react";
import { AdminSurface } from "./AdminSurface";
import { Button } from "@/components/ui/Button";
interface Signal {
  id: string;
  kind: string;
  details: string;
  category: string | null;
  remedy: string | null;
  processed_at: string | null;
}
export function LearningEvidence() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/learning/signals");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSignals(data.signals);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evidence unavailable");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const counts = new Map<string, number>();
  for (const signal of signals)
    counts.set(
      signal.category ?? "awaiting_review",
      (counts.get(signal.category ?? "awaiting_review") ?? 0) + 1,
    );
  return (
    <AdminSurface padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Learning evidence</h2>
        <Button variant="ghost" onClick={load}>
          Refresh evidence
        </Button>
      </div>
      <p className="mt-2 text-sm text-[var(--admin-muted)]">
        New corrections, missing sources and execution receipts are reviewed by the work engine. A
        successful action or an approved rule alone does not prove improvement.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm tabular-nums">
            {signals.length
              ? Array.from(counts)
                  .map(([name, count]) => `${name.replaceAll("_", " ")}: ${count}`)
                  .join(" · ")
              : "No captured evidence yet. Correct a draft or complete work to begin."}
          </p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            Showing up to 50 recent signals. Comparative quality and cost-per-result metrics need
            linked evaluation outcomes; no improvement score is available yet.
          </p>
          <ul className="mt-3 space-y-3">
            {signals.slice(0, 10).map((signal) => (
              <li key={signal.id} className="text-sm">
                <p className="font-medium">{signal.kind.replaceAll("_", " ")}</p>
                <p className="mt-1">{signal.details}</p>
                <p className="mt-1 text-[var(--admin-muted)]">
                  {signal.remedy ?? "Waiting for the next work-engine review."}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </AdminSurface>
  );
}
