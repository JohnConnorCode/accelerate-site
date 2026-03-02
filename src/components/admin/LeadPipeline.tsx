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

interface LeadPipelineProps {
  pipeline: Record<string, number>;
  pipelineValues?: Record<string, number>;
}

export function LeadPipeline({ pipeline, pipelineValues }: LeadPipelineProps) {
  const maxCount = Math.max(...stages.map((s) => pipeline[s.key] || 0), 1);

  return (
    <GlassCard hover="none" padding="none">
      <div className="p-5">
        <h3 className="font-display text-sm font-semibold text-white-primary mb-4">
          Lead Pipeline
        </h3>
        <div className="space-y-3">
          {stages.map((stage, i) => {
            const count = pipeline[stage.key] || 0;
            const value = pipelineValues?.[stage.key] || 0;
            const width = (count / maxCount) * 100;

            return (
              <motion.div
                key={stage.key}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
              >
                <span className="text-xs text-white-muted w-20 shrink-0">
                  {stage.label}
                </span>
                <div className="flex-1 h-7 rounded-md bg-white/5 overflow-hidden relative">
                  <motion.div
                    className={`h-full ${stage.color} rounded-md`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(width, count > 0 ? 4 : 0)}%` }}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.06, ease: "easeOut" }}
                    style={{ opacity: 0.7 }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-medium text-white-primary">
                    {count}
                    {value > 0 && (
                      <span className="ml-1.5 text-white-muted">
                        · ${value.toLocaleString()}
                      </span>
                    )}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
