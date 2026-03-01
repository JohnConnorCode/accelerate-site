"use client";

import { useReducer, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { stepTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type {
  GeneratorState,
  GeneratorAction,
  GeneratorStep,
  IntakeFormData,
  DigitalGrowthPlan,
} from "@/lib/types";

import { IndustryStep } from "./steps/IndustryStep";
import { BusinessStep } from "./steps/BusinessStep";
import { DigitalPresenceStep } from "./steps/DigitalPresenceStep";
import { PainPointsStep } from "./steps/PainPointsStep";
import { GoalsStep } from "./steps/GoalsStep";
import { TimelineBudgetStep } from "./steps/TimelineBudgetStep";
import { ContactStep } from "./steps/ContactStep";
import { GeneratingStep } from "./steps/GeneratingStep";
import { ResultsStep } from "./steps/ResultsStep";

// ========================================
// Step order and progress mapping
// ========================================

const STEP_ORDER: GeneratorStep[] = [
  "industry",
  "business",
  "digital_presence",
  "pain_points",
  "goals",
  "timeline_budget",
  "contact",
  "generating",
  "results",
];

const STEP_PROGRESS: Record<GeneratorStep, number> = {
  industry: 0,
  business: 14,
  digital_presence: 28,
  pain_points: 42,
  goals: 56,
  timeline_budget: 70,
  contact: 84,
  generating: 92,
  results: 100,
};

// ========================================
// Reducer
// ========================================

const initialState: GeneratorState = {
  currentStep: "industry",
  formData: {},
  plan: null,
  shareToken: null,
  isSubmitting: false,
  error: null,
};

function reducer(
  state: GeneratorState,
  action: GeneratorAction
): GeneratorState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step, error: null };
    case "UPDATE_FORM":
      return { ...state, formData: { ...state.formData, ...action.data } };
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.value };
    case "SET_PLAN":
      return {
        ...state,
        plan: action.plan,
        shareToken: action.shareToken,
        currentStep: "results",
        isSubmitting: false,
      };
    case "SET_ERROR":
      return { ...state, error: action.error, isSubmitting: false };
    case "RESET":
      return initialState;
  }
}

// ========================================
// Component
// ========================================

interface SolutionGeneratorProps {
  className?: string;
}

export function SolutionGenerator({ className }: SolutionGeneratorProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const currentStepIndex = STEP_ORDER.indexOf(state.currentStep);
  const progress = STEP_PROGRESS[state.currentStep];
  const showBackButton =
    currentStepIndex > 0 &&
    state.currentStep !== "generating" &&
    state.currentStep !== "results";

  // ---- Navigation helpers ----

  const goToNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(state.currentStep);
    const nextStep = STEP_ORDER[idx + 1];
    if (idx < STEP_ORDER.length - 1 && nextStep) {
      dispatch({ type: "SET_STEP", step: nextStep });
    }
  }, [state.currentStep]);

  const goToBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(state.currentStep);
    const prevStep = STEP_ORDER[idx - 1];
    if (idx > 0 && prevStep) {
      dispatch({ type: "SET_STEP", step: prevStep });
    }
  }, [state.currentStep]);

  const handleUpdate = useCallback((data: Partial<IntakeFormData>) => {
    dispatch({ type: "UPDATE_FORM", data });
  }, []);

  // ---- Submission ----

  const handleSubmit = useCallback(async () => {
    dispatch({ type: "SET_STEP", step: "generating" });
    dispatch({ type: "SET_SUBMITTING", value: true });

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: state.formData }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error ||
            errorData?.message ||
            `Request failed with status ${res.status}. Please try again.`
        );
      }

      const data = (await res.json()) as {
        plan: DigitalGrowthPlan;
        shareToken: string;
      };

      dispatch({
        type: "SET_PLAN",
        plan: data.plan,
        shareToken: data.shareToken,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again or book a call with our team.";
      dispatch({ type: "SET_ERROR", error: message });
    }
  }, [state.formData]);

  // ---- Keyboard navigation ----

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showBackButton) {
        goToBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showBackButton, goToBack]);

  // ---- Shared step props ----

  const stepProps = {
    formData: state.formData,
    onUpdate: handleUpdate,
    onNext: goToNext,
    onBack: goToBack,
  };

  // ---- Render the active step ----

  const renderStep = () => {
    switch (state.currentStep) {
      case "industry":
        return <IndustryStep {...stepProps} />;
      case "business":
        return <BusinessStep {...stepProps} />;
      case "digital_presence":
        return <DigitalPresenceStep {...stepProps} />;
      case "pain_points":
        return <PainPointsStep {...stepProps} />;
      case "goals":
        return <GoalsStep {...stepProps} />;
      case "timeline_budget":
        return <TimelineBudgetStep {...stepProps} />;
      case "contact":
        return <ContactStep {...stepProps} onSubmit={handleSubmit} />;
      case "generating":
        return <GeneratingStep {...stepProps} error={state.error} />;
      case "results":
        return (
          <ResultsStep
            {...stepProps}
            plan={state.plan}
            shareToken={state.shareToken}
          />
        );
    }
  };

  return (
    <GlassCard
      variant="prominent"
      padding="none"
      hover="none"
      className={cn("gold-top-border overflow-clip", className)}
      role="region"
      aria-label={`Solution generator: step ${currentStepIndex + 1} of ${STEP_ORDER.length}`}
    >
      {/* Progress Bar */}
      <div
        className="px-6 pt-6 md:px-8 md:pt-8"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${Math.round(progress)}% complete`}
      >
        <ProgressBar progress={progress} className="mb-2" />
        <p className="text-xs text-white-muted text-right">
          {Math.round(progress)}% complete
        </p>
      </div>

      {/* Back Button */}
      <div className="px-6 md:px-8 h-10 flex items-center">
        {showBackButton && (
          <button
            type="button"
            onClick={goToBack}
            className="flex items-center gap-1.5 text-sm text-white-secondary hover:text-white-primary transition-colors cursor-pointer min-h-[44px] -ml-2 px-2"
            aria-label="Go back to previous step"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
      </div>

      {/* Step Content */}
      <div className="px-6 pb-8 md:px-8 md:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.currentStep}
            variants={stepTransition}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
