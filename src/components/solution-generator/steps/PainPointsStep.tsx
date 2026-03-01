"use client";

import { motion } from "framer-motion";
import {
  TrendingDown,
  Clock,
  Repeat,
  UserX,
  Monitor,
  Search,
  BarChart3,
  TrendingUp,
  PhoneMissed,
  FileText,
  Calendar,
  Moon,
  FolderOpen,
  Users,
  CalendarX,
  Award,
  Thermometer,
  Target,
  Database,
  Check,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  basePainPoints,
  industryPainPoints,
} from "@/content/intake-questions";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { IntakeFormData } from "@/lib/types";

const iconMap: Record<string, LucideIcon> = {
  TrendingDown,
  Clock,
  Repeat,
  UserX,
  Monitor,
  Search,
  BarChart3,
  TrendingUp,
  PhoneMissed,
  FileText,
  Calendar,
  Moon,
  FolderOpen,
  Users,
  CalendarX,
  Award,
  Thermometer,
  Target,
  Database,
  HelpCircle,
};

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PainPointsStep({ formData, onUpdate, onNext }: StepProps) {
  const selected = formData.painPoints || [];
  const otherText = formData.painPointsOther || "";

  const industry = formData.industry;
  const extraPainPoints = industry ? industryPainPoints[industry] || [] : [];
  const allPainPoints = [...basePainPoints, ...extraPainPoints];

  const handleToggle = (value: string) => {
    const updated = selected.includes(value)
      ? selected.filter((p) => p !== value)
      : [...selected, value];
    onUpdate({ painPoints: updated });
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
          What is costing you the most right now?
        </h2>
        <p className="text-white-secondary">
          Select all that apply. These pain points shape your growth plan.
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {allPainPoints.map((point) => {
          const Icon = iconMap[point.icon || ""] || HelpCircle;
          const isChecked = selected.includes(point.value);

          return (
            <motion.label
              key={point.value}
              variants={fadeUp}
              className={cn(
                "flex items-start gap-3 px-4 py-4 rounded-xl cursor-pointer transition-all duration-200 min-h-[44px]",
                "border",
                isChecked
                  ? "border-[var(--border-gold)] bg-[var(--glass-gold-bg)] border-gold-glow"
                  : "glass border-[var(--border-glass)] hover:border-[var(--border-glass-hover)]"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all",
                  isChecked
                    ? "bg-gold-gradient border-transparent"
                    : "border-[var(--border-glass)] bg-transparent"
                )}
              >
                {isChecked && (
                  <Check className="w-3.5 h-3.5 text-black" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isChecked
                        ? "text-[var(--gold-base)]"
                        : "text-white-muted"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isChecked ? "text-white-primary" : "text-white-secondary"
                    )}
                  >
                    {point.label}
                  </span>
                </div>
                {point.description && (
                  <p className="text-xs text-white-muted mt-1 ml-6">
                    {point.description}
                  </p>
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={isChecked}
                onChange={() => handleToggle(point.value)}
              />
            </motion.label>
          );
        })}
      </motion.div>

      <div className="space-y-3">
        <Textarea
          id="pain-points-other"
          label="Anything else we should know?"
          placeholder="Tell us about other challenges you face..."
          value={otherText}
          onChange={(e) => onUpdate({ painPointsOther: e.target.value })}
          className="min-h-[80px]"
        />
      </div>

      <Button onClick={onNext} disabled={selected.length === 0} className="w-full" size="lg">
        Continue
      </Button>
    </div>
  );
}
