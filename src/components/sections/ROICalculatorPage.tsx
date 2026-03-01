"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calculator,
  TrendingUp,
  Clock,
  DollarSign,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { fadeUp, scaleUp } from "@/lib/animations";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  Industry,
  ROICalculatorInputs,
  ROICalculatorResult,
} from "@/lib/types";

// ========================================
// CONSTANTS
// ========================================

const INDUSTRY_OPTIONS = [
  { value: "home_services", label: "Home Services" },
  { value: "law_firm", label: "Law Firm" },
  { value: "professional_services", label: "Professional Services" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const INDUSTRY_MULTIPLIERS: Record<Industry, number> = {
  home_services: 1.35,
  law_firm: 1.4,
  professional_services: 1.3,
  real_estate: 1.25,
  other: 1.3,
};

const INDUSTRY_DEFAULT_DEAL_VALUE: Record<Industry, number> = {
  home_services: 2500,
  law_firm: 5000,
  professional_services: 3500,
  real_estate: 8000,
  other: 3000,
};

const CLOSE_RATE_IMPROVEMENT = 1.2;
const TIME_SAVED_FACTOR = 0.6;
const HOURLY_VALUE = 50;
const ONE_TIME_INVESTMENT = 5000;
const MONTHLY_INVESTMENT = 300;


// ========================================
// ROI CALCULATION
// ========================================

function calculateROI(inputs: ROICalculatorInputs): ROICalculatorResult {
  const { industry, monthlyLeads, averageDealValue, closeRate, hoursOnManualTasks } = inputs;

  const currentCloseRate = closeRate / 100;
  const currentMonthlyRevenue = monthlyLeads * averageDealValue * currentCloseRate;

  const projectedLeads = monthlyLeads * INDUSTRY_MULTIPLIERS[industry];
  const improvedCloseRate = currentCloseRate * CLOSE_RATE_IMPROVEMENT;
  const projectedMonthlyRevenue = projectedLeads * averageDealValue * improvedCloseRate;

  const additionalMonthlyRevenue = projectedMonthlyRevenue - currentMonthlyRevenue;
  const annualRevenueImpact = additionalMonthlyRevenue * 12;

  const timeSavedPerWeek = hoursOnManualTasks * TIME_SAVED_FACTOR;
  const costSavedPerMonth = timeSavedPerWeek * HOURLY_VALUE * 4;

  const annualInvestment = ONE_TIME_INVESTMENT + MONTHLY_INVESTMENT * 12;
  const annualGain = annualRevenueImpact + costSavedPerMonth * 12;
  const roiPercentage =
    annualInvestment > 0
      ? ((annualGain - annualInvestment) / annualInvestment) * 100
      : 0;

  const paybackPeriodMonths =
    additionalMonthlyRevenue + costSavedPerMonth > 0
      ? ONE_TIME_INVESTMENT / (additionalMonthlyRevenue + costSavedPerMonth)
      : 0;

  return {
    currentMonthlyRevenue,
    projectedMonthlyRevenue,
    additionalMonthlyRevenue,
    annualRevenueImpact,
    timeSavedPerWeek,
    costSavedPerMonth,
    roiPercentage,
    paybackPeriodMonths,
  };
}

// ========================================
// COMPARISON BAR
// ========================================

function ComparisonBar({
  label,
  current,
  projected,
}: {
  label: string;
  current: number;
  projected: number;
}) {
  const maxValue = Math.max(current, projected, 1);
  const currentPercent = (current / maxValue) * 100;
  const projectedPercent = (projected / maxValue) * 100;

  return (
    <div className="space-y-2">
      <p className="text-sm text-white-secondary">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white-muted w-16 shrink-0">Now</span>
          <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/15"
              initial={{ width: 0 }}
              animate={{ width: `${currentPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <span className="text-sm text-white-secondary font-medium w-24 text-right shrink-0">
            {formatCurrency(current)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--gold-base)] w-16 shrink-0">
            After
          </span>
          <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full progress-gold"
              initial={{ width: 0 }}
              animate={{ width: `${projectedPercent}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            />
          </div>
          <span className="text-sm text-gold-gradient font-semibold w-24 text-right shrink-0">
            {formatCurrency(projected)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ========================================
// STAT CARD
// ========================================

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <GlassCard
      variant={highlight ? "gold" : "default"}
      padding="md"
      hover="glow"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            highlight
              ? "bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)]"
              : "bg-white/5 border border-[var(--border-glass)]"
          )}
        >
          <Icon
            className={cn(
              "w-5 h-5",
              highlight ? "text-[var(--gold-base)]" : "text-white-secondary"
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-white-muted uppercase tracking-wider mb-1">
            {label}
          </p>
          <p
            className={cn(
              "font-display text-xl sm:text-2xl font-bold truncate",
              highlight ? "text-gold-gradient" : "text-white"
            )}
          >
            {value}
          </p>
          {sublabel && (
            <p className="text-xs text-white-muted mt-0.5">{sublabel}</p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export function ROICalculatorPage() {
  const [inputs, setInputs] = useState<ROICalculatorInputs>({
    industry: "home_services",
    monthlyLeads: 30,
    averageDealValue: INDUSTRY_DEFAULT_DEAL_VALUE.home_services,
    closeRate: 20,
    monthlyAdSpend: 2000,
    hoursOnManualTasks: 10,
  });

  const updateField = useCallback(
    <K extends keyof ROICalculatorInputs>(
      field: K,
      value: ROICalculatorInputs[K]
    ) => {
      setInputs((prev) => {
        const next = { ...prev, [field]: value };
        // When industry changes, update the default deal value
        if (field === "industry") {
          next.averageDealValue =
            INDUSTRY_DEFAULT_DEAL_VALUE[value as Industry];
        }
        return next;
      });
    },
    []
  );

  const result = useMemo(() => calculateROI(inputs), [inputs]);

  return (
    <>
      {/* ======== HERO ======== */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 gradient-mesh opacity-40" />
          <div className="absolute inset-0 grid-overlay opacity-20" />
          <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <AnimateOnScroll>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-gold mb-8">
              <Calculator className="w-4 h-4 text-[var(--gold-base)]" />
              <span className="text-sm text-[var(--gold-light)] font-medium">
                Free ROI Calculator
              </span>
            </div>
            <h1
              className="page-heading leading-[1.1] mb-6"
            >
              Calculate Your{" "}
              <span className="text-gold-gradient">ROI</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
              Enter your current numbers and see the projected impact of
              AI-powered automation on your revenue, time savings, and overall
              return on investment.
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* ======== CALCULATOR ======== */}
      <section className="py-16 sm:py-24 bg-[var(--bg-base)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* ---- INPUT PANEL ---- */}
            <AnimateOnScroll>
              <GlassCard variant="prominent" padding="lg">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-[var(--gold-base)]" />
                  </div>
                  <h2
                    className="font-display text-xl sm:text-2xl font-bold text-white"
                  >
                    Your Business Numbers
                  </h2>
                </div>

                <div className="space-y-5">
                  {/* Industry */}
                  <Select
                    id="industry"
                    label="Industry"
                    options={INDUSTRY_OPTIONS}
                    value={inputs.industry}
                    onChange={(e) =>
                      updateField("industry", e.target.value as Industry)
                    }
                  />

                  {/* Monthly Leads */}
                  <Input
                    id="monthlyLeads"
                    label="Monthly Leads"
                    type="number"
                    min={0}
                    value={inputs.monthlyLeads}
                    onChange={(e) =>
                      updateField(
                        "monthlyLeads",
                        Math.max(0, parseInt(e.target.value) || 0)
                      )
                    }
                  />

                  {/* Average Deal Value */}
                  <div className="w-full">
                    <label
                      htmlFor="dealValue"
                      className="block text-sm text-white-secondary mb-2"
                    >
                      Average Deal Value
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white-muted text-sm pointer-events-none">
                        $
                      </span>
                      <input
                        id="dealValue"
                        type="number"
                        min={0}
                        value={inputs.averageDealValue}
                        onChange={(e) =>
                          updateField(
                            "averageDealValue",
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className={cn(
                          "w-full pl-8 pr-4 py-3 rounded-lg",
                          "bg-[var(--bg-subtle)] border border-[var(--border-glass)]",
                          "text-[var(--white-primary)] placeholder:text-[var(--white-muted)]",
                          "focus:outline-none focus:border-[var(--gold-base)] focus:ring-1 focus:ring-[var(--gold-base)]/30",
                          "transition-all duration-200"
                        )}
                      />
                    </div>
                  </div>

                  {/* Close Rate */}
                  <div className="w-full">
                    <label
                      htmlFor="closeRate"
                      className="block text-sm text-white-secondary mb-2"
                    >
                      Close Rate: {inputs.closeRate}%
                    </label>
                    <input
                      id="closeRate"
                      type="range"
                      min={1}
                      max={80}
                      step={1}
                      value={inputs.closeRate}
                      aria-valuetext={`${inputs.closeRate}%`}
                      onChange={(e) =>
                        updateField("closeRate", parseInt(e.target.value))
                      }
                      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-[var(--gold-base)]"
                    />
                    <div className="flex justify-between text-xs text-white-muted mt-1">
                      <span>1%</span>
                      <span>80%</span>
                    </div>
                  </div>

                  {/* Monthly Ad Spend */}
                  <div className="w-full">
                    <label
                      htmlFor="adSpend"
                      className="block text-sm text-white-secondary mb-2"
                    >
                      Monthly Ad Spend
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white-muted text-sm pointer-events-none">
                        $
                      </span>
                      <input
                        id="adSpend"
                        type="number"
                        min={0}
                        value={inputs.monthlyAdSpend}
                        onChange={(e) =>
                          updateField(
                            "monthlyAdSpend",
                            Math.max(0, parseInt(e.target.value) || 0)
                          )
                        }
                        className={cn(
                          "w-full pl-8 pr-4 py-3 rounded-lg",
                          "bg-[var(--bg-subtle)] border border-[var(--border-glass)]",
                          "text-[var(--white-primary)] placeholder:text-[var(--white-muted)]",
                          "focus:outline-none focus:border-[var(--gold-base)] focus:ring-1 focus:ring-[var(--gold-base)]/30",
                          "transition-all duration-200"
                        )}
                      />
                    </div>
                  </div>

                  {/* Hours on Manual Tasks */}
                  <Input
                    id="manualHours"
                    label="Hours Spent on Manual Tasks per Week"
                    type="number"
                    min={0}
                    value={inputs.hoursOnManualTasks}
                    onChange={(e) =>
                      updateField(
                        "hoursOnManualTasks",
                        Math.max(0, parseInt(e.target.value) || 0)
                      )
                    }
                  />
                </div>
              </GlassCard>
            </AnimateOnScroll>

            {/* ---- RESULTS PANEL ---- */}
            <AnimateOnScroll delay={0.15}>
              <div className="space-y-6">
                {/* ROI Percentage - Big hero number */}
                <GlassCard variant="gold" padding="lg" hover="glow">
                  <motion.div
                    key={result.roiPercentage.toFixed(0)}
                    variants={scaleUp}
                    initial="hidden"
                    animate="visible"
                    className="text-center"
                  >
                    <p className="text-sm text-white-muted uppercase tracking-wider mb-2">
                      Projected ROI
                    </p>
                    <p
                      className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-gold-gradient leading-none"
                    >
                      {result.roiPercentage >= 0
                        ? `${Math.round(result.roiPercentage).toLocaleString()}%`
                        : "---"}
                    </p>
                    <p className="text-xs text-white-muted mt-3">
                      Estimated first-year return on investment
                    </p>
                  </motion.div>
                </GlassCard>

                {/* Revenue Comparison */}
                <GlassCard variant="prominent" padding="lg" hover="glow">
                  <div className="flex items-center gap-2 mb-5">
                    <BarChart3 className="w-5 h-5 text-[var(--gold-base)]" />
                    <h3 className="font-display text-base font-semibold text-white">
                      Revenue Comparison
                    </h3>
                  </div>
                  <ComparisonBar
                    label="Monthly Revenue"
                    current={result.currentMonthlyRevenue}
                    projected={result.projectedMonthlyRevenue}
                  />
                </GlassCard>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatCard
                    icon={DollarSign}
                    label="Additional Monthly Revenue"
                    value={formatCurrency(result.additionalMonthlyRevenue)}
                    highlight
                  />
                  <StatCard
                    icon={TrendingUp}
                    label="Annual Revenue Impact"
                    value={formatCurrency(result.annualRevenueImpact)}
                    highlight
                  />
                  <StatCard
                    icon={Clock}
                    label="Time Saved / Week"
                    value={`${result.timeSavedPerWeek.toFixed(1)} hrs`}
                    sublabel={`${formatCurrency(result.costSavedPerMonth)}/mo saved`}
                  />
                  <StatCard
                    icon={Calculator}
                    label="Payback Period"
                    value={
                      result.paybackPeriodMonths > 0
                        ? `${result.paybackPeriodMonths.toFixed(1)} mo`
                        : "---"
                    }
                    sublabel="Until investment is recovered"
                  />
                </div>

                {/* Investment Breakdown */}
                <GlassCard variant="default" padding="md" hover="none">
                  <h3
                    className="font-display text-sm font-semibold text-white-secondary mb-3"
                  >
                    Investment Estimate
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white-muted">
                        One-time setup (Grow package)
                      </span>
                      <span className="text-white-secondary font-medium">
                        {formatCurrency(ONE_TIME_INVESTMENT)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white-muted">Monthly service</span>
                      <span className="text-white-secondary font-medium">
                        {formatCurrency(MONTHLY_INVESTMENT)}/mo
                      </span>
                    </div>
                    <div className="h-px bg-[var(--border-glass)] my-2" />
                    <div className="flex justify-between">
                      <span className="text-white-muted">
                        First-year total
                      </span>
                      <span className="text-white font-semibold">
                        {formatCurrency(
                          ONE_TIME_INVESTMENT + MONTHLY_INVESTMENT * 12
                        )}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ======== DISCLAIMER + CTA ======== */}
      <section className="py-16 sm:py-24 bg-[var(--bg-base)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-radial from-[rgba(212,175,55,0.06)] to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Disclaimer */}
          <AnimateOnScroll>
            <p className="text-sm text-white-muted text-center max-w-2xl mx-auto mb-12 leading-relaxed">
              These projections are estimates based on industry averages and the
              inputs you provided. Actual results will vary depending on your
              market, competition, execution, and other factors. This calculator
              is intended to give you a directional sense of potential ROI, not
              a guarantee.
            </p>
          </AnimateOnScroll>

          {/* CTA */}
          <AnimateOnScroll variants={fadeUp}>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-10 sm:p-14">
                <h2
                  className="section-heading mb-4"
                >
                  Ready to See Your{" "}
                  <span className="text-gold-gradient">Custom Plan</span>?
                </h2>
                <p className="text-lg text-white/65 max-w-xl mx-auto mb-8">
                  Take 2 minutes to answer a few questions about your business
                  and get a personalized growth strategy with detailed pricing
                  and projected ROI.
                </p>
                <Link href="/#solution-generator">
                  <Button variant="primary" size="lg" pulse>
                    Get Your Custom Growth Plan
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}
