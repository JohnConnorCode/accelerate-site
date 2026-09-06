"use client";
import { AdminSurface } from "./AdminSurface";
import AdminLink from "./AdminLink";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { button, words, Pill } from "./RadarUI";
import type {
  RadarWorkspaceData,
  RadarSourceView,
} from "@/lib/revenue-os/radar-workspace-contract";
export function RadarOverview({
  data,
  historyOnly,
  sourceCard,
}: {
  data: RadarWorkspaceData;
  historyOnly: boolean;
  sourceCard: (source: RadarSourceView) => React.ReactNode;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [data.selection?.selected.length ?? 0, "Business actions"],
          [data.selection?.unranked.length ?? 0, "Neutral review"],
          [data.selection?.deferred.length ?? 0, "Deferred"],
          [data.sources.length, "Recent sources"],
        ].map(([value, text]) => (
          <AdminSurface key={String(text)} padding="sm">
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">{text}</p>
          </AdminSurface>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <AdminSurface>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Worth reviewing today</h2>
              <Pill>Human-reviewed estimates</Pill>
            </div>
            {data.selection?.selected.length ? (
              <div className="space-y-4">
                {data.selection.selected.map((item) => (
                  <AdminLink
                    key={item.id}
                    href={`/admin/radar/opportunities/${item.id}`}
                    className="group flex gap-4 rounded-xl bg-[var(--admin-surface-subtle)] p-4 transition-[background-color] hover:bg-[var(--admin-border)]"
                  >
                    <div className="min-w-12 text-center">
                      <span className="text-2xl font-semibold tabular-nums">
                        {Math.round(item.score)}
                      </span>
                      <p className="mt-1 text-[9px] uppercase tracking-wide text-[var(--admin-muted)]">
                        Estimate
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-balance text-sm font-semibold">
                        {data.candidateTitles.find((c) => c.id === item.id)?.title ??
                          "Business opportunity"}
                      </h3>
                      <p className="mt-2 text-pretty text-sm leading-6 text-[var(--admin-muted)]">
                        {item.nextAction}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill>Effort {item.effort}/5</Pill>
                        <Pill>{words(item.timeToValue)}</Pill>
                      </div>
                    </div>
                    <ArrowUpRight className="mt-1 shrink-0" size={16} aria-hidden />
                  </AdminLink>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-6">
                <h3 className="text-sm font-semibold">No ranked business actions yet</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--admin-muted)]">
                  Add source material, develop an opportunity and review its estimates. Unknown and
                  public-affairs subjects remain in neutral review.
                </p>
                <AdminLink href="/admin/ai" className={button + " mt-4"}>
                  Set up an opportunity with AI
                </AdminLink>
              </div>
            )}
          </AdminSurface>
          <AdminSurface>
            <h2 className="mb-4 text-base font-semibold">Neutral review &amp; deferred work</h2>
            {[...(data.selection?.unranked ?? []), ...(data.selection?.deferred ?? [])]
              .slice(0, 20)
              .map((item) => (
                <AdminLink
                  key={item.id}
                  href={`/admin/radar/opportunities/${item.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--admin-border)] py-3 last:border-0"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {data.candidateTitles.find((c) => c.id === item.id)?.title ?? "Opportunity"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--admin-muted)]">
                      {item.reason}
                    </p>
                  </div>
                  <ArrowUpRight size={15} className="shrink-0" aria-hidden />
                </AdminLink>
              ))}
            {!data.selection?.unranked.length && !data.selection?.deferred.length && (
              <p className="text-sm text-[var(--admin-muted)]">
                Nothing is waiting in this review window.
              </p>
            )}
          </AdminSurface>
          <AdminSurface>
            <h2 className="mb-4 text-base font-semibold">Retained opportunities</h2>
            {data.opportunities.length ? (
              data.opportunities.map((item) => (
                <AdminLink
                  key={item.id}
                  href={
                    historyOnly
                      ? `/admin/radar/history?opportunityId=${item.id}`
                      : `/admin/radar/opportunities/${item.id}`
                  }
                  className="flex min-h-12 items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm font-medium">{item.title}</span>
                  <Pill>{words(item.state)}</Pill>
                </AdminLink>
              ))
            ) : (
              <p className="text-sm text-[var(--admin-muted)]">No opportunities have been saved.</p>
            )}
          </AdminSurface>
        </div>
        <div className="space-y-5">
          <AdminSurface tone="subtle">
            <ShieldCheck size={20} aria-hidden />
            <h2 className="mt-3 text-sm font-semibold">Evidence before action</h2>
            <p className="mt-2 text-pretty text-xs leading-6 text-[var(--admin-muted)]">
              Scores are reviewed judgments, not probabilities. Unknowns stay unknown. Discovery,
              outreach and publication are not running in this workspace.
            </p>
            <p className="mt-3 text-xs leading-6">{data.model.reason}</p>
            <AdminLink href="/admin/integrations" className={button + " mt-4"}>
              Configure Radar
            </AdminLink>
          </AdminSurface>
          <AdminSurface>
            <h2 className="mb-4 text-sm font-semibold">Source library</h2>
            <div className="space-y-3">{data.sources.slice(0, 8).map(sourceCard)}</div>
            {!data.sources.length && (
              <p className="text-sm text-[var(--admin-muted)]">
                Add a public source and the text you want to review.
              </p>
            )}
          </AdminSurface>
        </div>
      </div>
      {data.truncated && (
        <p className="text-xs text-[var(--admin-muted)]">
          This is a bounded window of recent records. It does not compare every historical
          opportunity.
        </p>
      )}
    </>
  );
}
