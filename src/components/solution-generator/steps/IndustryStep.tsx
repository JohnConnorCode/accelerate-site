"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wrench,
  Scale,
  Briefcase,
  Building2,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { industryOptions } from "@/content/intake-questions";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { IntakeFormData } from "@/lib/types";

const iconMap: Record<string, LucideIcon> = {
  Wrench,
  Scale,
  Briefcase,
  Building2,
  HelpCircle,
};

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function IndustryStep({ formData, onUpdate, onNext }: StepProps) {
  const [selected, setSelected] = useState<string>(formData.industry || "");
  const [otherText, setOtherText] = useState(formData.industryOther || "");
  const [shouldAdvance, setShouldAdvance] = useState(false);

  const handleAdvance = useCallback(() => {
    onNext();
  }, [onNext]);

  useEffect(() => {
    if (shouldAdvance && selected && selected !== "other") {
      const timer = setTimeout(() => {
        handleAdvance();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [shouldAdvance, selected, handleAdvance]);

  const handleSelect = (value: string) => {
    setSelected(value);
    onUpdate({ industry: value as IntakeFormData["industry"] });
    if (value !== "other") {
      onUpdate({ industryOther: undefined });
      setShouldAdvance(true);
    } else {
      setShouldAdvance(false);
    }
  };

  const handleOtherContinue = () => {
    if (otherText.trim()) {
      onUpdate({ industryOther: otherText.trim() });
      onNext();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
          What type of business do you run?
        </h2>
        <p className="text-white-secondary">
          This helps us tailor our recommendations to your industry.
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {industryOptions.map((option) => {
          const Icon = iconMap[option.icon || ""] || HelpCircle;
          const isSelected = selected === option.value;

          return (
            <motion.div
              key={option.value}
              variants={fadeUp}
              className={cn(
                option.value === "other" && "sm:col-span-2 sm:max-w-xs sm:mx-auto"
              )}
            >
              <GlassCard
                hover="lift"
                padding="md"
                className={cn(
                  "cursor-pointer select-none min-h-[110px] flex items-start gap-4",
                  isSelected
                    ? "border-[var(--border-gold-hover)] border-gold-glow glass-gold"
                    : ""
                )}
                onClick={() => handleSelect(option.value)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(option.value);
                  }
                }}
              >
                <div
                  className={cn(
                    "w-11 h-11 rounded-lg flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-gold-gradient text-black"
                      : "bg-white/5 text-white-secondary"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-white-primary">
                    {option.label}
                  </p>
                  {option.description && (
                    <p className="text-sm text-white-secondary mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </motion.div>

      {selected === "other" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4"
        >
          <Input
            id="industry-other"
            label="Tell us your industry"
            placeholder="e.g., Healthcare, Retail, Education..."
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              onUpdate({ industryOther: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleOtherContinue();
              }
            }}
            autoFocus
          />
          <Button
            onClick={handleOtherContinue}
            disabled={!otherText.trim()}
            className="w-full sm:w-auto"
          >
            Continue
          </Button>
        </motion.div>
      )}
    </div>
  );
}
