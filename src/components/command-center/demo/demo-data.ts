/* Fake workspace for the interactive command-center demo on /command-center.

   Everything here is invented. The names, companies, numbers, and quotes are
   all fictional and the UI labels them as sample data, so nothing on this page
   can be mistaken for a real client. Keep it that way. */

export type ViewId = "approvals" | "people" | "pipeline" | "ask" | "meeting";

/* ── approvals ─────────────────────────────────────────────────────────── */

export type ActionKind = "email" | "calendar" | "deal" | "task" | "note";

export const ACTION_KIND: Record<ActionKind, { glyph: string; rgb: string; label: string }> = {
  email: { glyph: "→", rgb: "34,211,238", label: "Email" },
  calendar: { glyph: "◆", rgb: "96,165,250", label: "Calendar" },
  deal: { glyph: "✦", rgb: "163,230,53", label: "Pipeline" },
  task: { glyph: "↻", rgb: "167,139,250", label: "Tasks" },
  note: { glyph: "★", rgb: "251,191,36", label: "Notes" },
};

export interface DemoAction {
  id: string;
  kind: ActionKind;
  title: string;
  because: string;
  source: string;
  /** Editable body, present on the actions that produce written output. */
  draft?: string;
  /** Routine work: the kind that graduates out of the queue first. */
  routine?: boolean;
  /** Who or what the action concerns, used when reporting what it learned. */
  who: string;
}

/** What it did overnight without needing anyone, shown above the queue. */
export const OVERNIGHT = [
  { n: "14", label: "emails read and filed" },
  { n: "3", label: "meetings written up" },
  { n: "6", label: "actions drafted" },
  { n: "0", label: "sent without you" },
];

export const DEMO_ACTIONS: DemoAction[] = [
  {
    id: "act-1",
    who: "Sarah Chen",
    kind: "email",
    title: "Reply to Sarah Chen",
    because: "She asked for the revised scope by Friday.",
    source: "Northwind kickoff call, Tue 10:02",
    draft:
      "Hi Sarah,\n\nGood call yesterday. Revised scope is attached, with the reporting piece split out so you can take it to Marcus separately if that is easier.\n\nTwo things I said I would confirm: we can hit the March 3 start, and the training day works better in week two than week one.\n\nAnything you want changed before I send it to your side?\n\nJohn",
  },
  {
    id: "act-2",
    who: "Dana Whitfield",
    routine: true,
    kind: "calendar",
    title: "Hold 30 minutes with Dana Whitfield",
    because: "You promised Thursday on the call.",
    source: "Whitfield check-in, Mon 15:40",
  },
  {
    id: "act-3",
    who: "Northwind Group",
    kind: "deal",
    title: "Move Northwind Group to Proposal Sent",
    because: 'Her reply: "send it over this week and I will get it in front of Marcus."',
    source: "Email from s.chen@northwind.example, Wed 08:14",
  },
  {
    id: "act-4",
    who: "Brightwater",
    routine: true,
    kind: "task",
    title: "Add 4 tasks from the Brightwater site visit",
    because: "Each one is quoted from the transcript so you can check it.",
    source: "Brightwater site visit, Tue 14:20",
  },
  {
    id: "act-5",
    who: "Ray Atwell",
    kind: "email",
    title: "Chase the Atwell invoice",
    because: "18 days overdue and the last two emails went unanswered.",
    source: "Invoice 2043, sent Jan 22",
    draft:
      "Hi Ray,\n\nCircling back on invoice 2043, now 18 days past due. I know things have been busy on the Cedar site.\n\nIf there is a hold-up on your end, tell me what it is and I will work with it. If it just needs re-sending to a different address, say the word.\n\nJohn",
  },
  {
    id: "act-6",
    who: "Marcus Reyes",
    routine: true,
    kind: "note",
    title: "File call notes to Marcus Reyes",
    because: "Third conversation this month, none of it written down yet.",
    source: "Reyes intro call, Wed 11:05",
  },
];

/* ── people ────────────────────────────────────────────────────────────── */

export interface TimelineEvent {
  when: string;
  kind: "email-in" | "email-out" | "meeting" | "note" | "ai";
  text: string;
}

export interface DemoPerson {
  id: string;
  name: string;
  role: string;
  company: string;
  last: string;
  temp: "warm" | "cooling" | "cold";
  facts: { k: string; v: string }[];
  open: string[];
  timeline: TimelineEvent[];
}

export const DEMO_PEOPLE: DemoPerson[] = [
  {
    id: "p1",
    name: "Sarah Chen",
    role: "Operations Director",
    company: "Northwind Group",
    last: "2 days ago",
    temp: "warm",
    facts: [
      { k: "Decision maker", v: "Shares sign-off with Marcus Reyes (CFO)" },
      { k: "Budget cycle", v: "Approves in March, not at year end" },
      { k: "Prefers", v: "Short email, no decks, answers within a day" },
      { k: "Watch out", v: "Was burned by a vendor who missed a go-live in 2024" },
    ],
    open: [
      "Who signs off alongside Marcus?",
      "Does the March 3 start survive their audit week?",
    ],
    timeline: [
      { when: "Wed 08:14", kind: "email-in", text: '"Send it over this week and I will get it in front of Marcus."' },
      { when: "Tue 10:02", kind: "meeting", text: "Northwind kickoff call, 42 min. Scope, timeline, training." },
      { when: "Tue 10:48", kind: "ai", text: "Filed 6 facts, 3 tasks, and 2 open questions from the call." },
      { when: "Mon 16:30", kind: "email-out", text: "Sent the original scope and the two reference calls." },
      { when: "Jan 28", kind: "note", text: "Intro came through Dana Whitfield. Owes Dana a thank-you." },
    ],
  },
  {
    id: "p2",
    name: "Marcus Reyes",
    role: "CFO",
    company: "Northwind Group",
    last: "6 days ago",
    temp: "cooling",
    facts: [
      { k: "Cares about", v: "Payback period, not features" },
      { k: "Style", v: "Will not reply to a first email. Replies to Sarah." },
    ],
    open: ["What payback period does he need to see?"],
    timeline: [
      { when: "Wed 11:05", kind: "meeting", text: "Intro call, 18 min. Mostly listened." },
      { when: "Wed 11:24", kind: "ai", text: "Flagged: no notes filed from this call yet. Draft waiting." },
    ],
  },
  {
    id: "p3",
    name: "Dana Whitfield",
    role: "Managing Partner",
    company: "Whitfield & Co",
    last: "yesterday",
    temp: "warm",
    facts: [
      { k: "Relationship", v: "Referred Northwind. Has sent 3 introductions in 2 years." },
      { k: "Reciprocity", v: "You owe her an intro. Offered in March, never made." },
    ],
    open: ["Make the intro to Priya Raman you offered in March."],
    timeline: [
      { when: "Mon 15:40", kind: "meeting", text: "Check-in, 25 min. Asked how Northwind was going." },
      { when: "Mon 15:52", kind: "ai", text: "You promised Thursday. Calendar hold drafted and waiting." },
    ],
  },
  {
    id: "p4",
    name: "Ray Atwell",
    role: "Owner",
    company: "Atwell Construction",
    last: "18 days ago",
    temp: "cold",
    facts: [
      { k: "Status", v: "Invoice 2043 unpaid, 18 days" },
      { k: "History", v: "Always pays, usually late, responds to a direct ask" },
    ],
    open: ["Is the Cedar project delay affecting their cash flow?"],
    timeline: [
      { when: "Jan 22", kind: "email-out", text: "Invoice 2043 sent. No reply." },
      { when: "Feb 2", kind: "email-out", text: "First chase. No reply." },
      { when: "today", kind: "ai", text: "Escalated to your queue. Second chase drafted." },
    ],
  },
];

/* ── pipeline ──────────────────────────────────────────────────────────── */

export interface DemoDeal {
  id: string;
  name: string;
  company: string;
  value: string;
  age: string;
  flag?: string;
}

export const DEMO_PIPELINE: { stage: string; deals: DemoDeal[] }[] = [
  {
    stage: "In conversation",
    deals: [
      { id: "d1", name: "Reyes intro", company: "Northwind Group", value: "$18k", age: "6d" },
      { id: "d2", name: "Cedar retainer", company: "Atwell Construction", value: "$4k/mo", age: "22d", flag: "Cooling" },
    ],
  },
  {
    stage: "Proposal sent",
    deals: [
      { id: "d3", name: "Ops rebuild", company: "Northwind Group", value: "$42k", age: "2d" },
      { id: "d4", name: "Intake system", company: "Halcyon Legal", value: "$26k", age: "9d" },
    ],
  },
  {
    stage: "In talks",
    deals: [{ id: "d5", name: "Second site", company: "Brightwater", value: "$31k", age: "4d" }],
  },
  {
    stage: "Won",
    deals: [{ id: "d6", name: "Phase one", company: "Whitfield & Co", value: "$22k", age: "closed" }],
  },
];

/* ── ask (the AI surface) ──────────────────────────────────────────────── */

export interface DemoAnswer {
  q: string;
  a: string;
  sources: string[];
}

export const DEMO_ANSWERS: DemoAnswer[] = [
  {
    q: "What did I agree to with Northwind?",
    a: "Three things. A March 3 start date, the reporting piece split out as its own line so Marcus can approve it separately, and a training day in week two rather than week one. Sarah is taking the revised scope to Marcus this week. She has not committed to a number yet.",
    sources: ["Northwind kickoff call, Tue 10:02", "Email from s.chen@northwind.example, Wed 08:14"],
  },
  {
    q: "Who is going cold that I care about?",
    a: "Ray Atwell, 18 days since contact and an unpaid invoice. Marcus Reyes, 6 days, and he is the one who actually signs. Both have drafts waiting in your queue. Dana Whitfield is warm but you owe her an intro you offered in March, which is the kind of thing that quietly costs you referrals.",
    sources: ["Engagement scan, run 06:00 today", "3 contact records"],
  },
  {
    q: "Draft the follow-up to Dana.",
    a: "Written and in your queue. It thanks her for the Northwind introduction, confirms Thursday, and makes the Priya Raman intro you offered in March rather than leaving it hanging for a fourth month. It is 90 words. Approve it and it goes from your address.",
    sources: ["Whitfield check-in, Mon 15:40", "Note filed Jan 28"],
  },
];

/* ── meeting extraction ────────────────────────────────────────────────── */

export const DEMO_TRANSCRIPT = [
  { who: "Sarah", text: "Realistically we need this live before the audit, so early March at the latest." },
  { who: "You", text: "March 3 works. I will confirm the training day separately." },
  { who: "Sarah", text: "Marcus will want the reporting broken out. He approves that line himself." },
  { who: "You", text: "I will split it out and send the revised scope Friday." },
  { who: "Sarah", text: "One thing, we had a vendor miss a go-live in 2024 and it was painful. That is the nervousness you are hearing." },
];

export interface ExtractedItem {
  id: string;
  type: "Task" | "Fact" | "Question" | "Date";
  text: string;
  quote: string;
}

export const DEMO_EXTRACTED: ExtractedItem[] = [
  {
    id: "e1",
    type: "Task",
    text: "Send Sarah the revised scope with reporting split out, by Friday",
    quote: "I will split it out and send the revised scope Friday.",
  },
  {
    id: "e2",
    type: "Date",
    text: "Go-live target: March 3",
    quote: "March 3 works.",
  },
  {
    id: "e3",
    type: "Fact",
    text: "Marcus Reyes personally approves the reporting line",
    quote: "Marcus will want the reporting broken out. He approves that line himself.",
  },
  {
    id: "e4",
    type: "Fact",
    text: "Burned by a vendor missing a go-live in 2024, source of their caution",
    quote: "We had a vendor miss a go-live in 2024 and it was painful.",
  },
  {
    id: "e5",
    type: "Question",
    text: "Which week does the training day land in?",
    quote: "I will confirm the training day separately.",
  },
];

/* ── navigation ────────────────────────────────────────────────────────────
   The rail is the fastest read of how much this thing actually covers, so it
   carries the real shape of the system rather than only the five surfaces the
   demo builds out in full. Every item resolves to something: the five core
   ones to their own view, the rest to a compact but real-looking stub. */

export interface RailItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  /** Has a fully built view rather than a stub. */
  core?: boolean;
}

export const RAIL: { label: string; items: RailItem[] }[] = [
  {
    label: "Daily",
    items: [
      { id: "today", label: "Today", icon: "Sun", badge: "4", core: true },
      { id: "approvals", label: "Approvals", icon: "Inbox", core: true },
      { id: "inbox", label: "Inbox", icon: "Mail", badge: "12" },
    ],
  },
  {
    label: "Relationships",
    items: [
      { id: "people", label: "People", icon: "Users", core: true },
      { id: "companies", label: "Companies", icon: "Building2" },
      { id: "pipeline", label: "Pipeline", icon: "Columns3", core: true },
      { id: "referrals", label: "Referrals", icon: "Share2", badge: "3" },
    ],
  },
  {
    label: "Work",
    items: [
      { id: "projects", label: "Projects", icon: "FolderKanban" },
      { id: "tasks", label: "Tasks", icon: "CheckSquare", badge: "23" },
      { id: "meeting", label: "Meetings", icon: "FileText", core: true },
      { id: "documents", label: "Documents", icon: "Files" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { id: "ask", label: "Ask", icon: "Sparkles", core: true },
      { id: "brief", label: "Daily brief", icon: "Newspaper" },
      { id: "questions", label: "Open questions", icon: "HelpCircle", badge: "7" },
      { id: "reports", label: "Reports", icon: "BarChart3" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "activity", label: "Activity log", icon: "History" },
      { id: "automations", label: "Automations", icon: "Workflow" },
      { id: "integrations", label: "Integrations", icon: "Plug" },
      { id: "settings", label: "Settings", icon: "Settings" },
    ],
  },
];

export interface StubRow {
  a: string;
  b: string;
  c?: string;
  /** Renders in the AI accent, for rows the system produced itself. */
  ai?: boolean;
}

export const STUBS: Record<string, { title: string; sub: string; head: [string, string, string]; rows: StubRow[] }> = {
  today: {
    title: "Today",
    sub: "AI-prioritized daily agenda, syncing your calendar, emails, and CRM in real-time.",
    head: ["Action Required", "Context", "Status / Integration"],
    rows: [
      { a: "Approve revised proposal for Northwind", b: "Auto-generated from yesterday's Zoom transcript", c: "Draft ready in Docs", ai: true },
      { a: "Follow up with Sarah Chen", b: "She opened the pricing page 3 times today", c: "HubSpot signal", ai: true },
      { a: "Review Q3 Marketing Spend", b: "Approaching budget limit threshold", c: "QuickBooks alert", ai: true },
      { a: "Call back Ray Atwell", b: "Invoice 18 days overdue, two automated emails ignored", c: "Stripe / Pending" },
      { a: "Prep for QBR with Halcyon Legal", b: "AI pulled key metrics from past 3 months", c: "Meeting at 14:00", ai: true },
    ],
  },
  inbox: {
    title: "Inbox",
    sub: "Read, sorted, and attached to the right person before you open it.",
    head: ["From", "Subject", "Filed to"],
    rows: [
      { a: "Sarah Chen", b: "Re: revised scope", c: "Northwind Group", ai: true },
      { a: "Dana Whitfield", b: "Thursday still good?", c: "Whitfield & Co", ai: true },
      { a: "accounts@atwell", b: "Out of office until the 14th", c: "Atwell Construction", ai: true },
      { a: "Priya Raman", b: "Happy to be introduced", c: "New contact created", ai: true },
    ],
  },
  companies: {
    title: "Companies",
    sub: "Who works where, and which deals belong to whom.",
    head: ["Company", "People", "Open value"],
    rows: [
      { a: "Northwind Group", b: "2 contacts", c: "$60,000" },
      { a: "Brightwater", b: "3 contacts", c: "$31,000" },
      { a: "Halcyon Legal", b: "1 contact", c: "$26,000" },
      { a: "Atwell Construction", b: "1 contact", c: "$4,000/mo" },
    ],
  },
  referrals: {
    title: "Referrals",
    sub: "Who sent you work, and what you still owe them back.",
    head: ["From", "Sent you", "Owed back"],
    rows: [
      { a: "Dana Whitfield", b: "Northwind Group", c: "Intro to Priya Raman" },
      { a: "Dana Whitfield", b: "Halcyon Legal", c: "Nothing outstanding" },
      { a: "Marcus Reyes", b: "Brightwater", c: "Nothing outstanding" },
    ],
  },
  projects: {
    title: "Projects",
    sub: "Delivery work, with the client conversation attached to it.",
    head: ["Project", "Client", "State"],
    rows: [
      { a: "Ops rebuild", b: "Northwind Group", c: "Scoping" },
      { a: "Intake system", b: "Halcyon Legal", c: "Proposal out" },
      { a: "Second site rollout", b: "Brightwater", c: "In build" },
    ],
  },
  tasks: {
    title: "Tasks",
    sub: "Broken down small enough to act on, each linked to where it came from.",
    head: ["Task", "From", "Due"],
    rows: [
      { a: "Split reporting into its own line", b: "Northwind kickoff call", c: "Fri", ai: true },
      { a: "Confirm the training week", b: "Northwind kickoff call", c: "Fri", ai: true },
      { a: "Send Cedar site photos", b: "Brightwater site visit", c: "Mon", ai: true },
      { a: "Re-send invoice 2043", b: "Atwell chase", c: "Today" },
    ],
  },
  documents: {
    title: "Documents",
    sub: "Proposals, scopes and transcripts, filed against the right account.",
    head: ["Document", "Account", "Updated"],
    rows: [
      { a: "Northwind scope v2", b: "Northwind Group", c: "2 days ago" },
      { a: "Kickoff call transcript", b: "Northwind Group", c: "2 days ago", ai: true },
      { a: "Halcyon proposal", b: "Halcyon Legal", c: "9 days ago" },
    ],
  },
  brief: {
    title: "Daily brief",
    sub: "What happened, what is owed, and what it intends to do about it.",
    head: ["Line", "Detail", ""],
    rows: [
      { a: "Overnight", b: "14 emails read, 3 meetings written up, 6 actions drafted", ai: true },
      { a: "Owed by you", b: "Sarah Chen (scope, Friday), Dana Whitfield (intro)", ai: true },
      { a: "Going cold", b: "Ray Atwell 18 days, Marcus Reyes 6 days", ai: true },
      { a: "Moved on its own", b: "2 stage changes, both from replies", ai: true },
    ],
  },
  questions: {
    title: "Open questions",
    sub: "Held until you are next actually talking to the person.",
    head: ["Question", "About", "Since"],
    rows: [
      { a: "Who signs off alongside Marcus?", b: "Sarah Chen", c: "2 days" },
      { a: "What payback period does he need?", b: "Marcus Reyes", c: "6 days" },
      { a: "Is the Cedar delay a cash problem?", b: "Ray Atwell", c: "18 days" },
    ],
  },
  reports: {
    title: "Reports",
    sub: "Assembled and sent without anybody building them.",
    head: ["Report", "Cadence", "Last sent" ],
    rows: [
      { a: "Pipeline movement", b: "Weekly, Monday 07:00", c: "2 days ago", ai: true },
      { a: "What went quiet", b: "Weekly, Monday 07:00", c: "2 days ago", ai: true },
      { a: "Time by client", b: "Monthly", c: "Feb 1", ai: true },
    ],
  },
  activity: {
    title: "Activity log",
    sub: "Every action, and whether a person or the AI did it.",
    head: ["Action", "By", "When"],
    rows: [
      { a: "Moved Northwind to Proposal Sent", b: "You, approved", c: "08:22" },
      { a: "Drafted reply to Sarah Chen", b: "AI", c: "08:19", ai: true },
      { a: "Filed Northwind kickoff transcript", b: "AI", c: "Tue 10:48", ai: true },
      { a: "Merged duplicate contact", b: "You, approved", c: "Mon 16:04" },
    ],
  },
  automations: {
    title: "Automations",
    sub: "The things that always happen next, happening without you.",
    head: ["When", "Then", "State"],
    rows: [
      { a: "Deal reaches Proposal Sent", b: "Schedule a 5-day follow-up", c: "On" },
      { a: "Reply classified as a no", b: "Close the deal, log the reason", c: "On" },
      { a: "Invoice passes 14 days", b: "Draft a chase for approval", c: "On" },
      { a: "Contact goes 30 days quiet", b: "Raise it in the daily brief", c: "On" },
    ],
  },
  integrations: {
    title: "Integrations",
    sub: "Connected to what you already use, not a replacement for it.",
    head: ["Service", "Does", "State"],
    rows: [
      { a: "Gmail", b: "Reads and sends from your address", c: "Connected" },
      { a: "Google Calendar", b: "Meetings, attendees, briefings", c: "Connected" },
      { a: "Claude (MCP)", b: "Works your records directly", c: "Connected" },
      { a: "Accounting", b: "Invoice status into the queue", c: "Available" },
    ],
  },
  settings: {
    title: "Settings",
    sub: "Where the leash length lives. Every one of these is yours to move.",
    head: ["Setting", "Now", ""],
    rows: [
      { a: "Send email without approval", b: "Off" },
      { a: "File meeting notes without approval", b: "On, since Feb 2" },
      { a: "Move pipeline without approval", b: "Off" },
      { a: "Who can see the pipeline", b: "Owner and admin only" },
    ],
  },
};


/* ── feedback ──────────────────────────────────────────────────────────────
   Rejecting a draft is the most valuable thing a person does in this system,
   because it is the only input that changes what gets written next. The demo
   makes that visible: pick a reason, see what it recorded. */

export interface FeedbackReason {
  id: string;
  label: string;
  /** {who} is replaced with the subject of the action. */
  learned: string;
}

export const FEEDBACK_REASONS: FeedbackReason[] = [
  { id: "long", label: "Too long", learned: "Drafts to {who} will run shorter from here." },
  { id: "tone", label: "Wrong tone", learned: "Tone for {who} pulled closer to how you actually write to them." },
  { id: "facts", label: "Facts are wrong", learned: "Flagged. It will re-read the source before drafting this again." },
  { id: "timing", label: "Not yet", learned: "Held. This resurfaces in a week rather than tomorrow." },
  { id: "wrong", label: "Should not exist", learned: "This kind of action will stop being raised for {who}." },
];
