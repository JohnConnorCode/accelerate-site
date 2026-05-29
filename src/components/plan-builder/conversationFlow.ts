import type { QuestionDef } from "@/lib/types";
import {
  industryOptions,
  businessAgeOptions,
  teamSizeOptions,
  revenueRangeOptions,
  websiteStatusOptions,
  digitalToolOptions,
  industrySpecificQuestions,
  basePainPoints,
  industryPainPoints,
  goalOptions,
  timelineOptions,
  budgetOptions,
} from "@/content/intake-questions";

function getIndustryQuestions(): QuestionDef[] {
  const grouped: Record<string, QuestionDef[]> = {};

  for (const q of industrySpecificQuestions) {
    for (const industry of q.industries ?? []) {
      if (!grouped[industry]) grouped[industry] = [];
      grouped[industry].push({
        id: q.id,
        field: q.id,
        message: q.question,
        inputType: q.type === "multi" ? "chip-select" : q.type === "single" ? "bubble-buttons" : "text-input",
        options: q.options,
        skipIf: (fd) => fd.industry !== industry,
      });
    }
  }

  const result: QuestionDef[] = [];
  const seen = new Set<string>();
  const industryOrder = ["home_services", "law_firm", "professional_services", "real_estate"];

  for (const industry of industryOrder) {
    for (const q of grouped[industry] ?? []) {
      if (!seen.has(q.id)) {
        seen.add(q.id);
        result.push({
          ...q,
          skipIf: (fd) => fd.industry !== industry,
        });
      }
    }
  }

  return result;
}

export function buildQuestionFlow(): QuestionDef[] {
  const industrySpecific = getIndustryQuestions();

  return [
    // 1. Industry
    {
      id: "industry",
      field: "industry",
      message: "Let's build your custom growth plan. What kind of business do you run?",
      inputType: "option-cards",
      options: industryOptions,
    },
    // 2. Industry Other
    {
      id: "industryOther",
      field: "industryOther",
      message: "Got it. What's your industry?",
      inputType: "text-input",
      placeholder: "e.g. Dental practice, Fitness studio...",
      skipIf: (fd) => fd.industry !== "other",
    },
    // 3. Business name
    {
      id: "businessName",
      field: "businessName",
      message: "Great. What's the name of your business?",
      inputType: "text-input",
      placeholder: "Your business name",
    },
    // 4. Business age
    {
      id: "businessAge",
      field: "businessAge",
      message: "How long have you been in business?",
      inputType: "bubble-buttons",
      options: businessAgeOptions,
    },
    // 5. Team size
    {
      id: "teamSize",
      field: "teamSize",
      message: "How big is your team?",
      inputType: "bubble-buttons",
      options: teamSizeOptions,
    },
    // 6. Revenue range
    {
      id: "revenueRange",
      field: "revenueRange",
      message: "Roughly where is your annual revenue today?",
      inputType: "bubble-buttons",
      options: revenueRangeOptions,
    },
    // 7. Website status
    {
      id: "websiteStatus",
      field: "websiteStatus",
      message: "How's your current website situation?",
      inputType: "option-cards",
      options: websiteStatusOptions,
    },
    // 8. Current tools
    {
      id: "currentTools",
      field: "currentTools",
      message: "Which tools does your team already use? Select all that apply.",
      inputType: "chip-select",
      options: digitalToolOptions,
    },
    // Industry-specific questions (dynamic)
    ...industrySpecific,
    // 9. Pain points
    {
      id: "painPoints",
      field: "painPoints",
      message: "What's hurting your business the most right now? Pick all that apply.",
      inputType: "chip-select",
      options: [...basePainPoints],
      // Options are dynamically extended with industry pain points in the hook
    },
    // 10. Pain points other (optional)
    {
      id: "painPointsOther",
      field: "painPointsOther",
      message: "Anything else costing you time or money that I didn't list?",
      inputType: "text-input",
      placeholder: "Optional: type anything or skip",
      optional: true,
    },
    // 11. Top goals
    {
      id: "topGoals",
      field: "topGoals",
      message: "Now the fun part. What are your top priorities? Pick up to 3.",
      inputType: "chip-select",
      options: goalOptions,
      maxSelections: 3,
    },
    // 12. Website URL (conditional)
    {
      id: "websiteUrl",
      field: "websiteUrl",
      message: "Drop your website URL and I'll factor it into the plan.",
      inputType: "text-input",
      placeholder: "https://yourbusiness.com",
      skipIf: (fd) => fd.websiteStatus === "no_website",
      optional: true,
    },
    // 13. Timeline
    {
      id: "timeline",
      field: "timeline",
      message: "When are you looking to get moving?",
      inputType: "bubble-buttons",
      options: timelineOptions,
    },
    // 14. Budget
    {
      id: "budgetRange",
      field: "budgetRange",
      message: "Last one. What investment range feels right for you?",
      inputType: "bubble-buttons",
      options: budgetOptions,
    },
    // 15. Contact (always last)
    {
      id: "contact",
      field: "contact",
      message: "Your plan is ready to build. Where should I send it?",
      inputType: "contact-panel",
    },
  ];
}

export function getPainPointOptions(industry?: string) {
  const extra = industry && industry !== "other"
    ? industryPainPoints[industry as keyof typeof industryPainPoints] ?? []
    : [];
  return [...basePainPoints, ...extra];
}
