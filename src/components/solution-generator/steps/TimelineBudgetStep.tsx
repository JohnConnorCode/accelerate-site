"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { timelineOptions, budgetOptions } from "@/content/intake-questions";
import { fadeUp, staggerContainer } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { IntakeFormData } from "@/lib/types";

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function TimelineBudgetStep({ formData, onUpdate, onNext }: StepProps) {
  const selectedTimeline = formData.timeline || "";
  const selectedBudget = formData.budgetRange || "";

  const canContinue = !!selectedTimeline && !!selectedBudget;

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
          Timeline and budget
        </h2>
        <p className="text-white-secondary">
          This helps us recommend solutions that fit your schedule and investment range.
        </p>
      </div>

      {/* Timeline */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        <h3 className="text-lg font-semibold text-white-primary">
          When are you looking to get started?
        </h3>
        <div className="flex flex-wrap gap-3">
          {timelineOptions.map((option) => {
            const isSelected = selectedTimeline === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                variants={fadeUp}
                onClick={() =>
                  onUpdate({
                    timeline: option.value as IntakeFormData["timeline"],
                  })
                }
                className={cn(
                  "px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
                  "border",
                  isSelected
                    ? "bg-gold-gradient text-black border-transparent border-gold-glow"
                    : "glass border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)] hover:text-white-primary"
                )}
                role="radio"
                aria-checked={isSelected}
              >
                {option.label}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Budget */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        <h3 className="text-lg font-semibold text-white-primary">
          What is your initial investment range?
        </h3>
        <div className="flex flex-wrap gap-3">
          {budgetOptions.map((option) => {
            const isSelected = selectedBudget === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                variants={fadeUp}
                onClick={() =>
                  onUpdate({
                    budgetRange: option.value as IntakeFormData["budgetRange"],
                  })
                }
                className={cn(
                  "group relative px-5 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
                  "border",
                  isSelected
                    ? "bg-gold-gradient text-black border-transparent border-gold-glow"
                    : "glass border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)] hover:text-white-primary"
                )}
                role="radio"
                aria-checked={isSelected}
              >
                <span>{option.label}</span>
                {option.priceHint && (
                  <span
                    className={cn(
                      "block text-xs mt-1 font-normal",
                      isSelected ? "text-black/70" : "text-white-muted"
                    )}
                  >
                    {option.priceHint}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <Button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full"
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}
