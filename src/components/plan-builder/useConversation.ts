"use client";

import { useReducer, useCallback, useRef } from "react";
import type {
  IntakeFormData,
  DigitalGrowthPlan,
  ConversationMessage,
  ConversationPhase,
  Industry,
} from "@/lib/types";
import { buildQuestionFlow, getPainPointOptions } from "./conversationFlow";
import { getSmartDefaults } from "./smartDefaults";

// ========================================
// State
// ========================================

interface ConversationState {
  messages: ConversationMessage[];
  formData: Partial<IntakeFormData>;
  industrySpecificAnswers: Record<string, string | string[]>;
  questionIndex: number;
  phase: ConversationPhase;
  isTyping: boolean;
  plan: DigitalGrowthPlan | null;
  shareToken: string | null;
  error: string | null;
  smartDefaults: { painPoints: string[]; topGoals: string[] };
}

type Action =
  | { type: "ADD_MESSAGE"; message: ConversationMessage }
  | { type: "SET_TYPING"; value: boolean }
  | { type: "UPDATE_FORM"; data: Partial<IntakeFormData> }
  | { type: "UPDATE_INDUSTRY_ANSWER"; key: string; value: string | string[] }
  | { type: "SET_QUESTION_INDEX"; index: number }
  | { type: "SET_PHASE"; phase: ConversationPhase }
  | { type: "SET_PLAN"; plan: DigitalGrowthPlan; shareToken: string }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_SMART_DEFAULTS"; defaults: { painPoints: string[]; topGoals: string[] } };

const initialState: ConversationState = {
  messages: [],
  formData: {},
  industrySpecificAnswers: {},
  questionIndex: 0,
  phase: "chat",
  isTyping: false,
  plan: null,
  shareToken: null,
  error: null,
  smartDefaults: { painPoints: [], topGoals: [] },
};

function reducer(state: ConversationState, action: Action): ConversationState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "SET_TYPING":
      return { ...state, isTyping: action.value };
    case "UPDATE_FORM":
      return { ...state, formData: { ...state.formData, ...action.data } };
    case "UPDATE_INDUSTRY_ANSWER":
      return {
        ...state,
        industrySpecificAnswers: {
          ...state.industrySpecificAnswers,
          [action.key]: action.value,
        },
      };
    case "SET_QUESTION_INDEX":
      return { ...state, questionIndex: action.index };
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_PLAN":
      return {
        ...state,
        plan: action.plan,
        shareToken: action.shareToken,
        phase: "results",
        error: null,
      };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_SMART_DEFAULTS":
      return { ...state, smartDefaults: action.defaults };
  }
}

// ========================================
// Hook
// ========================================

let messageIdCounter = 0;
function nextId() {
  return `msg-${++messageIdCounter}`;
}

export function useConversation() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const questions = useRef(buildQuestionFlow()).current;
  const hasStarted = useRef(false);

  // Find the next unskipped question starting from a given index
  const findNextQuestion = useCallback(
    (startIdx: number) => {
      for (let i = startIdx; i < questions.length; i++) {
        const q = questions[i];
        if (q?.skipIf && q.skipIf(state.formData)) continue;
        return i;
      }
      return -1; // no more questions
    },
    [questions, state.formData]
  );

  // Push the first assistant question
  const startConversation = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const firstIdx = findNextQuestion(0);
    if (firstIdx === -1) return;
    const q = questions[firstIdx];
    if (!q) return;

    // Show typing then first question
    dispatch({ type: "SET_TYPING", value: true });
    setTimeout(() => {
      dispatch({ type: "SET_TYPING", value: false });
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          id: nextId(),
          role: "assistant",
          content: q.message,
          questionId: q.id,
          inputType: q.inputType,
          options: q.id === "painPoints" ? getPainPointOptions(state.formData.industry) : q.options,
          maxSelections: q.maxSelections,
          placeholder: q.placeholder,
          isOptional: q.optional,
        },
      });
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle user answering a question
  const answerQuestion = useCallback(
    (displayText: string, value: unknown) => {
      // Find the actual index of the current question in the array
      const currentActualIdx = findNextQuestion(state.questionIndex);
      if (currentActualIdx === -1) return;
      const currentQ = questions[currentActualIdx];
      if (!currentQ) return;

      // Dynamically inject industry pain points if needed
      const resolvedQ = currentQ.id === "painPoints"
        ? { ...currentQ, options: getPainPointOptions(state.formData.industry) }
        : currentQ;

      // Add user message
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          id: nextId(),
          role: "user",
          content: displayText,
        },
      });

      // Update form data
      const isIndustrySpecific = [
        "hs_service_types", "hs_lead_sources", "hs_estimates_per_week",
        "lf_practice_areas", "lf_intake_method", "lf_cases_per_month",
        "ps_service_type", "ps_client_acquisition", "ps_avg_client_value",
        "re_role", "re_lead_sources", "re_transactions_per_year", "re_crm",
      ].includes(resolvedQ.id);

      if (isIndustrySpecific) {
        dispatch({
          type: "UPDATE_INDUSTRY_ANSWER",
          key: resolvedQ.id,
          value: value as string | string[],
        });
      } else {
        dispatch({ type: "UPDATE_FORM", data: { [resolvedQ.field]: value } as Partial<IntakeFormData> });
      }

      // If industry was answered, set smart defaults
      if (resolvedQ.id === "industry") {
        const defaults = getSmartDefaults(value as Industry);
        dispatch({ type: "SET_SMART_DEFAULTS", defaults });

        if (defaults.painPoints.length > 0) {
          dispatch({ type: "UPDATE_FORM", data: { painPoints: defaults.painPoints } });
        }
        if (defaults.topGoals.length > 0) {
          dispatch({ type: "UPDATE_FORM", data: { topGoals: defaults.topGoals } });
        }
      }

      // Build updated formData for skip evaluation (reducer hasn't run yet)
      const updatedFormData = {
        ...state.formData,
        ...(isIndustrySpecific ? {} : { [resolvedQ.field]: value }),
      } as Partial<IntakeFormData>;

      // Advance past the answered question — scan from actualIdx + 1
      let nextIdx = -1;
      for (let i = currentActualIdx + 1; i < questions.length; i++) {
        const q = questions[i];
        if (q?.skipIf && q.skipIf(updatedFormData)) continue;
        nextIdx = i;
        break;
      }

      // Set questionIndex to the next question's position
      dispatch({
        type: "SET_QUESTION_INDEX",
        index: nextIdx === -1 ? questions.length : nextIdx,
      });

      if (nextIdx === -1) return;

      const nextQ = questions[nextIdx];
      if (!nextQ) return;

      // Show typing indicator, then next question
      dispatch({ type: "SET_TYPING", value: true });
      setTimeout(() => {
        dispatch({ type: "SET_TYPING", value: false });
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            id: nextId(),
            role: "assistant",
            content: nextQ.message,
            questionId: nextQ.id,
            inputType: nextQ.inputType,
            options: nextQ.id === "painPoints" ? getPainPointOptions(updatedFormData.industry) : nextQ.options,
            maxSelections: nextQ.maxSelections,
            placeholder: nextQ.placeholder,
            isOptional: nextQ.optional,
          },
        });
      }, 600);
    },
    [findNextQuestion, state.formData, state.questionIndex, questions]
  );

  // Submit the plan
  const submitPlan = useCallback(
    async (contactData: {
      contactName: string;
      contactEmail: string;
      contactPhone?: string;
      contactMethod: string;
      consentGiven: boolean;
    }) => {
      const fullFormData: Partial<IntakeFormData> = {
        ...state.formData,
        ...contactData,
        contactMethod: contactData.contactMethod as IntakeFormData["contactMethod"],
        industrySpecificAnswers: state.industrySpecificAnswers,
        currentTools: state.formData.currentTools ?? [],
        painPoints: state.formData.painPoints ?? [],
        topGoals: state.formData.topGoals ?? [],
      };

      dispatch({ type: "SET_PHASE", phase: "generating" });

      try {
        const res = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formData: fullFormData }),
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
            : "An unexpected error occurred. Please try again.";
        dispatch({ type: "SET_ERROR", error: message });
      }
    },
    [state.formData, state.industrySpecificAnswers]
  );

  // Get the last assistant message (to know what input to show)
  const lastAssistantMessage = state.messages
    .filter((m) => m.role === "assistant")
    .at(-1);

  // Whether the last message is already answered
  const isLastAnswered =
    lastAssistantMessage &&
    state.messages.at(-1)?.role === "user";

  return {
    messages: state.messages,
    formData: state.formData,
    phase: state.phase,
    isTyping: state.isTyping,
    plan: state.plan,
    shareToken: state.shareToken,
    error: state.error,
    smartDefaults: state.smartDefaults,
    lastAssistantMessage,
    isLastAnswered,
    startConversation,
    answerQuestion,
    submitPlan,
  };
}
