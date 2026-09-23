/* Content for the Command Center solution page (/command-center).

   Self-contained types, following the same convention as industry-feeds.ts.
   Category colors reuse the CHANNEL rgb language from industry-feeds.ts so the
   catalog reads as the same system as the ops console.

   Voice: plain, complete sentences aimed at a business owner, not a release
   note. Every capability carries a `promise` (one always-visible line of what
   it does for the business) and a `detail` (the fuller explanation an operator
   needs). The docs reference reads the same two fields, so the public page and
   the docs cannot drift. */

import type {
  CategoryMeta,
  Capability,
  SurfaceGroup,
  CurrentSurface,
} from "./command-center-contract";
export type {
  CapabilityCategory,
  CategoryMeta,
  Capability,
  SurfaceGroupId,
  SurfaceGroup,
  CurrentSurface,
} from "./command-center-contract";

export const CATEGORY_META: CategoryMeta[] = [
  {
    id: "capture",
    label: "Capture",
    blurb: "It captures what happens.",
    glyph: "◆",
    rgb: "96,165,250",
  },
  {
    id: "organize",
    label: "Organize",
    blurb: "It keeps records connected.",
    glyph: "▤",
    rgb: "167,139,250",
  },
  {
    id: "act",
    label: "Act",
    blurb: "It prepares work and, once you approve, does it.",
    glyph: "✦",
    rgb: "163,230,53",
  },
  {
    id: "learn",
    label: "Learn",
    blurb: "It turns your decisions into rules.",
    glyph: "↻",
    rgb: "34,211,238",
  },
  {
    id: "connect",
    label: "Connect",
    blurb: "You reach it from any device or assistant.",
    glyph: "⌘",
    rgb: "251,191,36",
  },
  {
    id: "govern",
    label: "Govern",
    blurb: "You keep control, and every action is logged.",
    glyph: "✓",
    rgb: "52,211,153",
  },
];

export const capabilities: Capability[] = [
  // ── Capture: what comes in gets recorded ──────────────────────────────
  {
    id: "transcripts",
    category: "capture",
    title: "Meeting transcript context",
    promise:
      "Bring supported transcript content from a configured Drive source into the workspace.",
    detail:
      "Connected Drive indexing retains extracted text from supported files. Review extracted information against the source; processing depends on the configured sync, supported file type and available AI workflow.",
  },
  {
    id: "paste",
    category: "capture",
    title: "Pasted contact lists and context",
    promise:
      "Turn a pasted contact list into a review batch, or supply context for a specific AI request.",
    detail:
      "Contact import lets you inspect proposed records before confirming them. Other requests use the assistant’s available tools and may need a separately reviewed proposal.",
  },
  {
    id: "email",
    category: "capture",
    title: "Connected email history",
    promise: "Read supported email threads alongside the customer and work they belong to.",
    detail:
      "Connect and verify the mailbox, then inspect sync results and identity matches. Unfamiliar senders can be reviewed before their conversations are linked to a contact.",
  },
  {
    id: "calendar",
    category: "capture",
    title: "Calendar context",
    promise: "Keep available meeting records and attendees connected to the workspace.",
    detail:
      "A configured calendar connection provides meeting context. Meeting preparation identifies upcoming appointments; Meeting commitments turns an explicitly entered checklist into assigned tasks.",
  },
  {
    id: "backfill",
    category: "capture",
    title: "Bring in available history",
    promise:
      "Use configured sync and backfill to make earlier email and calendar records available.",
    detail:
      "Review the provider permissions, job limits and sync results to understand the history imported. A connected account does not guarantee that its entire archive has been read.",
  },
  {
    id: "voice",
    category: "capture",
    title: "Contact import",
    promise:
      "Bring in a CSV or a pasted list, check it against the people you already know, and review the proposed records before anything saves.",
    detail:
      "An import is a review step rather than a blind write. The system flags rows that look like someone you already have, which is how an unfamiliar sender ends up attached to the right person instead of becoming a duplicate.",
  },

  // ── Organize: records stay connected ──────────────────────────────────
  {
    id: "people",
    category: "organize",
    title: "Customer records",
    promise: "Find the available conversations, notes and commitments linked to a person.",
    detail:
      "Open a contact and follow its linked records to understand the relationship. Missing sources or unresolved identities remain visible work for the team to check.",
  },
  {
    id: "companies",
    category: "organize",
    title: "Companies",
    promise: "Who works where, which deals belong to whom, and how the accounts connect.",
    detail:
      "Company records tie people, deals, and history together, so an account is one place to look instead of a set of names you have to join up yourself.",
  },
  {
    id: "pipeline",
    category: "organize",
    title: "Opportunities and pipeline",
    promise: "See current stages, values and next actions in board, list or calendar form.",
    detail:
      "Open the opportunity to inspect its customer, activity and next step. Calendar shows dated next actions on the viewer's local day and keeps unscheduled opportunities visible. Use the evidence you have before changing the record, then confirm the saved result.",
  },
  {
    id: "projects",
    category: "organize",
    title: "Tasks and commitments",
    promise: "Give work a title, date and source context so the team can follow it through.",
    detail:
      "Use Tasks & approvals to view the same tasks as a list, status board or date calendar. Filter ownership, status and source; scan due dates and related records; then edit or complete work through its existing task service. Onboarding and meeting workflows can create assigned checklists linked to their source records.",
  },
  {
    id: "notes",
    category: "organize",
    title: "Customer notes",
    promise: "Keep useful customer details attached to a shared record.",
    detail:
      "Save notes where the team can find them alongside the relationship history. Inspect the original source when a note affects a decision or commitment.",
  },
  {
    id: "custom-fields",
    category: "organize",
    title: "Business-specific records",
    promise: "Adapt the platform to track the information your process needs.",
    detail:
      "Use supported settings where available. New fields, record types or lifecycles may require a source extension that reuses the existing identity and permission services.",
  },
  {
    id: "graph",
    category: "organize",
    title: "A connected relationship graph",
    promise:
      "People, companies, deals, and documents link through the same records, so the connections between them are visible.",
    detail:
      "Suggested relationships from Opportunity Radar arrive with their sources and wait for your review. An introduction offer is an offer, and it does not mean the other person has agreed to be contacted.",
  },
  {
    id: "timeline",
    category: "organize",
    title: "Customer activity history",
    promise: "Follow available messages, notes and recorded work in the context of a customer.",
    detail:
      "Open the linked source to inspect a timeline entry. The activity record helps distinguish human decisions, proposed work and executed results.",
  },
  {
    id: "dupes",
    category: "organize",
    title: "Review contact matches",
    promise: "Check suggested identities before linking an unfamiliar sender to a customer.",
    detail:
      "Contact review lets you match a sender, create a contact when appropriate or leave the item for later. Imports also surface possible matches for review.",
  },
  {
    id: "opportunity-radar",
    category: "organize",
    title: "Opportunity Radar",
    promise:
      "Keep supplied sources, reviewed opportunities, relationship context, and saved drafts in one workspace, and approve anything before it sends.",
    detail:
      "Source briefing runs on a budget you set and stays off until you turn it on. Reviewed outreach uses the sender you configured only after an exact human approval, with contact checks and cooldowns. Automatic discovery and outcome measurement are still being built.",
    gated: true,
  },

  // ── Act: work gets prepared and done ──────────────────────────────────
  {
    id: "site-studio",
    category: "act",
    title: "Website pages",
    promise:
      "Draft and edit pages with AI help, preview them at phone and desktop widths, and publish only a revision you have reviewed.",
    detail:
      "New forks start with an editable, neutral product homepage and a fictional demo that needs no credentials. Guided setup connects your own workspace; save a contact and task before adding optional providers. Create your own pages, connect published forms to reviewed intake, and choose an AI model by provider and price or edit manually. Drafts stay private until published, with revision history and optional owner-only ChatGPT access through the same editor services.",
  },
  {
    id: "social-marketing",
    category: "act",
    title: "Social marketing",
    promise:
      "Prepare LinkedIn posts from your own sources, approve the exact wording and schedule, and follow the result through to a verified publication.",
    detail:
      "Each workspace connects its own organization account. An uncertain submission keeps its receipt for review instead of being reported as published.",
    gated: true,
  },
  {
    id: "collections",
    category: "act",
    title: "Collections",
    promise:
      "Group verified invoices by account and currency, record promises and disputes, and approve an exact reminder when you are ready to send.",
    detail:
      "Fresh payment and contact checks stop a stale reminder going out. The receipt tells you whether the send was confirmed or still needs reconciliation, so you never retry blind.",
    gated: true,
  },
  {
    id: "subscriptions",
    category: "act",
    title: "Subscriptions",
    promise:
      "Sell monthly or annual plans through Stripe Checkout and give each customer a branded account for renewals, invoices, and card changes.",
    detail:
      "Stripe stays the payment authority, and the workspace shows a checkout or webhook delay as pending rather than guessing an outcome.",
  },
  {
    id: "draft-email",
    category: "act",
    title: "Context-aware reply drafts",
    promise: "Ask AI to prepare a reply using the available conversation and business records.",
    detail:
      "Review the wording, recipient and commitments before approving a send. Source context helps the draft, while your review establishes whether it is appropriate.",
    gated: true,
  },
  {
    id: "followups",
    category: "act",
    title: "Follow-up commitments",
    promise: "Turn an agreed next step into visible work with a date and an owner.",
    detail:
      "Enter the commitment directly or use a supported task proposal. Meeting commitments takes an explicit checklist; automatic transcript extraction is a separate workflow.",
    gated: true,
  },
  {
    id: "decompose",
    category: "act",
    title: "Assigned task checklists",
    promise: "Break an onboarding or meeting follow-up into tasks the team can complete.",
    detail:
      "The bundled workflow plugins prepare one to ten tasks with descriptions, dates and assignees. Review the plan and confirm the created tasks after execution.",
    gated: true,
  },
  {
    id: "stage-moves",
    category: "act",
    title: "Reviewed pipeline changes",
    promise: "Ask AI to propose a stage change for a specific opportunity.",
    detail:
      "Inspect the record, proposed stage and supporting context in the approval flow. Confirm the saved stage and activity after the action runs.",
    gated: true,
  },
  {
    id: "sequences",
    category: "act",
    title: "Campaign follow-up",
    promise:
      "Prepare multi-step outreach with recipient checks, stop rules and reviewed activation.",
    detail:
      "Inspect the audience, sender, content, timing and limits before activation. Reply and suppression handling stop eligible future work through the shared campaign services.",
    gated: true,
  },
  {
    id: "bulk",
    category: "act",
    title: "Bulk contact changes",
    promise:
      "Tag up to two hundred contacts, stage them into a draft campaign, or suppress campaign email, with a result for each one.",
    detail:
      "Successful rows stay saved if another row fails, so a partial run is visible and the unfinished part can be retried.",
  },
  {
    id: "automations",
    category: "act",
    title: "Configured recurring work",
    promise: "Use supported jobs and workflow triggers to keep repeated work visible.",
    detail:
      "Configure the required capabilities and schedules, then inspect job and action results. A new business rule may require a source extension rather than a setting.",
  },
  {
    id: "queue",
    category: "act",
    title: "Shared approvals",
    promise: "Review AI proposals and workflow plans in one place, with their source context.",
    detail:
      "Approval records the decision; execution records the result. Eligible autonomy changes need a separate human decision, and restricted external actions keep their approval requirements.",
    gated: true,
  },

  // ── Learn: decisions become rules ─────────────────────────────────────
  {
    id: "edits",
    category: "learn",
    title: "Reusable corrections",
    promise: "Propose guidance your team wants future work to follow.",
    detail:
      "Learning Inbox keeps the proposed rule, scope and source available for review. Approved independent rules stay active together, and edited replies can propose reusable corrections. Cited references and later context receipts make their use inspectable.",
  },
  {
    id: "rejections",
    category: "learn",
    title: "Recorded decisions",
    promise: "Keep the reason for declining a proposal available with the work.",
    detail:
      "A recorded rejection helps the team understand the decision. Propose reusable guidance through Learning Inbox when the correction should apply beyond that one action.",
  },
  {
    id: "outcomes",
    category: "learn",
    title: "Results you can inspect",
    promise:
      "Compare recorded replies, stage changes and provider results with the work you requested.",
    detail:
      "Activity and action receipts retain evidence of execution. Use those records to assess the result; a completed action alone does not establish a business outcome.",
  },
  {
    id: "trust",
    category: "learn",
    title: "Autonomy you raise on purpose",
    promise:
      "Every kind of action carries its own trust level, and standing permission takes a human decision to grant.",
    detail:
      "Changing a level, a constraint, or the source clears the previous approval, so a shift in policy always comes back to a person. Revoking a permission keeps its audit history.",
  },
  {
    id: "brief",
    category: "learn",
    title: "A view of today’s work",
    promise: "Start with decisions, follow-up and business changes drawn from available records.",
    detail:
      "Today provides source-linked attention and supporting context. Open a finding to inspect its record before acting.",
  },
  {
    id: "precall",
    category: "learn",
    title: "Prepare for upcoming meetings",
    promise: "Find upcoming meetings and use their linked context to plan your preparation.",
    detail:
      "The Meeting preparation plugin provides a time-ordered report. A configured Meeting Intelligence Coworker can support richer briefs; its sources and execution must be set up separately.",
  },
  {
    id: "at-risk",
    category: "learn",
    title: "Find overdue follow-up",
    promise: "Use stale opportunity and overdue-task reports to decide what needs another look.",
    detail:
      "Pipeline follow-up and Overdue commitments apply defined rules to available records. Inspect the source and report coverage before drawing conclusions about the customer.",
  },
  {
    id: "questions",
    category: "learn",
    title: "Keep open questions with the work",
    promise: "Record an unanswered question as a note or next action linked to the customer.",
    detail:
      "The team can return to that context before the next conversation. Use an assigned task when the question needs a specific owner and due date.",
  },

  // ── Connect: reachable from anywhere ──────────────────────────────────
  {
    id: "web",
    category: "connect",
    title: "The web workspace",
    promise:
      "Today leads with decisions and follow-up, business changes and pipeline facts support the queue, and the same tasks and approvals stay editable in Work.",
    detail:
      "Personal and shared arrangements are both available, wide desktop layouts keep independent columns, and narrower screens fall back to a readable single order.",
  },
  {
    id: "chat",
    category: "connect",
    title: "Chat with your own data",
    promise:
      "Ask what you agreed with a client in March and get the answer with the record it came from.",
    detail:
      "The assistant cites the record it read, and it tells you when a source was unavailable instead of guessing.",
  },
  {
    id: "mcp",
    category: "connect",
    title: "Your own assistant, connected",
    promise:
      "Claude, ChatGPT, Cursor, and Antigravity connect over MCP and reach the same tools the workspace uses.",
    detail:
      "Workspace connections return bounded reads and stage changes for review. The separate owner-only Site Studio connection can execute exact website proposals under revocable OAuth delegation, with client-managed confirmations and recorded results.",
  },
  {
    id: "sms",
    category: "connect",
    title: "A mobile-ready workspace",
    promise:
      "Today, inbox, pipeline, records, and setup all work from a phone browser, including the pipeline board.",
    detail:
      "The board scrolls freely, keeps its column controls at every screen size, and supports dragging, touch, and a stage control for moving a card without dragging. Deployments with a dedicated app address also support installation, connection status and local drafts that you can read and reuse after reconnecting.",
  },
  {
    id: "api",
    category: "connect",
    title: "Shared service interfaces",
    promise: "Build integrations against the platform’s supported operations.",
    detail:
      "Use the documented tool, adapter and service contracts. A custom integration needs implementation and permission checks for the particular records and actions it exposes.",
  },
  {
    id: "reports",
    category: "connect",
    title: "Decision-ready analytics",
    promise:
      "Source, owner, campaign, stage, communication, forecast, attribution, and data-quality signals sit together.",
    detail:
      "Metric definitions are documented, so a forecast is labelled as a forecast and does not read as a recorded fact.",
  },
  {
    id: "custom-apps",
    category: "connect",
    title: "Apps built around your process",
    promise:
      "Extend the platform with custom records, lifecycles, workflows, integrations, AI tools, and screens that reuse your existing customer context.",
    detail:
      "Configuration covers the supported settings today, and broader changes use source development. A general-purpose in-app App builder is planned.",
  },
  {
    id: "workspace-themes",
    category: "connect",
    title: "Make the workspace your own",
    promise:
      "Choose one of seven appearances or preview a custom palette, typography, and corner style, then save it for the workspace.",
    detail:
      "Text contrast is checked before a theme saves, density is adjustable independently, and a theme follows the same permissions and revision checks as other branding. Demo choices stay separate from the live workspace.",
  },

  // ── Govern: control and the record ────────────────────────────────────
  {
    id: "modules",
    category: "govern",
    title: "Choose optional capabilities",
    promise: "Enable the optional parts of the workspace your business needs.",
    detail:
      "Core capabilities remain available. Disabling an optional module removes its navigation and gates its routes and tools, while preserving existing records.",
  },
  {
    id: "agent-workflow",
    category: "govern",
    title: "Point a coding agent at the backlog",
    promise:
      "A plain-language request is enough for a coding agent to pick up a task, prepare an isolated workspace, and carry it through verification and commit.",
    detail:
      "The agent does not need a ticket key or a provider-specific command, and it never asks you to paste credentials. With recovery enabled, a replacement agent can resume an interrupted task from its saved state. Verification renews the active claim, and checkpoints include safe unfinished source while excluding credentials and generated output.",
  },
  {
    id: "audit",
    category: "govern",
    title: "Trace recorded actions",
    promise: "Inspect who initiated a change and the result recorded for it.",
    detail:
      "Activity and receipts link actions to source records. Sensitive content stays in authorized records rather than being copied into every audit entry.",
  },
  {
    id: "killswitch",
    category: "govern",
    title: "Disable optional automation",
    promise: "Turn off a supported module or capability when your team needs to stop its work.",
    detail:
      "Use the relevant configuration control and inspect any pending work. Historical records remain available according to the feature’s retention and access rules.",
  },
  {
    id: "own-db",
    category: "govern",
    title: "Shared infrastructure, isolated data",
    promise:
      "One maintained application and database serves everyone, while each business's records stay separated by tenant context, membership, and row-level policy.",
    detail:
      "You get the benefit of a single system that is patched and improved once, without sharing data between businesses.",
  },
  {
    id: "roles",
    category: "govern",
    title: "Workspace and record access",
    promise: "Keep business data behind active membership, roles and record permissions.",
    detail:
      "The runtime rechecks access for supported operations. Review your workspace’s configured permissions instead of assuming a job title automatically grants or hides particular screens.",
  },
  {
    id: "health",
    category: "govern",
    title: "Connection and execution health",
    promise: "Find missing setup, failed jobs and results that need recovery.",
    detail:
      "Setup Center and operational health views show supported checks with their evidence. Follow the named recovery step and verify the specific connection or job afterward.",
  },
  {
    id: "ownership",
    category: "govern",
    title: "An open-source foundation",
    promise:
      "Run and extend the MIT-licensed application with infrastructure and provider accounts you control.",
    detail:
      "Use the neutral starter and self-hosting guides for your own installation. Review the documented content exports, data ownership and support arrangements when planning a handoff.",
  },
];

/** The four beats of the approval loop. Rendered with the .steps primitive. */
export const LOOP_STEPS = [
  {
    n: "01",
    title: "Read the context",
    tag: "available records",
    body: "The assistant uses registered tools to inspect the customer, conversation and work available to your workspace.",
  },
  {
    n: "02",
    title: "Prepare a next step",
    tag: "specific proposal",
    body: "A supported request becomes a proposed change with the record, recipient or task details available for review.",
  },
  {
    n: "03",
    title: "Apply the action policy",
    tag: "explicit authority",
    body: "Review actions that require a decision. Eligible actions can use a standing permission within its approved limits.",
  },
  {
    n: "04",
    title: "Check the result",
    tag: "recorded outcome",
    body: "Inspect what completed, open the source record and resolve any failure before repeating the work.",
  },
];

/** The autonomy ladder. Rendered with the .appr three-column primitive. */
export const TRUST_LADDER = [
  {
    k: "REVIEW",
    title: "Begin with a specific decision",
    body: "Inspect the proposed work and its context. Your decision is recorded alongside the action result.",
  },
  {
    k: "CONFIGURE",
    title: "Grant a bounded permission",
    body: "Eligible actions may be proposed for a higher trust level. A person confirms the scope and constraints.",
  },
  {
    k: "VERIFY",
    title: "Keep results visible",
    body: "Standing permission retains action history. Safety floors continue to require human decisions for restricted operations.",
  },
];

/** Scrolling capability strip under the hero. */
export const MARQUEE_ITEMS = [
  "Drafts the follow-up",
  "Files the meeting",
  "Moves the deal",
  "Books the session",
  "Sells recurring plans",
  "Flags the cooling client",
  "Answers what you agreed",
  "Briefs you before the session",
  "Earns more autonomy",
];

export const WHO_ITS_FOR = [
  "You run client work, business development, and admin, and there is no operations hire coming.",
  "Your team is small and most of what the business knows is in one person's head.",
  "You already work with us on automation and want your own internal operation running the same way.",
];

/** The three chapters of the "What is running today" section. */
export const SURFACE_GROUPS: SurfaceGroup[] = [
  {
    id: "day",
    label: "Run the day",
    blurb: "The surface your team opens every morning.",
    rgb: "96,165,250",
  },
  {
    id: "revenue",
    label: "Run the revenue",
    blurb: "The parts of the business it can take over.",
    rgb: "163,230,53",
  },
  {
    id: "control",
    label: "Keep control",
    blurb: "You decide what runs, who sees it, and what is on the record.",
    rgb: "52,211,153",
  },
];

/** Shipped operator surfaces shown near the top of the solution page. */
export const CURRENT_SURFACES: CurrentSurface[] = [
  {
    n: "01",
    group: "day",
    title: "Start with what needs you",
    body: "Overdue work, replies, meetings, and proposals ready for a decision arrive in one ranked list, each with the reason it is there. Two clicks gets you into the record behind it.",
  },
  {
    n: "02",
    group: "day",
    title: "See every deal as it stands",
    body: "Move opportunities through stages that keep their history, save the views your team checks every week, and open the full contact, company, activity, and next-action context in one place.",
  },
  {
    n: "03",
    group: "day",
    title: "One history per customer",
    body: "Messages, meetings, proposals, tasks, and notes all resolve back to the same records, so whoever picks up the conversation starts current instead of starting from scratch.",
  },
  {
    n: "04",
    group: "day",
    title: "Numbers you can check",
    body: "Source, owner, campaign, stage, forecast, and data-quality signals sit together, and a forecast is labelled as a forecast rather than read as a recorded result.",
  },
  {
    n: "05",
    group: "revenue",
    title: "Find and prepare new business",
    body: "Keep supplied sources, reviewed opportunities, relationship context, and saved drafts in one workspace. Source briefing runs on a budget you set, and outreach waits for an exact human approval.",
  },
  {
    n: "06",
    group: "revenue",
    title: "Turn a won deal into delivery",
    body: "Review the onboarding template and the proposal behind it, create one client engagement, and track its shared tasks and handoff receipt. A retry keeps the commitments that already completed.",
  },
  {
    n: "07",
    group: "revenue",
    title: "Sell recurring plans",
    body: "Create monthly or annual plans in Stripe, send customers through hosted checkout, and give each one a branded account for renewals, invoices, payment details, and cancellation.",
  },
  {
    n: "08",
    group: "revenue",
    title: "Get paid without the awkwardness",
    body: "Verified invoice balances, promises, and disputes sit together, and an approved reminder leaves with a receipt so an uncertain delivery never triggers a blind retry.",
  },
  {
    n: "09",
    group: "control",
    title: "Nothing leaves without a decision",
    body: "Outbound actions route through one queue where you approve, edit, or reject the exact change. Every action is logged with who did it and whether it was a person or the AI.",
  },
  {
    n: "10",
    group: "control",
    title: "One system, isolated per business",
    body: "Turn a capability off and its navigation and AI tools go with it. Roles decide who sees the invoices and who sees the pipeline, and each business keeps its own records, configuration, and audit trail.",
  },
];
