"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

interface LeadsChartProps {
  data: { date: string; leads: number }[];
  days?: number;
  onDaysChange?: (days: number) => void;
}

const rangeOptions = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

export function LeadsChart({ data, days = 30, onDaysChange }: LeadsChartProps) {
  return (
    <GlassCard hover="none" padding="none">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-semibold text-white-primary">
            Leads (Last {days} Days)
          </h3>
          {onDaysChange && (
            <div className="flex gap-1">
              {rangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onDaysChange(opt.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
                    days === opt.value
                      ? "bg-gold-gradient text-black"
                      : "glass text-white-muted hover:text-white-primary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <motion.div
          className="h-64"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0a0a0a",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "rgba(255,255,255,0.93)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="#D4AF37"
                strokeWidth={2}
                fill="url(#goldGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </GlassCard>
  );
}
