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
  agent?: string;
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
    agent: "inquiry",
    steps: [
      {
        title: "Read the request",
        instruction:
          "Ask the agent to find an unanswered inquiry, read the thread and prepare a reply plus a follow-up task.",
        route: "conversations",
      },
      {
        title: "Reply with the context",
        instruction:
          "Open Review in the conversation. Check the exact customer, message and task. Approve or reject each proposal without leaving chat.",
        route: "conversations",
      },
      {
        title: "Check the saved thread",
        instruction:
          "Read the simulated result in chat. Open the linked thread or task if you want to inspect it, then reload to check it remains saved.",
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
      "Reviewed onboarding tasks linked to the engagement. If dates or ownership are missing, the agent asks for them.",
    image: "/images/demo/ledgerstone-onboarding.png",
    recipe: "engagement-onboarding",
    agent: "onboarding",
    steps: [
      {
        title: "Choose the engagement",
        instruction:
          "Ask the agent to find a won engagement and prepare onboarding tasks. Give it the owner and dates, or ask it to clarify what is missing.",
        route: "client-onboarding",
      },
      {
        title: "Review and create the work",
        instruction:
          "Review each exact task in chat. Approve the tasks you want to create; no work is saved merely because the agent drafted it.",
        route: "client-onboarding",
      },
      {
        title: "Track the handoff",
        instruction:
          "Check the simulated task receipts. Ask the agent to update a task, or open Work to inspect the saved checklist.",
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
