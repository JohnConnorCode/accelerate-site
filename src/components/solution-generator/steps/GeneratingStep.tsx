"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { IntakeFormData } from "@/lib/types";

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  error: string | null;
}

const analysisSteps = [
  "Analyzing your business profile...",
  "Evaluating your industry landscape...",
  "Building your custom solution...",
  "Calculating ROI projections...",
];

export function GeneratingStep({ error }: StepProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (error) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    analysisSteps.forEach((_, index) => {
      const timer = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, index]);
      }, (index + 1) * 1000);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [error]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <GlassCard variant="prominent" padding="lg" className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-[var(--error)]/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-[var(--error)]" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-white-primary mb-2">
              Something went wrong
            </h3>
            <p className="text-white-secondary text-sm">{error}</p>
          </div>
          <Link href="/contact">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
            >
              Book a Call Instead
            </Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <GlassCard variant="prominent" padding="lg" className="max-w-md w-full text-center space-y-8">
        <div>
          <h3 className="text-xl md:text-2xl font-display font-bold text-white-primary mb-2">
            Building your growth plan
          </h3>
          <p className="text-white-secondary text-sm">
            Our AI is analyzing your business and creating a custom plan.
          </p>
        </div>

        <div className="space-y-4 text-left" aria-live="polite">
          {analysisSteps.map((step, index) => {
            const isCompleted = completedSteps.includes(index);
            const isActive =
              !isCompleted &&
              (index === 0 || completedSteps.includes(index - 1));

            return (
              <div
                key={index}
                className="flex items-center gap-3 min-h-[40px]"
                role="status"
              >
                <AnimatePresence mode="wait">
                  {isCompleted ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="w-6 h-6 rounded-full bg-gold-gradient flex items-center justify-center shrink-0"
                    >
                      <Check className="w-3.5 h-3.5 text-black" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div
                      key="spinner"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-6 h-6 flex items-center justify-center shrink-0"
                    >
                      <Loader2 className="w-5 h-5 text-gold animate-spin" aria-label="Loading" />
                    </motion.div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-border-glass shrink-0" />
                  )}
                </AnimatePresence>
                <span
                  className={cn(
                    "text-sm transition-colors duration-300",
                    isCompleted
                      ? "text-white-primary"
                      : isActive
                        ? "text-white-secondary"
                        : "text-white-muted"
                  )}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full progress-gold rounded-full"
            initial={{ width: "0%" }}
            animate={{
              width: `${(completedSteps.length / analysisSteps.length) * 100}%`,
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </GlassCard>
    </div>
  );
}
