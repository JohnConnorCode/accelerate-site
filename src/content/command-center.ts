/* Content for the Command Center solution page (/command-center).

   Self-contained types, following the same convention as industry-feeds.ts.
   Category colors reuse the CHANNEL rgb language from industry-feeds.ts so the
   catalog reads as the same system as the ops console. */

export type CapabilityCategory =
  | "capture"
  | "organize"
  | "act"
  | "learn"
  | "connect"
  | "govern";

export interface CategoryMeta {
  id: CapabilityCategory;
  label: string;
  blurb: string;
  glyph: string;
  rgb: string;
}

export const CATEGORY_META: CategoryMeta[] = [
  { id: "capture", label: "Capture", blurb: "It sees what happens.", glyph: "◆", rgb: "96,165,250" },
  { id: "organize", label: "Organize", blurb: "It files it correctly.", glyph: "▤", rgb: "167,139,250" },
  { id: "act", label: "Act", blurb: "It does the work and waits.", glyph: "✦", rgb: "163,230,53" },
  { id: "learn", label: "Learn", blurb: "It gets better at your business.", glyph: "↻", rgb: "34,211,238" },
  { id: "connect", label: "Connect", blurb: "You reach it from anywhere.", glyph: "⌘", rgb: "251,191,36" },
  { id: "govern", label: "Govern", blurb: "Nothing irreversible happens without you.", glyph: "✓", rgb: "52,211,153" },
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
    title: "Voice notes",
    detail:
      "Talk into your phone between appointments. It transcribes, files it, and texts you back what it did with it.",
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
    detail:
      "Stages, values, and what has actually moved. Not what you remember moving.",
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
      "People to companies, companies to deals, deals to documents. Ask who can introduce you to a target and get a real path, not a guess.",
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

  // Act
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
    title: "Bulk changes with an undo",
    detail: "Retag two hundred records at once. One click puts it all back.",
  },
  {
    id: "automations",
    category: "act",
    title: "Rules that fire on their own",
    detail:
      "When a deal hits a stage, the things that always happen next just happen.",
  },
  {
    id: "queue",
    category: "act",
    title: "Nothing leaves without your yes",
    gated: true,
    detail:
      "Every outbound action waits in one queue. Approve, edit, or reject. That is the setting on day one, and you decide when to loosen it.",
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
      "Every kind of action carries its own trust level. You raise it when the approval rate has earned it and drop it back the moment you want to.",
  },
  {
    id: "brief",
    category: "learn",
    title: "A brief every morning",
    detail:
      "What happened, what is owed, and what it intends to do about it today.",
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
      "A dashboard, a daily view, and one inbox holding everything that is waiting on you.",
  },
  {
    id: "chat",
    category: "connect",
    title: "Chat with your own data",
    detail:
      "Ask what you agreed with a client in March. Get the answer with the source it came from, not a plausible guess.",
  },
  {
    id: "mcp",
    category: "connect",
    title: "Claude works in it directly, with no copy and paste",
    detail:
      "No more pasting half your business into a chat window to ask a question about it. Claude connects straight to your records over MCP and works in them, inside the same permissions everyone else has.",
  },
  {
    id: "sms",
    category: "connect",
    title: "Text message",
    detail:
      "Ask a question, log a call, get a briefing. From your phone, with nothing to install.",
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
    title: "Reports by email",
    detail:
      "Weekly and monthly, to you or to the whole team, with nobody assembling them.",
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
    detail:
      "Turn any single part of it off in one click. Everything else keeps running.",
  },
  {
    id: "own-db",
    category: "govern",
    title: "Your own database",
    detail:
      "Your records live in a database of your own, separate from every other client.",
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
    detail:
      "The accounts, the data, the export. Leaving is a download, not a negotiation.",
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
  "Waits for your yes",
];

export const WHO_ITS_FOR = [
  "You run client work, business development, and admin, and there is no operations hire coming.",
  "Your team is small and most of what the business knows is in one person's head.",
  "You already work with us on automation and want your own internal operation running the same way.",
];
