/**
 * The single authority for docs structure, ordering, and section card
 * metadata. MDX files hold only prose; everything structural lives here so
 * a missing page fails the verifier instead of silently vanishing.
 *
 * Convention: every section directory collapses to its first page, which
 * must be that section's overview. The loader resolves a bare section slug
 * to it, so section landings need no separate route.
 */
export const DOCS_MANIFEST_CONTRACT = "docs-manifest.v1";

export interface DocsPageEntry {
  /** Full slug parts, e.g. ["command-center", "overview"]. */
  slug: string[];
  title: string;
  description: string;
}

export interface DocsSection {
  id: string;
  title: string;
  description: string;
  pages: DocsPageEntry[];
  /** Non-extension module ids this user-guide section documents. Empty for
   *  Start, Follow-up, and Self-hosting, which are not module clusters. */
  modules?: string[];
}

export const docsManifest: DocsSection[] = [
  {
    id: "start",
    title: "Start",
    description: "Learn the essentials and try your first complete workflow.",
    pages: [
      {
        slug: ["start", "overview"],
        title: "An AI command center you can make your own",
        description:
          "Connect your business, work with AI, and build on an open-source foundation you control.",
      },
      {
        slug: ["start", "how-it-works"],
        title: "How Accelerate works",
        description:
          "Follow business context from its source to a reviewed action, recorded result, and reusable extension.",
      },
      {
        slug: ["start", "business-owners"],
        title: "For business owners",
        description:
          "Choose a useful first workflow, assign ownership, and measure whether it helps.",
      },
      {
        slug: ["start", "agencies"],
        title: "For agencies",
        description: "Onboard client workspaces, verify access, and agree an operational handoff.",
      },
      {
        slug: ["start", "daily-path"],
        title: "Your first workflow",
        description: "Try the daily queue and review a proposed action using fictional data.",
      },
      {
        slug: ["start", "core-concepts"],
        title: "Core concepts",
        description: "The people, records, work, and decisions you will see in the workspace.",
      },
      {
        slug: ["start", "workspace"],
        title: "Your workspace",
        description: "Check your business context, membership, and available features.",
      },
      {
        slug: ["start", "modules"],
        title: "Modules",
        description: "Optional capabilities a workspace turns on and off without forking the app.",
      },
      {
        slug: ["start", "receipts"],
        title: "Check an action result",
        description: "Tell a prepared draft, an approved request, and a completed action apart.",
      },
      {
        slug: ["start", "troubleshooting"],
        title: "Troubleshooting",
        description:
          "Recover from common setup, access, search, and action failures without guessing.",
      },
    ],
  },
  {
    id: "plugins",
    title: "Plugin examples",
    description:
      "See what you can build: reports, reviewed workflows and dedicated business workspaces.",
    pages: [
      {
        slug: ["plugins", "overview"],
        title: "Plugin examples",
        description:
          "Explore ten bundled examples, from focused reports to complete business workspaces.",
      },
      {
        slug: ["plugins", "business-pulse"],
        title: "Business Pulse",
        description: "See pipeline risks, overdue commitments and upcoming meetings in one report.",
      },
      {
        slug: ["plugins", "client-onboarding"],
        title: "Client onboarding",
        description: "Turn a won opportunity into a reviewed, assigned kickoff checklist.",
      },
      {
        slug: ["plugins", "commitment-watch"],
        title: "Overdue commitments",
        description: "Find overdue tasks and return to the work behind each commitment.",
      },
      {
        slug: ["plugins", "example-inventory"],
        title: "Inventory registration example",
        description: "Learn how a module adds a page, navigation and settings to a workspace.",
      },
      {
        slug: ["plugins", "meeting-commitments"],
        title: "Meeting commitments",
        description: "Turn an existing meeting into assigned tasks with dates and a reviewed plan.",
      },
      {
        slug: ["plugins", "meeting-prep"],
        title: "Meeting preparation",
        description: "See which meetings are approaching so you can plan preparation time.",
      },
      {
        slug: ["plugins", "opportunity-radar"],
        title: "Opportunity Radar",
        description:
          "Explore a business-specific workspace for source-backed growth opportunities and relationship reviews.",
      },
      {
        slug: ["plugins", "pipeline-watch"],
        title: "Pipeline follow-up",
        description: "Find open opportunities whose next action or update needs attention.",
      },
      {
        slug: ["plugins", "receivables-collections"],
        title: "Receivables Collections",
        description:
          "Bring invoice evidence, customer commitments and reviewed reminders into one workspace.",
      },
      {
        slug: ["plugins", "stripe-invoicing"],
        title: "Stripe invoicing",
        description:
          "Prepare an invoice from a customer record, review it, and follow its provider result.",
      },
    ],
  },
  {
    id: "command-center",
    title: "Command Center",
    description:
      "One shared operating layer for the businesses that need it, and how to run the daily workspace.",
    modules: ["core-command"],
    pages: [
      {
        slug: ["command-center", "overview"],
        title: "The Command Center",
        description: "Customer context, daily priorities, and reviewed actions in one workspace.",
      },
      {
        slug: ["command-center", "capabilities"],
        title: "Capability reference",
        description: "Explore capabilities and check their availability in your workspace.",
      },
      {
        slug: ["command-center", "today"],
        title: "Work the Today queue",
        description: "Review urgent work, take the next action and confirm the result.",
      },
      {
        slug: ["command-center", "inbox"],
        title: "Inbox",
        description: "Triage leads, messages, tasks, and staged actions that still need a person.",
      },
      {
        slug: ["command-center", "work"],
        title: "Manage tasks and approvals in Work",
        description:
          "Edit commitments and review decisions while keeping one saved task or approval across views.",
      },
      {
        slug: ["command-center", "approvals"],
        title: "Review and approve actions",
        description:
          "Understand what waits for review, what approval does, and how to check the result.",
      },
      {
        slug: ["command-center", "activity"],
        title: "Inspect activity",
        description: "Find a recorded change and trace it to the affected record.",
      },
      {
        slug: ["command-center", "ask"],
        title: "Ask AI",
        description:
          "Ask a specific question, inspect the evidence, and review any proposed action.",
      },
    ],
  },
  {
    id: "pipeline",
    title: "Pipeline",
    description: "Opportunities, stages, value, and closed revenue in one operating view.",
    modules: ["core-pipeline", "revenue"],
    pages: [
      {
        slug: ["pipeline", "overview"],
        title: "Pipeline",
        description:
          "Move work that produces revenue, then review every opportunity from one board.",
      },
      {
        slug: ["pipeline", "revenue"],
        title: "Understand revenue figures",
        description:
          "Read client and proposal totals and investigate differences from pipeline or payment records.",
      },
      {
        slug: ["pipeline", "board"],
        title: "Use the pipeline board",
        description: "Move an opportunity forward and keep its next action clear.",
      },
    ],
  },
  {
    id: "conversations",
    title: "Conversations",
    description: "The reply-ready inbox for Gmail, forms, chat, and transcripts.",
    modules: ["core-conversations"],
    pages: [
      {
        slug: ["conversations", "overview"],
        title: "Conversations",
        description:
          "One thread per person, with the record it belongs to and a next action attached.",
      },
      {
        slug: ["conversations", "reply"],
        title: "Reply to a conversation",
        description: "Find the right thread, review the recipient, and check the send result.",
      },
    ],
  },
  {
    id: "contacts",
    title: "Contacts",
    description: "Identity resolution, intake, and reviewed list imports.",
    modules: ["core-contacts"],
    pages: [
      {
        slug: ["contacts", "overview"],
        title: "Contacts",
        description:
          "Canonical people and companies, with duplicates proposed rather than guessed.",
      },
      {
        slug: ["contacts", "import"],
        title: "Import contacts",
        description: "Prepare a small list, review the proposed records, and confirm the import.",
      },
    ],
  },
  {
    id: "outreach",
    title: "Outreach",
    description: "Campaigns, email templates, and reactivation of past demand.",
    modules: ["campaigns", "email-studio", "recovery"],
    pages: [
      {
        slug: ["outreach", "overview"],
        title: "Outreach",
        description:
          "Controlled outbound that stops on reply and refuses contacts who asked to be left alone.",
      },
      {
        slug: ["outreach", "collections"],
        title: "Review collection reminders",
        description:
          "Track verified invoice balances, payment promises, and disputes before approving a reminder.",
      },
      {
        slug: ["outreach", "campaigns"],
        title: "Campaigns",
        description:
          "Approve a version once, then automation runs inside sender, audience, cadence, limit, and stop rules.",
      },
      {
        slug: ["outreach", "email-studio"],
        title: "Email Studio",
        description: "Edit live copy, inspect what was sent, and compose a direct follow-up.",
      },
      {
        slug: ["outreach", "recovery"],
        title: "Review recovery outreach",
        description: "Check eligibility and the proposed playbook before contacting a past lead.",
      },
    ],
  },
  {
    id: "proposals",
    title: "Proposals",
    description: "Drafts, pricing validation, decisions, and follow-up.",
    modules: ["proposals"],
    pages: [
      {
        slug: ["proposals", "overview"],
        title: "Proposals",
        description: "Estimates and scopes that share a ledger with the rest of the workspace.",
      },
      {
        slug: ["proposals", "send"],
        title: "Drafting and sending",
        description:
          "Catalog pricing, unguessable public links, and decisions that write an audit row.",
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery",
    description: "Clients, bookings, content, and resources after the sale.",
    modules: ["clients", "bookings", "content", "resources"],
    pages: [
      {
        slug: ["delivery", "overview"],
        title: "Delivery",
        description:
          "The workspace past the won stage: retainers, meetings, publishing, and downloads.",
      },
      {
        slug: ["delivery", "clients"],
        title: "Review client accounts",
        description:
          "Find an account, check its status and monthly value, and open its delivery record.",
      },
      {
        slug: ["delivery", "bookings"],
        title: "Review bookings",
        description:
          "Check qualification, call status and the next step for a booked conversation.",
      },
      {
        slug: ["delivery", "content"],
        title: "Manage editorial work",
        description: "Create a content item, track its status and confirm changes were saved.",
      },
      {
        slug: ["delivery", "resources"],
        title: "Review resource downloads",
        description: "Find who requested a resource and check the recorded download time.",
      },
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    description: "The assistant, run traces, knowledge, and source-to-revenue analytics.",
    modules: ["core-intelligence", "analytics"],
    pages: [
      {
        slug: ["intelligence", "overview"],
        title: "Put AI to work with your business context",
        description:
          "Ask questions, inspect the evidence, and turn supported requests into reviewed actions.",
      },
      {
        slug: ["intelligence", "opportunity-radar"],
        title: "Review opportunities with Radar",
        description:
          "Review sources, relationship context, estimates, and drafts with explicit approvals and model budgets.",
      },
      {
        slug: ["intelligence", "tools"],
        title: "AI tool reference",
        description: "Registered tools, connection requirements, and input schemas.",
      },
      {
        slug: ["intelligence", "workspace"],
        title: "Use the AI Workspace",
        description:
          "Ask a specific question, check its sources and inspect the result of an action.",
      },
    ],
  },
  {
    id: "sources",
    title: "Sources",
    description: "Inbound leads, chat, subscribers, partners, and website grades.",
    modules: ["leads-capture", "subscribers", "partners", "website-grades"],
    pages: [
      {
        slug: ["sources", "overview"],
        title: "Sources",
        description:
          "Where new people enter, before they become contacts, conversations, or deals.",
      },
      {
        slug: ["sources", "leads"],
        title: "Review leads and chat handoffs",
        description: "Qualify an inquiry, check for an existing person and record the next action.",
      },
    ],
  },
  {
    id: "workspace",
    title: "Workspace",
    description: "Tenants, setup, settings, integrations, and the Feature Board.",
    modules: ["core-system", "integrations"],
    pages: [
      {
        slug: ["workspace", "overview"],
        title: "Workspace",
        description: "How a tenant is provisioned, connected, and kept ready.",
      },
      {
        slug: ["workspace", "integrations"],
        title: "Connect your tools and data",
        description:
          "Bring external context into the workspace and make supported actions available to your team and AI.",
      },
      {
        slug: ["workspace", "setup"],
        title: "Set up a working workspace",
        description: "Verify access and the connections needed for your first real workflow.",
      },
      {
        slug: ["workspace", "settings"],
        title: "Change workspace settings",
        description: "Update notifications and configuration, then confirm the saved result.",
      },
    ],
  },
  {
    id: "customize",
    title: "Customize",
    description: "Configure your workspace or build around a different business process.",
    pages: [
      {
        slug: ["customize", "overview"],
        title: "Make Command Center fit your business",
        description:
          "Configure the defaults, adapt a workflow, or build an App with its own records and screens.",
      },
    ],
  },
  {
    id: "extend",
    title: "Build on it",
    description:
      "For coding agents and humans: add a module, an integration adapter, a plugin, or an MCP client without forking core.",
    pages: [
      {
        slug: ["extend", "overview"],
        title: "Build the capabilities your business needs",
        description:
          "Add screens, integrations and AI tools while reusing the records and workflows already in place.",
      },
      {
        slug: ["extend", "apps"],
        title: "Build an App around your business process",
        description:
          "Choose shared primitives, custom domain work or a dedicated workspace without duplicating state.",
      },
      {
        slug: ["extend", "work-primitives"],
        title: "Design custom work without duplicate state",
        description:
          "Give an App its own lifecycle and connect tasks, decisions, attention and history to the original records.",
      },
      {
        slug: ["extend", "custom-ui"],
        title: "Build a custom operating screen",
        description:
          "Add a native App workspace or replace the default experience while retaining shared business services.",
      },
      {
        slug: ["extend", "ai-authoring"],
        title: "Build Apps with a coding assistant",
        description:
          "Use a concrete development brief today and understand the planned in-app draft, preview and publish experience.",
      },
      {
        slug: ["extend", "first-change"],
        title: "Your first developer change",
        description: "Run the demo, find the important files, and make a small extension change.",
      },
      {
        slug: ["extend", "modules"],
        title: "Add a module",
        description: "Register a JSON manifest and pages. Nothing in extensions/ is executed.",
      },
      {
        slug: ["extend", "adapters"],
        title: "Add an integration adapter",
        description:
          "Verify credentials, encrypt them, and turn inbound events into canonical records.",
      },
      {
        slug: ["extend", "plugins"],
        title: "Plugins",
        description:
          "Register a plugin manifest with tools and triggers that still go through governance.",
      },
      {
        slug: ["extend", "tools"],
        title: "Add an AI tool",
        description:
          "Register a schema, an impact tier, and a service boundary. Mutating tools propose.",
      },
      {
        slug: ["extend", "mcp"],
        title: "MCP concepts",
        description:
          "Bounded reads, staged writes, tenant isolation. The same registry the UI uses.",
      },
      {
        slug: ["extend", "mcp-clients"],
        title: "Connect an MCP client",
        description:
          "Connect an external assistant to the intended workspace and verify a read first.",
      },
      {
        slug: ["extend", "webhooks"],
        title: "Inbound webhooks",
        description:
          "Tenant-scoped public routes, signature checks, replay windows, and canonical ingest.",
      },
    ],
  },
  {
    id: "follow-up",
    title: "Follow-up",
    description:
      "The discipline that decides most inquiries: respond first, follow through, and let nothing wait.",
    pages: [
      {
        slug: ["follow-up", "overview"],
        title: "Follow up on an inquiry",
        description: "Assign the response, record a due date and close the loop.",
      },
    ],
  },
  {
    id: "self-hosting",
    title: "Self-hosting",
    description:
      "Run the Command Center yourself: what you need, how to start, and when to bring us in.",
    pages: [
      {
        slug: ["self-hosting", "overview"],
        title: "Self-hosting quickstart",
        description: "Explore without credentials, then connect a workspace you control.",
      },
      {
        slug: ["self-hosting", "installation"],
        title: "Connect your installation",
        description:
          "Create the owner account, configure a fresh database, and verify a connected workspace.",
      },
    ],
  },
];

/** Every page in manifest order. Drives static params, pager, and sidebar. */
export function flattenDocsPages(): DocsPageEntry[] {
  return docsManifest.flatMap((section) => section.pages);
}
