/* Content for the Command Center solution page (/command-center).

   Self-contained types, following the same convention as industry-feeds.ts.
   Category colors reuse the CHANNEL rgb language from industry-feeds.ts so the
   catalog reads as the same system as the ops console. */

export type CapabilityCategory = "capture" | "organize" | "act" | "learn" | "connect" | "govern";

export interface CategoryMeta {
  id: CapabilityCategory;
  label: string;
  blurb: string;
  glyph: string;
  rgb: string;
}

export const CATEGORY_META: CategoryMeta[] = [
  {
    id: "capture",
    label: "Capture",
    blurb: "It sees what happens.",
    glyph: "◆",
    rgb: "96,165,250",
  },
  {
    id: "organize",
    label: "Organize",
    blurb: "It files it correctly.",
    glyph: "▤",
    rgb: "167,139,250",
  },
  { id: "act", label: "Act", blurb: "It gets the work done.", glyph: "✦", rgb: "163,230,53" },
  {
    id: "learn",
    label: "Learn",
    blurb: "It gets better at your business.",
    glyph: "↻",
    rgb: "34,211,238",
  },
  {
    id: "connect",
    label: "Connect",
    blurb: "You reach it from anywhere.",
    glyph: "⌘",
    rgb: "251,191,36",
  },
  {
    id: "govern",
    label: "Govern",
    blurb: "Autonomy you dial up, fully audited.",
    glyph: "✓",
    rgb: "52,211,153",
  },
];

export interface Capability {
  id: string;
  category: CapabilityCategory;
  title: string;
  detail: string;
  /** True when this action routes through the approval queue before anything leaves. */
  gated?: boolean;
}

export const capabilities: Capability[] = [
  {
    id: "site-studio",
    category: "act",
    title: "Prepare a private page draft",
    detail:
      "Create template or AI-assisted pages with Muse Spark 1.3 by default and a searchable, refreshable catalogue of free, low-cost and premium models. Filter by provider and price; price increases require review. Installation owners can edit pages and shared content, preview responsive widths, save private revisions and review publication or rollback. Import and export move portable content between installations. A separate neutral starter export keeps the shared runtime while replacing business-owned content and omitting protected media and original hosting targets. Existing source pages are preserved until explicitly replaced; automatic migration of their original layouts remains separate work.",
  },
  // Capture
  {
    id: "transcripts",
    category: "capture",
    title: "Meeting transcripts, read automatically",
    detail:
      "Point it at a folder. Every new transcript gets read, sorted, and turned into a proposed set of records within the hour. You never open the file.",
  },
  {
    id: "paste",
    category: "capture",
    title: "Anything you paste",
    detail:
      "A wall of text from your phone. Scribbled notes from a call you took in the car. A forwarded email chain. Same pipeline, same result.",
  },
  {
    id: "email",
    category: "capture",
    title: "Email, both directions",
    detail:
      "Sent and received, threaded to the right person and attached to the right deal. It knows which reply answers which pitch.",
  },
  {
    id: "calendar",
    category: "capture",
    title: "Your calendar",
    detail:
      "Meetings become records. Attendees get matched to their files. Who you met and what came of it, without you writing anything down.",
  },
  {
    id: "backfill",
    category: "capture",
    title: "Years of history, loaded before you start",
    detail:
      "It reads the archive first. You log in on day one to a system that already knows your last two years of email and meetings.",
  },
  {
    id: "voice",
    category: "capture",
    title: "AI-assisted contact import",
    detail:
      "Bring in a CSV or pasted list, check for existing contacts, then review the proposed records before saving. Contact review helps you match unfamiliar conversation senders to the right person.",
  },

  // Organize
  {
    id: "people",
    category: "organize",
    title: "People",
    detail:
      "Everyone you deal with, the full history, what you last said, and what you still owe them.",
  },
  {
    id: "companies",
    category: "organize",
    title: "Companies",
    detail:
      "Who works where, which deals belong to whom, and how the accounts connect to each other.",
  },
  {
    id: "pipeline",
    category: "organize",
    title: "Deals and pipeline",
    detail: "Stages, values, and what has actually moved. Not what you remember moving.",
  },
  {
    id: "projects",
    category: "organize",
    title: "Projects, tasks, subtasks",
    detail:
      "Work broken down to the level you can act on, each piece linked back to the person or deal it came from.",
  },
  {
    id: "notes",
    category: "organize",
    title: "Notes that stay findable",
    detail:
      "As many as you want per person, pinned when they matter, searchable by full text a year later.",
  },
  {
    id: "custom-fields",
    category: "organize",
    title: "Custom fields on anything",
    detail:
      "Track what your business actually tracks. Matter status, job type, case number, permit stage. Your words, not a generic default.",
  },
  {
    id: "graph",
    category: "organize",
    title: "A relationship graph",
    detail:
      "Connect people, companies, deals, and documents through canonical records. Radar adds cited, human-reviewed relationship assertions and current contact paths; an introduction offer does not establish consent to send.",
  },
  {
    id: "timeline",
    category: "organize",
    title: "One timeline per person",
    detail:
      "Email, meetings, calls, notes, and every AI action in a single ordered feed, each line labelled with who did it.",
  },
  {
    id: "dupes",
    category: "organize",
    title: "Duplicate detection that asks first",
    detail:
      "It spots two records that look like one person and proposes the merge. It will not merge them on its own, because sometimes they really are two people.",
  },

  {
    id: "opportunity-radar",
    category: "organize",
    title: "Opportunity Radar: evidence, reviewed priorities, and drafts",
    detail:
      "Keep supplied sources, reviewed opportunity estimates, CRM context, and saved drafts in one workspace. Review exact changes before saving and retain the evidence history. Optional source briefing has explicit model budgets; automatic discovery and publication remain unfinished. Configured outreach requires exact human approval, fresh contact checks and delivery receipts.",
    gated: true,
  },

  {
    id: "social-marketing",
    category: "act",
    title: "Social Marketing: reviewed LinkedIn publishing",
    detail:
      "Prepare source-backed drafts, approve exact content and schedules, and follow Postiz acceptance through to verified LinkedIn publication. Each workspace connects its own organization, with an optional bundled runtime, private draft media and operator-controlled service setup; uncertain submissions retain their receipts for review.",
    gated: true,
  },

  // Act
  {
    id: "collections",
    category: "act",
    title: "Collections with verified balances and reviewed reminders",
    detail:
      "Group verified invoices by account and currency, record promises or disputes, and approve an exact reminder when sending is configured. Fresh payment and contact checks stop stale sends; receipts distinguish confirmed dispatch from an uncertain result that needs reconciliation.",
    gated: true,
  },
  {
    id: "draft-email",
    category: "act",
    title: "Email drafted off your own sent mail",
    gated: true,
    detail:
      "It reads the thread and how you have written to that person before, then produces the reply you would have written at your desk.",
  },
  {
    id: "followups",
    category: "act",
    title: "Follow-ups scheduled from what was said",
    gated: true,
    detail:
      "You promised Thursday on the call. Thursday is now on the calendar, with the reason attached, before you have hung up.",
  },
  {
    id: "decompose",
    category: "act",
    title: "Big tasks broken into small ones",
    gated: true,
    detail:
      "It proposes the subtasks and the order. You keep the ones that are real and bin the rest.",
  },
  {
    id: "stage-moves",
    category: "act",
    title: "Pipeline moved on evidence",
    gated: true,
    detail:
      "A reply says yes, so it proposes the stage change and shows you the exact sentence it read. You are approving a fact, not a hunch.",
  },
  {
    id: "sequences",
    category: "act",
    title: "Multi-step outreach",
    gated: true,
    detail:
      "Sequences that stop the second somebody replies, and refuse to run over a contact who asked to be left alone.",
  },
  {
    id: "bulk",
    category: "act",
    title: "Bulk contact changes with clear results",
    detail:
      "Tag up to two hundred contacts, stage them into a draft campaign, or suppress campaign email. Review each result and retry unfinished changes.",
  },
  {
    id: "automations",
    category: "act",
    title: "Rules that fire on their own",
    detail: "When a deal hits a stage, the things that always happen next just happen.",
  },
  {
    id: "queue",
    category: "act",
    title: "Smart approvals",
    gated: true,
    detail:
      "Outbound actions route through one queue. Approve, edit, or reject, and every decision teaches it. Categories you trust graduate to running on their own.",
  },

  // Learn
  {
    id: "edits",
    category: "learn",
    title: "Your edits are the training",
    detail:
      "Every word you change is recorded against the draft it came from. The next one starts closer to what you would have written.",
  },
  {
    id: "rejections",
    category: "learn",
    title: "Rejections count too",
    detail:
      "Tell it why you killed the draft and it stops making that particular mistake with that kind of person.",
  },
  {
    id: "outcomes",
    category: "learn",
    title: "It tracks whether the work worked",
    detail:
      "Did they reply. Did the deal move. Did it bounce. It grades its own output against what happened next, not against how busy it was.",
  },
  {
    id: "trust",
    category: "learn",
    title: "Autonomy you raise on purpose",
    detail:
      "Every kind of action carries its own trust level. Standing permission requires a human decision, and changing the policy clears that approval. Revoke or restore the intended workspace or coworker permission while retaining its audit history.",
  },
  {
    id: "brief",
    category: "learn",
    title: "A brief every morning",
    detail: "What happened, what is owed, and what it intends to do about it today.",
  },
  {
    id: "precall",
    category: "learn",
    title: "A briefing before every call",
    detail:
      "Fifteen minutes out, your phone buzzes with the history, the open questions, and what you promised them last time.",
  },
  {
    id: "at-risk",
    category: "learn",
    title: "It tells you who is going cold",
    detail:
      "Relationships that are slipping, ranked by what they are worth, while there is still time to save them.",
  },
  {
    id: "questions",
    category: "learn",
    title: "Open questions, held until useful",
    detail:
      "The thing you meant to ask in March, surfaced the next time you are actually in a room with them.",
  },

  // Connect
  {
    id: "web",
    category: "connect",
    title: "The web app",
    detail:
      "Open decisions, follow-up and pipeline work from a compact Today snapshot. Arrange decisions, commitments, coworker progress and enabled App follow-up in personal or shared views. Independent desktop columns avoid empty gaps beside uneven lists; narrow screens retain saved order. Inspect the context and prepare the next action. Work keeps the same tasks and approvals available for editing.",
  },
  {
    id: "chat",
    category: "connect",
    title: "Chat with your own data",
    detail:
      "Ask what you agreed with a client in March. Get the answer with the source it came from, not a plausible guess.",
  },
  {
    id: "modules",
    category: "govern",
    title: "Turn capabilities on and off per workspace",
    detail:
      "Proposals, campaigns, bookings, recovery, and the rest are modules a workspace enables or disables. Turning one off removes its navigation, closes its routes, and marks its AI tools unavailable to the assistant and to any connected external one.",
  },
  {
    id: "mcp",
    category: "connect",
    title: "Your own assistant, connected over MCP",
    detail:
      "Claude Desktop, Claude Code, ChatGPT, Cursor, and Antigravity connect over the Model Context Protocol and reach the same registered tools the workspace uses. Daily, Minimal and full tool lists keep discovery available without changing permissions. Reads return bounded queries with their sources; anything that would change a record or send a message becomes a staged proposal in the same approval queue.",
  },
  {
    id: "agent-workflow",
    category: "govern",
    title: "Point any coding agent at the backlog",
    detail:
      "Tell any coding agent that can read and run the repository to pick up backlog work and follow protocol. The repository entrypoint resolves the configured private transport, continues current work or selects an eligible card, preserves attempt ownership, creates the approved isolated worktree, supplies the live packet, and carries the work through verification, commit, and evidence submission without requiring a ticket key or internal command name. With the recovery migration and project policy enabled, replacement agents resume expired work from saved checkpoints.",
  },
  {
    id: "sms",
    category: "connect",
    title: "A mobile-ready workspace",
    detail:
      "Use Today, inbox, pipeline, records and setup from a responsive browser. Kanban offers freely scrollable columns, column buttons at every screen size, touch and keyboard dragging, and a stage control for moving a card.",
  },
  {
    id: "api",
    category: "connect",
    title: "An API",
    detail: "Anything else you run can read from it and write back to it.",
  },
  {
    id: "reports",
    category: "connect",
    title: "Decision-ready analytics",
    detail:
      "See source, owner, campaign, stage, communication, forecast, attribution, and data-quality signals together, with the metric semantics documented.",
  },

  {
    id: "custom-apps",
    category: "connect",
    title: "Build Apps around your own business process",
    detail:
      "Extend the open-source platform with custom records, lifecycles, workflows, integrations, AI tools and working screens. Reuse shared customer context and execution services. Current customization uses workspace settings and source development; a general-purpose in-app AI App builder is planned.",
  },

  {
    id: "workspace-themes",
    category: "connect",
    title: "Make the workspace your own",
    detail:
      "Choose among seven distinct appearances, from matte Material surfaces to silver macOS controls, or preview a custom palette, typography and corner style in Branding. Import and export portable themes, or ask the connected assistant to prepare a theme for approval. Saved themes use the same workspace permissions and revision checks as branding. Demo appearance choices stay separate from the live workspace. Choose comfortable or compact spacing independently of your theme; shared controls and responsive layouts keep the workspace consistent, with readable navigation, theme-aware transitions and comfortable touch targets.",
  },
  // Govern
  {
    id: "audit",
    category: "govern",
    title: "Every action logged",
    detail:
      "Who did it, when, and whether it was a person or the AI. Nothing in the system happens invisibly.",
  },
  {
    id: "killswitch",
    category: "govern",
    title: "A switch on every AI feature",
    detail: "Turn any single part of it off in one click. Everything else keeps running.",
  },
  {
    id: "own-db",
    category: "govern",
    title: "Shared infrastructure, isolated tenant data",
    detail:
      "One maintained application and database serves the system, while tenant context, membership checks, composite ownership, and row-level policies keep each business's records isolated.",
  },
  {
    id: "roles",
    category: "govern",
    title: "Role-based access",
    detail: "The bookkeeper sees the invoices. The bookkeeper does not see the pipeline.",
  },
  {
    id: "health",
    category: "govern",
    title: "It audits its own data",
    detail:
      "Nightly checks for duplicates, broken links, stale records, and numbers that stopped making sense.",
  },
  {
    id: "ownership",
    category: "govern",
    title: "You own all of it",
    detail: "The accounts, the data, the export. Leaving is a download, not a negotiation.",
  },
];

/** The four beats of the approval loop. Rendered with the .steps primitive. */
export const LOOP_STEPS = [
  {
    n: "01",
    title: "It watches",
    tag: "no input from you",
    body: "Transcripts, email, and calendar arrive on their own. It pulls out who was there, what was decided, and what somebody promised.",
  },
  {
    n: "02",
    title: "It drafts the work",
    tag: "nothing sent yet",
    body: "The follow-up email, the task list, the stage change, the calendar hold. Written, attached to the right records, and staged.",
  },
  {
    n: "03",
    title: "You approve",
    tag: "your call, every time",
    body: "One queue. Approve, edit, or throw it out. A morning of admin clears in about the time it takes to drink a coffee.",
  },
  {
    n: "04",
    title: "It learns from what you did",
    tag: "compounding",
    body: "Your edits move the next draft closer. Work it gets right often enough is work you can eventually stop reading.",
  },
];

/** The autonomy ladder. Rendered with the .appr three-column primitive. */
export const TRUST_LADDER = [
  {
    k: "WEEK ONE",
    title: "It drafts. You approve all of it.",
    body: "Everything waits for you. You are reading a lot of drafts and fixing the tone on most of them. That is the part that teaches it how you work.",
  },
  {
    k: "MONTH TWO",
    title: "The routine stops asking.",
    body: "Notes file themselves. Standard follow-ups go out on their own. Anything touching money or a new relationship still comes to you first.",
  },
  {
    k: "MONTH SIX",
    title: "You only see the exceptions.",
    body: "Most of the day runs without you. What reaches your queue is the work that genuinely needed a human, which is the only work you wanted to spend attention on.",
  },
];

/** Scrolling capability strip under the hero. */
export const MARQUEE_ITEMS = [
  "Drafts the follow-up",
  "Files the meeting",
  "Moves the deal",
  "Books the session",
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

/** Shipped operator surfaces shown near the top of the solution page. */
export const CURRENT_SURFACES = [
  {
    n: "01",
    label: "Review opportunities",
    title: "Opportunity Radar, from evidence to a saved draft",
    body: "Bring supplied sources, reviewed estimates, relationship context, and drafts into one daily workspace. Changes require an exact review, model spending starts off, and configured outreach requires an exact human approval with current evidence and contact checks.",
  },
  {
    title: "From a won opportunity to a reviewed delivery plan",
    body: "Review the onboarding template and originating proposal, create one client engagement, and track its shared tasks and handoff receipt. Open client rows to edit notes, follow exact record links and add a follow-up that opens in Tasks & approvals. Retries preserve completed commitments and the original source context.",
  },
  {
    n: "02",
    label: "Follow up on receivables",
    title: "Collections with payment context and delivery receipts",
    body: "Review verified invoice balances, payment promises, and disputes. Configured reminders use human approval, fresh eligibility checks, and durable receipts so uncertain delivery cannot trigger a blind retry.",
  },
  {
    n: "03",
    label: "Prioritize",
    title: "Today and the approval queue",
    body: "Overdue work, replies, meetings, proposals, campaign exceptions, and AI actions arrive in one ranked queue with a clear reason for every item.",
  },
  {
    n: "04",
    label: "Work revenue",
    title: "Pipeline, saved views, and record workspaces",
    body: "Move canonical opportunities through validated stages, save the views you use every week, and open the full contact, company, activity, and next-action context in one place.",
  },
  {
    n: "05",
    label: "Keep context",
    title: "Contacts, companies, conversations, and notes",
    body: "The operating history stays connected: identity, messages, meetings, proposals, tasks, and human or AI activity all resolve back to the same records.",
  },
  {
    n: "06",
    label: "Measure",
    title: "Analytics that separate facts from forecasts",
    body: "Source-to-revenue performance, reply coverage, forecast method, attribution gaps, stale data, and missing or incomplete stage history are visible without turning estimates into facts.",
  },
  {
    n: "07",
    label: "Automate safely",
    title: "Campaigns, proposals, and recovery",
    body: "Bulk contact changes report individual outcomes, and enrollment stays draft-only. Campaign copies start as unsent drafts and retain the same copy when an interrupted request is retried. Sends, campaign stops, proposal versions, task generation, and failed work use confirmation, idempotency, receipts, and recovery paths.",
  },
  {
    n: "08",
    label: "Run per tenant",
    title: "Shared infrastructure, isolated workspaces",
    body: "Each business gets its own tenant context, membership boundary, configuration, audit trail, and provider controls, including the option to use its own OpenRouter key and model budget. Twelve bundled plugin examples have public guides covering setup, approvals, costs, and recovery.",
  },
];
