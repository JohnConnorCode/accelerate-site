import type { BusinessAreaId } from "./command-center-contract";

export const commandCenterPositioning = {
  category: "Open-source AI business platform",
  headline: "An AI business platform you can make your own.",
  description:
    "Manage customers, sales, delivery, billing and marketing in one system. Use AI with your business context, and build workflows and custom apps around the way your team works.",
};

export interface BusinessArea {
  id: BusinessAreaId;
  title: string;
  headline: string;
  description: string;
  outcome: string;
  capabilityIds: readonly string[];
  image: string;
  imageAlt: string;
  guideHref: string;
  demoHref: string;
  tasks: readonly { title: string; detail: string; href: string }[];
  example: { title: string; steps: readonly string[]; result: string };
  setup: string;
  builder: string;
}

/** Business discovery metadata. Availability still belongs to the runtime and module contracts. */
export const businessAreas: readonly BusinessArea[] = [
  {
    id: "customer-context",
    title: "Customers & conversations",
    headline: "Answer with the customer's history in front of you.",
    description:
      "Find a person's conversations, opportunities, notes and commitments together. Give the next teammate enough context to help, and let AI use the available records when preparing a response.",
    outcome: "Less searching across inboxes and fewer handoffs that lose customer context.",
    capabilityIds: [
      "transcripts",
      "paste",
      "email",
      "calendar",
      "backfill",
      "voice",
      "people",
      "companies",
      "notes",
      "graph",
      "timeline",
      "dupes",
      "source-authority",
      "precall",
      "questions",
    ],
    image: "conversations/overview",
    imageAlt: "A fictional Northline customer conversation with its linked relationship context.",
    guideHref: "/docs/contacts",
    demoHref: "/demo/command-center/northline-roofing/conversations",
    tasks: [
      {
        title: "Keep one customer history",
        detail:
          "Open linked messages, opportunities and work from the contact directory. Review unfamiliar senders before matching them.",
        href: "/docs/contacts",
      },
      {
        title: "Prepare a useful reply",
        detail:
          "Ask AI about the selected conversation, inspect the source context and edit the proposed response.",
        href: "/docs/conversations/reply",
      },
      {
        title: "Bring existing information with you",
        detail:
          "Review contact imports and connect supported email, calendar and Drive sources incrementally.",
        href: "/docs/workspace/integrations",
      },
    ],
    example: {
      title: "A homeowner asks when the inspection will happen",
      steps: [
        "Open the customer's conversation and linked opportunity.",
        "Read the recorded callback window and outstanding next step.",
        "Prepare a response that reflects those details, then review and send it through the conversation.",
      ],
      result:
        "The response remains in the customer's thread, with the opportunity and follow-up available to the next teammate.",
    },
    setup:
      "The contact directory and manual records work without a model. Connected history needs its provider setup and completed sync. AI drafting needs a configured model; sending needs the configured sender and exact approval.",
    builder:
      "Add the customer information your industry needs, or build an account screen that combines existing identity, conversations and domain records. Reuse canonical customer IDs and workspace access.",
  },
  {
    id: "sales",
    title: "Sales & follow-up",
    headline: "Give each inquiry an owner and a path to a decision.",
    description:
      "Capture an inquiry, keep the opportunity's stage and next action visible, prepare a proposal and find follow-up that has gone quiet.",
    outcome:
      "A visible next step for new business, with fewer opportunities left to someone's memory.",
    capabilityIds: [
      "forms",
      "proposals",
      "pipeline",
      "opportunity-radar",
      "draft-email",
      "followups",
      "stage-moves",
      "bulk",
      "at-risk",
    ],
    image: "pipeline/overview",
    imageAlt:
      "Northline's fictional sales pipeline showing opportunities, stages and next actions.",
    guideHref: "/docs/pipeline",
    demoHref: "/demo/command-center/northline-roofing/pipeline",
    tasks: [
      {
        title: "Capture and qualify inquiries",
        detail:
          "Use website intake or Form builder, check the customer match and accept the inquiry into Pipeline.",
        href: "/docs/plugins/form-builder",
      },
      {
        title: "Manage the next sales action",
        detail:
          "Use board, list or calendar views. Assign ownership, record a dated next action and inspect quiet opportunities with Pipeline follow-up.",
        href: "/docs/pipeline/board",
      },
      {
        title: "Prepare and follow proposals",
        detail:
          "Build a proposal around the agreed services, send it for a customer decision and follow its linked opportunity.",
        href: "/docs/proposals",
      },
    ],
    example: {
      title: "A roof inspection request becomes an owned opportunity",
      steps: [
        "Review the inquiry and match it to the right customer.",
        "Record the inspection opportunity, owner and callback date.",
        "Prepare the estimate or proposal, and use the follow-up report to find overdue next actions.",
      ],
      result:
        "The office can see who owns the inquiry, what was offered and which customer action comes next.",
    },
    setup:
      "Pipeline and manual tasks are core. Forms and Pipeline follow-up are optional Apps. Messages and proposals need their configured sending path; the read-only follow-up report never sends a message.",
    builder:
      "Adapt qualification fields, pipeline stages or a follow-up report to your process. Keep proposal and opportunity changes in their existing services so the interface and AI observe the same decision.",
  },
  {
    id: "delivery",
    title: "Delivery & commitments",
    headline: "Turn agreed work into a handoff the team can follow.",
    description:
      "Connect client engagements, meeting commitments and assigned tasks. Keep the customer and agreement attached so the person doing the work understands what was promised.",
    outcome: "Clearer kickoff ownership and fewer commitments lost between sales and delivery.",
    capabilityIds: ["projects", "decompose", "debate-productions"],
    image: "plugins/client-onboarding",
    imageAlt:
      "A fictional client onboarding checklist with assigned work and its engagement context.",
    guideHref: "/docs/delivery",
    demoHref: "/demo/command-center/northline-roofing/client-onboarding",
    tasks: [
      {
        title: "Start a client engagement",
        detail: "Prepare access requests, kickoff steps and assigned work from a won opportunity.",
        href: "/docs/plugins/client-onboarding",
      },
      {
        title: "Carry meeting commitments forward",
        detail:
          "Turn an explicitly entered meeting checklist into dated tasks with owners and source context.",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        title: "Track the work in a useful view",
        detail:
          "Use Work as a list, board or calendar; save views, snooze tasks and find overdue commitments.",
        href: "/docs/command-center/work",
      },
    ],
    example: {
      title: "The customer accepts the job",
      steps: [
        "Open the won opportunity and client engagement.",
        "Prepare the site-access, materials and start-date checklist with actual owners and dates.",
        "Create the reviewed tasks and track completion in Work.",
      ],
      result:
        "The team has an assigned checklist linked to the engagement instead of a separate handoff spreadsheet.",
    },
    setup:
      "Client records and shared tasks are core. Client onboarding and Meeting commitments are optional Apps. They use supplied checklist information; they do not infer every obligation from a meeting.",
    builder:
      "Build a job, case or review workspace with its own lifecycle, linked to the customer and shared tasks. Collections demonstrates how an App can own domain state while participating in shared attention and AI.",
  },
  {
    id: "billing",
    title: "Billing & collections",
    headline: "Know what was agreed, what was invoiced and what still needs collecting.",
    description:
      "Prepare Stripe invoices, offer recurring plans and manage overdue balances with customer context. Keep a contract value, invoice, payment promise and collected payment distinct.",
    outcome:
      "Less reconstructing billing status before invoicing a customer or following up on an unpaid balance.",
    capabilityIds: ["invoices", "collections", "subscriptions", "reports"],
    image: "plugins/collections",
    imageAlt:
      "A fictional Collections case showing invoice evidence, payment promises and follow-up.",
    guideHref: "/docs/billing",
    demoHref: "/demo/command-center/northline-roofing/invoicing",
    tasks: [
      {
        title: "Create and send an invoice",
        detail:
          "Choose the customer and line items, preview the invoice and design its customer page before publication.",
        href: "/docs/plugins/stripe-invoicing",
      },
      {
        title: "Offer recurring plans",
        detail:
          "Configure supported monthly or annual subscriptions, customer checkout and account management.",
        href: "/docs/plugins/stripe-subscriptions",
      },
      {
        title: "Follow up on unpaid balances",
        detail:
          "Track selected invoices, inspect verified balances and payment promises, then prepare an appropriate reminder.",
        href: "/docs/plugins/receivables-collections",
      },
    ],
    example: {
      title: "An agreed job needs an invoice and a later follow-up",
      steps: [
        "Prepare an invoice for the existing customer and review its amounts.",
        "Approve creation and sending, then inspect the provider result.",
        "Track an outstanding invoice in Collections and review the balance, holds and promises before preparing a reminder.",
      ],
      result:
        "The team can distinguish a sent invoice from a payment and see the next collection decision against invoice evidence.",
    },
    setup:
      "Invoicing, subscriptions and Collections are optional and use connected Stripe accounts. Reminders also need a sender. Billing and external sends retain human approval; Revenue reports agreement values separately from collected cash.",
    builder:
      "Adapt invoice presentation or build a domain-specific billing workflow around the existing Stripe and collection services. Keep provider amounts and payment facts authoritative.",
  },
  {
    id: "marketing",
    title: "Marketing & publishing",
    headline: "Prepare the campaign, website and follow-up in the same business workspace.",
    description:
      "Create forms and website pages, organize editorial work, prepare email outreach and schedule supported social posts. Use the business context already available to produce more relevant content.",
    outcome:
      "Fewer separate handoffs between preparing content, publishing it and following up with customers.",
    capabilityIds: [
      "campaigns",
      "content-calendar",
      "site-studio",
      "social-marketing",
      "sequences",
    ],
    image: "plugins/site-studio",
    imageAlt: "Site Studio in the fictional workspace, with a page draft and responsive preview.",
    guideHref: "/docs/outreach",
    demoHref: "/demo/command-center/northline-roofing/site",
    tasks: [
      {
        title: "Build and update website pages",
        detail:
          "Use Site Studio to prepare AI page suggestions, compare changes and preview a draft before publishing a revision.",
        href: "/docs/plugins/site-studio",
      },
      {
        title: "Run email outreach and follow-up",
        detail:
          "Prepare audiences, templates, campaigns and sequences; inspect delivery and responses through the supported sending workflow.",
        href: "/docs/outreach/campaigns",
      },
      {
        title: "Coordinate content and social posts",
        detail:
          "Track editorial work in Content Calendar and prepare reviewed posts for supported LinkedIn company pages.",
        href: "/docs/plugins/social-marketing",
      },
    ],
    example: {
      title: "Prepare a seasonal roof-inspection campaign",
      steps: [
        "Draft the inspection page in Site Studio and preview its phone layout.",
        "Prepare the form and email audience, then review the content and publishing decisions.",
        "Follow incoming inquiries in Contacts and Pipeline; inspect campaign delivery separately.",
      ],
      result:
        "The team can manage the page, outreach and resulting inquiries in one application while checking each channel's actual result.",
    },
    setup:
      "Campaigns and editorial work use existing capabilities. Site Studio, forms and social publishing have their own module and connection requirements. Social scheduling currently supports the documented LinkedIn company-page path through Postiz; cross-channel attribution is not implied.",
    builder:
      "Add the content workflow or provider adapter your team needs using the existing customer, publishing and sending services. Channel-specific integrations still need implementation and verification.",
  },
  {
    id: "custom-apps",
    title: "Custom Apps & AI",
    headline: "Build your business's missing tools on a working foundation.",
    description:
      "Start with existing customer records and business services. Use a coding agent to add reports, workflows, tools or a dedicated App, and connect supported external assistants through MCP.",
    outcome:
      "Spend development effort on the process unique to your business instead of rebuilding common business infrastructure.",
    capabilityIds: [
      "coworkers",
      "custom-fields",
      "automations",
      "queue",
      "edits",
      "rejections",
      "outcomes",
      "trust",
      "brief",
      "web",
      "chat",
      "mcp",
      "sms",
      "api",
      "custom-apps",
      "workspace-themes",
      "modules",
      "agent-workflow",
      "audit",
      "killswitch",
      "own-db",
      "roles",
      "health",
      "ownership",
    ],
    image: "intelligence/workspace",
    imageAlt: "The AI workspace with a fictional business request and linked business actions.",
    guideHref: "/docs/extend",
    demoHref: "/demo/command-center/northline-roofing/ai",
    tasks: [
      {
        title: "Ask AI to work with business context",
        detail:
          "Read records, prepare exact changes and use supported jobs and bounded internal permissions. Review consequential actions where required.",
        href: "/docs/intelligence/workspace",
      },
      {
        title: "Adapt an existing report",
        detail:
          "Change Pipeline follow-up to fit your team's timing and verify findings against fixed fictional records.",
        href: "/docs/extend/first-change",
      },
      {
        title: "Build an App with a coding agent",
        detail:
          "Define the business task, reuse existing services and review the implemented interface, source and verification.",
        href: "/docs/extend/ai-authoring",
      },
    ],
    example: {
      title: "Your team follows up after three quiet days",
      steps: [
        "Run the source and explore the fictional workspace.",
        "Change the existing Pipeline follow-up report's stale threshold from seven days to three.",
        "Run the controlled report fixture and verify which open opportunities now appear.",
      ],
      result:
        "A useful business rule is adapted in a real extension, with the original customer references and report runtime preserved.",
    },
    setup:
      "The local site and demo need no business provider keys. Connected use needs workspace setup. Custom Apps are built from source with an external coding agent today; general-purpose in-app App generation remains planned.",
    builder:
      "Modules register navigation, routes and tools. Plugins reuse bounded runtime contracts. New domain records can own their lifecycle while linking to shared identity, tasks, AI and activity.",
  },
];

export function businessAreaForCapability(id: string): BusinessArea {
  const area = businessAreas.find((item) => item.capabilityIds.includes(id));
  if (!area) throw new Error(`Missing business area for capability: ${id}`);
  return area;
}
