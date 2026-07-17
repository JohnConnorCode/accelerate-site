"use client";

import { motion } from "framer-motion";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  PlusCircle,
  Check,
  Mail,
  DollarSign,
  Users,
  Send,
  Share2,
  Calendar,
  CheckSquare,
  CreditCard,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  websiteStatusOptions,
  digitalToolOptions,
  industrySpecificQuestions,
} from "@/content/intake-questions";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { IntakeFormData, IntakeQuestion } from "@/lib/types";

const iconMap: Record<string, LucideIcon> = {
  CheckCircle,
  AlertCircle,
  XCircle,
  PlusCircle,
  Mail,
  DollarSign,
  Users,
  Send,
  Share2,
  Calendar,
  CheckSquare,
  CreditCard,
  X,
};

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DigitalPresenceStep({
  formData,
  onUpdate,
  onNext,
}: StepProps) {
  const selectedWebsite = formData.websiteStatus || "";
  const selectedTools = formData.currentTools || [];
  const industryAnswers = formData.industrySpecificAnswers || {};

  const industryQuestions = industrySpecificQuestions.filter(
    (q) => !q.industries || q.industries.includes(formData.industry!)
  );

  const handleWebsiteSelect = (value: string) => {
    onUpdate({ websiteStatus: value as IntakeFormData["websiteStatus"] });
  };

  const handleToolToggle = (value: string) => {
    const updated = selectedTools.includes(value)
      ? selectedTools.filter((t) => t !== value)
      : [...selectedTools, value];
    onUpdate({ currentTools: updated });
  };

  const handleIndustryAnswer = (
    questionId: string,
    value: string | string[]
  ) => {
    onUpdate({
      industrySpecificAnswers: {
        ...industryAnswers,
        [questionId]: value,
      },
    });
  };

  const renderIndustryQuestion = (question: IntakeQuestion) => {
    const currentValue = industryAnswers[question.id];

    switch (question.type) {
      case "single":
      case "button-group":
        return (
          <div key={question.id} className="space-y-3">
            <p className="text-sm font-medium text-white-primary">
              {question.question}
            </p>
            <div className="flex flex-wrap gap-2">
              {question.options.map((opt) => {
                const isSelected = currentValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      handleIndustryAnswer(question.id, opt.value)
                    }
                    className={cn(
                      "px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
                      "border",
                      isSelected
                        ? "bg-gold-gradient text-black border-transparent"
                        : "glass border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)] hover:text-white-primary"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case "multi":
        return (
          <div key={question.id} className="space-y-3">
            <p className="text-sm font-medium text-white-primary">
              {question.question}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {question.options.map((opt) => {
                const currentArr =
                  (currentValue as string[] | undefined) || [];
                const isChecked = currentArr.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 min-h-[44px]",
                      "border",
                      isChecked
                        ? "border-border-gold bg-[var(--glass-gold-bg)]"
                        : "border-border-glass hover:border-[var(--border-glass-hover)]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all",
                        isChecked
                          ? "bg-gold-gradient border-transparent"
                          : "border-border-glass bg-transparent"
                      )}
                    >
                      {isChecked && (
                        <Check className="w-3.5 h-3.5 text-black" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        isChecked ? "text-white-primary" : "text-white-secondary"
                      )}
                    >
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      case "text":
        return (
          <div key={question.id} className="space-y-3">
            <Input
              id={`iq-${question.id}`}
              label={question.question}
              placeholder="Type your answer..."
              value={(currentValue as string) || ""}
              onChange={(e) =>
                handleIndustryAnswer(question.id, e.target.value)
              }
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
          What does your digital presence look like today?
        </h2>
        <p className="text-white-secondary">
          Understanding where you are helps us map out where to go.
        </p>
      </div>

      {/* Website Status */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white-primary">
          Your website
        </h3>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {websiteStatusOptions.map((option) => {
            const Icon = iconMap[option.icon || ""] || CheckCircle;
            const isSelected = selectedWebsite === option.value;

            return (
              <motion.div key={option.value} variants={fadeUp}>
                <GlassCard
                  hover="lift"
                  padding="sm"
                  className={cn(
                    "cursor-pointer select-none flex items-center gap-3 min-h-[60px]",
                    isSelected
                      ? "border-[var(--border-gold-hover)] border-gold-glow glass-gold"
                      : ""
                  )}
                  onClick={() => handleWebsiteSelect(option.value)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleWebsiteSelect(option.value);
                    }
                  }}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 shrink-0",
                      isSelected ? "text-gold" : "text-white-muted"
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-white-primary" : "text-white-secondary"
                      )}
                    >
                      {option.label}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Current Tools */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white-primary">
          Tools you currently use
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {digitalToolOptions.map((tool) => {
            const Icon = iconMap[tool.icon || ""] || CheckSquare;
            const isChecked = selectedTools.includes(tool.value);

            return (
              <label
                key={tool.value}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 min-h-[44px]",
                  "border",
                  isChecked
                    ? "border-border-gold bg-[var(--glass-gold-bg)]"
                    : "border-border-glass hover:border-[var(--border-glass-hover)]"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all",
                    isChecked
                      ? "bg-gold-gradient border-transparent"
                      : "border-border-glass bg-transparent"
                  )}
                >
                  {isChecked && (
                    <Check className="w-3.5 h-3.5 text-black" />
                  )}
                </div>
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isChecked ? "text-gold" : "text-white-muted"
                  )}
                />
                <span
                  className={cn(
                    "text-sm",
                    isChecked ? "text-white-primary" : "text-white-secondary"
                  )}
                >
                  {tool.label}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChecked}
                  onChange={() => handleToolToggle(tool.value)}
                />
              </label>
            );
          })}
        </div>
      </div>

      {/* Industry-specific questions */}
      {industryQuestions.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white-primary">
            A few more questions for your industry
          </h3>
          {industryQuestions.map(renderIndustryQuestion)}
        </div>
      )}

      <Button onClick={onNext} className="w-full" size="lg">
        Continue
      </Button>
    </div>
  );
}
