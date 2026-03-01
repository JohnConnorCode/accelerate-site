"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  index?: number;
}

export function StatCard({ label, value, change, trend, icon: Icon, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <GlassCard hover="glow" padding="md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-white-muted">{label}</span>
          <Icon className="h-4 w-4 text-white-muted" />
        </div>
        <p className="text-2xl font-display font-bold text-gold-gradient">
          {value}
        </p>
        {change && (
          <p className={cn(
            "mt-1 text-xs flex items-center gap-1",
            trend === "up" && "text-[var(--success)]",
            trend === "down" && "text-[var(--error)]",
            !trend && "text-white-muted"
          )}>
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {change}
          </p>
        )}
      </GlassCard>
    </motion.div>
  );
}
