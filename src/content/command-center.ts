/* Content for the Command Center solution page (/command-center).

   Self-contained types, following the same convention as industry-feeds.ts.
   Category colors reuse the CHANNEL rgb language from industry-feeds.ts so the
   catalog reads as the same system as the ops console.

   Voice: plain, complete sentences aimed at a business owner, not a release
   note. Every capability carries a `promise` (one always-visible line of what
   it does for the business) and a `detail` (the fuller explanation an operator
   needs). The docs reference reads the same two fields, so the public page and
   the docs cannot drift. */

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

export interface Capability {
  id: string;
  category: CapabilityCategory;
  title: string;
  /** One always-visible line: what this does for the business. */
  promise: string;
  /** Expanded explanation for someone deciding whether it fits. */
  detail: string;
  /** True when this action routes through the approval queue before anything leaves. */
  gated?: boolean;
}

export const capabilities: Capability[] = [
  // ── Capture: what comes in gets recorded ──────────────────────────────
  {
    id: "transcripts",
    category: "capture",
    title: "Meeting transcripts",
    promise:
      "Point it at a folder and every new transcript is read, filed, and turned into proposed records within the hour.",
    detail:
      "You connect the folder once. After that nobody opens a transcript by hand: the system reads it, works out who was in the room and what was decided, and stages the records for your review.",
  },
  {
    id: "paste",
    category: "capture",
    title: "Anything you paste in",
    promise:
      "A wall of text from your phone, notes from a call in the car, or a forwarded email chain goes through the same pipeline as the rest.",
    detail:
      "Paste the text into the workspace and it proposes the contacts, deals, and follow-ups inside it. Messy input is normal, and the review step is where you correct it before anything saves.",
  },
  {
    id: "email",
    category: "capture",
    title: "Email in both directions",
    promise:
      "Sent and received mail is attached to the right person and the right deal, so you can see which reply answers which pitch.",
    detail:
      "Connect a mailbox and the history threads itself. Replies land against the conversation they belong to instead of sitting in a shared inbox nobody owns.",
  },
  {
    id: "calendar",
    category: "capture",
    title: "Calendar",
    promise: "Meetings become records, and the people you met are matched to their files.",
    detail:
      "You get the who and the what without writing anything down. The meeting, the attendees, and what came out of it sit on the same record as everything else.",
  },
  {
    id: "backfill",
    category: "capture",
    title: "Your history, loaded first",
    promise:
      "It reads the archive before you start, so day one opens on a system that already knows your last two years of email and meetings.",
    detail:
      "You do not begin with an empty database. The past is indexed and attached to the people and companies it belongs to, which is what lets the workspace answer a question about a customer on the first morning.",
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
    title: "People",
    promise:
      "Everyone you deal with, with the full history, what you last said, and what you still owe them.",
    detail:
      "One page per person replaces the search across inbox, phone, and memory. Open a name and the whole relationship is there in order.",
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
    title: "Deals and pipeline",
    promise:
      "Stages, values, and what has actually moved, with a recorded reason behind each change.",
    detail:
      "The board shows the deal as it stands rather than as you remember it, and every stage change keeps the evidence that caused it.",
  },
  {
    id: "projects",
    category: "organize",
    title: "Projects, tasks, and subtasks",
    promise:
      "Work broken down to the level you can act on, with each piece linked to the person or deal it came from.",
    detail:
      "A task never floats free. It keeps the customer, conversation, or proposal that produced it attached, so whoever picks it up has the context.",
  },
  {
    id: "notes",
    category: "organize",
    title: "Notes that stay findable",
    promise:
      "As many notes as you need on a person, pinned when they matter and searchable in full a year later.",
    detail:
      "Notes are attached to the record rather than to someone's notebook, so the detail survives the person who wrote it leaving the account.",
  },
  {
    id: "custom-fields",
    category: "organize",
    title: "Custom fields on anything",
    promise:
      "Track what your business actually tracks, like matter status, job type, case number, or permit stage.",
    detail:
      "The workspace stores your vocabulary instead of forcing a generic set of defaults, which is what makes a record worth reading.",
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
    title: "One timeline per person",
    promise:
      "Email, meetings, calls, notes, and every AI action in one ordered feed, each line labelled with who did it.",
    detail:
      "You read one history rather than stitching together four. Human and AI entries sit side by side, and you can see which is which.",
  },
  {
    id: "dupes",
    category: "organize",
    title: "Duplicate detection that asks first",
    promise:
      "When two records look like one person, it proposes the merge and shows you the evidence instead of merging on its own.",
    detail:
      "Sometimes two records really are two people. A merge you did not ask for quietly destroys history, so the decision stays with you and only the clear matches clear themselves.",
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
      "DeepSeek V4.1 Flash is the default model, and you can choose another by provider and price. Drafts stay private until an installation owner publishes them, and history supports rollback.",
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
    title: "Email drafted from your own sent mail",
    promise:
      "It reads the thread and how you have written to that person before, then produces the reply you would have written at your desk.",
    detail:
      "You review the draft and the recipient before anything goes out. The first few you approve are what teach it your voice.",
    gated: true,
  },
  {
    id: "followups",
    category: "act",
    title: "Follow-ups scheduled from what was said",
    promise:
      "You promised Thursday on the call, and Thursday is on the calendar with the reason attached before you have hung up.",
    detail:
      "The commitment is captured as work rather than left in your head, and it routes through an approval like any other outbound step.",
    gated: true,
  },
  {
    id: "decompose",
    category: "act",
    title: "Big tasks broken into small ones",
    promise: "It proposes the subtasks and the order, and you keep the ones that are real.",
    detail:
      "A large piece of work becomes a list you can start on. Nothing is created until you accept the breakdown.",
    gated: true,
  },
  {
    id: "stage-moves",
    category: "act",
    title: "Pipeline moved on evidence",
    promise:
      "When a reply says yes, it proposes the stage change and shows you the exact sentence it read.",
    detail:
      "You are approving a fact you can check rather than a hunch, and the sentence stays attached to the change.",
    gated: true,
  },
  {
    id: "sequences",
    category: "act",
    title: "Multi-step outreach",
    promise:
      "A sequence stops the second somebody replies and refuses to run over anyone who asked to be left alone.",
    detail:
      "Each step is an approval while the action type is still earning trust, so you see the follow-up before the customer does.",
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
    title: "Rules that fire on their own",
    promise:
      "When a deal reaches a stage, the steps that always happen next run without you remembering them.",
    detail:
      "Rules are configured once and shown in the workspace, so the work they do is visible rather than hidden inside someone's habits.",
  },
  {
    id: "queue",
    category: "act",
    title: "One approval queue",
    promise:
      "Every outbound action routes through one place where you approve, edit, or reject it, and each decision teaches the system.",
    detail:
      "Categories you trust often enough graduate to running without asking, one rung at a time and with a person confirming every promotion.",
    gated: true,
  },

  // ── Learn: decisions become rules ─────────────────────────────────────
  {
    id: "edits",
    category: "learn",
    title: "Your edits are the training",
    promise:
      "Every word you change is recorded against the draft it came from, so the next draft starts closer to what you would have written.",
    detail:
      "The correction is attached to the exact decision, which is what makes the improvement specific rather than general.",
  },
  {
    id: "rejections",
    category: "learn",
    title: "Rejections count too",
    promise:
      "Tell it why you turned a draft down and it stops making that particular mistake with that kind of person.",
    detail:
      "A reason on the rejection is what turns a no into a rule. Without one, the same draft comes back next week.",
  },
  {
    id: "outcomes",
    category: "learn",
    title: "It tracks whether the work worked",
    promise:
      "Did they reply, did the deal move, did the email bounce: the system grades its own output against what happened next.",
    detail:
      "It grades itself on the result rather than on how busy it looked, so the measure is what the work produced.",
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
    title: "A brief every morning",
    promise:
      "What happened, what is owed, and what the system intends to do about it today, waiting when you open the workspace.",
    detail: "You start from a summary of the operation instead of a blank screen or a search.",
  },
  {
    id: "precall",
    category: "learn",
    title: "A briefing before every call",
    promise:
      "Fifteen minutes out, the history, the open questions, and what you promised them last time arrive before you dial.",
    detail:
      "The brief is built from the same records the rest of the workspace uses, so it matches what your team already knows.",
  },
  {
    id: "at-risk",
    category: "learn",
    title: "It tells you who is going cold",
    promise:
      "Relationships that are slipping surface while there is still time to save them, ranked by what they are worth.",
    detail:
      "A quiet account looks healthy until it is gone. This puts the cooling ones in front of you early.",
  },
  {
    id: "questions",
    category: "learn",
    title: "Open questions, held until useful",
    promise:
      "The thing you meant to ask in March comes back the next time you are actually in a room with them.",
    detail:
      "Unanswered questions stay attached to the person and resurface at the moment they are worth raising.",
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
      "Reads return bounded results with their sources. Anything that would change a record or send a message becomes a staged proposal in the same approval queue, so an outside assistant cannot act on its own.",
  },
  {
    id: "sms",
    category: "connect",
    title: "A mobile-ready workspace",
    promise:
      "Today, inbox, pipeline, records, and setup all work from a phone browser, including the pipeline board.",
    detail:
      "The board scrolls freely, keeps its column controls at every screen size, and supports dragging, touch, and a stage control for moving a card without dragging.",
  },
  {
    id: "api",
    category: "connect",
    title: "An API",
    promise: "Anything else you run can read from the workspace and write back to it.",
    detail: "The API uses the same permissions and approval rules as the interface.",
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
    title: "Turn capabilities on and off",
    promise:
      "Each part of the workspace, from proposals to campaigns, can be switched off, which removes its navigation and its AI tools at the same time.",
    detail:
      "A workspace enables what it needs and hides the rest, so the surface matches the business rather than a fixed feature list.",
  },
  {
    id: "agent-workflow",
    category: "govern",
    title: "Point a coding agent at the backlog",
    promise:
      "A plain-language request is enough for a coding agent to pick up a task, prepare an isolated workspace, and carry it through verification and commit.",
    detail:
      "The agent does not need a ticket key or a provider-specific command, and it never asks you to paste credentials. With recovery enabled, a replacement agent can resume an interrupted task from its saved state.",
  },
  {
    id: "audit",
    category: "govern",
    title: "Every action logged",
    promise:
      "Who did it, when, and whether it was a person or the AI, with nothing in the system happening invisibly.",
    detail:
      "Each entry can be checked against the record it points to, and sensitive content stays out of the log while the authorized record keeps it.",
  },
  {
    id: "killswitch",
    category: "govern",
    title: "A switch on every AI feature",
    promise:
      "Turn any single part of the system off in one click while everything else keeps running.",
    detail:
      "Nothing here is all or nothing. A workspace can stop one capability without bringing down the rest.",
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
    title: "Role-based access",
    promise: "The bookkeeper sees the invoices and does not see the pipeline.",
    detail: "Access follows the role, so people have the records they need and no more.",
  },
  {
    id: "health",
    category: "govern",
    title: "It audits its own data",
    promise:
      "Nightly checks look for duplicates, broken links, stale records, and numbers that stopped making sense.",
    detail:
      "Findings arrive as review work rather than silent changes, so a cleanup never rewrites something you rely on.",
  },
  {
    id: "ownership",
    category: "govern",
    title: "You own all of it",
    promise:
      "The accounts, the data, and the export, so leaving is a download rather than a negotiation.",
    detail:
      "The underlying application is MIT licensed, and your records are exportable at any time.",
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

export type SurfaceGroupId = "day" | "revenue" | "control";

export interface SurfaceGroup {
  id: SurfaceGroupId;
  label: string;
  blurb: string;
  rgb: string;
}

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

export interface CurrentSurface {
  n: string;
  group: SurfaceGroupId;
  title: string;
  body: string;
}

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
