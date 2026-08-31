"use client";

import { useCallback } from "react";
import { CalendarCheck2, DollarSign, Target, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
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
  const bookingsQuery = useAdminQuery<{ opportunities: Opportunity[]; metrics: Metrics }>(["admin", "bookings"], "/api/admin/bookings?days=90");
  const items = bookingsQuery.data?.opportunities ?? [];
  const metrics = bookingsQuery.data?.metrics ?? null;
  const loading = bookingsQuery.isPending;

  const load = useCallback(async () => {
    const result = await bookingsQuery.refetch();
    if (result.error) toast.error(result.error.message || "Couldn't load bookings");
  }, [bookingsQuery]);

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

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" subtitle="Roofing campaign qualification, calls, and revenue attribution." />
      <AdminReadBody loading={loading} hasData={Boolean(bookingsQuery.data)} error={bookingsQuery.error?.message} onRetry={() => void load()} refreshing={bookingsQuery.isFetching} loadingFallback={<LoadingSkeleton variant="table" />} label="Loading bookings">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Qualified", value: metrics?.qualified || 0, note: `${metrics?.qualifiedToBooked || 0}% booked`, icon: Target },
          { label: "Booked", value: metrics?.booked || 0, note: `${metrics?.bookedToShowed || 0}% showed`, icon: CalendarCheck2 },
          { label: "Calls held", value: metrics?.showed || 0, note: `${metrics?.noShow || 0} no-shows`, icon: UserCheck },
          { label: "Won revenue", value: `$${(metrics?.wonRevenue || 0).toLocaleString()}`, note: `$${(metrics?.pipelineValue || 0).toLocaleString()} pipeline`, icon: DollarSign },
        ].map(({ label, value, note, icon: Icon }) => (
          <AdminSurface key={label} padding="lg"><div className="flex items-start justify-between gap-3"><div><p className="admin-eyebrow">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.045em] text-[var(--admin-ink)]">{value}</p><p className="admin-copy mt-1 text-xs">{note}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black/[0.045] dark:bg-white/[0.06]"><Icon className="size-4" /></span></div></AdminSurface>
        ))}
      </div>
      <AdminSurface padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[var(--admin-border)] font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--admin-muted)]"><tr><th className="px-5 py-4">Company</th><th className="px-4 py-4">Fit</th><th className="px-4 py-4">Leak</th><th className="px-4 py-4">Source</th><th className="px-4 py-4">Call</th><th className="px-4 py-4">Stage</th></tr></thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {items.map((item) => (
                <tr key={item.id} className="text-[var(--admin-ink)]">
                  <td className="px-5 py-4"><a href={item.company_website} target="_blank" rel="noreferrer" className="font-medium transition-opacity hover:opacity-70">{new URL(item.company_website).hostname}</a><p className="admin-copy mt-1 text-xs">{item.email}</p></td>
                  <td className="px-4 py-4"><span className={item.qualified ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--admin-muted)]"}>{item.revenue_band.replace(/_/g, " ")}</span><p className="admin-copy mt-1 text-xs">{item.role.replace(/_/g, " ")}</p></td>
                  <td className="px-4 py-4">{item.primary_leak.replace(/_/g, " ")}</td>
                  <td className="px-4 py-4">{item.utm_source || "Direct"}<p className="admin-copy mt-1 text-xs">{item.utm_campaign || "—"}</p></td>
                  <td className="px-4 py-4 tabular-nums">{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                  <td className="px-4 py-4"><select value={item.stage} onChange={(event) => updateStage(item, event.target.value)} className="min-h-10 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3 text-xs text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]">{stages.map((stage) => <option key={stage} value={stage}>{stage.replace(/_/g, " ")}</option>)}</select></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--admin-muted)]">No roofing opportunities yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </AdminSurface>
      </AdminReadBody>
    </div>
  );
}
