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
        title: "Start using Command Center",
        description: "Choose a task, follow its steps and check the result.",
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
        title: "Intelligence",
        description:
          "Ask with bounded context, inspect what ran, and read funnel numbers from the same records.",
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
        title: "Integrations and modules",
        description: "Providers, module switches, and the MCP key, from the operator console.",
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
    id: "extend",
    title: "Build on it",
    description:
      "For coding agents and humans: add a module, an integration adapter, a plugin, or an MCP client without forking core.",
    pages: [
      {
        slug: ["extend", "overview"],
        title: "Extend the runtime",
        description: "What every extension inherits: approval, audit, module gating, and MCP.",
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
