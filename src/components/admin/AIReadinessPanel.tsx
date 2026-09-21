"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2, Target, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

type Analytics = {
  schemaReady: boolean;
  windowDays?: number;
  funnel?: { starts: number; previews: number; unlocked: number; websiteAudited?: number };
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
        <p className="text-xs text-white-muted">Server-confirmed assessment records</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Started" value={number(funnel.starts)} icon={BarChart3} />
        <Metric label="Previewed" value={number(funnel.previews)} icon={Target} />
        <Metric label="Unlocked" value={number(funnel.unlocked)} icon={Users} />
        <Metric label="Sites audited" value={number(funnel.websiteAudited)} icon={Target} />
        <Metric
          label="Unlock rate"
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
