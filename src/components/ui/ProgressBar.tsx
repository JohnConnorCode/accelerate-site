"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  return (
    <div
      className={cn(
        "w-full h-1.5 bg-white/5 rounded-full overflow-hidden",
        className
      )}
    >
      <motion.div
        className="h-full progress-gold rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    </div>
  );
}
