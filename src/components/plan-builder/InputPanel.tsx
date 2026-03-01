"use client";

import type { ConversationMessage, IntakeFormData } from "@/lib/types";
import { OptionCards } from "./inputs/OptionCards";
import { BubbleButtons } from "./inputs/BubbleButtons";
import { ChipSelect } from "./inputs/ChipSelect";
import { ChatTextInput } from "./inputs/ChatTextInput";
import { ContactPanel } from "./inputs/ContactPanel";

interface InputPanelProps {
  message: ConversationMessage;
  formData: Partial<IntakeFormData>;
  smartDefaults: { painPoints: string[]; topGoals: string[] };
  onAnswer: (displayText: string, value: unknown) => void;
  onSubmit: (data: {
    contactName: string;
    contactEmail: string;
    contactPhone?: string;
    contactMethod: string;
    consentGiven: boolean;
  }) => void;
}

export function InputPanel({
  message,
  formData,
  smartDefaults,
  onAnswer,
  onSubmit,
}: InputPanelProps) {
  const { inputType, options = [], maxSelections, placeholder, isOptional, questionId } = message;

  switch (inputType) {
    case "option-cards":
      return (
        <OptionCards
          options={options}
          onSelect={(value, label) => onAnswer(label, value)}
        />
      );

    case "bubble-buttons":
      return (
        <BubbleButtons
          options={options}
          onSelect={(value, label) => onAnswer(label, value)}
        />
      );

    case "chip-select": {
      let preSelected: string[] = [];
      if (questionId === "painPoints") {
        preSelected = formData.painPoints ?? smartDefaults.painPoints;
      } else if (questionId === "topGoals") {
        preSelected = formData.topGoals ?? smartDefaults.topGoals;
      }

      return (
        <ChipSelect
          options={options}
          maxSelections={maxSelections}
          preSelected={preSelected}
          onConfirm={(values, labels) => onAnswer(labels.join(", "), values)}
        />
      );
    }

    case "text-input":
      return (
        <ChatTextInput
          placeholder={placeholder}
          isOptional={isOptional}
          onSubmit={(value) => onAnswer(value, value)}
          onSkip={isOptional ? () => onAnswer("Skipped", "") : undefined}
        />
      );

    case "contact-panel":
      return <ContactPanel onSubmit={onSubmit} />;

    default:
      return null;
  }
}
