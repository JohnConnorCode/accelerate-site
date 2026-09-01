"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Globe, ArrowUpRight, Target } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

interface PlausibleData {
  configured?: boolean;
  realtime: number;
  topPages: { page: string; visitors: number }[];
  topSources: { source: string; visitors: number }[];
  goals: { goal: string; visitors: number; events: number }[];
}

export function PlausibleWidget() {
  const [data, setData] = useState<PlausibleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/plausible");
      if (!res.ok) {
        if (res.status === 503) {
          setError("Plausible API key not configured");
          return;
        }
        throw new Error("Failed to fetch");
      }
      const nextData = await res.json();
      if (nextData.configured === false) {
        setError("Plausible API key not configured");
        return;
      }
      setData(nextData);
      setError(null);
    } catch {
      setError("Failed to load analytics");
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (error) {
    return (
      <GlassCard hover="none">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-white-muted" />
          <h3 className="font-display text-sm font-semibold text-white-primary">Site Analytics</h3>
        </div>
        <p className="text-xs text-white-muted">{error}</p>
      </GlassCard>
    );
  }

  if (!data) {
    return (
      <GlassCard hover="none">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-white-muted" />
          <h3 className="font-display text-sm font-semibold text-white-primary">Site Analytics</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-white/5 rounded" />
          <div className="h-4 bg-white/5 rounded w-3/4" />
          <div className="h-4 bg-white/5 rounded w-1/2" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard hover="none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gold" />
          <h3 className="font-display text-sm font-semibold text-white-primary">Site Analytics</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-white-secondary font-medium">{data.realtime} live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Top Pages */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="w-3.5 h-3.5 text-white-muted" />
            <span className="text-xs text-white-muted uppercase tracking-wider">Top Pages</span>
          </div>
          <div className="space-y-1.5">
            {data.topPages.slice(0, 5).map((p) => (
              <div key={p.page} className="flex items-center justify-between text-xs">
                <span className="text-white-secondary truncate max-w-[140px]" title={p.page}>
                  {p.page}
                </span>
                <span className="text-white-muted font-mono ml-2">{p.visitors}</span>
              </div>
            ))}
            {data.topPages.length === 0 && <p className="text-xs text-white-muted">No data yet</p>}
          </div>
        </div>

        {/* Top Sources */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-white-muted" />
            <span className="text-xs text-white-muted uppercase tracking-wider">Top Sources</span>
          </div>
          <div className="space-y-1.5">
            {data.topSources.slice(0, 5).map((s) => (
              <div key={s.source} className="flex items-center justify-between text-xs">
                <span className="text-white-secondary truncate max-w-[140px]">{s.source}</span>
                <span className="text-white-muted font-mono ml-2">{s.visitors}</span>
              </div>
            ))}
            {data.topSources.length === 0 && (
              <p className="text-xs text-white-muted">No data yet</p>
            )}
          </div>
        </div>

        {/* Goals */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-white-muted" />
            <span className="text-xs text-white-muted uppercase tracking-wider">
              Conversions (7d)
            </span>
          </div>
          <div className="space-y-1.5">
            {data.goals.slice(0, 5).map((g) => (
              <div key={g.goal} className="flex items-center justify-between text-xs">
                <span className="text-white-secondary truncate max-w-[140px]" title={g.goal}>
                  {g.goal}
                </span>
                <span className="text-white-muted font-mono ml-2">{g.events}</span>
              </div>
            ))}
            {data.goals.length === 0 && (
              <p className="text-xs text-white-muted">Configure goals in Plausible</p>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
