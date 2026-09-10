/**
 * Services page content model. The four engagement modes and the Command
 * Center framing come from marketing-positioning.ts (single source of truth);
 * this file holds the page-specific sections only. Copy rules follow
 * docs/contracts/MARKETING-POSITIONING-CONTRACT.md: plain sentences, concrete
 * work, no invented metrics, no formulaic contrast framing.
 */

export type ServiceProblem = { title: string; body: string };

export const problemRows: ServiceProblem[] = [
  {
    title: "Work that repeats",
    body: "Follow-up, intake, reporting, scheduling, document handling, and data entry run through people every single day.",
  },
  {
    title: "Revenue that leaks",
    body: "Replies arrive slowly, opportunities go quiet, and follow-up depends on someone remembering.",
  },
  {
    title: "Information that is scattered",
    body: "Email says one thing, the CRM says another, and the current number lives in a spreadsheet.",
  },
  {
    title: "Judgment that needs support",
    body: "Research, prioritization, drafting, and preparation consume hours that could go to decisions, relationships, and the work only people can do.",
  },
];

export type BuildGroup = {
  id: string;
  title: string;
  items: string[];
  /** Legacy service-catalog anchor this group inherits (#engagement, #content). */
  legacyAnchor?: string;
};

export const buildGroups: BuildGroup[] = [
  {
    id: "revenue",
    title: "Revenue",
    items: [
      "Lead qualification and routing",
      "Pipeline follow-up and revival",
      "Proposal and estimate preparation",
      "Opportunity research",
      "Dormant account re-engagement",
    ],
  },
  {
    id: "operations",
    title: "Operations",
    items: [
      "Intake and onboarding systems",
      "Approval workflows",
      "Meeting preparation and follow-up",
      "Field-note processing",
      "Internal dashboards",
    ],
  },
  {
    id: "customer",
    title: "Customer experience",
    legacyAnchor: "engagement",
    items: [
      "Inquiry handling trained on your policies",
      "Booking and scheduling",
      "Customer portals",
      "Support triage and escalation",
      "Review and re-engagement workflows",
    ],
  },
  {
    id: "finance",
    title: "Finance",
    items: [
      "Invoice and payment workflows",
      "Collections support",
      "Payment and revenue monitoring",
      "Cash and pipeline reporting",
    ],
  },
  {
    id: "knowledge",
    title: "Knowledge",
    legacyAnchor: "content",
    items: [
      "Company knowledge search",
      "Document intelligence",
      "SOP copilots",
      "Research agents",
      "Internal AI assistants",
    ],
  },
];

/** One capability line under the four modes, phrased as examples, not a menu. */
export const buildCapabilities =
  "AI agents · workflow automation · CRM and pipeline systems · integrations · internal tools · customer experiences · reporting · custom applications";

export type IntegrationGroup = { title: string; body: string };

export const integrationGroups: IntegrationGroup[] = [
  {
    title: "Email and conversations",
    body: "Gmail, website chat, and SMS through a custom connection where needed.",
  },
  {
    title: "Calendar and files",
    body: "Google Calendar and Google Drive, with Microsoft 365 as custom integration work.",
  },
  {
    title: "CRM and records",
    body: "Your existing CRM, or Accelerate's built-in records when there is nothing worth keeping.",
  },
  {
    title: "Payments and finance",
    body: "Stripe plus exports and events from the accounting system you already run.",
  },
  {
    title: "Everyday work tools",
    body: "Project management, team communication, and specialized industry software.",
  },
];

export const integrationClosing =
  "If a system has an API, a webhook, an MCP interface, or a screen a person uses, there is usually a practical way to bring it into the workflow. Native connections are used where they exist today; anything else is custom integration work, and it is quoted as such.";

export type EngagementShape = { title: string; body: string };

export const engagementShapes: EngagementShape[] = [
  {
    title: "Strategy",
    body: "A focused audit, recommendation, or roadmap.",
  },
  {
    title: "Fixed build",
    body: "A clearly scoped system, workflow, or integration.",
  },
  {
    title: "Build and operate",
    body: "We build the system and run the associated work.",
  },
  {
    title: "Ongoing optimization",
    body: "Support, monitoring, expansion, and improvement over time.",
  },
];

export const scopingPromise =
  "Most initial projects are fixed scope. The recommendation, the cost, and the success criteria are confirmed in writing before work begins. Focused strategy engagements start at $1,500. Custom builds typically start at $2,500, with monthly support where ongoing work makes sense.";

/** Work slugs featured on Services, framed Problem → System → Result. */
export const featuredServiceWorkSlugs = ["work-shelter", "sparkblox", "superdebate"] as const;

export const commandCenterFraming =
  "If the honest answer is one workflow, one agent, or one integration, that is what we build. Some businesses grow into a shared operating layer: one place where records, conversations, pipeline, payments, and work are visible together, with AI coworkers acting through governed tools.";
