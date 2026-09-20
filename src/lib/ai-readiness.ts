import { z } from "zod";

export const AI_READINESS_VERSION = "2026-09-v1";

export const readinessDimensions = [
  {
    key: "process",
    label: "Process",
    description: "Repeatable work is visible and ready to improve.",
  },
  {
    key: "data",
    label: "Data",
    description: "The information an AI workflow needs is findable and trustworthy.",
  },
  {
    key: "tools",
    label: "Tools",
    description: "Current tools can share context instead of creating more manual work.",
  },
  {
    key: "team",
    label: "Team",
    description: "People have time, ownership, and confidence to adopt a change.",
  },
  {
    key: "governance",
    label: "Guardrails",
    description: "Review, privacy, and measurement are clear before automation runs.",
  },
] as const;

export type ReadinessDimension = (typeof readinessDimensions)[number]["key"];

export const readinessQuestions = [
  {
    id: "process_visibility",
    dimension: "process",
    prompt: "How clearly can you see where work gets stuck?",
    helper: "Think about the work between a new inquiry and a completed job.",
    options: [
      { value: "unknown", label: "I am not sure yet", score: null },
      { value: "hidden", label: "It lives in people’s heads", score: 0 },
      { value: "partial", label: "We see parts of it", score: 1 },
      { value: "visible", label: "We track it in one place", score: 2 },
      { value: "measured", label: "We track it and review it", score: 3 },
    ],
  },
  {
    id: "process_repeatability",
    dimension: "process",
    prompt: "How repeatable is your highest-volume workflow?",
    helper: "Examples: lead follow-up, quoting, intake, scheduling, reporting.",
    options: [
      { value: "unknown", label: "It changes every time", score: null },
      { value: "ad_hoc", label: "Mostly ad hoc", score: 0 },
      { value: "tribal", label: "Experienced people know the steps", score: 1 },
      { value: "documented", label: "The main steps are documented", score: 2 },
      { value: "improving", label: "Documented and improved from results", score: 3 },
    ],
  },
  {
    id: "process_bottleneck",
    dimension: "process",
    prompt: "What happens when the person responsible is unavailable?",
    helper: "This shows whether the process can safely be shared or assisted.",
    options: [
      { value: "unknown", label: "I have not tested that", score: null },
      { value: "stops", label: "Work usually stops", score: 0 },
      { value: "slows", label: "Someone has to reconstruct it", score: 1 },
      { value: "handoff", label: "We have a workable handoff", score: 2 },
      { value: "resilient", label: "The process keeps moving with clear ownership", score: 3 },
    ],
  },
  {
    id: "data_location",
    dimension: "data",
    prompt: "Where does the information for that workflow live?",
    helper: "Choose the answer that best describes most of the information.",
    options: [
      { value: "unknown", label: "I am not sure", score: null },
      { value: "scattered", label: "Email, paper, and separate files", score: 0 },
      { value: "mixed", label: "Several tools with manual copying", score: 1 },
      { value: "central", label: "One main system plus a few sources", score: 2 },
      { value: "connected", label: "Connected systems with a reliable record", score: 3 },
    ],
  },
  {
    id: "data_quality",
    dimension: "data",
    prompt: "How often do people correct missing or conflicting information?",
    helper: "Consider contact details, status, dates, and ownership.",
    options: [
      { value: "unknown", label: "We do not measure it", score: null },
      { value: "often", label: "Often", score: 0 },
      { value: "sometimes", label: "Sometimes", score: 1 },
      { value: "rarely", label: "Rarely", score: 2 },
      { value: "controlled", label: "We have an owner and a check", score: 3 },
    ],
  },
  {
    id: "data_reporting",
    dimension: "data",
    prompt: "Can you answer the key question behind your next decision?",
    helper: "For example: which source, step, or service creates the best result? ",
    options: [
      { value: "unknown", label: "Not reliably", score: null },
      { value: "manual", label: "Only after manual work", score: 0 },
      { value: "delayed", label: "Yes, but with a delay", score: 1 },
      { value: "available", label: "Usually", score: 2 },
      { value: "current", label: "Quickly, with context and history", score: 3 },
    ],
  },
  {
    id: "tool_stack",
    dimension: "tools",
    prompt: "How well do your current tools support the workflow?",
    helper: "Think about your CRM, inbox, calendar, forms, files, and billing tools.",
    options: [
      { value: "unknown", label: "I do not know", score: null },
      { value: "friction", label: "They create duplicate work", score: 0 },
      { value: "usable", label: "They work, with workarounds", score: 1 },
      { value: "fit", label: "They fit the main workflow", score: 2 },
      { value: "extensible", label: "They share data or have reliable integrations", score: 3 },
    ],
  },
  {
    id: "tool_integrations",
    dimension: "tools",
    prompt: "How much copying happens between tools each week?",
    helper: "Include retyping, downloading, forwarding, and spreadsheet updates.",
    options: [
      { value: "unknown", label: "We have not counted it", score: null },
      { value: "heavy", label: "A lot", score: 0 },
      { value: "regular", label: "Regularly", score: 1 },
      { value: "limited", label: "A little", score: 2 },
      { value: "minimal", label: "Almost none for the priority workflow", score: 3 },
    ],
  },
  {
    id: "tool_automation",
    dimension: "tools",
    prompt: "What happens automatically today?",
    helper: "Automation can be small, such as reminders, routing, or status updates.",
    options: [
      { value: "unknown", label: "I am not sure", score: null },
      { value: "none", label: "Nothing important", score: 0 },
      { value: "small", label: "A few isolated tasks", score: 1 },
      { value: "workflow", label: "Parts of a workflow", score: 2 },
      { value: "managed", label: "Workflows run with monitoring", score: 3 },
    ],
  },
  {
    id: "team_owner",
    dimension: "team",
    prompt: "Who owns improving the priority workflow?",
    helper: "A named owner makes a pilot much easier to learn from.",
    options: [
      { value: "unknown", label: "No one yet", score: null },
      { value: "shared", label: "Everyone and no one", score: 0 },
      { value: "founder", label: "The owner handles it", score: 1 },
      { value: "named", label: "A named person owns it", score: 2 },
      { value: "team", label: "An owner and backup review it", score: 3 },
    ],
  },
  {
    id: "team_capacity",
    dimension: "team",
    prompt: "How much capacity do you have for a small improvement project?",
    helper: "A useful first project should fit the team’s real week.",
    options: [
      { value: "unknown", label: "We are at capacity", score: null },
      { value: "none", label: "None right now", score: 0 },
      { value: "limited", label: "A few hours a month", score: 1 },
      { value: "available", label: "A few hours a week", score: 2 },
      { value: "dedicated", label: "Someone can own a pilot", score: 3 },
    ],
  },
  {
    id: "team_adoption",
    dimension: "team",
    prompt: "How does your team respond to a new tool or process?",
    helper: "The best automation is one people can understand and use.",
    options: [
      { value: "unknown", label: "It depends", score: null },
      { value: "resist", label: "People usually resist", score: 0 },
      { value: "cautious", label: "People need a lot of proof", score: 1 },
      { value: "open", label: "People will try a focused change", score: 2 },
      { value: "learning", label: "People review and improve new workflows", score: 3 },
    ],
  },
  {
    id: "governance_review",
    dimension: "governance",
    prompt: "Which work must a person review before it goes out?",
    helper: "Clear review boundaries keep early automation safe.",
    options: [
      { value: "unknown", label: "We have not defined that", score: null },
      { value: "unclear", label: "It is unclear", score: 0 },
      { value: "informal", label: "People know informally", score: 1 },
      { value: "defined", label: "The review step is defined", score: 2 },
      { value: "audited", label: "Review and exceptions are recorded", score: 3 },
    ],
  },
  {
    id: "governance_privacy",
    dimension: "governance",
    prompt: "How do you handle sensitive customer or business information?",
    helper: "Do not include any sensitive information in this assessment.",
    options: [
      { value: "unknown", label: "We need to clarify it", score: null },
      { value: "open", label: "Access is mostly informal", score: 0 },
      { value: "partial", label: "Some access rules exist", score: 1 },
      { value: "controlled", label: "Access is assigned by role", score: 2 },
      { value: "reviewed", label: "Access and retention are reviewed", score: 3 },
    ],
  },
  {
    id: "governance_measurement",
    dimension: "governance",
    prompt: "How would you decide whether a pilot worked?",
    helper:
      "A baseline can be time, response speed, completion rate, or another operating measure.",
    options: [
      { value: "unknown", label: "We need help choosing", score: null },
      { value: "feeling", label: "By how it feels", score: 0 },
      { value: "anecdote", label: "By a few examples", score: 1 },
      { value: "baseline", label: "We can compare before and after", score: 2 },
      { value: "owned", label: "A named owner reviews a defined measure", score: 3 },
    ],
  },
] as const;

export const assessmentAnswerSchema = z.record(z.string(), z.string().min(1).max(40));
export const profileSchema = z.object({
  businessType: z.string().trim().min(1).max(120),
  teamSize: z.enum(["just_me", "2_to_5", "6_to_15", "16_to_50", "50_plus"]),
  priority: z.enum([
    "win_more",
    "save_time",
    "serve_better",
    "understand_business",
    "prepare_safely",
  ]),
  bottleneck: z.enum(["follow_up", "admin", "intake", "delivery", "reporting", "unknown"]),
  details: z.string().trim().max(500).optional(),
});

export type AssessmentAnswers = z.infer<typeof assessmentAnswerSchema>;
export type AssessmentProfile = z.infer<typeof profileSchema>;

export const recommendationCatalog = {
  follow_up: {
    key: "follow_up",
    title: "Lead response and follow-through",
    summary:
      "Make sure new inquiries receive the right next step, with a clear handoff when judgment is needed.",
    why: "This is a good first pilot when response work is repeated, time-sensitive, and currently spread across inboxes or memory.",
    prerequisites: [
      "A single place to record new inquiries",
      "A named owner for exceptions",
      "A baseline for response time or completed follow-ups",
    ],
    effort: "Start with one inquiry source and one review rule.",
    risk: "A draft or reminder must not send without the review boundary you choose.",
    metric: "Time from inquiry to first useful response",
  },
  admin: {
    key: "admin",
    title: "Routine admin and reminders",
    summary:
      "Reduce repeated status updates, reminders, and handoffs while keeping a person in control of exceptions.",
    why: "This fits teams losing time to predictable coordination rather than complex decisions.",
    prerequisites: [
      "A repeatable task with a clear trigger",
      "An owner for exceptions",
      "A record of completed work",
    ],
    effort: "Pilot one low-risk task before connecting several systems.",
    risk: "Bad source data can create bad reminders, so start with a small reviewed group.",
    metric: "Hours spent on the selected task each week",
  },
  intake: {
    key: "intake",
    title: "Client or customer intake",
    summary:
      "Collect the right information once, route it to the right person, and make missing steps visible.",
    why: "Intake is a strong starting point when the same questions and handoffs repeat for every new customer.",
    prerequisites: [
      "A short required-information checklist",
      "A canonical customer record",
      "A person who handles unusual cases",
    ],
    effort: "Map one intake path from first form to accepted handoff.",
    risk: "Do not let automation make eligibility or high-stakes decisions without review.",
    metric: "Time from first request to complete handoff",
  },
  delivery: {
    key: "delivery",
    title: "Delivery coordination",
    summary:
      "Keep commitments, files, tasks, and client updates connected around one piece of work.",
    why: "This fits teams where delivery quality depends on remembering many small promises.",
    prerequisites: [
      "A shared delivery checklist",
      "Clear status owners",
      "A place to record commitments",
    ],
    effort: "Choose one service or project type and follow it end to end.",
    risk: "Keep customer-facing changes reviewable until the process is proven.",
    metric: "Overdue or missed commitment count",
  },
  reporting: {
    key: "reporting",
    title: "Decision-ready reporting",
    summary: "Turn scattered activity into a small set of current measures the team can act on.",
    why: "Reporting is a useful first step when you need clarity before adding automation.",
    prerequisites: [
      "A defined decision the report supports",
      "Trusted source fields",
      "A review cadence and owner",
    ],
    effort: "Start with one decision and three measures, then expand only when useful.",
    risk: "A polished dashboard cannot fix missing or conflicting source data.",
    metric: "Time needed to answer the selected operating question",
  },
} as const;

export type RecommendationKey = keyof typeof recommendationCatalog;

export type DimensionScore = {
  key: ReadinessDimension;
  label: string;
  score: number | null;
  answered: number;
  total: number;
  coverage: number;
  description: string;
};

export type ReadinessReport = {
  version: string;
  score: number | null;
  scoreLabel: string;
  coverage: number;
  dimensionScores: DimensionScore[];
  recommendations: Array<(typeof recommendationCatalog)[RecommendationKey]>;
  strongestDimension: string | null;
  focusDimension: string | null;
  profile: AssessmentProfile;
  summary: string;
  pilot: { title: string; baseline: string; success: string; owner: string; review: string };
  actionPlan: Array<{ week: string; title: string; detail: string }>;
  aiStatus: "rules" | "enriched";
};

export function scoreLabel(score: number | null, coverage: number) {
  if (score === null) return coverage < 70 ? "More answers needed" : "Ready for a guided review";
  if (score < 40) return "Build the foundation";
  if (score < 65) return "Ready for a focused pilot";
  if (score < 85) return "Ready to connect the pieces";
  return "Ready to improve continuously";
}

export function calculateReadiness(
  answers: AssessmentAnswers,
  profile: AssessmentProfile,
): ReadinessReport {
  const dimensionScores: DimensionScore[] = readinessDimensions.map((dimension) => {
    const questions = readinessQuestions.filter((question) => question.dimension === dimension.key);
    const answered = questions.filter(
      (question) =>
        answers[question.id] &&
        question.options.find((option) => option.value === answers[question.id])?.score !== null,
    ).length;
    const points = questions.reduce(
      (sum, question) =>
        sum +
        (question.options.find((option) => option.value === answers[question.id])?.score ?? 0),
      0,
    );
    const complete = answered >= 2;
    const score = complete ? Math.round((points / (answered * 3)) * 100) : null;
    return {
      key: dimension.key,
      label: dimension.label,
      description: dimension.description,
      score,
      answered,
      total: questions.length,
      coverage: Math.round((answered / questions.length) * 100),
    };
  });
  const validScores = dimensionScores.filter(
    (dimension): dimension is DimensionScore & { score: number } => dimension.score !== null,
  );
  const coverage = Math.round(
    (dimensionScores.reduce((sum, dimension) => sum + dimension.answered, 0) /
      readinessQuestions.length) *
      100,
  );
  const score =
    validScores.length === dimensionScores.length
      ? Math.round(
          validScores.reduce((sum, dimension) => sum + dimension.score, 0) / dimensionScores.length,
        )
      : null;
  const strongest = validScores.slice().sort((a, b) => b.score - a.score)[0] ?? null;
  const focus = validScores.slice().sort((a, b) => a.score - b.score)[0] ?? null;
  const recKey: RecommendationKey =
    profile.bottleneck === "unknown"
      ? focus?.key === "process"
        ? "admin"
        : focus?.key === "data"
          ? "reporting"
          : focus?.key === "tools"
            ? "follow_up"
            : "intake"
      : profile.bottleneck;
  const primary = recommendationCatalog[recKey];
  const fallback = recommendationCatalog[recKey === "reporting" ? "admin" : "reporting"];
  const recommendations = [primary, fallback].filter(
    (value, index, list) => list.findIndex((item) => item.key === value.key) === index,
  );
  const label = scoreLabel(score, coverage);
  const summary =
    score === null
      ? `You have answered ${coverage}% of the assessment. Finish the remaining areas to get a complete readiness score; your current answers already point to ${primary.title.toLowerCase()} as a useful place to start.`
      : `Your current readiness is ${score}/100. ${primary.title} is the clearest first opportunity because it fits the work and constraints you described.`;
  const pilot = {
    title: primary.title,
    baseline: primary.metric,
    success: `Agree on a baseline for ${primary.metric.toLowerCase()} and review it after the first focused pilot.`,
    owner: "Name one person who can approve exceptions and review the result.",
    review: "Keep customer-facing actions reviewed until the pilot proves its assumptions.",
  };
  const actionPlan = [
    {
      week: "Week 1",
      title: "Choose one workflow",
      detail: `Map the current steps for ${primary.title.toLowerCase()}, including where information is lost and where a person must decide.`,
    },
    {
      week: "Week 2",
      title: "Set the baseline",
      detail: `Record the current state for ${primary.metric.toLowerCase()} and confirm the owner, source data, and review boundary.`,
    },
    {
      week: "Week 3",
      title: "Run a small pilot",
      detail:
        "Use a limited set of real cases, review every exception, and record what the workflow got wrong or missed.",
    },
    {
      week: "Week 4",
      title: "Decide what to improve",
      detail:
        "Compare the baseline, team feedback, and exception log. Expand only what is useful and safe.",
    },
  ];
  return {
    version: AI_READINESS_VERSION,
    score,
    scoreLabel: label,
    coverage,
    dimensionScores,
    recommendations,
    strongestDimension: strongest?.label ?? null,
    focusDimension: focus?.label ?? null,
    profile,
    summary,
    pilot,
    actionPlan,
    aiStatus: "rules",
  };
}

export function publicPreview(report: ReadinessReport) {
  return {
    version: report.version,
    score: report.score,
    scoreLabel: report.scoreLabel,
    coverage: report.coverage,
    dimensionScores: report.dimensionScores,
    strongestDimension: report.strongestDimension,
    focusDimension: report.focusDimension,
    summary: report.summary,
    previewRecommendation: report.recommendations[0],
  };
}
