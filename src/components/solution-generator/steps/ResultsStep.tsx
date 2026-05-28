"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Download,
  Share2,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { staggerContainer, fadeUp } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type {
  IntakeFormData,
  DigitalGrowthPlan,
  SolutionRecommendation,
} from "@/lib/types";

interface StepProps {
  formData: Partial<IntakeFormData>;
  onUpdate: (data: Partial<IntakeFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  plan: DigitalGrowthPlan | null;
  shareToken: string | null;
}

function SolutionCard({ solution }: { solution: SolutionRecommendation }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={cn(
        "glass rounded-xl overflow-clip transition-colors duration-300",
        isOpen ? "border-[rgba(var(--accent-rgb),0.2)]" : ""
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center justify-between w-full px-6 py-4 text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h4 className="font-semibold text-white-primary">{solution.name}</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gold-gradient text-black font-medium shrink-0">
              {solution.estimatedImpact}
            </span>
          </div>
          <p className="text-sm text-white-secondary mt-1 line-clamp-1">
            {solution.description}
          </p>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-white-muted shrink-0 ml-4" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white-muted shrink-0 ml-4" />
        )}
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-6 pb-5 space-y-4"
        >
          <div>
            <p className="text-sm font-medium text-gold mb-1">
              Why it matters
            </p>
            <p className="text-sm text-white-secondary">{solution.whyItMatters}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-white-primary mb-2">
              Features included
            </p>
            <ul className="space-y-1.5">
              {solution.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white-secondary">
                  <span className="text-gold mt-0.5 shrink-0">-</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-white-muted">Timeline:</span>{" "}
              <span className="text-white-primary">{solution.timeline}</span>
            </div>
            <div>
              <span className="text-white-muted">Investment:</span>{" "}
              <span className="text-white-primary">{solution.pricingDisplay}</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function ResultsStep({ plan, shareToken }: StepProps) {
  const router = useRouter();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleShare = useCallback(async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/plan/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setToastMessage("Plan link copied to clipboard!");
      setToastVisible(true);
    } catch {
      setToastMessage("Could not copy link. URL: " + url);
      setToastVisible(true);
    }
  }, [shareToken]);

  const handleDownloadPdf = useCallback(() => {
    if (!shareToken) return;
    window.open(`/api/plan-pdf/${shareToken}`, "_blank");
  }, [shareToken]);

  if (!plan) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <GlassCard variant="prominent" padding="lg" className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-12 h-12 text-white-muted mx-auto" />
          <div>
            <h3 className="text-xl font-display font-bold text-white-primary mb-2">
              No plan available
            </h3>
            <p className="text-white-secondary text-sm">
              Something went wrong generating your plan. Please try again or book a call with our team.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              router.push("/contact");
            }}
          >
            Book a Call
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white-primary mb-2">
            Your <span className="text-gold-gradient">Digital Growth Plan</span>
          </h2>
          <p className="text-white-secondary">
            Here is a personalized roadmap built for{" "}
            <span className="text-white-primary font-medium">your business</span>.
          </p>
        </motion.div>
      </div>

      {/* Executive Summary */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        <GlassCard variant="gold" padding="lg">
          <h3 className="text-lg font-display font-bold text-gold-gradient mb-3">
            Executive Summary
          </h3>
          <p className="text-white-primary leading-relaxed">
            {plan.executiveSummary}
          </p>
        </GlassCard>
      </motion.div>

      {/* Recommended Solutions */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        <h3 className="text-xl font-display font-bold text-white-primary">
          Recommended Solutions
        </h3>
        {plan.recommendations.map((rec, index) => (
          <motion.div key={index} variants={fadeUp}>
            <SolutionCard solution={rec} />
          </motion.div>
        ))}
      </motion.div>

      {/* Implementation Roadmap */}
      <div className="space-y-6">
        <h3 className="text-xl font-display font-bold text-white-primary">
          Implementation Roadmap
        </h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--gold-base)] via-[var(--gold-light)] to-[var(--gold-champagne)]" />

          <div className="space-y-8">
            {plan.implementationRoadmap.map((phase) => (
              <motion.div
                key={phase.phase}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="relative pl-14"
              >
                {/* Phase marker */}
                <div className="absolute left-2 top-1 w-7 h-7 rounded-full bg-gold-gradient text-black flex items-center justify-center text-xs font-bold">
                  {phase.phase}
                </div>

                <GlassCard padding="md" hover="none">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h4 className="font-semibold text-white-primary">
                      {phase.name}
                    </h4>
                    <span className="text-xs text-gold bg-[var(--glass-gold-bg)] px-2 py-1 rounded-full shrink-0">
                      {phase.duration}
                    </span>
                  </div>
                  <p className="text-sm text-white-secondary mb-3">
                    {phase.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {phase.solutions.map((sol, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded bg-white/5 text-white-muted"
                      >
                        {sol}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ROI Projection */}
      <div className="space-y-4">
        <h3 className="text-xl font-display font-bold text-white-primary">
          ROI Projection
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 90-Day */}
          <GlassCard padding="md" hover="none">
            <h4 className="text-sm font-semibold text-gold mb-4">
              90-Day Projection
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white-secondary">Inquiry increase</span>
                <span className="text-sm font-medium text-white-primary">
                  {plan.roiProjection.ninetyDay.estimatedLeadIncrease}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white-secondary">Time saved</span>
                <span className="text-sm font-medium text-white-primary">
                  {plan.roiProjection.ninetyDay.estimatedTimeSaved}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white-secondary">Revenue impact</span>
                <span className="text-sm font-medium text-gold-gradient">
                  {plan.roiProjection.ninetyDay.estimatedRevenueImpact}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* 12-Month */}
          <GlassCard variant="gold" padding="md" hover="none">
            <h4 className="text-sm font-semibold text-gold mb-4">
              12-Month Projection
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white-secondary">Inquiry increase</span>
                <span className="text-sm font-medium text-white-primary">
                  {plan.roiProjection.twelveMonth.estimatedLeadIncrease}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white-secondary">Time saved</span>
                <span className="text-sm font-medium text-white-primary">
                  {plan.roiProjection.twelveMonth.estimatedTimeSaved}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white-secondary">Revenue impact</span>
                <span className="text-sm font-medium text-gold-gradient">
                  {plan.roiProjection.twelveMonth.estimatedRevenueImpact}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
        <p className="text-xs text-white-muted italic">
          {plan.roiProjection.disclaimer}
        </p>
      </div>

      {/* Investment Summary */}
      <div className="space-y-4">
        <h3 className="text-xl font-display font-bold text-white-primary">
          Investment Summary
        </h3>
        <GlassCard padding="md" hover="none">
          {/* One-time costs */}
          {plan.investmentSummary.oneTimeCosts.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white-primary mb-3">
                One-time costs
              </h4>
              <div className="space-y-2">
                {plan.investmentSummary.oneTimeCosts.map((cost, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-white-secondary">{cost.item}</span>
                    <span className="text-sm text-white-primary font-medium">
                      {formatCurrency(cost.amount)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border-glass pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-white-primary">
                      Total one-time
                    </span>
                    <span className="text-sm font-bold text-gold-gradient">
                      {formatCurrency(plan.investmentSummary.totalOneTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Monthly costs */}
          {plan.investmentSummary.monthlyCosts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white-primary mb-3">
                Monthly costs
              </h4>
              <div className="space-y-2">
                {plan.investmentSummary.monthlyCosts.map((cost, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-white-secondary">{cost.item}</span>
                    <span className="text-sm text-white-primary font-medium">
                      {formatCurrency(cost.amount)}/mo
                    </span>
                  </div>
                ))}
                <div className="border-t border-border-glass pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-white-primary">
                      Total monthly
                    </span>
                    <span className="text-sm font-bold text-gold-gradient">
                      {formatCurrency(plan.investmentSummary.totalMonthly)}/mo
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {plan.investmentSummary.budgetNotes && (
            <p className="text-xs text-white-muted mt-4 italic">
              {plan.investmentSummary.budgetNotes}
            </p>
          )}
        </GlassCard>
      </div>

      {/* Next Steps */}
      <div className="space-y-4">
        <h3 className="text-xl font-display font-bold text-white-primary">
          Next Steps
        </h3>
        <GlassCard padding="md" hover="none">
          <ol className="space-y-3">
            {plan.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gold-gradient text-black text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-white-secondary">{step}</span>
              </li>
            ))}
          </ol>
        </GlassCard>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button
          variant="primary"
          size="lg"
          pulse
          className="flex-1 gap-2"
          onClick={() => {
            router.push("/contact");
          }}
        >
          <CalendarCheck className="w-5 h-5" />
          Book a Free Discovery Call
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="flex-1 gap-2"
          onClick={handleDownloadPdf}
        >
          <Download className="w-5 h-5" />
          Download as PDF
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="flex-1 gap-2"
          onClick={handleShare}
        >
          <Share2 className="w-5 h-5" />
          Share This Plan
        </Button>
      </div>

      <Toast
        message={toastMessage}
        type="success"
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
    </div>
  );
}
