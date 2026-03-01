"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import type { IntakeOption } from "@/lib/types";
import {
  Wrench,
  Scale,
  Briefcase,
  Building2,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  XCircle,
  PlusCircle,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wrench,
  Scale,
  Briefcase,
  Building2,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  XCircle,
  PlusCircle,
};

interface OptionCardsProps {
  options: IntakeOption[];
  onSelect: (value: string, label: string) => void;
}

export function OptionCards({ options, onSelect }: OptionCardsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: IntakeOption) => {
    setSelected(option.value);
    setTimeout(() => {
      onSelect(option.value, option.label);
    }, 300);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {options.map((option, i) => {
        const Icon = option.icon ? iconMap[option.icon] : null;
        const isSelected = selected === option.value;

        return (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <GlassCard
              hover="lift"
              padding="md"
              className={cn(
                "cursor-pointer transition-all duration-200 min-h-[72px]",
                isSelected
                  ? "border-[var(--gold-base)] ring-1 ring-[var(--gold-base)]"
                  : "border-transparent"
              )}
              onClick={() => handleSelect(option)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(option);
                }
              }}
            >
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    isSelected ? "bg-gold-gradient" : "bg-white/5"
                  )}>
                    <Icon className={cn("w-5 h-5", isSelected ? "text-black" : "text-[var(--gold-base)]")} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className={cn(
                    "font-medium text-sm",
                    isSelected ? "text-[var(--gold-base)]" : "text-white-primary"
                  )}>
                    {option.label}
                  </p>
                  {option.description && (
                    <p className="text-xs text-white-muted mt-0.5 line-clamp-2">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}
