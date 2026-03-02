"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Shield,
  Smartphone,
  Gauge,
  Eye,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Mail,
  Loader2,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";


import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import { fadeUp, heroStagger, heroItem } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { WebsiteGradeResult, GradeCategory } from "@/lib/types";

// ========================================
// CONSTANTS
// ========================================

const ANALYSIS_STEPS = [
  { label: "Checking performance...", icon: Gauge },
  { label: "Analyzing SEO...", icon: Search },
  { label: "Testing mobile responsiveness...", icon: Smartphone },
  { label: "Reviewing security...", icon: Shield },
  { label: "Checking accessibility...", icon: Eye },
];

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof Gauge; label: string; description: string }
> = {
  performance: {
    icon: Gauge,
    label: "Performance",
    description: "Speed, load times, and core web vitals",
  },
  seo: {
    icon: Search,
    label: "SEO",
    description: "Search engine visibility and optimization",
  },
  mobile: {
    icon: Smartphone,
    label: "Mobile",
    description: "Mobile responsiveness and usability",
  },
  security: {
    icon: Shield,
    label: "Security",
    description: "HTTPS, headers, and vulnerability protection",
  },
  accessibility: {
    icon: Eye,
    label: "Accessibility",
    description: "WCAG compliance and inclusive design",
  },
};

// ========================================
// HELPERS
// ========================================

function getScoreColor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 40) return "#F59E0B";
  return "var(--error)";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  if (score >= 40) return "Poor";
  return "Critical";
}

function getIssueSeverityIcon(issue: string) {
  const lower = issue.toLowerCase();
  if (lower.includes("critical") || lower.includes("missing") || lower.includes("not use")) {
    return <XCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />;
  }
  if (lower.includes("consider") || lower.includes("could") || lower.includes("minor")) {
    return (
      <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
    );
  }
  return <XCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />;
}

// ========================================
// SCORE GAUGE
// ========================================

function ScoreGauge({ score, size = 180 }: { score: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`Website score: ${score} out of 100, rated ${label}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
          style={{
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-display text-5xl font-bold"
          style={{
            color,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {score}
        </motion.span>
        <motion.span
          className="text-sm text-white-secondary mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          out of 100
        </motion.span>
      </div>
    </div>
  );
}

// ========================================
// CATEGORY CARD
// ========================================

function CategoryCard({
  categoryKey,
  category,
}: {
  categoryKey: string;
  category: GradeCategory;
}) {
  const config = CATEGORY_CONFIG[categoryKey];
  if (!config) return null;

  const Icon = config.icon;
  const color = getScoreColor(category.score);

  return (
    <GlassCard variant="default" padding="lg" hover="lift" className="h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: `${color}15`,
              border: `1px solid ${color}30`,
            }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <h3
              className="font-display font-semibold text-[var(--heading-color)]"
            >
              {config.label}
            </h3>
            <p className="text-xs text-white-muted">{config.description}</p>
          </div>
        </div>
        <div
          className="font-display text-2xl font-bold"
          style={{
            color,
          }}
        >
          {category.score}
        </div>
      </div>

      {/* Mini progress bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-5">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${category.score}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
        />
      </div>

      {/* Issues */}
      <div className="space-y-3">
        {category.issues.map((issue, i) => (
          <div key={i} className="flex gap-2 text-sm">
            {getIssueSeverityIcon(issue)}
            <span className="text-white-secondary">{issue}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ========================================
// LOADING ANIMATION
// ========================================

function LoadingAnalysis({ stepIndex }: { stepIndex: number }) {
  return (
    <section className="py-24">
      <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="relative mx-auto w-20 h-20">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-[var(--gold-base)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="w-8 h-8 text-[var(--gold-base)]" />
            </div>
          </div>

          <div>
            <h2
              className="font-display text-2xl font-bold text-[var(--heading-color)] mb-2"
            >
              Analyzing Your Website
            </h2>
            <p className="text-white-secondary">
              Hang tight while we evaluate your site across five key areas.
            </p>
          </div>

          <div className="space-y-3">
            {ANALYSIS_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = i === stepIndex;
              const isComplete = i < stepIndex;

              return (
                <motion.div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                    isActive
                      ? "glass-gold"
                      : isComplete
                        ? "glass-prominent"
                        : "opacity-40"
                  )}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: isActive || isComplete ? 1 : 0.4, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-[var(--gold-base)] animate-spin" />
                  ) : (
                    <StepIcon className="w-5 h-5 text-white-muted" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      isActive
                        ? "text-white font-medium"
                        : isComplete
                          ? "text-white-secondary"
                          : "text-white-muted"
                    )}
                  >
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full progress-gold rounded-full"
              animate={{
                width: `${((stepIndex + 1) / ANALYSIS_STEPS.length) * 100}%`,
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ========================================
// RESULTS SECTION
// ========================================

function ResultsSection({
  result,
  onEmailSubmit,
  emailSent,
  emailError,
}: {
  result: WebsiteGradeResult;
  onEmailSubmit: (email: string) => void;
  emailSent: boolean;
  emailError: string | null;
}) {
  const [email, setEmail] = useState("");
  const scoreLabel = getScoreLabel(result.overallScore);
  const scoreColor = getScoreColor(result.overallScore);

  return (
    <>
      {/* Overall Score */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)] mb-6">
              Report for {new URL(result.url).hostname}
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-8"
            >
              Your Website Score
            </h2>
          </AnimateOnScroll>

          <AnimateOnScroll className="flex flex-col items-center">
            <ScoreGauge score={result.overallScore} size={200} />
            <motion.div
              className="mt-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <span
                className="text-lg font-semibold"
                style={{ color: scoreColor }}
              >
                {scoreLabel}
              </span>
              <p className="text-white-muted text-sm mt-1">
                Based on performance, SEO, mobile, security, and accessibility
              </p>
            </motion.div>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Category Cards */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-12">
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3"
            >
              Detailed{" "}
              <span className="text-gold-gradient">Breakdown</span>
            </h2>
            <p className="text-white-secondary">
              How your website performs across five critical areas.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(result.categories).map(([key, category]) => (
              <motion.div key={key} variants={fadeUp}>
                <CategoryCard categoryKey={key} category={category} />
              </motion.div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* AI Recommendations */}
      <section className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll className="text-center mb-10">
            <div className="inline-flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[var(--gold-base)]" />
              <span className="text-sm font-medium text-[var(--gold-light)] uppercase tracking-wide">
                AI-Powered
              </span>
            </div>
            <h2
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3"
            >
              Recommendations
            </h2>
            <p className="text-white-secondary">
              Prioritized actions to improve your website.
            </p>
          </AnimateOnScroll>

          <StaggerContainer className="space-y-4">
            {result.aiRecommendations.map((rec, i) => (
              <motion.div key={i} variants={fadeUp}>
                <GlassCard variant="default" padding="md" hover="glow">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gold-gradient flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-black">
                        {i + 1}
                      </span>
                    </div>
                    <p className="text-white-secondary text-sm leading-relaxed pt-1">
                      {rec}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <div className="section-divider" />

      {/* Email Capture */}
      <section className="py-16 sm:py-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="lg">
              {emailSent ? (
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="w-10 h-10 text-[var(--success)]" />
                  <h3
                    className="font-display text-xl font-bold text-[var(--heading-color)]"
                  >
                    Report Saved
                  </h3>
                  <p className="text-white-secondary text-sm">
                    We have saved your report. Check your inbox for a copy.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Mail className="w-5 h-5 text-[var(--gold-base)]" />
                    <h3
                      className="font-display text-xl font-bold text-[var(--heading-color)]"
                    >
                      Email Me This Report
                    </h3>
                  </div>
                  <p className="text-white-secondary text-sm mb-6">
                    Get a copy of your website grade report sent to your inbox
                    for future reference.
                  </p>
                  {emailError && (
                    <div className="flex items-center justify-center gap-2 text-sm text-[var(--error)] mb-4">
                      <AlertCircle className="w-4 h-4" />
                      {emailError}
                    </div>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (email.trim()) onEmailSubmit(email.trim());
                    }}
                    className="flex flex-col sm:flex-row gap-3"
                  >
                    <div className="flex-1">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        aria-label="Email address for report"
                      />
                    </div>
                    <Button type="submit" variant="primary" size="md">
                      Send Report
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                </>
              )}
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <AnimateOnScroll>
            <h2
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4"
            >
              Want Us to{" "}
              <span className="text-gold-gradient">Fix These Issues?</span>
            </h2>
            <p className="text-lg text-white-secondary mb-8 max-w-xl mx-auto">
              Our team builds fast, SEO-optimized websites with AI-powered
              features that convert visitors into customers.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button variant="primary" size="lg" pulse className="w-full sm:w-auto">
                  Get a Free Consultation
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/services">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  View Our Services
                </Button>
              </Link>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}

// ========================================
// MAIN COMPONENT
// ========================================

export function WebsiteGraderPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<WebsiteGradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Step through loading animation
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev >= ANALYSIS_STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Scroll to results once they appear
  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [result]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url.trim() || isLoading) return;

      setError(null);
      setResult(null);
      setIsLoading(true);
      setLoadingStep(0);
      setEmailSent(false);

      try {
        const response = await fetch("/api/grade-website", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to grade website");
        }

        // Ensure the loading animation finishes
        const minDelay = new Promise<void>((resolve) =>
          setTimeout(resolve, ANALYSIS_STEPS.length * 800 + 400)
        );
        await minDelay;

        setResult(data as WebsiteGradeResult);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong. Please try again."
        );
      } finally {
        setIsLoading(false);
        setLoadingStep(0);
      }
    },
    [url, isLoading]
  );

  const handleEmailSubmit = useCallback(
    async (email: string) => {
      if (!result) return;
      setEmailError(null);

      try {
        const res = await fetch("/api/grade-website", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: result.url, email }),
        });

        if (!res.ok) throw new Error("Request failed");

        setEmailSent(true);
      } catch {
        setEmailError("Failed to save your report. Please try again.");
      }
    },
    [result]
  );

  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 gradient-mesh opacity-40" />
          <div className="absolute inset-0 grid-overlay opacity-20" />
          <div className="hero-glow-orb hero-glow-orb-gold absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            variants={heroStagger}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={heroItem}>
              <div className="flex items-center justify-center gap-1.5 mb-6 text-sm font-semibold text-[var(--gold-light)]">
                <Globe className="w-4 h-4" />
                Free Website Analysis
              </div>
            </motion.div>

            <motion.h1
              variants={heroItem}
              className="page-heading leading-[1.1] mb-6"
            >
              How Does Your Website{" "}
              <span className="text-gold-gradient">Stack Up?</span>
            </motion.h1>

            <motion.p
              variants={heroItem}
              className="text-lg sm:text-xl text-[var(--white-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Get a free, instant analysis of your website across performance,
              SEO, mobile, security, and accessibility, with specific
              recommendations to improve.
            </motion.p>

            {/* URL Input Form */}
            <motion.div variants={heroItem} className="max-w-xl mx-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="Enter your website URL (e.g., example.com)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isLoading}
                      aria-label="Website URL"
                      className="text-base"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={isLoading || !url.trim()}
                    pulse={!isLoading && !!url.trim()}
                    className="sm:w-auto w-full whitespace-nowrap"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Grade My Website
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Error display */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-2 text-sm text-[var(--error)] justify-center"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>

              <p className="text-xs text-white-muted mt-4">
                No sign-up required. Results are instant and free.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LoadingAnalysis stepIndex={loadingStep} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {result && (
        <div ref={resultsRef}>
          <div className="section-divider" />
          <ResultsSection
            result={result}
            onEmailSubmit={handleEmailSubmit}
            emailSent={emailSent}
            emailError={emailError}
          />
        </div>
      )}

      {/* Pre-results: What We Analyze section (shown when no result yet) */}
      {!result && !isLoading && (
        <>
          <div className="section-divider" />

          <section className="py-16 sm:py-24">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <AnimateOnScroll className="text-center mb-12">
                <h2
                  className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-3"
                >
                  What We{" "}
                  <span className="text-gold-gradient">Analyze</span>
                </h2>
                <p className="text-white-secondary max-w-xl mx-auto">
                  Our grader evaluates your website across five critical
                  dimensions that determine how well it serves your business.
                </p>
              </AnimateOnScroll>

              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <motion.div key={key} variants={fadeUp}>
                      <GlassCard
                        variant="default"
                        padding="lg"
                        hover="lift"
                        className="text-center h-full"
                      >
                        <div className="w-12 h-12 rounded-xl bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center mx-auto mb-4">
                          <Icon className="w-6 h-6 text-[var(--gold-base)]" />
                        </div>
                        <h3
                          className="font-display text-lg font-semibold text-[var(--heading-color)] mb-2"
                        >
                          {config.label}
                        </h3>
                        <p className="text-sm text-white-secondary">
                          {config.description}
                        </p>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </StaggerContainer>
            </div>
          </section>

          <div className="section-divider" />

          {/* Why it matters */}
          <section className="py-16 sm:py-24">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <AnimateOnScroll>
                <h2
                  className="font-display text-2xl sm:text-3xl font-bold tracking-tight mb-4"
                >
                  Why Your Website Score{" "}
                  <span className="text-gold-gradient">Matters</span>
                </h2>
                <p className="text-white-secondary leading-relaxed mb-8 max-w-xl mx-auto">
                  Your website is the first impression most customers have of
                  your business. A slow, insecure, or hard-to-find site is
                  costing you clients and revenue every day.
                </p>
              </AnimateOnScroll>

              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  {
                    stat: "53%",
                    text: "of mobile visitors leave a site that takes over 3 seconds to load",
                  },
                  {
                    stat: "75%",
                    text: "of users judge a business's credibility based on their website design",
                  },
                  {
                    stat: "68%",
                    text: "of online experiences begin with a search engine query",
                  },
                ].map((item, i) => (
                  <motion.div key={i} variants={fadeUp}>
                    <GlassCard variant="gold" padding="md" hover="none">
                      <p
                        className="font-display text-3xl font-bold text-gold-gradient mb-2"
                      >
                        {item.stat}
                      </p>
                      <p className="text-sm text-white-secondary">
                        {item.text}
                      </p>
                    </GlassCard>
                  </motion.div>
                ))}
              </StaggerContainer>
            </div>
          </section>
        </>
      )}
    </>
  );
}
