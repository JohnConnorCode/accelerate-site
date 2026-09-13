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

/** Which reading path a section belongs to. Sections are required to declare
 *  one, and `docsManifest` must list every "operator" section before every
 *  "builder" section, so the sidebar, the landing page, and the pager can
 *  treat the two tracks as one contiguous run each. */
export type DocsTrackId = "operator" | "builder";

export interface DocsTrack {
  id: DocsTrackId;
  title: string;
  description: string;
}

export const docsTracks: DocsTrack[] = [
  {
    id: "operator",
    title: "Run your business",
    description: "For the person who owns the workflow: contacts, pipeline, approvals, revenue.",
  },
  {
    id: "builder",
    title: "Build and run it yourself",
    description: "For a developer or coding assistant: plugins, extension points, self-hosting.",
  },
];

export interface DocsSection {
  id: string;
  track: DocsTrackId;
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
    track: "operator",
    title: "Start",
    description: "Learn the essentials and try your first complete workflow.",
    pages: [
      {
        slug: ["start", "overview"],
        title: "An AI command center you can make your own",
        description:
          "Connect your business, work with AI that earns more trust over time, and build on an open-source foundation you control.",
      },
      {
        slug: ["start", "how-it-works"],
        title: "How Accelerate works",
        description:
          "The one path every entry point follows, from raw source data to a reviewed action and its receipt.",
      },
      {
        slug: ["start", "business-owners"],
        title: "For business owners",
        description:
          "Decide whether it fits, run a small pilot, and know what to check before you rely on it.",
      },
      {
        slug: ["start", "agencies"],
        title: "For agencies",
        description:
          "Plan one client pilot: who owns what, how to prove data stays separated, and how to hand it over.",
      },
      {
        slug: ["start", "daily-path"],
        title: "Your first workflow",
        description:
          "Walk through the daily queue in the fictional demo: find work, review a proposal, and confirm what happened.",
      },
      {
        slug: ["start", "core-concepts"],
        title: "Core concepts",
        description:
          "The vocabulary every other guide assumes: workspace, record, approval, receipt, and how they connect.",
      },
      {
        slug: ["start", "workspace"],
        title: "Your workspace",
        description: "Check your business context, membership, and available features.",
      },
      {
        slug: ["start", "modules"],
        title: "Modules",
        description:
          "Turn a whole area of the product on or off per workspace, without forking the application.",
      },
      {
        slug: ["start", "receipts"],
        title: "Check an action result",
        description:
          "Read the receipt, not the confirmation toast, to know whether an action actually finished.",
      },
      {
        slug: ["start", "troubleshooting"],
        title: "Troubleshooting",
        description:
          "The recovery step for the setup, access, and action failures you'll actually hit, by symptom.",
      },
    ],
  },
  {
    id: "command-center",
    track: "operator",
    title: "Command Center",
    description:
      "One shared operating layer for the businesses that need it, and how to run the daily workspace.",
    modules: ["core-command"],
    pages: [
      {
        slug: ["command-center", "overview"],
        title: "The Command Center",
        description:
          "Where your day starts: ranked work, the records behind it, and actions the system takes as it earns your trust.",
      },
      {
        slug: ["command-center", "capabilities"],
        title: "Capability reference",
        description:
          "47 capabilities in six categories, from what the system sees to what it never does without you.",
      },
      {
        slug: ["command-center", "today"],
        title: "Make Today your daily workspace",
        description:
          "Arrange your business brief, decisions, work and App follow-up into saved views that fit your day.",
      },
      {
        slug: ["command-center", "inbox"],
        title: "Inbox",
        description:
          "Every new lead, message, and staged action that hasn't found an owner yet, in one queue.",
      },
      {
        slug: ["command-center", "work"],
        title: "Manage tasks and approvals in Work",
        description:
          "The editing view over the same tasks and approvals Today shows you, with filters and full editing.",
      },
      {
        slug: ["command-center", "approvals"],
        title: "Review and approve actions",
        description:
          "How approval works, how it earns more autonomy over time, and what to check after a decision.",
      },
      {
        slug: ["command-center", "activity"],
        title: "Inspect activity",
        description: "Trace a change back to who made it, what actually happened, and when.",
      },
      {
        slug: ["command-center", "ask"],
        title: "Ask AI",
        description:
          "Ask a specific question, see the records it used to answer, and review anything it proposes.",
      },
    ],
  },
  {
    id: "conversations",
    track: "operator",
    title: "Conversations",
    description: "The reply-ready inbox for Gmail, forms, chat, and transcripts.",
    modules: ["core-conversations"],
    pages: [
      {
        slug: ["conversations", "overview"],
        title: "Conversations",
        description:
          "Every message from every channel, landed on the same thread, the same person, and the same deal.",
      },
      {
        slug: ["conversations", "reply"],
        title: "Reply to a conversation",
        description:
          "Find the right thread, confirm who you're actually writing to, and check that it sent.",
      },
    ],
  },
  {
    id: "contacts",
    track: "operator",
    title: "Contacts",
    description: "Identity resolution, intake, and reviewed list imports.",
    modules: ["core-contacts"],
    pages: [
      {
        slug: ["contacts", "overview"],
        title: "Contacts",
        description:
          "One record per person, matched from every channel, with merges proposed rather than assumed.",
      },
      {
        slug: ["contacts", "import"],
        title: "Import contacts",
        description:
          "Bring in a CSV or pasted list through a review batch that writes nothing until you confirm it.",
      },
    ],
  },
  {
    id: "pipeline",
    track: "operator",
    title: "Pipeline",
    description: "Opportunities, stages, value, and closed revenue in one operating view.",
    modules: ["core-pipeline", "revenue"],
    pages: [
      {
        slug: ["pipeline", "overview"],
        title: "Pipeline",
        description: "Every open deal on one board, ranked by what actually moves revenue next.",
      },
      {
        slug: ["pipeline", "revenue"],
        title: "Understand revenue figures",
        description:
          "Where each number on the revenue screen actually comes from, and how to chase a discrepancy.",
      },
      {
        slug: ["pipeline", "board"],
        title: "Use the pipeline board",
        description:
          "Drag a card when the evidence actually changed, and leave the next action clear behind it.",
      },
    ],
  },
  {
    id: "proposals",
    track: "operator",
    title: "Proposals",
    description: "Drafts, pricing validation, decisions, and follow-up.",
    modules: ["proposals"],
    pages: [
      {
        slug: ["proposals", "overview"],
        title: "Proposals",
        description:
          "Drafts, sends, and decisions on one ledger, with pricing checked against your catalog.",
      },
      {
        slug: ["proposals", "send"],
        title: "Drafting and sending",
        description:
          "Draft, share an unguessable link, and record a decision that writes its own audit row.",
      },
    ],
  },
  {
    id: "follow-up",
    track: "operator",
    title: "Follow-up",
    description:
      "The discipline that decides most inquiries: respond first, follow through, and let nothing wait.",
    pages: [
      {
        slug: ["follow-up", "overview"],
        title: "Follow up on an inquiry",
        description:
          "Assign the response, name a real next action, and close the loop once it's answered.",
      },
    ],
  },
  {
    id: "outreach",
    track: "operator",
    title: "Outreach",
    description: "Campaigns, email templates, and reactivation of past demand.",
    modules: ["campaigns", "email-studio", "recovery"],
    pages: [
      {
        slug: ["outreach", "overview"],
        title: "Outreach",
        description:
          "Outbound that stops the moment someone replies or asks to be left alone, no exceptions.",
      },
      {
        slug: ["outreach", "collections"],
        title: "Review collection reminders",
        description:
          "Chase what invoicing actually confirms is owed, with every reminder requiring your approval.",
      },
      {
        slug: ["outreach", "campaigns"],
        title: "Campaigns",
        description:
          "Approve one version, then automation runs entirely inside the rules you set for it.",
      },
      {
        slug: ["outreach", "email-studio"],
        title: "Email Studio",
        description:
          "Edit the actual live copy, check what really sent, and write a direct one-off follow-up.",
      },
      {
        slug: ["outreach", "recovery"],
        title: "Review recovery outreach",
        description:
          "Check who actually qualifies and the proposed playbook before reopening a past lead.",
      },
    ],
  },
  {
    id: "delivery",
    track: "operator",
    title: "Delivery",
    description: "Clients, bookings, content, and resources after the sale.",
    modules: ["clients", "bookings", "content", "resources"],
    pages: [
      {
        slug: ["delivery", "overview"],
        title: "Delivery",
        description:
          "The workspace for what happens after a deal is won: retainers, meetings, publishing, downloads.",
      },
      {
        slug: ["delivery", "clients"],
        title: "Review client accounts",
        description:
          "Find an account, check what it's actually worth, and open its delivery record.",
      },
      {
        slug: ["delivery", "bookings"],
        title: "Review bookings",
        description: "Prep for the call, then record what actually happened once it's over.",
      },
      {
        slug: ["delivery", "content"],
        title: "Manage editorial work",
        description:
          "Track a brief from idea to published, and verify a review actually caught what mattered.",
      },
      {
        slug: ["delivery", "resources"],
        title: "Review resource downloads",
        description:
          "Find who requested a resource, when, and whether that's worth a real follow-up.",
      },
    ],
  },
  {
    id: "sources",
    track: "operator",
    title: "Sources",
    description: "Inbound leads, chat, subscribers, partners, and website grades.",
    modules: ["leads-capture", "subscribers", "partners", "website-grades"],
    pages: [
      {
        slug: ["sources", "overview"],
        title: "Sources",
        description:
          "Where a new name actually enters the business, before it becomes a canonical contact.",
      },
      {
        slug: ["sources", "leads"],
        title: "Review leads and chat handoffs",
        description:
          "Qualify a new inquiry, check whether it's actually someone you already know, and record what's next.",
      },
    ],
  },
  {
    id: "intelligence",
    track: "operator",
    title: "Intelligence",
    description: "The assistant, run traces, knowledge, and source-to-revenue analytics.",
    modules: ["core-intelligence", "analytics"],
    pages: [
      {
        slug: ["intelligence", "overview"],
        title: "Put AI to work with your business context",
        description:
          "Ask a real question, see the evidence behind the answer, and review whatever it prepares.",
      },
      {
        slug: ["intelligence", "opportunity-radar"],
        title: "Review opportunities with Radar",
        description:
          "Review sourced opportunities and relationships, with model spend off by default and every send reviewed.",
      },
      {
        slug: ["intelligence", "tools"],
        title: "AI tool reference",
        description:
          "Every registered tool, generated straight from the registry: what it needs and what it does.",
      },
      {
        slug: ["intelligence", "learning-inbox"],
        title: "Teach the business with the Learning Inbox",
        description:
          "Propose reusable corrections once, review them in one inbox, and let approved learnings guide future work.",
      },
      {
        slug: ["intelligence", "workspace"],
        title: "Use the AI Workspace",
        description:
          "Ask a specific question, check the sources behind the answer, then inspect what actually ran.",
      },
    ],
  },
  {
    id: "workspace",
    track: "operator",
    title: "Workspace",
    description: "Tenants, setup, settings, integrations, and the Feature Board.",
    modules: ["core-system", "integrations"],
    pages: [
      {
        slug: ["workspace", "overview"],
        title: "Workspace",
        description: "How your business gets provisioned, connected, verified, and kept running.",
      },
      {
        slug: ["workspace", "integrations"],
        title: "Connect your tools and data",
        description:
          "Turn a message, calendar event, or invoice sitting in another app into usable context here.",
      },
      {
        slug: ["workspace", "setup"],
        title: "Set up a working workspace",
        description: "Verify the connections one real workflow needs, before layering on more.",
      },
      {
        slug: ["workspace", "settings"],
        title: "Change workspace settings",
        description:
          "Change a notification or your workspace's look, then confirm the change actually saved.",
      },
    ],
  },
  {
    id: "customize",
    track: "operator",
    title: "Customize",
    description: "Configure your workspace or build around a different business process.",
    pages: [
      {
        slug: ["customize", "overview"],
        title: "Make Command Center fit your business",
        description:
          "Five levels of change, from flipping a setting to building your own domain-specific App.",
      },
    ],
  },
  {
    id: "plugins",
    track: "builder",
    title: "Plugin examples",
    description:
      "See what you can build: reports, reviewed workflows and dedicated business workspaces.",
    pages: [
      {
        slug: ["plugins", "overview"],
        title: "Plugin examples",
        description:
          "Twelve working examples, from a read-only report to a full business workspace, all shipped disabled.",
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
        description:
          "The smallest possible extension: a manifest, a page, and a setting, with nothing else.",
      },
      {
        slug: ["plugins", "meeting-commitments"],
        title: "Meeting commitments",
        description:
          "Turn what got agreed in a meeting into assigned, dated tasks someone actually owns.",
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
          "A business-specific workspace for source-backed growth opportunities and relationship reviews.",
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
          "Chase an overdue balance from verified invoice evidence, with every reminder reviewed first.",
      },
      {
        slug: ["plugins", "social-marketing"],
        title: "Social Marketing",
        description:
          "Prepare LinkedIn posts, approve their content and time, and follow publication receipts from your workspace.",
      },
      {
        slug: ["plugins", "stripe-invoicing"],
        title: "Stripe invoicing",
        description:
          "Prepare an invoice from a customer record, review it, and check exactly what Stripe accepted.",
      },
      {
        slug: ["plugins", "site-studio"],
        title: "Draft public pages with Site Studio",
        description:
          "Create and edit website pages, review AI suggestions, and publish saved revisions.",
      },
    ],
  },
  {
    id: "extend",
    track: "builder",
    title: "Build on it",
    description:
      "For coding agents and humans: add a module, an integration adapter, a plugin, or an MCP client without forking core.",
    pages: [
      {
        slug: ["extend", "overview"],
        title: "Build the capabilities your business needs",
        description:
          "Add a screen, an integration, or an AI tool, reusing the records and approval flow already in place.",
      },
      {
        slug: ["extend", "apps"],
        title: "Build an App around your business process",
        description:
          "Choose shared primitives, custom domain work, or a dedicated workspace, without duplicating state.",
      },
      {
        slug: ["extend", "work-primitives"],
        title: "Design custom work without duplicate state",
        description:
          "Give an App its own lifecycle, and link tasks, decisions, and history back to the real record.",
      },
      {
        slug: ["extend", "custom-ui"],
        title: "Build a custom operating screen",
        description:
          "Build the exact screen your business needs, while keeping the shared services underneath it.",
      },
      {
        slug: ["extend", "ai-authoring"],
        title: "Build Apps with a coding assistant",
        description:
          "A concrete brief to hand a coding assistant today, plus where the in-app builder is headed.",
      },
      {
        slug: ["extend", "first-change"],
        title: "Your first developer change",
        description:
          "Run the demo, learn where code actually lives, and make one small, safe extension change.",
      },
      {
        slug: ["extend", "modules"],
        title: "Add a module",
        description:
          "Register a JSON manifest and the pages it names; nothing under extensions/ ever gets executed.",
      },
      {
        slug: ["extend", "adapters"],
        title: "Add an integration adapter",
        description:
          "Verify a provider's credentials, encrypt them, and turn its inbound events into canonical records.",
      },
      {
        slug: ["extend", "plugins"],
        title: "Plugins",
        description:
          "Register a plugin manifest with tools and triggers that still route through real governance.",
      },
      {
        slug: ["extend", "tools"],
        title: "Add an AI tool",
        description:
          "Register a schema, an impact tier, and a service boundary; a mutating tool always proposes.",
      },
      {
        slug: ["extend", "mcp"],
        title: "MCP concepts",
        description:
          "Bounded reads, staged writes, and tenant isolation, using the exact same registry the UI uses.",
      },
      {
        slug: ["extend", "mcp-clients"],
        title: "Connect an MCP client",
        description:
          "Point an external assistant at the right workspace, and verify a read before trusting it.",
      },
      {
        slug: ["extend", "webhooks"],
        title: "Inbound webhooks",
        description:
          "A tenant-scoped public route that checks the signature before anything touches real data.",
      },
    ],
  },
  {
    id: "self-hosting",
    track: "builder",
    title: "Self-hosting",
    description:
      "Run the Command Center yourself: what you need, how to start, and when to bring us in.",
    pages: [
      {
        slug: ["self-hosting", "overview"],
        title: "Self-hosting quickstart",
        description:
          "Explore the real interface with zero credentials, then connect a workspace you actually control.",
      },
      {
        slug: ["self-hosting", "installation"],
        title: "Connect your installation",
        description:
          "Create the owner account, apply the ordered schema, and sign in to a workspace you control.",
      },
    ],
  },
];

/** Every page in manifest order. Drives static params, pager, and sidebar. */
export function flattenDocsPages(): DocsPageEntry[] {
  return docsManifest.flatMap((section) => section.pages);
}

/** The track a slug's owning section belongs to, or null for an unknown slug. */
export function docsTrackForSlug(slug: string[]): DocsTrackId | null {
  const sectionId = slug[0];
  const section = docsManifest.find((entry) => entry.id === sectionId);
  return section?.track ?? null;
}
