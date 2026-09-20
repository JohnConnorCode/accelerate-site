"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import type { FirstUseProgress } from "@/lib/revenue-os/first-use";
export default function GetStartedPage() {
  const [progress, setProgress] = useState<FirstUseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/get-started");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProgress(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Progress could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your first follow-up"
        subtitle="Turn one inquiry into a completed next step, then carry a reviewed correction into later work."
      />
      <AdminSurface padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Start with one real inquiry</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--admin-muted)]">
              This path works for invited workspaces and self-hosted installations. Start with
              manual tasks; connect AI and email when you need drafting or sending. Progress comes
              from saved records and survives reloads.
            </p>
          </div>
          <Button disabled={loading} onClick={load}>
            {loading ? "Checking…" : "Refresh progress"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-4">
            {error}
          </p>
        )}
        {progress && (
          <ol className="mt-6 space-y-4">
            {progress.steps.map((step, index) => (
              <li
                key={step.id}
                className="flex gap-4 rounded-xl bg-[var(--admin-surface-subtle)] p-4"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface)] text-sm tabular-nums"
                  aria-label={step.complete ? "Complete" : `Step ${index + 1}`}
                >
                  {step.complete ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm text-[var(--admin-muted)]">{step.description}</p>
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex min-h-10 items-center text-sm font-medium underline underline-offset-4"
                  >
                    {step.complete ? "Review saved work" : "Open workspace step"}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </AdminSurface>
      {progress && (
        <AdminSurface padding="lg">
          <h2 className="text-lg font-semibold">What has been verified</h2>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            Connections, background work, model execution and useful outcomes are checked
            separately.
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {progress.readiness.map((item) => (
              <div key={item.label} className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
                <dt className="font-medium">{item.label}</dt>
                <dd className="mt-1 text-sm">
                  <span className="font-medium capitalize">{item.state}</span>
                  <p className="mt-1 text-[var(--admin-muted)]">{item.detail}</p>
                </dd>
              </div>
            ))}
          </dl>
        </AdminSurface>
      )}
    </div>
  );
}
