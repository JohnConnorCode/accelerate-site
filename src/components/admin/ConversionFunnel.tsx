"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";

const stages = [
  { key: "new", label: "New", color: "bg-blue-500" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { key: "qualified", label: "Qualified", color: "bg-green-500" },
  { key: "proposal", label: "Proposal", color: "bg-purple-500" },
  { key: "won", label: "Won", color: "bg-emerald-500" },
];

interface ConversionFunnelProps {
  funnel: Record<string, number>;
}

export function ConversionFunnel({ funnel }: ConversionFunnelProps) {
  const stageData = stages.map((stage) => ({
    ...stage,
    count: funnel[stage.key] || 0,
  }));

  const firstCount = stageData[0]?.count || 1;

  return (
    <GlassCard hover="none">
      <h3 className="font-display text-sm font-semibold text-white-primary mb-4">
        Conversion Funnel
      </h3>
      <div className="space-y-2">
        {stageData.map((stage, i) => {
          // Funnel width based on ratio to first stage
          const funnelWidth = Math.max((stage.count / Math.max(firstCount, 1)) * 100, stage.count > 0 ? 8 : 2);
          const prevCount = i > 0 ? stageData[i - 1]!.count : 0;
          const dropOff = i > 0 && prevCount > 0
            ? Math.round(((prevCount - stage.count) / prevCount) * 100)
            : null;
          const convRate = firstCount > 0
            ? Math.round((stage.count / firstCount) * 100)
            : 0;

          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-white-secondary">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white-primary font-medium">{stage.count}</span>
                  {i > 0 && (
                    <span className="text-white-muted">({convRate}%)</span>
                  )}
                  {dropOff !== null && dropOff > 0 && (
                    <span className="text-red-400 text-[10px]">-{dropOff}%</span>
                  )}
                </div>
              </div>
              <div className="flex justify-center">
                <motion.div
                  className={`h-8 rounded ${stage.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${funnelWidth}%` }}
                  transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
                  style={{ opacity: 0.6 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost leads */}
      {(funnel["lost"] || 0) > 0 && (
        <div className="mt-4 pt-3 border-t border-border-glass">
          <div className="flex items-center justify-between text-xs">
            <span className="text-red-400">Lost</span>
            <span className="text-red-400 font-medium">{funnel["lost"]}</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
