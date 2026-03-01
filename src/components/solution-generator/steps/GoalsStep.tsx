"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Zap,
  Repeat,
  Globe,
  RefreshCw,
  DollarSign,
  BarChart3,
  Scissors,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { goalOptions } from "@/content/intake-questions";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { IntakeFormData } from "@/lib/types";

const iconMap: Record<string, LucideIcon> = {
  TrendingUp,
  Zap,
  Repeat,
  Globe,
  RefreshCw,
  DollarSign,
  BarChart3,
  Scissors,
  HelpCircle,
};

const MAX_GOALS = 3;

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GoalsStep({ formData, onUpdate, onNext }: StepProps) {
  const selected = formData.topGoals || [];

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onUpdate({ topGoals: selected.filter((g) => g !== value) });
    } else if (selected.length < MAX_GOALS) {
      onUpdate({ topGoals: [...selected, value] });
    }
  };

  const getSelectionOrder = (value: string): number => {
    const index = selected.indexOf(value);
    return index >= 0 ? index + 1 : 0;
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
          What matters most to you?
        </h2>
        <p className="text-white-secondary">
          Select your top {MAX_GOALS} priorities ({selected.length}/{MAX_GOALS}{" "}
          selected)
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {goalOptions.map((goal) => {
          const Icon = iconMap[goal.icon || ""] || HelpCircle;
          const isSelected = selected.includes(goal.value);
          const order = getSelectionOrder(goal.value);
          const isDisabled = !isSelected && selected.length >= MAX_GOALS;

          return (
            <motion.div key={goal.value} variants={fadeUp}>
              <GlassCard
                hover={isDisabled ? "none" : "lift"}
                padding="md"
                className={cn(
                  "relative select-none flex items-start gap-4 min-h-[80px]",
                  isSelected
                    ? "border-[var(--border-gold-hover)] border-gold-glow glass-gold cursor-pointer"
                    : isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer"
                )}
                onClick={() => !isDisabled && handleToggle(goal.value)}
                role="checkbox"
                aria-checked={isSelected}
                aria-disabled={isDisabled}
                tabIndex={isDisabled ? -1 : 0}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
                    e.preventDefault();
                    handleToggle(goal.value);
                  }
                }}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gold-gradient text-black flex items-center justify-center text-xs font-bold shadow-md">
                    {order}
                  </div>
                )}
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-gold-gradient text-black"
                      : "bg-white/5 text-white-secondary"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-white-primary text-sm">
                    {goal.label}
                  </p>
                  {goal.description && (
                    <p className="text-xs text-white-secondary mt-1">
                      {goal.description}
                    </p>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </motion.div>

      <Button
        onClick={onNext}
        disabled={selected.length === 0}
        className="w-full"
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}
