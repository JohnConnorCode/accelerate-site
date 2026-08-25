import type { ChangelogEntry } from "@/lib/types";

export const changelogEntries: ChangelogEntry[] = [
  { id: "professional-admin-demo-workspaces", slug: "professional-admin-demo-workspaces", title: "Three complete businesses in one public Command Center demo", description: "The full Command Center can now be explored publicly as three detailed fictional businesses: a children's enrichment studio, a roofing and exteriors company, and a growth consultancy. The demo uses the actual admin routes and responsive components rather than a parallel mock dashboard, with populated email, conversations, pipeline, bookings, campaigns, proposals, clients, analytics, integrations, settings, AI operations, and roadmap views. Every action stays inside isolated browser-session state, every workspace has a guided story and exact reset, and the four admin appearances work across desktop and mobile. The shorter interactive preview and the complete admin workspace now link to each other clearly.", category: "feature", publishedAt: "2026-08-25" },
  { id: "selected-work-portfolio", slug: "selected-work-portfolio", title: "Selected Work rebuilt as an evidence-led portfolio", description: "Published six public project stories through one typed, reusable portfolio system, with Northern Trust preserved as an unlisted archive. WORK+SHELTER and SuperDebate receive flagship visual treatment with authentic product and operating-system captures, while every case uses truthful attribution, verified claims, project-specific art direction, responsive media, reduced-motion behavior, and clear connections to current Accelerate services. Search, sitemap, metadata, related work, and archive exclusions all derive from the same visibility contract.", category: "feature", publishedAt: "2026-08-25" },
  { id: "booking-restored", slug: "booking-restored", title: "Booking is live again, on the right calendar", description: "Every Book a call surface now points at the correct scheduler. The link had been disabled after it was found pointing at an unrelated business while embedded on the contact page and handed out by the website assistant. The contact embed, the roofing embed, the assistant, and the qualifier all read one value, so booking can be turned on or off everywhere at once rather than drifting apart. A signed Calendly booking now reaches the operator queue, and a redelivered booking is recognised as the same meeting instead of notifying twice.", category: "fix", publishedAt: "2026-08-20" },
  { id: "house-style-enforced-on-chat", slug: "house-style-enforced-on-chat", title: "House style enforced on assistant replies", description: "The website assistant now has its house style enforced as replies stream, not merely requested in its instructions. Prompt rules are guidance a model can drift from; this is applied to the outgoing text itself, while links, hyphenated words, dates, and numeric ranges pass through untouched. The conversation ledger records what was actually sent rather than what was first generated.", category: "improvement", publishedAt: "2026-08-20" },
  { id: "autonomous-inbound-responder", slug: "autonomous-inbound-responder", title: "Approved response policies for inbound inquiries", description: "Added the ability to acknowledge a new inquiry within seconds without a person in the loop, built as a versioned policy the founder signs rather than an agent that is trusted. The policy fixes its trigger, limits, guardrails, wording, and model; any material change suspends it until the new version is approved. It refuses to act outside a first-touch inquiry, an active contact, a daily and per-contact ceiling, and business hours, and a draft that states pricing, commits to a time, or claims work already done is rejected before anyone reads it. Every refusal is recorded with its reason, not only every send. It ships switched off.", category: "feature", publishedAt: "2026-08-20" },
  { id: "ai-tool-contract-enforced", slug: "ai-tool-contract-enforced", title: "AI tool contracts are now enforced, not advertised", description: "Tool schemas and impact levels were declared throughout the assistant layer and checked nowhere, so the system was safe only because every write happened to route through the approval queue. Tool calls are now validated against their declared schema before running, a tool marked read-only that tries to stage an action is refused, a tool that should propose but does not is refused, and destructive capability fails closed. Operational snapshots are bounded and now name any data they could not read instead of reporting an empty result as fact.", category: "improvement", publishedAt: "2026-08-20" },
  { id: "assistant-run-ledger", slug: "assistant-run-ledger", title: "Every assistant conversation is now on the record", description: "The public website assistant is the one place an AI speaks to prospects unattended, and it kept no record of what it said. It now opens a run on the same ledger as the internal copilot, tees the streamed reply into it, and reaches a final state whether the answer completes, the provider fails, or the visitor closes the tab. The copilot also now knows the current date, returns what it gathered instead of discarding the answer when it runs out of steps, and names any actions it left awaiting approval.", category: "improvement", publishedAt: "2026-08-20" },
  { id: "operational-alerting", slug: "operational-alerting", title: "Failures now reach the founder", description: "Operational failures were visible only inside the admin dashboard, behind a poll, to someone already looking. Job failures, recovered stalls, integration problems, and failed webhook deliveries now send an alert with its own delivery receipt, de-duplicated so a flapping subsystem produces one message rather than fifty. Health reporting was also corrected: it counted only outright failures, so a job stuck mid-run read as healthy, and failed webhook receipts were never read by any surface at all.", category: "improvement", publishedAt: "2026-08-19" },
  { id: "campaign-engine-repair", slug: "campaign-engine-repair", title: "Outbound campaigns can send, recover, and stay within one budget", description: "Three independent faults meant a member added through the interface could never receive anything, while the scheduled run reported success. Members now carry a resolved contact and a real due time, a send that fails is retried with backoff instead of being terminally stopped, a claim abandoned by a crashed run is recovered rather than stranded, and one account-wide daily ceiling now governs every active campaign instead of each one carrying its own.", category: "fix", publishedAt: "2026-08-19" },
  { id: "inquiry-capture-hardening", slug: "inquiry-capture-hardening", title: "No inquiry is reported saved unless it was", description: "Several public forms logged a database failure and returned success anyway, so a visitor was told their details were recorded when they were not. Every capture path now checks its write and reports honestly. A booking that produced no notification, caused by writing to a column that does not exist, was also corrected and proven end to end in production.", category: "fix", publishedAt: "2026-08-19" },
  { id: "nonprofit-practice", slug: "nonprofit-practice", title: "A dedicated practice page for nonprofits", description: "Added a purpose-built page for nonprofit organisations covering donor follow-up, volunteer coordination, grant deadlines, and the operational load that falls on small teams, including the end-to-end command centre built for WORK+SHELTER.", category: "feature", publishedAt: "2026-08-19" },
  { id: "gmail-cursor-recovery", slug: "gmail-cursor-recovery", title: "Gmail sync cursor and recovery semantics", description: "Gmail synchronization now records a durable history cursor only after a complete bounded run, derives changed threads from Gmail history without duplicate work, and exposes incremental, initial, or recovery mode with honest deferred and failure counts. Expired cursors use a bounded reconciliation path instead of silently skipping work.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "calendar-canonical-association", slug: "calendar-canonical-association", title: "Calendar events now associate through canonical identity", description: "Google Calendar synchronization now links a meeting only when exactly one canonical contact matches an attendee, records ambiguous and unmatched cases without guessing, and associates the current opportunity. A confirmed upcoming meeting safely stops pending campaign outreach once without creating or changing an external event or pipeline stage.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "gmail-reply-campaign-stop", slug: "gmail-reply-campaign-stop", title: "Gmail replies stop campaign follow-up", description: "Gmail synchronization now uses the shared exact primary/alternate-email resolver and only treats newly recorded inbound messages as reply facts. Those facts enter the canonical campaign-stop service, preserving the same receipt, audit, and send-claim safeguards as unsubscribe and Resend delivery failures.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "campaign-stop-claim-boundary", slug: "campaign-stop-claim-boundary", title: "Atomic campaign stop and send-claim boundary", description: "Campaign stop conditions and send claims now serialize on each canonical contact inside PostgreSQL. The claim verifies the contact is active and the campaign is still approved; a stop records terminal eligibility before another due step can claim. A controlled production check proves a stopped membership cannot be claimed.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "canonical-campaign-stop-service", slug: "canonical-campaign-stop-service", title: "Canonical campaign stop controls", description: "Campaign suppression now has one Revenue OS service instead of separate unsubscribe, delivery-webhook, and executor writes. It records why pending memberships stopped, preserves activity and audit evidence, and rechecks contact suppression plus campaign approval immediately before a claimed send reaches Resend.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "resend-delivery-ledger", slug: "resend-delivery-ledger", title: "Resend delivery ledger and campaign suppression", description: "The canonical sender now adds durable provider idempotency and Revenue OS tags to every Resend message. A signed, replay-safe webhook ledger records delivery outcomes, activity, and audit evidence, while hard bounces, complaints, and provider suppressions immediately prevent later campaign sends. Setup Center now distinguishes basic sending from live delivery feedback and documents the one Resend webhook configuration step.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "atomic-revenue-job-claims", slug: "atomic-revenue-job-claims", title: "Atomic claims for scheduled Revenue OS work", description: "Added one database-owned claim path for scheduled and on-demand Revenue OS jobs. Concurrent invocations now return the existing running receipt, while repeated deterministic keys return their completed receipt instead of starting a second execution. Cron and Workspace sync routes expose an honest skipped result when another worker already owns the job.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "revenue-schema-contract-verification", slug: "revenue-schema-contract-verification", title: "Verified Revenue OS schema contract", description: "Added a versioned, read-only production schema verifier and immutable verification receipts. It checks required tables, columns, constraints, indexes, PostgreSQL functions, and service-only policies; clearly reports unapplied migrations, metadata drift, or connectivity failure; and makes Setup Center show the exact verified contract version and latest successful check instead of trusting a single table query.", category: "improvement", publishedAt: "2026-08-17" },
  { id: "approval-gated-ai-contact-import", slug: "approval-gated-ai-contact-import", title: "OpenRouter contact cleanup and approval import", description: "Added one founder-only Contact Import workspace for pasted lists, CSV, TSV, JSON, and messy notes. OpenRouter proposes normalized contacts, deterministic identity checks identify new versus existing records, and a literal-evidence guard strips unsupported AI fields before low-confidence or ambiguous rows default to excluded. The founder edits and approves an exact digest-bound snapshot before canonical writes; execution creates row-level receipts and safe partial retry without creating opportunities, campaigns, tasks, or messages. Standardized every active AI caller on one server-only OpenRouter gateway, configured encrypted production AI and cron credentials, applied and idempotently verified all pending production schemas, reached 100% required Setup readiness, and added a Keychain-backed migration command so future agents own migration execution through live verification.", category: "feature", publishedAt: "2026-08-16" },
  { id: "revenue-os-agent-contract", slug: "revenue-os-agent-contract", title: "Universal agent engineering contract", description: "Codified one repository-wide framework for canonical data ownership, domain-service writes, automation claims and receipts, AI tool impact and confirmation, governed learning, failure semantics, verification, ticket pickup, evidence, and recovery. Added a core Revenue OS module map and a machine verifier that rejects thin or contradictory managed-card handoffs before implementation begins.", category: "improvement", publishedAt: "2026-08-16" },
  { id: "admin-command-center-recovery", slug: "admin-command-center-recovery", title: "Professional Command Center recovery", description: "Rebuilt the admin interaction foundation around one responsive route registry, persisted collapsible sidebar, consistent entry motion, complete light/dark tokens, and one accessible portal dialog used by every modal and drawer. Restored Email Studio with editable drafts, rendered previews, explicit publishing, sent-message history, and compose handoff. Reworked Feature Board pointer/keyboard drag behavior and added one canonical compatibility bridge across Leads, Contacts, Chat, Clients, Subscribers, Resources, Partners, and Website Grades, including a unified person timeline and Pipeline deep-links. Verified all 25 registered admin routes at desktop and phone widths with Playwright.", category: "improvement", publishedAt: "2026-08-16" },
  { id: "money-first-inbound-outreach", slug: "money-first-inbound-outreach", title: "Money-first inbound and outreach safety", description: "Contact, chat, and roofing inquiries now feed one canonical revenue loop with same-day follow-up. The contact page uses manual scheduling while Calendly is disabled. Campaign email adds durable idempotency, founder reply-to, one-click unsubscribe, immediate suppression, and a server-enforced one-step/10-per-day pilot limit.", category: "improvement", publishedAt: "2026-08-16" },
  { id: "canonical-inbound-revenue-loop", slug: "canonical-inbound-revenue-loop", title: "Qualified inbound requests now enter the revenue work queue", description: "A roofing audit request now creates or enriches one canonical contact, company, and opportunity; retains source attribution; records an activity receipt and stage history; and creates a deduplicated same-day follow-up task for qualified prospects. The original nurture sequence remains non-blocking, so a delivery issue cannot lose the lead.", category: "improvement", publishedAt: "2026-08-16" },
  { id: "turn-key-first-party-analytics", slug: "turn-key-first-party-analytics", title: "Turn-key first-party revenue analytics", description: "Analytics now works without a Plausible or other third-party analytics account. The public site records privacy-minimised page views and conversion events server-side, while the founder workspace keeps that traffic context separate from the canonical opportunity, source, stage, and won-revenue funnel. Missing attribution and an unapplied event schema are visibly flagged rather than shown as healthy zeroes.", category: "improvement", publishedAt: "2026-08-16" },
  { id: "opportunity-provenance-ledger", slug: "opportunity-provenance-ledger", title: "Opportunity provenance from creation", description: "New opportunities now write an initial pipeline-stage event and canonical activity receipt at creation, preserving their origin, linked identity, starting stage, and value for future timelines and agent context.", category: "improvement", publishedAt: "2026-08-16" },
  {
    id: "canonical-task-service",
    slug: "canonical-task-service",
    title: "Canonical task service and activity receipts",
    description:
      "Manual and AI-approved tasks now use one validated service. It prevents duplicate open AI tasks through a deterministic key, records audit history, and creates activity receipts for task creation, completion, and snoozing.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "ai-operations-trace-ledger",
    slug: "ai-operations-trace-ledger",
    title: "AI Operations trace ledger",
    description:
      "Added a founder-only AI Operations workspace for reviewing recent copilot runs, completion and failure state, bounded previews, tool use, token volume, and helpful/not-helpful feedback, without exposing raw tool payloads or secrets.",
    category: "feature",
    publishedAt: "2026-08-16",
  },
  {
    id: "revenue-copilot-tool-registry",
    slug: "revenue-copilot-tool-registry",
    title: "Revenue Copilot tool registry and safety tiers",
    description:
      "Copilot capabilities now come from one versioned registry that declares each tool’s schema, impact tier, confirmation requirement, and validated execution path. Tool receipts preserve that policy metadata for inspection, and unknown capabilities fail closed.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "revenue-copilot-feedback-loop",
    slug: "revenue-copilot-feedback-loop",
    title: "Governed learning for the Revenue Copilot",
    description:
      "The founder can now rate completed copilot responses as helpful or not helpful. Ratings are tied to an auditable run and are used only as bounded, aggregate tool-quality telemetry on future commands, never as raw instructions, automatic policy changes, or autonomous sends.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "revenue-os-command-center-today",
    slug: "revenue-os-command-center-today",
    title: "Revenue OS Command Center: Prioritized Today",
    description:
      "Reworked the founder’s Today workspace into an explainable revenue operator queue. It separates replies, commitments, approvals, and proposals; tells you why each item is ranked; supports audited completion and next-day snooze for commitments; and surfaces connection and job health without claiming an unconfigured system is working. The next backlog slice adds meetings, campaign exceptions, task deduplication, and shared counters.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "launch-website-grader",
    slug: "launch-website-grader",
    title: "Website Grader Tool",
    description:
      "Launched our free Website Grader tool that analyzes any URL for performance, SEO, mobile-friendliness, security, and accessibility. Get AI-powered recommendations for improvement in under 30 seconds.",
    category: "feature",
    publishedAt: "2026-02-28",
  },
  {
    id: "launch-roi-calculator",
    slug: "launch-roi-calculator",
    title: "ROI Calculator",
    description:
      "New interactive ROI calculator that estimates the revenue impact of AI-powered automation based on your industry, current inquiry volume, and deal size. See projected 90-day and 12-month returns.",
    category: "feature",
    publishedAt: "2026-02-28",
  },
  {
    id: "service-packages",
    slug: "service-packages",
    title: "Service Packages",
    description:
      "Introduced three clear service packages: Launch, Grow, and Accelerate. Each package bundles our services at the best value with transparent pricing and no hidden fees.",
    category: "feature",
    publishedAt: "2026-02-28",
  },
  {
    id: "case-study-home-services",
    slug: "case-study-home-services",
    title: "Case Study: A Home-Services Client",
    description:
      "Published our first detailed case study showing how a home-services client dramatically increased inbound inquiries and grew monthly revenue using our AI-powered website and automation system.",
    category: "announcement",
    publishedAt: "2026-02-25",
  },
  {
    id: "partner-program-launch",
    slug: "partner-program-launch",
    title: "Partner Program",
    description:
      "Launched the Accelerate Partner Program with three tiers: Referral, Agency, and Technology partners. Earn commissions, get co-marketing support, and access exclusive resources.",
    category: "feature",
    publishedAt: "2026-02-20",
  },
  {
    id: "lead-magnet-resources",
    slug: "lead-magnet-resources",
    title: "Free Resource Library",
    description:
      "Released three free downloadable resources: AI Readiness Checklist, 7 AI Automations Every SMB Needs, and the 2026 AI Tool Comparison Guide. All available for free with email signup.",
    category: "feature",
    publishedAt: "2026-02-15",
  },
  {
    id: "ai-plan-generator-improvements",
    slug: "ai-plan-generator-improvements",
    title: "Solution Generator Improvements",
    description:
      "Enhanced the AI Solution Generator with more industry-specific recommendations, better ROI projections, and faster generation times. Plans are now more detailed and actionable.",
    category: "improvement",
    publishedAt: "2026-02-10",
  },
  {
    id: "site-launch",
    slug: "site-launch",
    title: "Accelerate Website Launch",
    description:
      "Launched acceleratewith.us, the new home for Accelerate AI Solutions. Featuring our AI-powered Solution Generator, industry-specific pages, and a design built for speed and conversion.",
    category: "announcement",
    publishedAt: "2026-02-01",
  },
];
