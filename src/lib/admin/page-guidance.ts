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
    description:
      "Follow one inquiry through a saved next step and a reviewed correction you can reuse in later work.",
    steps: [
      "Start with a real inquiry and record the next action with an owner and due date.",
      "Complete the task, review a useful correction, and check which connections have actually been verified.",
    ],
    guideHref: "/docs/start/first-value",
  },
  architect: {
    description:
      "Describe your business and review the sources used to prepare a workspace proposal.",
    steps: [
      "Explain one workflow and attach only the sources needed for it.",
      "Review the proposed Blueprint before approving or applying any change.",
    ],
    guideHref: "/docs/intelligence/workspace",
  },
  blueprints: {
    description: "Review saved workspace proposals, their versions and validation results.",
    steps: [
      "Open a Blueprint and compare its proposed changes with your business needs.",
      "Resolve validation findings before approving an exact version. Approval and application are separate steps.",
    ],
    guideHref: "/docs/intelligence/workspace",
  },
  learning: {
    description: "Review reusable corrections before sharing them with future work.",
    steps: [
      "Read the proposed rule, its evidence and the workers it would affect.",
      "Approve a supported correction, reject it, or keep it limited to the current conversation.",
    ],
    guideHref: "/docs/intelligence/learning-inbox",
  },
  today: {
    description:
      "See urgent priorities, upcoming commitments, and the next steps that need your attention.",
    steps: [
      "Start with an item that needs attention and read why it appears here.",
      "Open its related record to review the details or take the next action.",
    ],
    guideHref: "/docs/start/daily-path",
  },
  work: {
    description: "Track assigned tasks and review actions waiting for your approval.",
    steps: [
      "Use the filters to find assigned, due, or pending work.",
      "Open an item to review its details and the record behind it before acting.",
    ],
    guideHref: "/docs/start/daily-path",
  },
  coworkers: {
    description: "Inspect AI coworker work, outcomes and actions awaiting a person.",
    steps: [
      "Open a work item to read the coworker's result and linked source.",
      "Review consequential proposals in Work before approving or rejecting them.",
    ],
    guideHref: "/docs/command-center/work",
  },
  pipeline: {
    description: "See where each opportunity stands and decide how to move it forward.",
    steps: [
      "Open an opportunity to review its contact, stage, and next step.",
      "Update the stage as the deal progresses and record the reason when it closes.",
    ],
    guideHref: "/docs/follow-up/overview",
  },
  conversations: {
    description:
      "Read customer messages, review the conversation history, and prepare your next reply.",
    steps: [
      "Select a conversation to see its messages and related customer records.",
      "Review the recipient and reply before confirming a send. Use Work for tasks and approvals, or Intake review for new enquiries.",
    ],
    guideHref: "/docs/conversations/reply",
  },
  inbox: {
    description: "Review incoming items and follow-ups that need a decision.",
    steps: [
      "Filter the queue and open an item to understand what needs attention.",
      "Review the suggested action or open the related conversation for the full context.",
    ],
    guideHref: "/docs/start/daily-path",
  },
  "identity-review": {
    description:
      "Match unfamiliar senders to the right contact so their messages appear with the right history.",
    steps: [
      "Compare the sender details with the suggested contacts.",
      "Choose a matching contact only when you are sure. Leave uncertain matches for later review.",
    ],
    guideHref: "/docs/contacts/overview",
  },
  contacts: {
    description:
      "Understand each customer through their messages, opportunities and assigned next steps.",
    steps: [
      "Open a contact and review their history and current next step.",
      "For a list import, check the preview and resolve any issues before confirming.",
    ],
    guideHref: "/docs/contacts/import",
  },
  emails: {
    description: "Edit reusable email copy and review messages your business has sent.",
    steps: [
      "Choose a template and review its subject, message, and available fields.",
      "Preview your changes before saving. Use Email Sequences to check scheduled follow-ups.",
    ],
    guideHref: "/docs/outreach/email-studio",
  },
  campaigns: {
    description: "Prepare outreach campaigns, review recipients, and track their progress.",
    steps: [
      "Open a campaign to review its audience, message, and current status.",
      "Check the recipient list and sending requirements before starting outreach.",
    ],
    guideHref: "/docs/outreach/campaigns",
  },
  recovery: {
    description: "Reconnect with past enquiries and customers who may be ready for a follow-up.",
    steps: [
      "Choose the audience and review why each contact is included.",
      "Review the message and campaign settings before starting outreach.",
    ],
    guideHref: "/docs/outreach/recovery",
  },
  proposals: {
    description: "Prepare customer proposals and follow their progress from draft to decision.",
    steps: [
      "Open a proposal to review its services, pricing, and customer details.",
      "Check the preview before sending, then return here to follow its status.",
    ],
    guideHref: "/docs/proposals/overview",
  },
  "delivery-runs": {
    description:
      "Check scheduled follow-ups, delivered messages, and the next email in each sequence.",
    steps: [
      "Find the contact or sequence you want to review.",
      "Check its current step and delivery status before changing follow-up settings.",
    ],
    guideHref: "/docs/outreach/overview",
  },
  revenue: {
    description: "Review revenue and customer value to understand where your business is growing.",
    steps: [
      "Choose the period you want to review and check the available totals.",
      "Open related records to understand the activity behind a result.",
    ],
    guideHref: "/docs/intelligence/overview",
  },
  clients: {
    description: "Keep customer details, delivery progress, and related work together.",
    steps: [
      "Open a client to review their current work and history.",
      "Use the linked records to follow up on proposals, bookings, or outstanding tasks.",
    ],
    guideHref: "/docs/delivery/clients",
  },
  bookings: {
    description: "Review meeting requests, scheduled appointments, and booking details.",
    steps: [
      "Find an appointment and check its time, contact, and status.",
      "Open the related record to prepare for the meeting or follow up afterward.",
    ],
    guideHref: "/docs/delivery/bookings",
  },
  content: {
    description: "Plan content, track its progress, and keep upcoming publishing work visible.",
    steps: [
      "Choose a calendar or board view to find upcoming content.",
      "Open an item to review its details and update its progress.",
    ],
    guideHref: "/docs/delivery/content",
  },
  resources: {
    description: "Manage downloadable resources and review how people access them.",
    steps: [
      "Open a resource to review its title, description, and download details.",
      "Check the customer-facing information before saving your changes.",
    ],
    guideHref: "/docs/delivery/resources",
  },
  ai: {
    description:
      "Ask about your business, review AI activity, and understand the tools available to it.",
    steps: [
      "Ask a specific question or choose a task to begin.",
      "Review the supporting information and any proposed action before approving it.",
    ],
    guideHref: "/docs/intelligence/workspace",
  },
  analytics: {
    description:
      "Understand which sources bring enquiries and how those enquiries become customers.",
    steps: [
      "Choose the reporting period and compare the available sources.",
      "Check the records behind a result before deciding what to change.",
    ],
    guideHref: "/docs/intelligence/overview",
  },
  activity: {
    description: "Review recorded changes and action results across your business.",
    steps: [
      "Filter by activity type or find the record you want to investigate.",
      "Open an entry to check what happened and whether the action completed.",
    ],
    guideHref: "/docs/start/receipts",
  },
  tenants: {
    description: "Manage business workspaces and the people who can access them.",
    steps: [
      "Select a workspace to review its configuration and access.",
      "Check which business you are changing before saving an update.",
    ],
    guideHref: "/docs/workspace/overview",
  },
  integrations: {
    description: "Manage connected services and the business tools available in your workspace.",
    steps: [
      "Choose a service or module to inspect its availability and requirements.",
      "Use Setup to complete missing connections, then return here to review its tools.",
    ],
    guideHref: "/docs/workspace/integrations",
  },
  setup: {
    description: "Connect your services and check what is ready or still needs attention.",
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
    description: "Set the logo, colors, and business identity used in customer documents.",
    steps: [
      "Review the current logo and colors before editing.",
      "Save your changes and preview a customer document to check the result.",
    ],
    guideHref: "/docs/customize/overview",
  },
  settings: {
    description: "Adjust workspace preferences and how your team uses Command Center.",
    steps: [
      "Choose the relevant settings group and read the explanation beside each option.",
      "Save changes when available and check the confirmation before leaving.",
    ],
    guideHref: "/docs/workspace/settings",
  },
  leads: {
    description: "Review enquiries, qualify potential customers, and decide who needs follow-up.",
    steps: [
      "Open an enquiry to review the request and contact details.",
      "Update its qualification and next step as you learn more.",
    ],
    guideHref: "/docs/sources/leads",
  },
  "chat-leads": {
    description: "Review enquiries submitted through your website chat.",
    steps: [
      "Open a submission to read the request and available contact details.",
      "Use the related contact or conversation to continue the follow-up.",
    ],
    guideHref: "/docs/sources/overview",
  },
  subscribers: {
    description: "Review people who subscribed to your emails or requested a resource.",
    steps: [
      "Find a subscriber and check how they joined the list.",
      "Review their details and subscription status before including them in outreach.",
    ],
    guideHref: "/docs/sources/overview",
  },
  partners: {
    description: "Review partnership enquiries and decide who to follow up with.",
    steps: [
      "Open an application to understand the organisation and its proposal.",
      "Review the contact details and available status actions before following up.",
    ],
    guideHref: "/docs/sources/overview",
  },
  "website-grades": {
    description: "Review website assessment submissions and their results.",
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
    description: "Create customer invoices and inspect their recorded Stripe status.",
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
    description: "Review outstanding invoices and choose the next payment follow-up.",
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
    description: "Turn a won engagement into an owned delivery checklist.",
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
    description: "Create website pages and review each revision before publishing.",
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
    description: "Inspect recurring billing and the subscription status recorded by Stripe.",
    steps: [
      "Find the customer subscription and inspect its billing status.",
      "Review the available billing action and its result before promising a change to the customer.",
    ],
    guideHref: "/docs/plugins/stripe-invoicing",
  },
  "form-builder": {
    description: "Create intake forms that collect the information your team needs to respond.",
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
    description: "Prepare social content and review the scheduled publishing work.",
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
