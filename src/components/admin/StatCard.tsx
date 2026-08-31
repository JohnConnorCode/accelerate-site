"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminSurface } from "@/components/admin/AdminSurface";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  index?: number;
}

export function StatCard({ label, value, change, trend, icon: Icon, index = 0 }: StatCardProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { delay: index * 0.04, duration: 0.24 }}
    >
      <AdminSurface padding="lg" className="h-full">
        <div className="mb-3 flex items-center justify-between">
          <span className="admin-copy text-sm">{label}</span>
          <Icon className="size-4 text-[var(--admin-muted)]" />
        </div>
        <p className="font-display text-2xl font-bold tabular-nums text-[var(--admin-ink)]">
          {value}
        </p>
        {change && (
          <p className={cn(
            "mt-1 text-xs flex items-center gap-1",
            trend === "up" && "text-[var(--success)]",
            trend === "down" && "text-[var(--error)]",
            !trend && "text-[var(--admin-muted)]"
          )}>
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {change}
          </p>
        )}
      </AdminSurface>
    </motion.div>
  );
}
