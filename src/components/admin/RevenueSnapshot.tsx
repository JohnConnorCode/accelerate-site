"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { DollarSign, TrendingUp, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const funnelStages = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { key: "qualified", label: "Qualified", color: "bg-green-500" },
  { key: "proposal", label: "Proposal", color: "bg-purple-500" },
  { key: "won", label: "Won", color: "bg-emerald-500" },
];

interface RevenueSnapshotProps {
  pipeline: Record<string, number>;
  pipelineValues: Record<string, number>;
  clientMRR?: number;
  activeClients?: number;
}

export function RevenueSnapshot({ pipeline, pipelineValues, clientMRR = 0, activeClients = 0 }: RevenueSnapshotProps) {
  const totalPipelineValue = Object.entries(pipelineValues)
    .filter(([key]) => key !== "lost")
    .reduce((sum, [, val]) => sum + val, 0);

  const wonRevenue = pipelineValues["won"] || 0;

  const stageData = funnelStages.map((stage) => ({
    ...stage,
    count: pipeline[stage.key] || 0,
  }));

  const maxCount = Math.max(...stageData.map((s) => s.count), 1);

  // Only show if there's any data
  const hasData = totalPipelineValue > 0 || Object.values(pipeline).some((v) => v > 0);
  if (!hasData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
    >
      <GlassCard hover="none">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[var(--gold-light)]" />
            <h3 className="font-display text-sm font-semibold text-white-primary">
              Revenue Snapshot
            </h3>
          </div>
          <Link
            href="/admin/revenue"
            className="flex items-center gap-1 text-xs text-white-muted hover:text-[var(--gold-light)] transition-colors"
          >
            View details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Client MRR */}
        {clientMRR > 0 && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400/80 mb-1">Client MRR</p>
                <p className="text-2xl font-display font-bold text-emerald-400">
                  ${clientMRR.toLocaleString()}/mo
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white-muted">Active Clients</p>
                <p className="text-lg font-display font-bold text-white-primary">{activeClients}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white-muted mb-1">Total Pipeline</p>
            <p className="text-xl font-display font-bold text-gold-gradient">
              ${totalPipelineValue.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white-muted mb-1">Won Revenue</p>
            <p className="text-xl font-display font-bold text-emerald-400">
              ${wonRevenue.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs text-white-muted mb-1">Avg Deal Value</p>
            <p className="text-xl font-display font-bold text-white-primary">
              {totalPipelineValue > 0 && Object.keys(pipelineValues).length > 0
                ? `$${Math.round(totalPipelineValue / Object.values(pipeline).reduce((a, b) => a + b, 0) || 1).toLocaleString()}`
                : "$0"}
            </p>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-white-muted" />
          <p className="text-xs text-white-muted uppercase font-semibold">Conversion Funnel</p>
        </div>
        <div className="space-y-2">
          {stageData.map((stage, i) => {
            const width = (stage.count / maxCount) * 100;
            const prevCount = i > 0 ? stageData[i - 1]!.count : 0;
            const dropOff = i > 0 && prevCount > 0
              ? Math.round(((prevCount - stage.count) / prevCount) * 100)
              : null;

            return (
              <div key={stage.key} className="flex items-center gap-3">
                <span className="text-xs text-white-muted w-20 shrink-0">{stage.label}</span>
                <div className="flex-1 h-6 rounded bg-white/5 overflow-hidden relative">
                  <motion.div
                    className={`h-full ${stage.color} rounded`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(width, stage.count > 0 ? 4 : 0)}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                    style={{ opacity: 0.7 }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white-primary">
                    {stage.count}
                  </span>
                </div>
                {dropOff !== null && dropOff > 0 && (
                  <span className="text-[10px] text-white-muted w-12 shrink-0 text-right">
                    -{dropOff}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </motion.div>
  );
}
