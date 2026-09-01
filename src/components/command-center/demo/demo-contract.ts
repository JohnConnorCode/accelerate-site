import { integrationRegistry } from "@/lib/revenue-os/integration-registry";
import { DEMO_ACTIONS, DEMO_PEOPLE, DEMO_PIPELINE, RAIL } from "./demo-data";

/**
 * The public demo is deliberately a separate, client-only presentation layer.
 * This file is its contract: scenarios, capability coverage, and provider
 * language live here so screens cannot quietly drift into separate stories.
 */

export type DemoScenarioId = "revenue-recovery" | "meeting-to-execution" | "connected-operations";
export type DemoCapabilityStatus = "guided" | "interactive" | "represented" | "excluded";
export type DemoProviderState = "sample_connected" | "available" | "next" | "planned";

export interface DemoScenario {
  id: DemoScenarioId;
  label: string;
  eyebrow: string;
  summary: string;
  outcome: string;
  buyerTakeaway: string;
  steps: Array<{ view: string; title: string; detail: string; completionKey?: string }>;
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: "revenue-recovery",
    label: "Revenue recovery",
    eyebrow: "8 minute guided story",
    summary:
      "Use evidence to protect the Northwind opportunity and make a human-reviewed follow-up happen.",
    outcome:
      "A grounded recommendation becomes an approved action and an auditable revenue update.",
    buyerTakeaway:
      "A tailored operating layer can bring relationship context, proposed work, human review, and receipts into one place without replacing the tools a team already uses.",
    steps: [
      {
        view: "today",
        title: "See what needs attention",
        detail:
          "Northwind is ready for a precise follow-up; the reason is visible before anyone acts.",
      },
      {
        view: "people",
        title: "Inspect relationship context",
        detail:
          "Sarah’s preferences, Marcus’s decision role, and the original commitment are all attached to the account.",
      },
      {
        view: "ask",
        title: "Ask from the records",
        detail: "The answer cites the call and email that support it.",
      },
      {
        view: "approvals",
        title: "Review the proposed action",
        detail: "Approve, edit, skip, or teach the system. Nothing sends in this demo.",
        completionKey: "approved:*",
      },
      {
        view: "activity",
        title: "Inspect the receipt",
        detail: "The simulated decision is recorded with its source and downstream impact.",
        completionKey: "approved:*",
      },
    ],
  },
  {
    id: "meeting-to-execution",
    label: "Meeting to execution",
    eyebrow: "7 minute guided story",
    summary:
      "Turn a client conversation into reviewable facts, tasks, and follow-through without losing the source.",
    outcome: "Selected commitments appear as operating work and an immutable simulated receipt.",
    buyerTakeaway:
      "For some teams, the right solution is a focused meeting-to-execution workflow rather than a full Command Center.",
    steps: [
      {
        view: "meeting",
        title: "Review the transcript",
        detail: "Each extracted item carries the exact statement that supports it.",
      },
      {
        view: "meeting",
        title: "Choose what enters the system",
        detail: "The operator decides which facts, tasks, dates, and questions are kept.",
        completionKey: "meeting:applied",
      },
      {
        view: "tasks",
        title: "See the committed work",
        detail: "Accepted work is now visible as a task tied to the meeting.",
        completionKey: "meeting:applied",
      },
      {
        view: "brief",
        title: "Read the changed operating brief",
        detail: "The morning brief reflects what is owed and why.",
        completionKey: "meeting:applied",
      },
      {
        view: "activity",
        title: "Inspect the record",
        detail: "The system shows exactly what was accepted and what was left untouched.",
        completionKey: "meeting:applied",
      },
    ],
  },
  {
    id: "connected-operations",
    label: "Connected operations",
    eyebrow: "6 minute guided story",
    summary:
      "Show the Command Center as an operating layer around existing tools, with honest connection boundaries.",
    outcome:
      "A buyer can see what is sample-connected today, what is next, and where evidence and recovery live.",
    buyerTakeaway:
      "Accelerate starts with the business and its existing tools, then recommends the smallest useful combination of integrations, automation, AI, internal tools, training, and managed execution.",
    steps: [
      {
        view: "integrations",
        title: "Inspect connected operating context",
        detail:
          "The sample workspace distinguishes provider maturity from a live connection claim.",
        completionKey: "integration:google",
      },
      {
        view: "inbox",
        title: "Follow an incoming signal",
        detail: "A fictional Gmail thread is linked to the person and opportunity it affects.",
      },
      {
        view: "automations",
        title: "Review the guarded workflow",
        detail: "Automation drafts and raises work; external actions stay approval-gated.",
      },
      {
        view: "activity",
        title: "Trace what happened",
        detail: "Every material change has a simulated source and receipt.",
      },
    ],
  },
] as const;

export interface DemoCapability {
  view: string;
  status: DemoCapabilityStatus;
  scenarios: readonly DemoScenarioId[];
  purpose: string;
  exclusionReason?: string;
}

export const DEMO_CAPABILITIES: readonly DemoCapability[] = [
  {
    view: "today",
    status: "guided",
    scenarios: ["revenue-recovery"],
    purpose: "Prioritized operating context",
  },
  {
    view: "approvals",
    status: "guided",
    scenarios: ["revenue-recovery"],
    purpose: "Human-reviewed proposed actions",
  },
  {
    view: "inbox",
    status: "interactive",
    scenarios: ["connected-operations"],
    purpose: "Linked communication context",
  },
  {
    view: "people",
    status: "guided",
    scenarios: ["revenue-recovery"],
    purpose: "Relationship intelligence and evidence",
  },
  {
    view: "companies",
    status: "interactive",
    scenarios: ["revenue-recovery"],
    purpose: "Account-level context",
  },
  {
    view: "pipeline",
    status: "interactive",
    scenarios: ["revenue-recovery"],
    purpose: "Evidence-backed revenue progress",
  },
  {
    view: "referrals",
    status: "interactive",
    scenarios: ["revenue-recovery"],
    purpose: "Relationship reciprocity",
  },
  {
    view: "projects",
    status: "interactive",
    scenarios: ["meeting-to-execution"],
    purpose: "Connected delivery work",
  },
  {
    view: "tasks",
    status: "interactive",
    scenarios: ["meeting-to-execution"],
    purpose: "Reviewable commitments",
  },
  {
    view: "meeting",
    status: "guided",
    scenarios: ["meeting-to-execution"],
    purpose: "Transcript-to-work review",
  },
  {
    view: "documents",
    status: "interactive",
    scenarios: ["meeting-to-execution"],
    purpose: "Source-linked knowledge",
  },
  {
    view: "ask",
    status: "guided",
    scenarios: ["revenue-recovery"],
    purpose: "Grounded operational answers",
  },
  {
    view: "brief",
    status: "interactive",
    scenarios: ["meeting-to-execution"],
    purpose: "Daily operating summary",
  },
  {
    view: "questions",
    status: "interactive",
    scenarios: ["meeting-to-execution"],
    purpose: "Unresolved relationship context",
  },
  {
    view: "reports",
    status: "interactive",
    scenarios: ["revenue-recovery"],
    purpose: "Evidence-linked reporting",
  },
  {
    view: "activity",
    status: "interactive",
    scenarios: ["revenue-recovery", "meeting-to-execution", "connected-operations"],
    purpose: "Receipts and provenance",
  },
  {
    view: "automations",
    status: "interactive",
    scenarios: ["connected-operations"],
    purpose: "Guarded operating workflows",
  },
  {
    view: "integrations",
    status: "guided",
    scenarios: ["connected-operations"],
    purpose: "Truthful provider capability and maturity",
  },
  {
    view: "settings",
    status: "interactive",
    scenarios: ["connected-operations"],
    purpose: "Human-control preferences",
  },
] as const;

const providerStates: Record<string, DemoProviderState> = {
  google: "sample_connected",
  resend: "sample_connected",
  openrouter: "sample_connected",
  "first-party": "sample_connected",
  microsoft: "available",
  stripe: "next",
  hubspot: "planned",
  accounting: "planned",
};

export const DEMO_INTEGRATIONS = integrationRegistry
  .filter((provider) => providerStates[provider.id])
  .map((provider) => ({
    id: provider.id,
    name: provider.name,
    description: provider.description,
    state: providerStates[provider.id]!,
    capabilities: provider.capabilities.map((capability) => capability.label),
    guardrail: provider.guardrail,
  }));

export interface DemoOutcome {
  key: string;
  title: string;
  detail: string;
  source: string;
  at: string;
}

export function validateDemoContract() {
  const errors: string[] = [];
  const railViews = new Set(RAIL.flatMap((section) => section.items.map((item) => item.id)));
  const capabilities = new Map(
    DEMO_CAPABILITIES.map((capability) => [capability.view, capability]),
  );

  for (const view of railViews) {
    if (!capabilities.has(view))
      errors.push(`Missing demo capability disposition for rail view: ${view}`);
  }
  for (const capability of DEMO_CAPABILITIES) {
    if (!railViews.has(capability.view) && capability.status !== "excluded")
      errors.push(`Demo capability is not a rail view: ${capability.view}`);
    if (!capability.scenarios.length && capability.status !== "excluded")
      errors.push(`Demo capability has no scenario: ${capability.view}`);
  }
  for (const scenario of DEMO_SCENARIOS) {
    for (const step of scenario.steps) {
      if (!railViews.has(step.view))
        errors.push(`Scenario ${scenario.id} references missing view: ${step.view}`);
    }
  }
  for (const provider of Object.keys(providerStates)) {
    if (!integrationRegistry.some((candidate) => candidate.id === provider))
      errors.push(`Demo provider is absent from integration registry: ${provider}`);
  }

  const people = new Set(DEMO_PEOPLE.map((person) => person.name));
  const companies = new Set(DEMO_PEOPLE.map((person) => person.company));
  const pipelineCompanies = new Set(
    DEMO_PIPELINE.flatMap((column) => column.deals.map((deal) => deal.company)),
  );
  const knownCompanies = new Set([...companies, ...pipelineCompanies]);
  for (const company of companies) {
    if (!pipelineCompanies.has(company))
      errors.push(`Demo person company has no pipeline or delivery context: ${company}`);
  }
  for (const action of DEMO_ACTIONS) {
    if (!people.has(action.who) && !knownCompanies.has(action.who))
      errors.push(`Demo action has an unknown person or company: ${action.id}`);
    if (!action.source.trim()) errors.push(`Demo action has no source: ${action.id}`);
  }
  return errors;
}
