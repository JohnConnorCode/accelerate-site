import { adminNavLinks } from "./navigation";
/** Operator explanations for core destinations. Keep claims aligned with their pages. */
export interface AdminPageGuidance {
  description: string;
  startHint?: string;
  savedOutcome?: string;
  workflowId?: string;
  steps: readonly string[];
  guideHref: string;
}

export const adminPageGuidance: Record<string, AdminPageGuidance> = {
  "get-started": {
    description: "Choose a useful business workflow and connect the capabilities your team needs.",
    steps: [
      "Start with a real inquiry and record the next action with an owner and due date.",
      "Complete the task, review a useful correction, and check which connections have actually been verified.",
    ],
    guideHref: "/docs/start/first-value",
  },
  architect: {
    description:
      "Turn a described business workflow into a reviewed proposal for adapting the workspace.",
    steps: [
      "Explain one workflow and attach only the sources needed for it.",
      "Review the proposed Blueprint before approving or applying any change.",
    ],
    guideHref: "/docs/intelligence/workspace",
  },
  blueprints: {
    description:
      "Compare workspace proposals and implementation briefs before choosing the changes your business needs.",
    steps: [
      "Open a Blueprint and compare its proposed changes with your business needs.",
      "Resolve validation findings before approving an exact version. Approval and application are separate steps.",
    ],
    guideHref: "/docs/intelligence/workspace",
  },
  "source-authority": {
    description:
      "Identify the verified source for a business fact before using it in an AI answer.",
    steps: [
      "Register verified systems with an owner, tier, truth domains and expiry.",
      "Review stale evidence and potential conflicts; retry an interrupted save to confirm its original receipt.",
    ],
    guideHref: "/docs/intelligence/source-authority",
  },
  learning: {
    description:
      "Keep reviewed business guidance and reusable corrections available to later AI work.",
    steps: [
      "Read the proposed rule, its evidence and the workers it would affect.",
      "Approve a supported correction, reject it, or keep it limited to the current conversation.",
    ],
    guideHref: "/docs/intelligence/learning-inbox",
  },
  today: {
    description:
      "Find the sales follow-up, client commitment or billing decision that needs attention next.",
    steps: [
      "Start with an item that needs attention and read why it appears here.",
      "Open its related record to review the details or take the next action.",
    ],
    guideHref: "/docs/start/daily-path",
  },
  work: {
    description:
      "Keep assigned commitments visible so the team knows who should act and when the work is due.",
    steps: [
      "Use the filters to find assigned, due, or pending work.",
      "Open an item to review its details and the record behind it before acting.",
    ],
    guideHref: "/docs/start/daily-path",
  },
  coworkers: {
    description:
      "See which AI jobs have prepared useful work, completed an operation or need a person’s decision.",
    steps: [
      "Open a work item to read the coworker's result and linked source.",
      "Review consequential proposals in Work before approving or rejecting them.",
    ],
    guideHref: "/docs/command-center/work",
  },
  pipeline: {
    description:
      "Give each opportunity an owner, current stage and next action so sales follow-up stays visible.",
    steps: [
      "Open an opportunity to review its contact, stage, and next step.",
      "Update the stage as the deal progresses and record the reason when it closes.",
    ],
    guideHref: "/docs/follow-up/overview",
  },
  conversations: {
    description:
      "Answer a customer with their thread and related business records in front of you.",
    steps: [
      "Select a conversation to see its messages and related customer records.",
      "Review the recipient and reply before confirming a send. Use Work for tasks and approvals, or Intake review for new enquiries.",
    ],
    guideHref: "/docs/conversations/reply",
  },
  inbox: {
    description:
      "Route new inquiries and handoffs to the person or record that should handle them.",
    steps: [
      "Filter the queue and open an item to understand what needs attention.",
      "Review the suggested action or open the related conversation for the full context.",
    ],
    guideHref: "/docs/start/daily-path",
  },
  "identity-review": {
    description:
      "Attach unfamiliar messages to the right customer so the next teammate can find the relationship history.",
    steps: [
      "Compare the sender details with the suggested contacts.",
      "Choose a matching contact only when you are sure. Leave uncertain matches for later review.",
    ],
    guideHref: "/docs/contacts/overview",
  },
  contacts: {
    description:
      "Find a customer’s conversations, opportunities and commitments without searching separate tools.",
    steps: [
      "Open a contact and review their history and current next step.",
      "For a list import, check the preview and resolve any issues before confirming.",
    ],
    guideHref: "/docs/contacts/import",
  },
  emails: {
    description: "Reuse useful customer messages and inspect what your business actually sent.",
    steps: [
      "Choose a template and review its subject, message, and available fields.",
      "Preview your changes before saving. Use Email Sequences to check scheduled follow-ups.",
    ],
    guideHref: "/docs/outreach/email-studio",
  },
  campaigns: {
    description:
      "Reach a reviewed audience with relevant copy, a defined cadence and visible delivery results.",
    steps: [
      "Open a campaign to review its audience, message, and current status.",
      "Check the recipient list and sending requirements before starting outreach.",
    ],
    guideHref: "/docs/outreach/campaigns",
  },
  recovery: {
    description: "Find past inquiries worth another conversation and prepare relevant follow-up.",
    steps: [
      "Choose the audience and review why each contact is included.",
      "Review the message and campaign settings before starting outreach.",
    ],
    guideHref: "/docs/outreach/recovery",
  },
  proposals: {
    description:
      "Turn the agreed services and pricing into a customer offer, then follow its decision.",
    steps: [
      "Open a proposal to review its services, pricing, and customer details.",
      "Check the preview before sending, then return here to follow its status.",
    ],
    guideHref: "/docs/proposals/overview",
  },
  "delivery-runs": {
    description:
      "Keep scheduled follow-up visible and see which message comes next for each customer.",
    steps: [
      "Find the contact or sequence you want to review.",
      "Check its current step and delivery status before changing follow-up settings.",
    ],
    guideHref: "/docs/outreach/overview",
  },
  revenue: {
    description:
      "Understand current agreement and opportunity values while keeping invoiced and collected amounts distinct.",
    steps: [
      "Choose the period you want to review and check the available totals.",
      "Open related records to understand the activity behind a result.",
    ],
    guideHref: "/docs/intelligence/overview",
  },
  clients: {
    description:
      "Give delivery teams the agreement details, activity and follow-ups for each client engagement.",
    steps: [
      "Open a client to review their current work and history.",
      "Use the linked records to follow up on proposals, bookings, or outstanding tasks.",
    ],
    guideHref: "/docs/delivery/clients",
  },
  bookings: {
    description:
      "Prepare for scheduled conversations and carry the agreed next steps into customer work.",
    steps: [
      "Find an appointment and check its time, contact, and status.",
      "Open the related record to prepare for the meeting or follow up afterward.",
    ],
    guideHref: "/docs/delivery/bookings",
  },
  content: {
    description: "Coordinate editorial briefs and their progress from preparation to publication.",
    steps: [
      "Choose a calendar or board view to find upcoming content.",
      "Open an item to review its details and update its progress.",
    ],
    guideHref: "/docs/delivery/content",
  },
  resources: {
    description:
      "See who requested a resource so the team can follow up with the right customer context.",
    steps: [
      "Open a resource to review its title, description, and download details.",
      "Check the customer-facing information before saving your changes.",
    ],
    guideHref: "/docs/delivery/resources",
  },
  ai: {
    description:
      "Use business context to find answers, prepare work and operate supported services.",
    steps: [
      "Ask a specific question or choose a task to begin.",
      "Review the supporting information and any proposed action before approving it.",
    ],
    guideHref: "/docs/intelligence/workspace",
  },
  analytics: {
    description:
      "Understand sales movement and current performance using the records behind the figures.",
    steps: [
      "Choose the reporting period and compare the available sources.",
      "Check the records behind a result before deciding what to change.",
    ],
    guideHref: "/docs/intelligence/overview",
  },
  activity: {
    description: "Trace business changes and completed operations to their source records.",
    steps: [
      "Filter by activity type or find the record you want to investigate.",
      "Open an entry to check what happened and whether the action completed.",
    ],
    guideHref: "/docs/start/receipts",
  },
  tenants: {
    description: "Provision business workspaces and manage their access and operating status.",
    steps: [
      "Select a workspace to review its configuration and access.",
      "Check which business you are changing before saving an update.",
    ],
    guideHref: "/docs/workspace/overview",
  },
  integrations: {
    description: "Choose the Apps and provider connections needed for your team’s workflows.",
    steps: [
      "Choose a service or module to inspect its availability and requirements.",
      "Use Setup to complete missing connections, then return here to review its tools.",
    ],
    guideHref: "/docs/workspace/integrations",
  },
  setup: {
    description:
      "Verify the connections your workflow relies on and find the next setup or recovery step.",
    steps: [
      "Start with an item marked as needing attention and read its next step.",
      "After completing the setup step, refresh the checks to confirm its status.",
    ],
    guideHref: "/docs/workspace/setup",
  },
  features: {
    description:
      "Plan product improvements, follow implementation progress, and review completed work.",
    steps: [
      "Open a card to review its scope, acceptance criteria, and current owner.",
      "Use the available workflow actions to move work forward and review its evidence.",
    ],
    guideHref: "/docs/start/workspace",
  },
  branding: {
    description: "Give the workspace and customer-facing material the business’s identity.",
    steps: [
      "Review the current logo and colors before editing.",
      "Save your changes and preview a customer document to check the result.",
    ],
    guideHref: "/docs/customize/overview",
  },
  settings: {
    description: "Set workspace preferences so the application matches how your team works.",
    steps: [
      "Choose the relevant settings group and read the explanation beside each option.",
      "Save changes when available and check the confirmation before leaving.",
    ],
    guideHref: "/docs/workspace/settings",
  },
  leads: {
    description:
      "Turn website inquiries into customer opportunities with ownership and a next action.",
    steps: [
      "Open an enquiry to review the request and contact details.",
      "Update its qualification and next step as you learn more.",
    ],
    guideHref: "/docs/sources/leads",
  },
  "chat-leads": {
    description: "Follow up on visitors whose website conversation needs a person.",
    steps: [
      "Open a submission to read the request and available contact details.",
      "Use the related contact or conversation to continue the follow-up.",
    ],
    guideHref: "/docs/sources/overview",
  },
  subscribers: {
    description:
      "Review the people who opted into updates before preparing an appropriate audience.",
    steps: [
      "Find a subscriber and check how they joined the list.",
      "Review their details and subscription status before including them in outreach.",
    ],
    guideHref: "/docs/sources/overview",
  },
  partners: {
    description: "Review partner requests and record the next relationship step.",
    steps: [
      "Open an application to understand the organisation and its proposal.",
      "Review the contact details and available status actions before following up.",
    ],
    guideHref: "/docs/sources/overview",
  },
  "website-grades": {
    description: "Use a website assessment to understand an inquiry before the next conversation.",
    steps: [
      "Open a submission to review the website and available assessment.",
      "Use the contact details and findings to prepare a relevant follow-up.",
    ],
    guideHref: "/docs/sources/overview",
  },
};

const taskContext: Record<
  string,
  Pick<AdminPageGuidance, "startHint" | "savedOutcome" | "workflowId">
> = {
  today: {
    startHint: "Open the source behind a finding before choosing the next action.",
    savedOutcome:
      "Completed work remains with its source record; refresh Today to review the latest available evidence.",
  },
  work: {
    startHint:
      "Choose Tasks or Approvals, then open an item to see its owner, due date and related record.",
    savedOutcome:
      "Task changes stay on the assigned task. Approval results show what was attempted and confirmed.",
  },
  contacts: {
    startHint:
      "Search by name or email. Open history to review messages, tasks and linked opportunities.",
    savedOutcome: "The customer history keeps linked messages, opportunities and tasks together.",
    workflowId: "inquiry",
  },
  conversations: {
    startHint: "Select a customer thread, read the latest request and prepare a reply.",
    savedOutcome: "Check the message result in the thread before treating the reply as sent.",
    workflowId: "inquiry",
  },
  clients: {
    startHint:
      "Open a client to review the engagement, delivery notes and outstanding commitments.",
    savedOutcome: "Saved client changes and linked tasks remain available to the next teammate.",
    workflowId: "onboarding",
  },
  pipeline: {
    startHint: "Open the opportunity you want to move forward and check its stage and next step.",
    savedOutcome: "Stage changes stay with the opportunity and its recorded history.",
  },
};

const extensionGuidance: Record<string, AdminPageGuidance> = {
  "stripe-invoicing": {
    description:
      "Bill an existing customer, design the customer page and follow the invoice’s recorded status.",
    startHint:
      "Open an invoice to inspect its status, or choose Create invoice to prepare a customer draft.",
    steps: [
      "Choose the customer, line items and terms, then inspect the invoice preview.",
      "Request draft approval, review the exact version and create it. Request sending approval when it is ready.",
      "Inspect the confirmed result and payment status before following up.",
    ],
    savedOutcome:
      "Draft creation, sending and payment have separate results. An accepted send leaves payment outstanding until Stripe records it.",
    guideHref: "/docs/plugins/stripe-invoicing",
    workflowId: "invoice",
  },
  "receivables-collections": {
    description:
      "Choose the next payment follow-up with invoice balances, promises and disputes in view.",
    startHint: "Open a case and check its remaining amount, due date and latest source status.",
    steps: [
      "Review the customer, invoice and any dispute or pause.",
      "Prepare the available follow-up, review it and inspect its recorded result.",
    ],
    savedOutcome:
      "The case keeps the follow-up result alongside its invoice source and current balance.",
    guideHref: "/docs/plugins/receivables-collections",
    workflowId: "invoice",
  },
  "client-onboarding": {
    description:
      "Give a won engagement an assigned kickoff checklist that the delivery team can follow.",
    startHint:
      "Choose the won opportunity, then supply the owner and dates needed for the handoff.",
    steps: [
      "Select the engagement and review the proposed onboarding tasks.",
      "Check each owner and due date, approve the exact proposal and open the created tasks in Work.",
    ],
    savedOutcome:
      "Created tasks link back to the engagement so the delivery team can follow the handoff.",
    guideHref: "/docs/plugins/client-onboarding",
    workflowId: "onboarding",
  },
  "site-studio": {
    description:
      "Prepare customer-facing pages with responsive preview and publish the revision your team has reviewed.",
    startHint:
      "Open a page or create a draft. Use preview to inspect changes before choosing Publish.",
    steps: [
      "Describe the page or edit its existing blocks, then save the draft.",
      "Preview the customer view and inspect the exact revision before publishing.",
      "Check the published revision; use the available rollback action when an earlier version is needed.",
    ],
    savedOutcome:
      "Saving retains the draft. Publishing changes the public revision after the separate confirmation.",
    guideHref: "/docs/plugins/site-studio",
  },
  "stripe-subscriptions": {
    description: "Offer recurring plans and follow the customer’s subscription and billing state.",
    steps: [
      "Find the customer subscription and inspect its billing status.",
      "Review the available billing action and its result before promising a change to the customer.",
    ],
    guideHref: "/docs/plugins/stripe-subscriptions",
  },
  "form-builder": {
    description:
      "Collect the right inquiry details and review responses into customer and pipeline work.",
    steps: [
      "Open a form and review its questions, routing and customer-facing preview.",
      "Save the form and check its available publication settings before sharing it.",
    ],
    guideHref: "/docs/plugins/form-builder",
  },
  "meeting-commitments": {
    description: "Review meeting commitments and turn agreed next steps into owned tasks.",
    steps: [
      "Choose the meeting and inspect the supported commitments.",
      "Check the owner and due date before approving task creation, then inspect the saved tasks.",
    ],
    guideHref: "/docs/plugins/meeting-commitments",
  },
  "opportunity-radar": {
    description: "Review relevant public opportunities and decide which deserve follow-up.",
    steps: [
      "Open an opportunity and read its source and relevance explanation.",
      "Review outreach details and the available action before proceeding.",
    ],
    guideHref: "/docs/plugins/opportunity-radar",
  },
  "social-marketing": {
    description:
      "Prepare source-backed social content and schedule reviewed posts through the supported publishing connection.",
    steps: [
      "Open the draft and check its message, source and destination account.",
      "Preview the content before scheduling it and inspect the publishing result.",
    ],
    guideHref: "/docs/plugins/social-marketing",
  },
  "example-inventory": {
    description: "Inspect the example inventory workspace and its stock records.",
    steps: [
      "Choose an inventory item and review its stock and reorder information.",
      "Review the available changes and check the saved result.",
    ],
    guideHref: "/docs/plugins/example-inventory",
  },
};
Object.assign(adminPageGuidance, extensionGuidance);
for (const link of adminNavLinks) {
  const guidance = adminPageGuidance[link.id];
  if (!guidance) continue;
  Object.assign(guidance, taskContext[link.id]);
  guidance.startHint ??= guidance.steps[0];
}
