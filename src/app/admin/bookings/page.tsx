"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, DollarSign, Target, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { GlassCard } from "@/components/ui/GlassCard";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";

interface Opportunity {
  id: string;
  email: string;
  company_website: string;
  role: string;
  revenue_band: string;
  primary_leak: string;
  qualified: boolean;
  stage: string;
  scheduled_at?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  estimated_value?: number;
  won_value?: number;
  created_at: string;
}

interface Metrics {
  total: number;
  qualified: number;
  booked: number;
  showed: number;
  noShow: number;
  won: number;
  pipelineValue: number;
  wonRevenue: number;
  qualifiedToBooked: number;
  bookedToShowed: number;
}

const stages = ["nurture", "qualified", "calendar_viewed", "booked", "showed", "no_show", "proposal", "won", "lost"];

export default function AdminBookingsPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ opportunities: Opportunity[]; metrics: Metrics }>("/api/admin/bookings?days=90");
      setItems(data.opportunities);
      setMetrics(data.metrics);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStage = async (item: Opportunity, stage: string) => {
    try {
      await fetchJson("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, stage, estimatedValue: item.estimated_value, wonValue: item.won_value }),
      });
      toast.success(`Moved to ${stage.replace(/_/g, " ")}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update booking");
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" subtitle="Roofing campaign qualification, calls, and revenue attribution." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Qualified", value: metrics?.qualified || 0, note: `${metrics?.qualifiedToBooked || 0}% booked`, icon: Target },
          { label: "Booked", value: metrics?.booked || 0, note: `${metrics?.bookedToShowed || 0}% showed`, icon: CalendarCheck2 },
          { label: "Calls held", value: metrics?.showed || 0, note: `${metrics?.noShow || 0} no-shows`, icon: UserCheck },
          { label: "Won revenue", value: `$${(metrics?.wonRevenue || 0).toLocaleString()}`, note: `$${(metrics?.pipelineValue || 0).toLocaleString()} pipeline`, icon: DollarSign },
        ].map(({ label, value, note, icon: Icon }) => (
          <GlassCard key={label} hover="none"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.12em] text-white-muted">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums text-white-primary">{value}</p><p className="mt-1 text-xs text-white-muted">{note}</p></div><Icon className="size-5 text-gold" /></div></GlassCard>
        ))}
      </div>
      <GlassCard hover="none" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border-glass text-xs uppercase tracking-[0.1em] text-white-muted"><tr><th className="px-5 py-4">Company</th><th className="px-4 py-4">Fit</th><th className="px-4 py-4">Leak</th><th className="px-4 py-4">Source</th><th className="px-4 py-4">Call</th><th className="px-4 py-4">Stage</th></tr></thead>
            <tbody className="divide-y divide-border-glass">
              {items.map((item) => (
                <tr key={item.id} className="text-white-secondary">
                  <td className="px-5 py-4"><a href={item.company_website} target="_blank" rel="noreferrer" className="font-medium text-white-primary hover:text-gold">{new URL(item.company_website).hostname}</a><p className="mt-1 text-xs text-white-muted">{item.email}</p></td>
                  <td className="px-4 py-4"><span className={item.qualified ? "text-emerald-300" : "text-white-muted"}>{item.revenue_band.replace(/_/g, " ")}</span><p className="mt-1 text-xs text-white-muted">{item.role.replace(/_/g, " ")}</p></td>
                  <td className="px-4 py-4">{item.primary_leak.replace(/_/g, " ")}</td>
                  <td className="px-4 py-4">{item.utm_source || "Direct"}<p className="mt-1 text-xs text-white-muted">{item.utm_campaign || "—"}</p></td>
                  <td className="px-4 py-4 tabular-nums">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                  <td className="px-4 py-4"><select value={item.stage} onChange={(event) => updateStage(item, event.target.value)} className="min-h-10 rounded-lg border border-border-glass bg-bg-subtle px-3 text-xs text-white-primary outline-none focus:border-gold">{stages.map((stage) => <option key={stage} value={stage}>{stage.replace(/_/g, " ")}</option>)}</select></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-white-muted">No roofing opportunities yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
