"use client";

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MRRChartProps {
  data: { date: string; mrr: number }[];
}

export function MRRChart({ data }: MRRChartProps) {
  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.3 }}
    >
      <GlassCard hover="none">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-[var(--gold-light)]" />
          <h3 className="font-display text-sm font-semibold text-white-primary">
            MRR Over Time
          </h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(20,20,30,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
                formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, "MRR"]}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="var(--gold-base)"
                strokeWidth={2}
                dot={{ fill: "var(--gold-base)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </motion.div>
  );
}
