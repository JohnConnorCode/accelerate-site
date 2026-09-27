"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2, Target, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

type Analytics = {
  schemaReady: boolean;
  windowDays?: number;
  funnel?: { starts: number; previews: number; unlocked: number; websiteAudited?: number };
  eventAnalyticsReady?: boolean;
  eventAnalyticsCapped?: boolean;
  eventFunnel?: {
    stepViews: { label: string; value: number }[];
    questionViews: { label: string; value: number }[];
    pdfDownloads: number;
    scanCompletions: number;
    scanPartials: number;
    scanFailures: number;
  };
  averageScore?: number | null;
  completionRate?: number | null;
  bottlenecks?: { label: string; value: number }[];
  sources?: { label: string; value: number }[];
  leads?: {
    id: string;
    name: string | null;
    email: string | null;
    business_name: string | null;
    score: number | null;
    created_at: string;
  }[];
};

const number = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : new Intl.NumberFormat("en-US").format(value);

export function AIReadinessPanel() {
  const [data, setData] = useState<Analytics | null>(null);
  useEffect(() => {
    fetch("/api/admin/ai-readiness?days=30")
      .then((response) => response.json())
      .then(setData)
      .catch(() => setData({ schemaReady: false }));
  }, []);
  if (!data)
    return (
      <div className="mb-6 flex items-center gap-2 text-sm text-white-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading assessment analytics…
      </div>
    );
  if (!data.schemaReady)
    return (
      <GlassCard className="mb-6">
        <p className="text-sm text-white-secondary">
          AI Readiness analytics will appear after the assessment migration is applied.
        </p>
      </GlassCard>
    );
  const funnel = data.funnel || { starts: 0, previews: 0, unlocked: 0, websiteAudited: 0 };
  return (
    <section className="mb-8 space-y-4" aria-labelledby="ai-readiness-analytics-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="admin-eyebrow">Lead magnet performance · last 30 days</p>
          <h2
            id="ai-readiness-analytics-heading"
            className="mt-1 text-xl font-semibold text-white-primary"
          >
            AI Readiness Assessment
          </h2>
        </div>
        <p className="text-xs text-white-muted">Browser activity and saved reports</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Metric
          label="Started sessions"
          value={data.eventAnalyticsReady ? number(funnel.starts) : "—"}
          icon={BarChart3}
        />
        <Metric label="Previewed" value={number(funnel.previews)} icon={Target} />
        <Metric label="Unlocked" value={number(funnel.unlocked)} icon={Users} />
        <Metric label="Site URLs provided" value={number(funnel.websiteAudited)} icon={Target} />
        <Metric
          label="Report unlock rate"
          value={
            data.completionRate === null || data.completionRate === undefined
              ? "—"
              : `${data.completionRate}%`
          }
          icon={Target}
        />
        <Metric
          label="Avg. score"
          value={
            data.averageScore === null || data.averageScore === undefined
              ? "—"
              : `${data.averageScore}/100`
          }
          icon={BarChart3}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <p className="admin-eyebrow">Assessment progress · unique sessions</p>
          {!data.eventAnalyticsReady ? (
            <p className="mt-4 text-sm text-white-muted">
              Detailed step analytics are unavailable. Check first-party analytics access for this
              workspace.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(data.eventFunnel?.stepViews || []).map((item) => (
                  <div key={item.label} className="rounded-xl border border-border-glass p-3">
                    <p className="text-xs capitalize text-white-muted">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white-primary">
                      {number(item.value)}
                    </p>
                  </div>
                ))}
                <div className="rounded-xl border border-border-glass p-3">
                  <p className="text-xs text-white-muted">PDF download clicks</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white-primary">
                    {number(data.eventFunnel?.pdfDownloads)}
                  </p>
                </div>
                <div className="rounded-xl border border-border-glass p-3">
                  <p className="text-xs text-white-muted">Website scans completed</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white-primary">
                    {number(data.eventFunnel?.scanCompletions)}
                  </p>
                </div>
                <div className="rounded-xl border border-border-glass p-3">
                  <p className="text-xs text-white-muted">Website scans partial</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white-primary">
                    {number(data.eventFunnel?.scanPartials)}
                  </p>
                </div>
                <div className="rounded-xl border border-border-glass p-3">
                  <p className="text-xs text-white-muted">Website scan failures</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-white-primary">
                    {number(data.eventFunnel?.scanFailures)}
                  </p>
                </div>
              </div>
              {!!data.eventFunnel?.questionViews.length && (
                <details className="mt-4 rounded-xl border border-border-glass p-3">
                  <summary className="cursor-pointer text-sm font-medium text-white-secondary">
                    Question-by-question views
                  </summary>
                  <div className="mt-3 space-y-2">
                    {data.eventFunnel.questionViews.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="text-white-muted">{item.label}</span>
                        <span className="font-semibold tabular-nums text-white-primary">
                          {number(item.value)} sessions
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <p className="mt-4 text-xs leading-5 text-white-muted">
                Counts use anonymous, session-scoped visitor IDs. Answers, names, and email
                addresses are not included in event analytics. Started sessions use browser events;
                previews and unlocked reports use saved assessment records.
              </p>
              {data.eventAnalyticsCapped && (
                <p className="mt-2 text-xs leading-5 text-amber-300">
                  More than 10,000 events matched this window. Step counts show the latest 10,000.
                </p>
              )}
            </>
          )}
        </GlassCard>
        <GlassCard>
          <p className="admin-eyebrow">Common constraints</p>
          <div className="mt-4 space-y-3">
            {(data.bottlenecks || []).length ? (
              data.bottlenecks?.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="capitalize text-white-secondary">{item.label}</span>
                  <span className="font-semibold tabular-nums text-white-primary">
                    {item.value}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-white-muted">No answers yet.</p>
            )}
          </div>
        </GlassCard>
        <GlassCard>
          <p className="admin-eyebrow">Top sources</p>
          <div className="mt-4 space-y-3">
            {(data.sources || []).length ? (
              data.sources?.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-white-secondary">{item.label}</span>
                  <span className="font-semibold tabular-nums text-white-primary">
                    {item.value}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-white-muted">No attributed assessments yet.</p>
            )}
          </div>
        </GlassCard>
      </div>
      <GlassCard padding="none" className="overflow-hidden">
        <div className="border-b border-border-glass px-4 py-3">
          <p className="admin-eyebrow">Recent unlocked reports</p>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr className="border-b border-border-glass">
                <th className="px-4 py-3 text-left text-xs uppercase text-white-muted">Person</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-white-muted">Business</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-white-muted">Score</th>
                <th className="px-4 py-3 text-left text-xs uppercase text-white-muted">Date</th>
              </tr>
            </thead>
            <tbody>
              {(data.leads || []).map((lead) => (
                <tr key={lead.id} className="border-b border-border-glass">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white-primary">{lead.name || "Unknown"}</div>
                    <div className="text-xs text-white-muted">{lead.email}</div>
                  </td>
                  <td className="px-4 py-3 text-white-secondary">{lead.business_name || "—"}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-white-primary">
                    {lead.score === null ? "—" : `${lead.score}/100`}
                  </td>
                  <td className="px-4 py-3 text-xs text-white-muted">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.leads?.length && (
            <p className="px-4 py-5 text-sm text-white-muted">No unlocked reports yet.</p>
          )}
        </div>
      </GlassCard>
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BarChart3;
}) {
  return (
    <GlassCard>
      <div className="flex items-center justify-between">
        <div>
          <p className="admin-eyebrow">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white-primary">{value}</p>
        </div>
        <Icon className="h-4 w-4 text-white-muted" />
      </div>
    </GlassCard>
  );
}
