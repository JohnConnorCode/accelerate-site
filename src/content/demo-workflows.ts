import type { DemoScenarioId } from "@/lib/admin/demo/scenarios";

export interface DemoWorkflow {
  id: string;
  label: string;
  scenario: DemoScenarioId;
  business: string;
  title: string;
  problem: string;
  result: string;
  image: string;
  recipe: string;
  steps: Array<{ title: string; instruction: string; route: string }>;
}

/** Instructions for the shared fictional workspace, never a separate simulation. */
export const demoWorkflows: DemoWorkflow[] = [
  {
    id: "inquiry",
    label: "Answer an inquiry",
    scenario: "northline-roofing",
    business: "Northline Roofing",
    title: "Give the homeowner a clear next step.",
    problem:
      "A customer has asked about an inspection. The person replying needs the conversation and the opportunity in view.",
    result:
      "A simulated reply saved in the customer’s thread, ready for the next teammate to pick up.",
    image: "/images/demo/northline-conversations.png",
    recipe: "roofing-inquiry",
    steps: [
      {
        title: "Read the request",
        instruction:
          "Open a customer thread in Conversations. Read the latest message and linked opportunity before replying.",
        route: "conversations",
      },
      {
        title: "Reply with the context",
        instruction:
          "Write a short reply in the composer. Review the recipient and wording, choose Review & Send, then Confirm send. Sending is simulated.",
        route: "conversations",
      },
      {
        title: "Check the saved thread",
        instruction:
          "Find your reply in that conversation. Reload and check it remains in this demo session.",
        route: "conversations",
      },
    ],
  },
  {
    id: "onboarding",
    label: "Start client work",
    scenario: "ledgerstone-advisory",
    business: "Ledgerstone Advisory",
    title: "Turn a won engagement into assigned work.",
    problem:
      "The engagement is agreed. Delivery still needs an owner, client access and a kickoff checklist.",
    result:
      "An onboarding checklist linked to the won opportunity, with a saved status for each task.",
    image: "/images/demo/ledgerstone-onboarding.png",
    recipe: "engagement-onboarding",
    steps: [
      {
        title: "Choose the engagement",
        instruction:
          "Open Client onboarding and select a won opportunity. Inspect the suggested checklist and its dates.",
        route: "client-onboarding",
      },
      {
        title: "Review and create the work",
        instruction:
          "Choose Review workflow, then Request approval. Inspect the plan before selecting Approve & create tasks.",
        route: "client-onboarding",
      },
      {
        title: "Track the handoff",
        instruction:
          "Open the created checklist in Workflow history. Mark one task complete, then reload to verify its saved status.",
        route: "client-onboarding",
      },
    ],
  },
  {
    id: "invoice",
    label: "Prepare an invoice",
    scenario: "superdebate",
    business: "SuperDebate",
    title: "Follow an invoice from review to its result.",
    problem:
      "A customer needs an invoice. The recipient, amount and terms need review before anything is sent.",
    result:
      "A fictional invoice with separate recorded results for creating the draft and sending it. Payment remains a separate event.",
    image: "/images/demo/superdebate-invoicing.png",
    recipe: "invoice-follow-up",
    steps: [
      {
        title: "Prepare the invoice",
        instruction:
          "Open Invoicing. Choose Use sample invoice, inspect the customer and line items, then Prepare invoice.",
        route: "invoicing",
      },
      {
        title: "Approve the exact draft",
        instruction:
          "Choose Request draft approval, then Approve & create draft after checking the preview.",
        route: "invoicing",
      },
      {
        title: "Send and inspect the result",
        instruction:
          "Choose Request sending approval, then Approve & send invoice. Inspect the simulated receipt; no real invoice or email is created.",
        route: "invoicing",
      },
    ],
  },
];
