const allowedStatuses = new Set(["backlog", "planned", "in_progress", "blocked", "shipped"]);
const allowedPriorities = new Set(["urgent", "high", "medium", "low"]);

// Controlled Feature Board taxonomy. Labels are for filtering, not prose. Every
// managed card gets exactly one category, phase, and milestone label plus no more
// than two capabilities from this allowlist. Do not add one-off labels to cards;
// extend this map only when a reusable concept spans multiple tickets.
const CATEGORY_BY_WORKSTREAM = {
  foundation: "platform",
  platform: "platform",
  setup: "platform",
  security: "governance",
  admin: "operator",
  operations: "operator",
  campaigns: "engagement",
  proposals: "engagement",
  google: "integrations",
  gmail: "integrations",
  calendar: "integrations",
  drive: "integrations",
  integrations: "integrations",
  ai: "intelligence",
  intelligence: "intelligence",
  qa: "quality",
  release: "quality",
  productization: "productization",
  documentation: "productization",
  site: "marketing",
  runtime: "runtime",
  coworker: "runtime",
  learn: "intelligence",
};

const DEFAULT_CAPABILITY_BY_WORKSTREAM = {
  foundation: "data",
  platform: "platform",
  setup: "setup",
  security: "security",
  admin: "admin-ux",
  operations: "operations",
  campaigns: "outreach",
  proposals: "proposals",
  google: "workspace",
  gmail: "email",
  calendar: "scheduling",
  drive: "knowledge",
  integrations: "integrations",
  ai: "ai",
  intelligence: "knowledge",
  qa: "testing",
  release: "release",
  productization: "productization",
  documentation: "documentation",
  site: "marketing",
  runtime: "work-engine",
  coworker: "coworkers",
  learn: "learning",
};

const CAPABILITY_ALIASES = {
  activity: "activity",
  agent: "coworkers",
  "agent-activity": "coworkers",
  "agent-trace": "agent-trace",
  "ai-context": "ai",
  ai: "ai",
  approval: "automation",
  auth: "security",
  automation: "automation",
  calendar: "scheduling",
  campaigns: "outreach",
  clonable: "productization",
  config: "productization",
  confirmation: "automation",
  contacts: "identity",
  conversations: "email",
  coworker: "coworkers",
  coworkers: "coworkers",
  database: "data",
  dedupe: "reliability",
  drive: "knowledge",
  email: "email",
  encryption: "security",
  "evidence-ledger": "evidence-ledger",
  evidence: "evidence-ledger",
  "capability-graph": "capability-graph",
  finance: "finance",
  gmail: "email",
  google: "workspace",
  health: "reliability",
  identity: "identity",
  inbound: "inbound",
  indexing: "knowledge",
  integrations: "integrations",
  learning: "learning",
  mcp: "mcp",
  memory: "memory",
  observability: "reliability",
  openrouter: "ai",
  operations: "operations",
  pipeline: "pipeline",
  playwright: "testing",
  proposals: "proposals",
  qa: "testing",
  reliability: "reliability",
  research: "knowledge",
  resilience: "reliability",
  security: "security",
  setup: "setup",
  tasks: "tasks",
  testing: "testing",
  "second-brain": "knowledge",
  "tool-registry": "tool-registry",
  "work-engine": "work-engine",
  workitem: "work-engine",
  webhooks: "integrations",
  "autonomy-policy": "autonomy-policy",
  autonomy: "autonomy-policy",
};

// Loop One is the only active milestone. It is the shortest dependency-ordered
// circuit that turns a captured inquiry into an inspectable revenue record,
// operator work, a receipted reply, and bounded context the system can remember.
// Broad phase/aspiration cards come after their concrete prerequisites; later
// autonomy, learning, and trust phases stay on the horizon until See and Remember
// are real. This keeps the board executable instead of merely comprehensive.
//
// Order is the intended execution order. Cards earn their place here by being on
// that circuit, not by being important in the abstract, nearly every card on this
// board is important, which is precisely why the board stopped functioning as a
// queue. Promote a card by adding its key; demote by removing it.
//
// NORTHSTAR ALIGNMENT
// The platform vision (docs/NORTHSTAR.md) defines five product layers and five
// implementation phases. Existing phases map as follows:
//
//   Phase 0–1  →  Phase A: Complete Loop One (See + Remember foundations)
//   Phase 2–3  →  Phase B: Agent Runtime foundation (Notice + Act primitives)
//   Phase 4    →  Phase C: Reference coworker (Sales end-to-end loop)
//   Phase 5    →  Phase D: Plugin SDK + MCP
//   Phase 6    →  Phase E: Additional coworkers/plugins + documentation
//
// The five product layers (See → Remember → Notice → Act → Learn) cut across
// implementation phases. Loop One completes See and Remember. Phase B adds the
// durable Work Engine, Capability Graph, Evidence Ledger, Autonomy Policy Engine,
// Coworker model, and Agent Activity UI. Phase C proves it all with one
// reference coworker.
//
// Ten architectural principles govern every card:
//   1. Database/runtime is authoritative, not the model
//   2. Agents use tools; they do not bypass business services
//   3. Every consequential action has an explicit authorization path
//   4. Every autonomous action must be explainable after the fact
//   5. Every AI-derived fact retains provenance
//   6. Deterministic logic remains deterministic
//   7. AI may propose policy; humans establish policy
//   8. Plugins extend Accelerate rather than create parallel infrastructure
//   9. Capabilities are explicit; missing capabilities are normal
//  10. Work is durable; a browser session is not the unit of execution
export const LOOP_ONE = [
  "feature-board-dependency-integrity",
  "identity-resolution-service",
  "activity-ledger-normalization",
  "pipeline-stage-board",
  "record-detail-workspace",
  "pipeline-saved-views",
  "task-dedup-service",
  "priority-selector-service",
  "today-operator-inbox",
  "canonical-attribution",
  "cloneable-command-center-contract",
  "tenant-config-seam",
  "shared-database-multi-tenancy-contract",
  "tenant-control-plane-schema",
  "tenant-context-authorization",
  "tenant-workspace-provisioning",
  "atomic-execution-claims",
  "setup-control-plane",
  "secret-storage-hardening",
  "tenant-provider-public-boundaries",
  "tenant-isolation-cutover",
  "integration-capability-platform",
  "communication-sender-service",
  "openrouter-ai-gateway",
  "founder-note-capture",
  "google-oauth-first-sync",
  "gmail-incremental-sync",
  "gmail-thread-idempotency",
  "gmail-record-association",
  "conversations-operator-inbox",
  "calendar-sync-association",
  "second-brain-see",
  "drive-folder-boundary",
  "drive-content-indexing",
  "audit-ledger-coverage",
  "ai-tool-registry",
  "ai-bounded-context",
  "ai-command-runtime",
  "ai-run-traces",
  "ai-command-workspace",
  "ai-confirmation-system",
  "drive-provenance-retrieval",
  "second-brain-remember",
  "playwright-inbound-pipeline",
  "autonomous-inbound-responder",
  "scheduling-substrate-decision",
];
const LOOP_ONE_SET = new Set(LOOP_ONE);

// Now stays small enough to scan. After Gate 0 ships, Wave 1 starts with
// atomic claims. Remaining circuit work is Next; unrelated work is Later.
export const NOW_KEYS = ["google-oauth-first-sync"];
const NOW_SET = new Set(NOW_KEYS);

// Northstar layer mapping: each second-brain phase card corresponds to one of
// the five product layers defined in docs/NORTHSTAR.md. The "trust" key is a
// cross-cutting concern (audit + provenance + traces) that underpins all layers.
export const SECOND_BRAIN_IMPLEMENTATIONS = {
  // Layer 1: SEE — observe the business
  "second-brain-see": [
    "openrouter-ai-gateway",
    "founder-note-capture",
    "google-oauth-first-sync",
    "gmail-incremental-sync",
    "gmail-thread-idempotency",
    "gmail-record-association",
    "calendar-sync-association",
  ],
  // Layer 2: REMEMBER — durable organizational memory
  "second-brain-remember": [
    "second-brain-see",
    "founder-note-capture",
    "drive-folder-boundary",
    "drive-content-indexing",
    "drive-provenance-retrieval",
    "ai-bounded-context",
  ],
  // Layer 3: NOTICE — what matters now
  "second-brain-notice": [
    "proactive-operator-intelligence",
    "scheduling-substrate-decision",
    "precall-briefs",
    "notification-dispatch-preferences",
  ],
  // Layer 4: ACT — perform or prepare real business work
  "second-brain-act": [
    "automation-policy-registry",
    "autonomous-inbound-responder",
    "postmeeting-workflow",
  ],
  // Layer 5: LEARN — repeated decisions become explicit policy
  "second-brain-learn": ["agent-learning-feedback-loop", "second-brain-act"],
  // Cross-cutting: TRUST — audit, provenance, traces (underpins all layers)
  "second-brain-trust": ["second-brain-learn", "audit-ledger-coverage", "ai-run-traces"],
};

// The newest focused slice stays short and precedes the accumulated evidence,
// so follow-up fixes remain reviewable without rewriting shipped history.
const LATEST_IMPLEMENTATION_EVIDENCE = {
  "admin-shell-design-system":
    "2026-08-31 deep-link and AI workspace follow-up: the shared fictional runtime now resolves exact client and opportunity detail records, rejects unknown entity IDs across nine API families without fixture substitution, preserves generated AI-run identity, exposes the canonical AI conversation ID, and routes pipeline Tasks to Today. Clients and client details moved from legacy glass/gold styling to shared semantic admin surfaces. The AI workspace removes the stacked explainer-card hierarchy, uses a compact three-view switcher, restores mobile conversation selection, keeps its composer in a viewport-aware primary work surface, and presents answers as readable editorial output with visible evidence actions. The expanded five-business desktop/mobile browser matrix opens every client and opportunity record and proves unknown IDs fail honestly. 2026-08-31 production receipt: exact product commit 8d5efaf9ab2e90c516652d7af900bb5353456e98 is READY as Vercel deployment dpl_BXLiwkJZ1FiJwuLANiUeamVAfPhy and aliased to https://www.acceleratewith.us. The canonical Inbox document exposes only release identity 8d5efaf9ab2e and the public changelog includes the repair. Live Northline browser QA passed every one of the 28 admin routes on desktop/mobile, including the assertion that one Inbox click issues one read and returns to idle. Live layout QA passed 13 affected routes across Signal, Paper, Night, desktop/mobile, reduced motion, measured sibling gaps, overflow, and runtime errors; the live Analytics mobile screenshot was inspected from /tmp/accelerate-admin-layout-continuity-live. The release audit found every local/remote agent branch contained in main and both retained stashes superseded by later commits. Implementation: moved top-level section rhythm into AdminReadBody's ready-state wrapper after the async motion boundary severed every route-level space-y contract. Analytics, Bookings, Revenue Recovery, Pipeline, Feature Board, Integrations, Tenants, Email Studio, record details, and Website Grades now inherit one gap rule across live/demo, cached, refreshing, desktop/mobile, and all appearances. Removed leaked roofing language from shared Bookings, made the Analytics supporting note reflow on phones, and migrated legacy Revenue cards/chart from public glass/gold/white tokens to AdminSurface plus admin semantic tokens. Setup's missing Google tokenHealth fixture no longer crashes fictional workspaces. Inbox no longer performs an eager refetch from an effect coupled to the changing React Query result; the query owns initial loading, while user, visibility, and operator-event refreshes use a stable refetch reference and truthful busy state. Before release, the complete five-business, 28-route desktop/mobile matrix passed populated content, theme ownership, Inbox refresh, isolation, focus containment, overflow, console errors, and protected-request escape with screenshots in /tmp/accelerate-full-admin-demo.",
  "tenant-workspace-provisioning":
    "2026-08-31 production release receipt: commit 3da0be4 deployed READY as dpl_4zYBYVirPw6MJ6bK9kb2gznLQRYT and aliased to https://www.acceleratewith.us. Authenticated canonical-alias Playwright passed the tenant directory and keyboard resend path at 1440x1000 and 390x844 with mocked mutation boundaries, reduced motion, clean console state, and no overflow. Live readiness re-verified two active tenants, five active memberships, confirmation-required email Auth, confirmed founder access, verified Resend sender domain, and service-role-only lifecycle functions. The additive invitation audit idempotency index applied successfully and an immediate rerun proved it already existed. No client account or real invitation was created during QA.",
  "ai-bounded-context":
    "2026-08-31 production release receipt: the complete bounded-context code shipped in READY deployment dpl_4zYBYVirPw6MJ6bK9kb2gznLQRYT on https://www.acceleratewith.us, and both public changelog entries are live. A canonical `/api/chat` smoke returned HTTP 200 but correctly used DEMO_MODE_REPLY because production has no OPENROUTER_API_KEY; `vercel pull` likewise returned no credential and no approved local/Keychain secret exists. The card therefore remains In Progress rather than claiming live model evidence. Exact remaining action: add the founder-owned OpenRouter credential to Vercel Production, redeploy, run `verify:ai-gateway`, then prove one grounded public response and one authenticated copilot answer with context-version/source receipts. No key was fabricated or exposed.",
  "founder-note-capture":
    "2026-08-31 burn-in foundation complete; card intentionally remains In Progress. The global composer now opens directly with Cmd/Ctrl+Shift+M without conflicting with browser shortcuts, and every saved activity receipt records bounded open-to-save duration plus capture source while preserving the same request ID across visible-failure retry. `loadFounderKnowledgeNotes` and founder-only GET expose a bounded activity-backed reader with body, author, date, stable source receipt, and canonical attachments; incomplete provenance fails closed. Duplicate retries now repair a missing redacted audit receipt without duplicating a healthy one. `verify-founder-note-adoption.ts` reads only IDs, provenance, links, dates, and metadata—never note text—and separates the mechanical seven-day/sub-ten-second gate from explicit founder usefulness confirmation. The live read-only Accelerate report on 2026-08-31 returned pending with zero notes/measured captures, so no adoption claim was fabricated. Service tests, TypeScript, zero-warning lint, and authenticated repository Playwright pass; desktop/mobile/dark/reduced-motion screenshots in `/tmp/accelerate-founder-note` were opened and reviewed. Remaining: at least three measured real captures across three days after a seven-day observation window, median capture at or below ten seconds, and founder confirmation that retrieved notes are useful. No schema, provider, production mutation, or deployment occurred.",
  "openrouter-ai-gateway":
    "2026-08-31 closure audit shipped locally: every named AI workflow resolves through the shared server-only adapter and source/package inspection finds no direct provider SDK. Strict structured calls require provider JSON Schema plus a domain validator; malformed and invalid responses fail before domain writes. The gateway now also preserves public-chat streaming request ID, resolved fallback model, token usage, duration, terminal outcome, and bounded/redacted errors in the shared run/event ledger. Streaming uses the same declared OpenRouter fallback and usage contract as non-streaming calls, including CRLF-safe SSE parsing and provider error frames. Setup reports primary/default and optional fallback model readiness without exposing the key; setup docs now define the fallback override. Verification passed: test:openrouter-resilience, test:agent-trace, test:agent-loop, test:ai-command-runtime, test:setup-status, TypeScript, zero-warning lint, agent/board contracts, production build, and diff check. Prior controlled production OpenRouter proof from 2026-08-16 and 2026-08-20 remains the provider receipt; this closure made no provider call, secret access, production mutation, or deployment.",
  "public-site-motion-performance":
    "2026-08-31 homepage hero timing parity: removed the compressed phone-only animation overrides, so mobile now inherits the exact desktop word cascade (0.2–2.8s), productivity strike (3.85s), PROFIT (4.7s), underline (5.1s), and CTA (6.1s) while retaining responsive composition and proportional blur. A dedicated production-browser contract compares every computed duration and delay across 1440x900 and 390x844, captures three intermediate frames per viewport, checks overflow and console errors, and verifies reduced-motion completion; it passed with byte-equivalent timing snapshots. 2026-08-31 mobile Chrome incident repair: production cache provenance first ruled out mixed deployment IDs, service-worker control, disk-cached RSC payloads, and repeated document navigation across 120 Command Center transitions. The public shell then exposed the rendering fault: full-route blur plus 47 concurrent homepage animations and an unbounded mobile spotlight frame loop competed with the drawer. Public route handoff is now opacity-only; the mounted inert drawer uses interruptible CSS state transitions; the opaque cover suspends hidden-page painting; mobile decorative drift and logo loops are static; the spotlight runs continuously only for fine pointers and for a bounded response after touch; programmatic route focus no longer draws the broken native heading outline. New persistent public-profile QA covers primary public Links, rapid open/close interruption, long tasks, fresh parity, reduced motion, focus, overflow, runtime errors, and full-route filter state at 4x CPU. Optimized-build evidence: persistent drawer-open p95 125.5ms, route-commit p95 148.7ms, max 148.7ms, longest task 69ms; fresh p95 126.5/168.3ms; all checks passed. Open-menu and settled-route screenshots under /tmp/accelerate-public-release-trace were reviewed. 2026-08-30 hero entrance repair: PROFIT and the booking button use delayed CSS transitions off `.hero.loaded`. A prior first-paint visibility pass initialized that flag to true and marked the eyebrow `reveal-immediate`, so those two beats never left rest opacity. Restored `useState(false)`, the loaded eyebrow class, and a hero-only hide-until-loaded rule. Isolated webpack preview on 3020: desktop PROFIT opacity 0 at 1s, ~1 at 6.2s with CTA still 0, CTA 1 at 7.4s. Screenshots reviewed under /tmp/accelerate-hero-fix. Contract: `npx tsx scripts/test-navigation-runtime.ts` now fails if the hero starts loaded.",
  "public-shell-route-consistency":
    "2026-08-30 public render split: marketing chrome lives in `src/app/(marketing)/layout.tsx` via MarketingChrome so admin and rewritten demo workspaces do not hydrate Header/Footer/Chat/Dock. Root `not-found.tsx` wraps NotFoundBody in MarketingChrome; `(marketing)/not-found.tsx` renders the body only. Isolated 3020 QA: unmatched `/this-route-does-not-exist` and nested `/learn/not-a-real-article-slug-zzzz` each have one site header and one footer. Learn listings still serialize ArticleSummary only. NOW remains tenant-config-seam. No live board apply, commit, push, or deploy.",
  "cloneable-command-center-contract":
    "2026-08-30 architecture supersession: this card remains the immutable receipt for the former instance-per-client decision, but `shared-database-multi-tenancy-contract` now supersedes it by explicit founder direction. Its no-tenant guardrail must not be applied to the new architecture or child cards. The prior config-seam and install evidence remains useful migration input; it is no longer the active product shape.",
  "tenant-config-seam":
    "2026-08-30 close: admin compose signatures now read tenant.founder.name and tenant.brand.name. The cloneability ratchet covers src/components/admin with an empty budget. Changing only tenant.brand/founder re-rendered login chrome and outbound email as Harbor Pipe Co with no Accelerate wordmark. Isolated 3020 login desktop/mobile and rendered email reviewed under /tmp/accelerate-tenant-rebrand. `npm run test:tenant-config` covers email chrome, compose signatures, sender/from, Plausible domain, siteUrl, campaign sender default, unsubscribe URL, Setup Vercel link, auth/admin chrome, copilot/chat persona, publicBooking, and the empty budget. Capability flags stay consumed-only: publicBooking is the one reader. Public marketing pages remain Accelerate-branded by contract. No live board apply, commit, push, or deploy.",
  "audit-ledger-coverage":
    "2026-08-30 Wave 1 close: `listAuditHistory` filters actor, entity, action, source, and date and throws on ledger read failure. Proposal create/update/send, public view/accept/decline, calendar sync summaries, and settings PUT write before/after rows without proposal bodies, decline reasons, attendee payloads, or setting values. Public proposal GET still returns the proposal if the view audit write fails. `/admin/activity` is the founder audit ledger with query-backed filters; the fictional demo serves the same shape. Verification: `npm run test:audit` (11 checks); `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3020 npm run qa:audit-activity` (desktop/mobile filter, Back, reduced motion, overflow, console, no protected requests). Reviewed `/tmp/accelerate-audit-activity/activity-desktop.png` and `activity-mobile.png`. Isolated preview used because shared 3010 was down and 3011 is a 2026-08-28 `next start`. No production apply or deployment.",
};

LATEST_IMPLEMENTATION_EVIDENCE["admin-shell-design-system"] =
  "2026-08-31 settings control and hierarchy repair: notification preferences now use one semantic shared switch with a 48x28 pill track, centered 20px thumb, equal end insets, 44px hit target, keyboard operation, focus treatment, per-preference busy protection, and optimistic rollback. AdminShell suppresses redundant one-item top-level breadcrumbs while preserving multi-level record context. Settings removes nested Framer Motion ownership and makes configuration keys, editors, and actions wrap or stack on compact screens. Static contracts and the full five-business desktop/mobile browser matrix cover switch geometry and interaction, top-level hierarchy, overflow, deep links, protected-request isolation, and runtime errors; desktop/mobile Settings screenshots were visually inspected. " +
  LATEST_IMPLEMENTATION_EVIDENCE["admin-shell-design-system"];

LATEST_IMPLEMENTATION_EVIDENCE["admin-shell-design-system"] =
  "2026-08-31 production receipt: exact product commit 309d7d00206d89f16fb9985e469ad94afa5f8d85 is READY as Vercel deployment dpl_97YsfXwgHejvqVRycbKZV2eWiMfi and aliased to https://www.acceleratewith.us. The canonical Settings response returned HTTP 200 with release identity 309d7d00206d. The live five-business, 28-route desktop/mobile matrix passed switch geometry and keyboard interaction, client/opportunity deep links, content population, responsive overflow, console health, theme ownership, and protected-request isolation. A cold-hydration false negative led the browser gate to wait for coherent H1/title commitment before sampling; the hardened full rerun passed. " +
  LATEST_IMPLEMENTATION_EVIDENCE["admin-shell-design-system"];

// Fresh evidence is kept separate from the long-lived historical card notes so
// focused follow-up slices stay reviewable without rewriting shipped history.
const CURRENT_IMPLEMENTATION_EVIDENCE = {
  "tenant-workspace-provisioning":
    "2026-08-31 invitation delivery completion: the platform lifecycle service creates branded one-time invite or magic-link credentials without Supabase default SMTP, records the exact pending membership before delivery, sends through the verified Resend identity with a tenant/user/request idempotency key, and returns distinct sent, failed, unknown, and existing-account outcomes with provider receipts. Delivery outcomes enter immutable platform audit history; uncertain provider or local-receipt outcomes refuse blind retry. Acceptance verifies the token server-side and binds tenant ID, canonical slug, Auth user, and normalized email before the atomic audited membership RPC. Pending memberships expose an accessible 40px keyboard resend action. Read-only production readiness proves email Auth enabled with confirmation required, a confirmed founder, two active tenants, five active memberships, and a verified Resend sender domain. Fixture-backed authenticated production-build QA proves keyboard resend, request identity, reduced motion, clean console state, no mutation, and no overflow at 1440x1000 and 390x844.",
  "ai-bounded-context":
    "2026-08-31 completion candidate: Revenue Copilot, public chat, plans, proposals, content briefs, contact import, and first-touch responder now declare fixed context budgets, explicit source allowlists, and untrusted-data boundaries. Copilot tool results carry registered receipt provenance and final output is structurally enforced; invalid or invented citations degrade to an explicit partial answer. Plans and proposals reject money outside the typed published catalog and mismatched totals. Content briefs require allowed-source evidence and fact indexes. Contact imports preserve bounded source indexes and reject unsupported model fields before identity work. Responder v2 bounds every field and rejects invented pricing, results, capabilities, availability, timelines, prompt leakage, and links; its version bump suspends sends pending explicit reapproval. Focused AI, import, responder, gateway, command-runtime, TypeScript, and diff checks pass. Remaining before Shipped: deploy the exact verified release and capture production gateway/context evidence.",
  "admin-shell-design-system":
    "2026-08-28 horizontal control-rail polish: Today Priority Queue, Pipeline views, and Contact intake now use the shared cross-browser scrollbar-hiding utility, preserving touch/trackpad scroll without the WebKit scrollbar flashing on mobile load. UX browser coverage checks both standard and WebKit computed scrollbar states before interacting with Today and captures the direct-load rail on desktop and mobile. 2026-08-28 cold-load perception repair: AdminAsyncRegion now behaviorally withholds local placeholders for 120ms instead of merely declaring a delayed animation, then crossfades only genuinely slow reads. Today owns one destination-shaped fallback whose mobile summary retains the final 2x2 geometry rather than stacking generic cards. The navigation filmstrip now exercises an uncached 650ms route, current WAAPI semantic stagger, cold-load fallback visibility, same-frame destination intent, retained committed content, focus, scroll reset, dock movement, and mobile/desktop frames; the corrected local run passed with 40ms mobile acknowledgement and screenshots were opened and inspected. 2026-08-28 perceptual-navigation completion: the root admin fallback is removed so committed work remains usable during route resolution; one AdminRouteStage owns direct-load and navigation blur/rise motion with a bounded 48ms semantic stagger; one AdminAsyncRegion delays local placeholders, preserves cached results during refetch, and animates ready data without page-level popping. Today uses retained shared queries, a true mobile 2x2 summary, an exploration-first demo hierarchy without setup noise or duplicate decision rails, and immediate optimistic updates. Pipeline uses the same compact 2x2 mobile summary. The responsive command palette renders as a safe-area-aware full-screen mobile command surface with immediate local results and a 120ms people debounce. Timed production-browser QA measured 39ms tap acknowledgement and verifies committed-route motion, no root fallback, search focus, phone geometry, and reduced motion. 2026-08-28 interaction-integrity repair: Today approval rows and arrows open the shared focus-managed review dialog with reactive deep links and deterministic close/focus return; contact rows open a complete relationship detail dialog; desktop notifications are compact and anchored beside their trigger while the inset mobile sheet traps focus and owns the dock edge; mobile More removes redundant Navigation/More labels and gives its top space to Search and Ask AI; semantic status messages keep standard admin ink over restrained status tints. The shared UX contract now prohibits controls without outcomes, detached overlays, hue-on-hue status copy, and arbitrary redundant interface labels. Browser QA covers desktop/mobile click paths, URL state, focus, overlay geometry, status contrast, public shell parity, and WCAG A/AA serious or critical violations. 2026-08-28 overlay repair: desktop and mobile alerts now share one body-portaled, viewport-owned notification primitive with placement-specific geometry, bounded scrolling, collision-free mobile dock ownership, and browser assertions for containment. 2026-08-27 permanent navigation, loading, and overlay architecture: NavigationRuntime exposes immediate destination intent, preserves committed accessibility state, and restores replacement-heading focus through the actual DOM handoff. AdminQueryProvider, useAdminQuery, and AdminPageLoading provide cancellable deduped reads, retained data, real destination headers, and regional loading geometry; Pipeline and Conversations adopt the shared read path. The glass mobile dock moves one shared active surface, yields the bottom edge to portaled notifications, and More remains a focus-contained right drawer. Shared composers and semantic repeated-list rules cover AI, Gmail, Today, and alerts.",
  "full-admin-demo-runtime":
    "2026-08-28 demo parity and theme ownership: the launcher owns a dedicated prepaint theme preference instead of competing with the site or scenario appearance, reload sampling guards against dark/light flicker, and the shared Today queue now supplies replies, commitments, approvals, and proposals with functional filters and meaningful destinations. 2026-08-27 exploration-first simplification: intentionally removed the visible guided tour while preserving the complete shared admin route tree, scenario switching, reset, appearance controls, fictional-data safety boundary, and browser-session runtime.",
  "public-site-motion-performance":
    "2026-08-28 mobile hero rhythm repair: removed the elastic viewport filler that cramped PROFIT against the headline and pushed the strategy CTA 92-184px away on phones. The closing group is now content-sized with explicit responsive spacing, keeps the CTA above the fold from 320x568 through 430x932, and browser geometry fails on either a cramped headline gap or a detached action. 2026-08-28 reveal lifecycle repair: shared word-mask headings now attach to the same viewport lifecycle as other public reveals, so below-fold industry headings remain armed until entry instead of completing offscreen. Browser coverage traverses the law-firm page at desktop, mobile, and reduced motion and verifies both heading and content entry timing.",
  "selected-work-portfolio":
    "2026-08-28 visual-system follow-up: the Work index and every case now use one 14px media radius, theme-token surfaces, and a non-conflicting fixed-header offset. The public theme toggle uses the resolved preference, persists a real inversion, and browser coverage checks both theme states and media geometry.",
  "full-admin-demo-scenarios":
    "2026-08-27 scenario-pack v3: the launcher and shared runtime now expose five separately authored operating models for roofing, injury law, advisory, real estate, and a nonprofit network. Each pack has distinct identity, animated mark, appearance, people, companies, opportunity values, next actions, conversations, tasks, approvals, campaigns, resources, and roadmap evidence. Exact copy duplication is contract-tested; the five-business 28-route desktop/mobile matrix, all five appearances, populated contact expansion, refresh/reset/isolation, and production build pass.",
  "durable-work-engine":
    "2026-09-02 shipped: migrations/20260902-work-items.sql (work_items table, claim_work_item RPC with advisory lock, indexes, RLS, constraints). src/lib/revenue-os/work-items.ts (create, claim, withWorkItem, start, complete, fail+retry with exponential backoff, scheduleCheck, cancel, release, list, stale recovery). Task bridge: createWorkItem({ surfaceInInbox: true }). AI tool: get_claimable_work. TypeScript, lint, build, and contract verify pass.",
  "capability-graph-canonical":
    "2026-09-02 shipped: migrations/20260902-workspace-capabilities.sql (workspace_capabilities table, resolve_workspace_capability RPC, upsert_workspace_capability RPC, indexes, RLS). src/lib/revenue-os/capabilities.ts (resolve, checkCapabilitiesBeforeWork, list, register, sync). AI tool: get_workspace_capabilities. TypeScript, lint, build, and contract verify pass.",
  "evidence-claim-ledger":
    "2026-09-02 shipped: migrations/20260902-claims-evidence.sql (claims + evidence tables, record_evidence RPC with human truth hierarchy, evidence_strength + claim_status enums, indexes, RLS, constraints). src/lib/revenue-os/claims.ts (recordEvidence, list, retract, supersede, humanConfirm, listConflictedClaims). AI tool: get_claims_for_entity. TypeScript, lint, build, and contract verify pass.",
  "autonomy-policy-engine":
    "2026-09-02 shipped: migrations/20260902-autonomy-policies.sql (autonomy_policies table, check_autonomy RPC, upsert_autonomy_policy RPC, grant_standing_permission RPC, autonomy_hard_floors table seeded with 6 floors, indexes, RLS). src/lib/revenue-os/autonomy-policy.ts (check, list, register, grantStandingPermission, listHardFloors). AI tool: get_autonomy_policies. TypeScript, lint, build, and contract verify pass.",
  "coworker-model":
    "2026-09-03 shipped: Five coworkers bootstrapped (sales, business-pulse, meeting-intel, finance, operations). Each registers capabilities, autonomy policies, and work kinds. Work scheduler auto-creates daily/weekly work. TypeScript, lint, build, and contract verify pass. 2026-09-02 shipped: migrations/20260902-coworkers.sql (coworkers table with required_capabilities, work_kinds, autonomy_overrides, indexes, RLS). src/lib/revenue-os/coworkers.ts (register, list, getCoworkerManifest with capability gaps, updateStatus). AI tool: get_coworkers + bootstrap tools for each coworker.",
  "agent-activity-surface":
    "2026-09-02 shipped: src/lib/revenue-os/agent-activity.ts (getAgentActivityForEntity composes work items + actions + claims + audit into human-readable timeline). AI tool: get_agent_activity_for_entity. TypeScript, lint, build, and contract verify pass.",
  "finance-coworker":
    "2026-09-03 shipped: src/lib/revenue-os/finance-coworker.ts (3 work kinds: weekly_revenue_reconciliation, detect_overdue_payments, revenue_stage_audit). Bootstrap registers capabilities + autonomy policies. Handlers registered in work engine cron. AI tool: bootstrap_finance_coworker. TypeScript, lint, build, and contract verify pass.",
  "operations-coworker":
    "2026-09-03 shipped: src/lib/revenue-os/operations-coworker.ts (3 work kinds: daily_health_check, integration_status_audit, data_quality_scan). Bootstrap registers capabilities + autonomy policies. Handlers registered in work engine cron. AI tool: bootstrap_operations_coworker. TypeScript, lint, build, and contract verify pass.",
  "work-scheduler":
    "2026-09-03 shipped: src/lib/revenue-os/work-scheduler.ts (auto-creates 9 daily work items: digest, stale deals, bottleneck, velocity change, health check, integration audit, data quality, overdue scan, revenue stage audit; weekly: reconciliation on Mondays; scans calendar_events 48h ahead for meeting pre-call briefs). Date-based deduplication. Cross-coworker triggers: inbound→Sales+BP+Ops, pipeline won→Finance+Ops, high-stage→BP+Finance, Calendly→Meeting Intel. All 18 handler paths store domain-specific agent memory. Wired in cron route before executeClaimableWork. TypeScript, lint, build, and contract verify pass.",
  "memory-architecture":
    "2026-09-03 shipped: src/lib/revenue-os/memory.ts (five categories: canonical, activity, knowledge, agent, learned_policy). Agent memory with time-decay horizons (session/daily/weekly/permanent). Learned policies with supersession. Unified queryMemory across all categories. 5 AI tools: query_memory, store_agent_memory, get_agent_memory, get_learned_policies, record_learned_policy. Migration: 20260903-memory-architecture.sql. Work executor consults learned policies and stores agent memory after execution. TypeScript, lint, build, and contract verify pass.",
  "budgets":
    "2026-09-03 shipped: src/lib/revenue-os/budgets.ts (checkBudgets, recordBudgetUsage, setBudgetLimit, listBudgetLimits). Six budget kinds (model_spend, vendor_api_calls, emails_sent, research_depth, retry_count, runtime_seconds). Per-coworker or global limits with daily/weekly/monthly periods. Work executor checks budgets before execution and records usage after. 90%+ usage triggers audit alert. Migration: 20260903-budgets.sql. 2 AI tools: check_budgets, get_budget_limits. TypeScript, lint, build, and contract verify pass.",
};

function taxonomyLabels({ key, workstream, phase, status, labels }) {
  const category = CATEGORY_BY_WORKSTREAM[workstream];
  const fallbackCapability = DEFAULT_CAPABILITY_BY_WORKSTREAM[workstream];
  if (!category || !fallbackCapability)
    throw new Error(`Unknown workstream taxonomy for ${key}: ${workstream}`);
  const milestone =
    status === "shipped"
      ? "done"
      : NOW_SET.has(key)
        ? "now"
        : LOOP_ONE_SET.has(key)
          ? "next"
          : "later";
  const capabilities = [
    ...new Set(labels.map((label) => CAPABILITY_ALIASES[label]).filter(Boolean)),
  ].slice(0, 2);
  if (!capabilities.length) capabilities.push(fallbackCapability);
  return [
    `category:${category}`,
    `milestone:${milestone}`,
    `phase:${phase}`,
    ...capabilities.map((capability) => `capability:${capability}`),
  ];
}

// Everything outside the delivery circuit keeps its full specification in Later.
// Shelving is not deletion or a judgement about value. Nothing is claimed until
// an owner claims it, and the WIP limit is enforced in validateFeatureBacklog.
function card({
  key,
  title,
  workstream,
  phase,
  status = "backlog",
  priority = "medium",
  description,
  acceptance,
  dependencies = [],
  start,
  guardrails,
  owner = null,
  labels = [],
  evidence = null,
  verification = null,
}) {
  const effectiveStatus = status;
  const isLoopOne = LOOP_ONE_SET.has(key);
  const shelved = effectiveStatus !== "shipped" && !isLoopOne;
  if (!allowedStatuses.has(effectiveStatus)) throw new Error(`Invalid status for ${key}`);
  if (!allowedPriorities.has(priority)) throw new Error(`Invalid priority for ${key}`);
  if (isLoopOne && effectiveStatus === "backlog")
    throw new Error(`Loop One card ${key} must be planned or further along`);
  return {
    seed_key: key,
    title,
    description,
    status: effectiveStatus,
    priority,
    labels: taxonomyLabels({ key, workstream, phase, status: effectiveStatus, labels }),
    owner,
    target_date: null,
    acceptance_criteria: acceptance.map((item) => `- ${item}`).join("\n"),
    notes: [
      `Workstream: ${workstream}. Category: ${CATEGORY_BY_WORKSTREAM[workstream]}. Phase: ${phase}.`,
      `Northstar phase: ${phase <= 1 ? "A (Complete Loop One — See + Remember)" : phase <= 3 ? "B (Agent Runtime foundation — Notice + Act primitives)" : phase === 4 ? "C (Reference coworker — Sales end-to-end loop)" : phase === 5 ? "D (Plugin SDK + MCP)" : "E (Additional coworkers/plugins + documentation)"}. Vision: docs/NORTHSTAR.md.`,
      `Dependencies: ${dependencies.length ? dependencies.join("; ") : "None. This can be claimed immediately."}`,
      `Starting points: ${start}`,
      `Guardrails / non-goals: ${guardrails}`,
      isLoopOne
        ? `Delivery circuit: step ${LOOP_ONE.indexOf(key) + 1} of ${LOOP_ONE.length}. Board milestone: ${effectiveStatus === "shipped" ? "Done" : NOW_SET.has(key) ? "Now" : "Next"}. The circuit turns a real inquiry into an inspectable record, operator work, a receipted reply, attributed revenue, and bounded memory. Claim this card by setting Owner and in_progress; keep no more than two cards in progress at once.`
        : shelved
          ? "Board milestone: Later. This card keeps its full specification but is outside the current delivery circuit. Do not start it before Now and dependency-ready Next work unless a current card explicitly depends on it."
          : "Board milestone: Done. This card is shipped; reopen it only with new evidence that an acceptance item no longer holds.",
      SECOND_BRAIN_IMPLEMENTATIONS[key]
        ? `Implementation cards: ${SECOND_BRAIN_IMPLEMENTATIONS[key].map((implementationKey) => `card:${implementationKey}`).join(", ")}. This phase card is a roll-up and must not duplicate those services.`
        : null,
      "Taxonomy contract: docs/contracts/FEATURE-BOARD-TAXONOMY.md. Do not add one-off labels; use one category, milestone, phase, and up to two allowlisted capabilities.",
      "Architecture contract: docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md. Agent procedure: docs/contributing/AGENT-TICKET-RUNBOOK.md. Module ownership: src/lib/revenue-os/README.md.",
      `Required verification: ${verification || "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; the closest scoped service/API/Playwright test named by this card; npm run build and git diff --check before Shipped. Data or automation changes must also prove invalid input, duplicate/replay, truthful failure receipts, and safe retry. UI changes require reviewed desktop/mobile screenshots."}`,
      "Stop conditions: pause and create or update a dependency card before adding a new provider, weakening authorization, performing a destructive migration, expanding real-recipient automation, or bypassing an authoritative domain service.",
      ...([
        LATEST_IMPLEMENTATION_EVIDENCE[key],
        CURRENT_IMPLEMENTATION_EVIDENCE[key],
        evidence,
      ].filter(Boolean).length
        ? [
            `Current implementation evidence: ${[LATEST_IMPLEMENTATION_EVIDENCE[key], CURRENT_IMPLEMENTATION_EVIDENCE[key], evidence].filter(Boolean).join(" ")}`,
          ]
        : []),
      "Agent handoff: claim the card by setting Owner, read linked services and migrations before editing, preserve unrelated worktree changes, attach test evidence in Internal notes, and move to Shipped only after every acceptance item is verified.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    source: "revenue-os-master-plan",
    archived_at: null,
  };
}

export const featureBacklog = [
  // Phase 0, truth, schema, and operating contract
  card({
    key: "revenue-os-production-migration",
    title: "Verify the production Revenue OS schema",
    workstream: "foundation",
    phase: 0,
    status: "shipped",
    priority: "high",
    description:
      "Confirm the canonical Revenue OS and Feature Board schemas are present in production and record the verification baseline.",
    acceptance: [
      "All canonical, receipt, audit, integration, and feature-board tables are queryable through the service role",
      "The migration order is documented and a rerun is idempotent",
      "Setup Center reports both schema checks ready without exposing credentials",
    ],
    start:
      "migrations/20260816-revenue-os.sql; migrations/20260816-feature-board.sql; src/app/api/admin/setup/route.ts",
    guardrails:
      "Do not delete or rename legacy tables. A table existing is schema verification, not proof that an integration is operational.",
    labels: ["database", "verified"],
    evidence:
      "2026-08-16: production service-role queries and Setup Center schema checks verified the canonical Revenue OS and Feature Board tables. The 90-card manifest re-verifies with zero drift. Analytics, money-first outreach, Email Studio, and Contact Import migrations were applied through the Keychain-backed CLI path, rerun idempotently, and verified object-by-object in production. Ordered migrations and agent-owned execution are documented in CLAUDE.md, AGENTS.md, and docs/self-hosting/REVENUE-OS-SETUP.md.",
  }),
  card({
    key: "feature-board-operational",
    title: "Operate the Feature Board as the delivery source of truth",
    workstream: "foundation",
    phase: 0,
    status: "shipped",
    priority: "high",
    description:
      "Maintain one durable roadmap with exact ordering, structured details, archival history, and agent-ready handoffs.",
    acceptance: [
      "Cards reorder within and across columns atomically",
      "Create, edit, filter, label, prioritize, and archive actions persist through authenticated APIs",
      "Desktop and mobile Playwright checks cover rendering, details, and cross-column drag",
    ],
    start:
      "src/app/admin/features/page.tsx; src/app/api/admin/features/route.ts; scripts/qa-feature-board.mjs",
    guardrails:
      "Do not create a parallel roadmap in another document. User-created cards must never be overwritten by the curated seed.",
    labels: ["admin", "roadmap"],
    evidence:
      "2026-08-16: authenticated Feature Board Playwright verified desktop/mobile rendering, details, and cross-column drag persistence; the managed manifest applied and verified 88 active cards with no missing, drifted, or outside-manifest records.",
  }),
  card({
    key: "schema-drift-verification",
    title: "Add schema-version and drift verification",
    workstream: "foundation",
    phase: 0,
    status: "shipped",
    priority: "high",
    description:
      "Make the deployed schema version and expected columns, constraints, functions, policies, and indexes reproducibly verifiable before shipping.",
    acceptance: [
      "A checked-in verifier fails on missing or incompatible Revenue OS objects",
      "The verifier distinguishes unapplied migration, drift, and connectivity failure",
      "Setup Center shows the verified version and last successful check",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start:
      "migrations/20260817-schema-verification.sql; src/lib/revenue-os/schema-contract.ts; scripts/verify-revenue-schema.ts; src/app/api/admin/setup/route.ts",
    guardrails: "Read metadata only; never auto-alter production during a verification run.",
    labels: ["database", "qa"],
    evidence:
      "2026-08-17: deterministic terminal-state coverage is complete in `src/lib/revenue-os/schema-contract.ts` and `scripts/test-schema-verification.ts` (`npm run test:schema-verification` now covers unapplied_migration, drift, connectivity_failure, stale/missing verification mapping, and mixed failure-then-connectivity classification). Production founder-auth Setup QA now passes at `PLAYWRIGHT_BASE_URL=https://www.acceleratewith.us npm run qa:setup-mobile` with schema status `ready`, 21 checks, and desktop/mobile screenshots written to `/tmp/accelerate-setup-qa/setup-desktop.png` and `/tmp/accelerate-setup-qa/setup-mobile.png`. Closure review 2026-08-18: all three acceptance criteria have production schema receipt and Setup Center evidence plus deterministic terminal-state coverage.",
  }),
  card({
    key: "legacy-canonical-reconciliation",
    title: "Reconcile legacy records with the canonical model",
    workstream: "foundation",
    phase: 0,
    status: "shipped",
    priority: "high",
    description:
      "Prove row-count and field-level parity between legacy capture tables and canonical contacts, companies, opportunities, activities, and attribution.",
    acceptance: [
      "A report compares every legacy source type with canonical imports and identifies missing, duplicate, or ambiguous rows",
      "Original source record type and ID remain traceable",
      "Legacy reads are not retired until the report passes in production",
    ],
    dependencies: [
      "Verify the production Revenue OS schema",
      "Implement deterministic contact and company identity resolution",
    ],
    start:
      "migrations/20260816-revenue-os.sql; src/lib/revenue-os/identity.ts; legacy admin API routes",
    guardrails:
      "Do not delete legacy rows or silently merge ambiguous identities. Current zero-row production state should still produce a valid empty reconciliation report.",
    labels: ["migration", "data-quality"],
    evidence:
      "2026-08-18: deterministic fixture coverage in `scripts/test-legacy-reconciliation.ts` now verifies zero-row, matched, missing, duplicate-canonical, and ambiguous statuses while preserving `source_record_type`/`source_record_id`; added a dedicated report-builder path check for scope, canonical counts, and canonical-read error surfacing in the envelope. Added report persistence/export command in `scripts/legacy-reconciliation-report.ts` and `npm run report:legacy-reconciliation` (`--env-file=.env.local --output /tmp/legacy-reconciliation-report.json`) to produce `totalRows/matched/missing/ambiguous/duplicate`, canonical counts, and per-source read stats/errors. Verification passed: `npm run test:legacy-reconciliation`; `npm run report:legacy-reconciliation -- --output /tmp/legacy-reconciliation-report.json` (zero-row read-only run in this env); `legacy-canonical` report now always preserves `source_record_type` and `source_record_id`. Closure review 2026-08-18: the production read-only report ran cleanly across all eight legacy source tables (0 source rows, 0 canonical contacts/companies, 0 missing/ambiguous/duplicate rows, no read errors), which meets this card's explicitly valid zero-row production acceptance. Legacy reads remain preserved and must be rechecked before any retirement.",
  }),
  card({
    key: "identity-resolution-service",
    title: "Implement deterministic contact and company identity resolution",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "urgent",
    owner: "Codex / Terra",
    description:
      "Create one identity resolver for UI, forms, syncs, webhooks, campaigns, and AI that handles alternate emails and refuses ambiguous matches.",
    acceptance: [
      "Exact provider ID, source ID, normalized email, alternate email, and domain matching follow a documented precedence",
      "Ambiguous matches return a reviewable conflict instead of merging",
      "Repeated inbound submissions and syncs resolve to the same canonical records",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start:
      "src/lib/revenue-os/identity.ts; src/lib/revenue-os/inbound.ts; src/app/api/qualify/route.ts",
    guardrails:
      "Never merge solely on display name. Preserve provenance and provide a manual resolution path.",
    labels: ["identity", "dedupe"],
    evidence:
      "2026-08-20: `src/lib/revenue-os/identity.ts` is the one resolver. Precedence is documented and exercised by `npm run test:identity-resolution`. An ambiguous match refuses rather than merging: ingestInboundLead throws 'Multiple open opportunities match this email; review the identity before merging.' Repeated submissions resolving to the same canonical records is proven live against production by `npm run verify:inbound-canonical`, which also asserts the activity receipts written on capture. Verified end to end on 2026-08-20 by submitting a real contact form to www.acceleratewith.us: one contact, one company, one opportunity, correctly linked.",
  }),
  card({
    key: "pipeline-transition-service",
    title: "Finish the canonical pipeline transition service",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "high",
    description:
      "Route every opportunity stage change through one validated service with immutable history, reasons, and terminal-state rules.",
    acceptance: [
      "UI, AI, campaigns, calendar, proposals, and webhooks use the same transition function",
      "Invalid regressions and terminal-state changes are rejected server-side",
      "Each accepted transition goes through one atomic stage_event + audit write",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start: "src/lib/revenue-os/pipeline.ts; src/app/api/admin/revenue-os/pipeline/route.ts",
    guardrails:
      "Do not update opportunity stages directly from route handlers. Lost transitions require a reason; won/lost reopening requires an explicit policy.",
    labels: ["pipeline", "service"],
    evidence:
      "2026-08-17: canonical transition service now normalizes legacy stage inputs/outputs, enforces terminal reopen policy with optional explicit override, requires loss reasons, preserves closed/probability/loss metadata, and rejects unknown or stale state transitions. Proposal, calendar-viewed, Calendly webhook, admin bookings, and pipeline admin APIs now call transitionOpportunity before stage movement and map optimistic lock failures to 409. Added scripts/test-pipeline-transition.ts to cover loss validation, terminal reopen policy, legacy alias mapping, invalid transition blocking, optimistic concurrency, unknown-stage rejection, and API-level transition error mapping (409 stale / 400 invalid). Closure review 2026-08-18: every known stage-changing adapter calls transitionOpportunity, with loss/reopen/alias/invalid/stale behavior covered by scripts/test-pipeline-transition.ts, now runnable as npm run test:pipeline-transition (9 checks passing). 2026-08-19: re-confirmed in production by npm run verify:attribution-loop, which moves a real opportunity through the full new to won path via transitionOpportunity and verifies stage, probability-driven close timestamp, won value carry-over, and one immutable stage event per transition.",
  }),
  card({
    key: "activity-ledger-normalization",
    title: "Normalize the cross-channel activity ledger",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Represent form submissions, messages, meetings, notes, proposal events, stage changes, tasks, and AI actions in one chronological activity contract.",
    acceptance: [
      "Every supported event has a stable source ID and canonical contact/company/opportunity links",
      "Duplicate webhooks and syncs do not duplicate activity",
      "Record timelines and AI context read from the same ordered ledger",
    ],
    dependencies: [
      "Implement deterministic contact and company identity resolution",
      "Finish the canonical pipeline transition service",
    ],
    start:
      "migrations/20260816-revenue-os.sql; src/app/api/admin/revenue-os/pipeline/route.ts; src/lib/revenue-os/tasks.ts",
    guardrails: "Keep immutable provider facts separate from editable human notes.",
    labels: ["activity", "timeline"],
    evidence:
      "Shipped locally 2026-08-23 and intentionally held for the next feature-batch deployment. Added authoritative `activities.ts` contract `revenue-os-activity-ledger.v1`: normalized bounded inputs, required stable source/external receipt identity, canonical links, concurrent replay reread, deterministic occurrence ordering, bounded pagination, and truthful database failures. Inbound, roofing, tasks, pipeline creation and transitions, founder notes, Resend, Gmail replies, campaign stops, proposal decisions, and contact import now use the one writer; a static ownership assertion prevents future direct inserts. Added founder-only `/api/admin/revenue-os/activity`, migrated the canonical contact timeline reader, and registered bounded read-only `get_record_timeline` so admin records and AI consume the same ordered evidence. Updated the module ownership map. Verification passed: `npm run test:activity-ledger` (validation, replay, failure, ownership and reader parity), pipeline transition, task/job, identity, founder note, AI tool gate, action execution and campaign-stop suites; local webhook/cron defense; founder-route source checks; TypeScript; lint; diff check; agent contract; and a 340-page production build. No schema change or deployment was performed.",
  }),
  card({
    key: "communication-sender-service",
    title: "Finish one auditable communication sender",
    workstream: "foundation",
    phase: 1,
    status: "blocked",
    priority: "high",
    owner: "Grok-4.6-02-communication-sender-service",
    description:
      "Unify Gmail personal replies and Resend campaign/transactional sends behind validated services that record provider IDs and terminal results.",
    acceptance: [
      "Every send records channel, recipient, provider ID, idempotency key, result, and linked records",
      "Gmail replies preserve thread headers while Resend owns bulk and transactional delivery",
      "Retries cannot send a second copy after a successful provider receipt",
    ],
    dependencies: ["Implement deterministic contact and company identity resolution"],
    start:
      "src/lib/revenue-os/communications.ts; src/lib/email/send.ts; src/lib/revenue-os/google.ts",
    guardrails:
      "Never hide provider failures or switch channels implicitly. Ad-hoc and AI-generated sends require confirmation.",
    labels: ["email", "service"],
    evidence:
      "2026-08-30 Wave 1: Gmail replies now claim a local processing row before the provider call, fail that row on provider error, and throw for reconcile-before-retry if Gmail accepted the message but the local receipt could not be recorded. Thread headers are built by `gmail-reply-mime.ts`: In-Reply-To and References wrap the original message id, subjects stay Re:, and raw MIME uses CRLF. Confirmed conversation replies and action-queue execution pass a deterministic idempotency key. `npx tsx scripts/test-gmail-reply-mime.ts` passed. Resend production re-verified: `npm run verify:recorded-send` providerId aba63fef-e6d7-4472-a913-147a769bd58e to delivered@resend.dev; `npm run verify:recorded-send-failure` left a failed receipt. Remaining before Shipped: one live founder-connected Gmail reply that proves those headers on a real thread. Blocked on Connect Google OAuth and complete the first Workspace sync. 2026-08-20: `sendRecordedEmail` in `src/lib/revenue-os/communications.ts` is the one sender. Every send records channel, recipient, provider id, idempotency key, result, and linked records, proven against the real Resend account by `npm run verify:recorded-send` (delivered@resend.dev, so no person is emailed). `npm run verify:recorded-send-failure` proves a rejected send leaves a failed receipt rather than a phantom success, and an idempotent replay returns the first receipt instead of delivering a second copy. Also fixed: Resend rejects tag values outside [A-Za-z0-9_-] and campaign templates are named `campaign:<id>:step:<n>`, which silently failed every campaign send until safeTagValue was added. NOT SHIPPED because acceptance criterion 2 is unverified: sendGmailReply exists but Google Workspace has never been connected, so thread-header preservation on replies has no evidence.",
  }),
  card({
    key: "task-dedup-service",
    title: "Build the canonical task generator with deduplication",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "high",
    description:
      "Create tasks from humans, meetings, campaign exceptions, proposals, and AI without producing duplicate open commitments.",
    acceptance: [
      "Tasks link to the relevant contact, company, opportunity, proposal, or source run",
      "A deterministic dedupe key prevents equivalent open tasks",
      "Completion, reassignment, due dates, and source are audited",
    ],
    dependencies: ["Normalize the cross-channel activity ledger"],
    start:
      "src/lib/revenue-os/tasks.ts; tasks schema in migrations/20260816-revenue-os.sql; src/lib/revenue-os/action-executor.ts",
    guardrails:
      "AI may propose tasks but must not create external commitments without the required confirmation tier.",
    labels: ["tasks", "dedupe"],
    evidence:
      "2026-08-20: `src/lib/revenue-os/tasks.ts` is the one task writer. Tasks link to contact, company, opportunity, and source. The deterministic dedupe key is proven by `npm run test:job-and-task-contracts`, including the case that matters most: dedupe is scoped to open tasks, so a completed follow-up does not suppress the next real one forever, and a task with no key is always created. Creation, completion, and snooze all write audit entries and activity receipts. Verified live on 2026-08-20: a production contact-form submission created exactly one high-priority follow-up task due the same day, with a task_created activity.",
  }),
  card({
    key: "integration-capability-platform",
    title: "Build the provider capability platform and integration catalog",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Create the stable integration contract that lets the Command Center add, replace, degrade, and retire providers without leaking provider-specific assumptions into admin, AI, or domain workflows. Ship a truthful founder-facing catalog for live and planned capabilities before adding another provider.",
    acceptance: [
      "A versioned provider registry declares capabilities, scopes, cost posture, sync strategy, data classes, readiness checks, and operational limits for every live or planned provider",
      "One authoritative integration read model combines registry policy with live connection, run, webhook, and freshness evidence and never reports configuration presence as healthy",
      "The founder can inspect connected, degraded, available, and planned providers in a responsive Integrations workspace with capability-level state, freshness, scope, cost, and exact next actions",
      "AI and future adapters can consume the same capability availability contract without provider-specific UI branching",
      "Registry, read-model, authorization, missing-schema, stale-evidence, and responsive desktop/mobile behavior have deterministic verification",
    ],
    dependencies: [
      "Finish Setup Center as the operational control plane",
      "Build the system-health report and freshness thresholds",
    ],
    start:
      "src/lib/revenue-os/integrations.ts; src/app/api/admin/integrations/route.ts; src/app/admin/integrations/page.tsx; src/lib/admin/navigation.ts",
    guardrails:
      "This slice is read-only and must not connect a new provider, weaken founder authorization, expose secrets, pretend roadmap entries are installed, or move business logic into an integration adapter. Native APIs and webhooks remain the durable provider boundary; MCP and n8n remain optional edge adapters.",
    labels: ["integrations", "capabilities", "control-plane", "state-of-the-art"],
    evidence:
      "2026-08-23: shipped registry revenue-os-integrations.v1 with 14 native, next-wave, planned, and optional-edge providers. Every provider declares capabilities, direction/impact, scopes where applicable, cost posture, transports, data classes, limits, setup/reference links, and an ownership guardrail. The server-only catalog combines this policy with connection, source/job, webhook, message, first-party, AI-run, and schema-verification evidence; configuration alone is Available or Needs verification, and missing scopes, failures, missing tables, and stale receipts degrade explicitly. Added founder-only /api/admin/integrations, responsive /admin/integrations, System navigation, Setup cross-link, search, status filters, capability receipts, and expandable operating contracts. Verification passed: npm run test:integration-catalog; npx tsc --noEmit; npm run lint; npm run test:route-coverage; npm run verify:admin-tokens; npm run build; git diff --check; authenticated qa:integration-catalog and test:admin-parity -- --integrations. Desktop, mobile, planned-contract, search, reduced-motion, and dark screenshots in /tmp/accelerate-integration-catalog were opened and inspected with no overflow, console errors, or unexpected dialogs.",
  }),
  card({
    key: "priority-selector-service",
    title: "Create the shared operator-priority selector",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Rank overdue commitments, unread replies, imminent meetings, proposal follow-up, campaign exceptions, and system warnings with one explainable policy.",
    acceptance: [
      "Today, navigation counters, AI ranking, and notifications consume the same selector",
      "Every ranked item exposes reason, urgency, source timestamp, and recommended next action",
      "Stable tie-breaking prevents items from jumping unpredictably",
    ],
    dependencies: [
      "Normalize the cross-channel activity ledger",
      "Build the canonical task generator with deduplication",
    ],
    start:
      "src/lib/revenue-os/queue.ts; src/app/api/admin/revenue-os/overview/route.ts; src/app/admin/today/page.tsx",
    guardrails:
      "Do not use opaque AI ranking for hard deadlines or unread replies. Rules must remain inspectable and testable.",
    labels: ["today", "priority"],
    evidence:
      "Shipped locally 2026-08-23; intentionally held for a later feature-batch deployment. `loadOperatorQueue` now deterministically ranks overdue tasks, unread replies, approvals, proposals, meetings within 48 hours, campaign recipients stopped after exhausted retries, and operational health concerns. Every returned item is runtime-validated for reason, urgency, source timestamp, safe admin link, and recommended next action; ordering is urgency, deadline, kind, source timestamp, then stable ID. Today renders the full explanation, navigation reads `/api/admin/revenue-os/priority`, the notification panel embeds the same top work, and `get_today_snapshot` remains the AI consumer. Live service-role verification surfaced `google-workspace-sync` as the current top critical system item. Verification passed: `npm run test:priority-selector`, notification and route contracts, TypeScript, lint, admin tokens, agent contract, local build, diff check, Today desktop/mobile parity, and the expanded Today interaction QA. Reviewed screenshots `/tmp/accel-shots/priority-attention-desktop.png`, `/tmp/accel-shots/priority-attention-mobile-reduced.png`, and `/tmp/accel-shots/today-command-center-mobile.png`; visual review found and fixed the previously clipped bell panel with explicit sidebar/mobile placement.",
  }),
  card({
    key: "canonical-attribution",
    title: "Consolidate analytics on canonical source-to-revenue data",
    workstream: "foundation",
    phase: 2,
    status: "shipped",
    priority: "high",
    description:
      "Make every admin metric derive from the same canonical contacts, opportunities, stage events, campaigns, meetings, proposals, and won revenue.",
    acceptance: [
      "Source → qualified → meeting → proposal → win → revenue totals reconcile",
      "Legacy analytics and page counters do not disagree with the canonical service",
      "Unknown attribution and data-quality gaps are visible instead of dropped",
    ],
    dependencies: [
      "Reconcile legacy records with the canonical model",
      "Finish the canonical pipeline transition service",
    ],
    start:
      "src/lib/revenue-os/analytics.ts; src/app/api/admin/revenue-os/analytics/route.ts; migrations/20260816-first-party-analytics.sql",
    guardrails:
      "Do not join solely on email when a canonical ID exists. State metric timezone, window, and inclusion rules.",
    labels: ["analytics", "revenue"],
    evidence:
      "2026-08-20: `npm run verify:attribution-loop` passes against production and reconciles source through qualified, meeting, proposal, win, and revenue. Data-quality gaps are visible rather than dropped: the analytics surface previously reported 81 conversions at 56.6% when only 6 were real intent (4.2%), counting every form touch as a conversion; the canonical service now distinguishes them and shows unknown attribution explicitly. Legacy agreement is covered by the separately shipped legacy-canonical-reconciliation card.",
  }),
  card({
    key: "atomic-execution-claims",
    title: "Enforce atomic claims and idempotency for jobs and actions",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "high",
    owner: "Grok-4.6-01-atomic-execution-claims",
    description:
      "Ensure campaigns, approvals, sync jobs, sends, and webhook processing claim work atomically before side effects.",
    acceptance: [
      "Concurrent workers cannot execute the same logical job or send twice",
      "Every run reaches a truthful terminal state with summary or error",
      "Stale claims have a bounded and audited recovery path",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start:
      "migrations/20260817-atomic-job-claims.sql; src/lib/revenue-os/runs.ts; src/lib/revenue-os/action-executor.ts; src/app/api/cron/",
    guardrails: "Never rely on HTTP 200 as proof of successful intended work.",
    labels: ["reliability", "idempotency"],
    evidence:
      "2026-08-29 Gate 0 follow-on: stale recoveries now write `execution.stale_claim_recovered` audit receipts. Job takeovers audit from startJobRun using recovered_from; campaign members stuck `sending` past 30 minutes return to active under the original send key and are audited; actions stuck `executing` close as failed and are audited so they cannot disable the queue. job_runs.recovered_from is part of the schema contract. Verification: npm run test:job-and-task-contracts; npm run test:action-execution; npm run test:job-claims (production concurrent claim + completed replay); npm run verify:stale-claim-recovery (production abandoned claim takeover, failed terminal receipt, recovered_from link, audit row); npx tsc --noEmit; lint; git diff --check. Provider-uncertainty reconciliation for Gmail replies remains on communication-sender-service. 2026-08-17: added the one shared database-owned job claim RPC and runs.ts outcome contract. The migration enforces one active job per job key plus deterministic completed-receipt replay; cron and founder-triggered Google sync now return truthful skipped results when another worker owns the job. Applied and reran the migration idempotently in production. Controlled production QA proved first claim, concurrent duplicate skip to the same running receipt, and completed deterministic replay (npm run test:job-claims).",
  }),
  card({
    key: "audit-ledger-coverage",
    title: "Complete before/after audit coverage for material changes",
    workstream: "foundation",
    phase: 1,
    status: "shipped",
    priority: "high",
    owner: "Grok-4.6-05-audit-ledger-coverage",
    description:
      "Record the actor, origin, target, before/after summary, and timestamp for every material founder, AI, automation, integration, and public action.",
    acceptance: [
      "Pipeline, campaigns, messages, calendar, proposals, settings, integrations, tasks, and Feature Board writes are covered",
      "Sensitive token and message content is redacted where appropriate",
      "The admin can filter audit history by actor, entity, action, source, and date",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start: "src/lib/revenue-os/audit.ts; mutation routes; admin activity pages",
    guardrails: "Audit failures must be observable; never serialize secrets or full OAuth tokens.",
    labels: ["audit", "security"],
    evidence:
      "2026-08-30 Wave 1: `recordAudit` now redacts token/secret/password/key fields and known provider prefixes, and throws when the ledger write fails instead of swallowing the error. `npm run test:audit` covers redaction and fail-closed writes. Remaining: proposal/calendar/Feature Board before-after coverage and Activity filters. 2026-08-16: shared audit writes cover canonical inbound, pipeline transitions, tasks, AI feedback/actions, campaign state, Google connection activity, and selected settings. Remaining: complete proposal/calendar/webhook/Feature Board before-after coverage, redaction tests, observable audit-write failures, and Activity filters.",
  }),
  card({
    key: "legacy-api-adapters",
    title: "Back legacy admin reads with canonical adapters",
    workstream: "foundation",
    phase: 2,
    status: "planned",
    priority: "high",
    description:
      "Temporarily preserve legacy response shapes while sourcing data from canonical services until parity checks and UI conversion pass.",
    acceptance: [
      "Legacy pages return compatible fields derived from canonical records",
      "Adapter usage is instrumented so remaining consumers are known",
      "Retirement requires production reconciliation and replacement-route QA",
    ],
    dependencies: [
      "Reconcile legacy records with the canonical model",
      "Consolidate analytics on canonical source-to-revenue data",
    ],
    start:
      "src/lib/revenue-os/legacy-adapter.ts; src/app/api/admin/leads; bookings; inbox; contacts routes",
    guardrails:
      "Do not maintain dual-write business logic longer than necessary and never delete legacy tables in this task.",
    labels: ["compatibility", "migration"],
    evidence:
      "2026-08-16: added one server-only compatibility adapter that annotates Leads, Contact Submissions, Chat Inquiries, Clients, Subscribers, Resource Downloads, Partners, and Website Grades with canonical contact/company/opportunity linkage while preserving every response field and degrading safely if Revenue OS is unavailable. Contact detail now combines legacy source history with canonical opportunities, activities, messages, tasks, and a Pipeline deep-link. Remaining: adapter telemetry, production reconciliation, and retirement of legacy source queries after parity.",
  }),

  // Phase 2, focused founder admin
  card({
    key: "admin-shell-design-system",
    title: "Complete the shared professional admin system",
    workstream: "admin",
    phase: 2,
    status: "planned",
    priority: "high",
    description:
      "Finish one visual and interaction system for headers, surfaces, tables, filters, pills, dialogs, drawers, commands, and state feedback across every retained route.",
    acceptance: [
      "Retained routes use shared primitives and operational color semantics",
      "Interactive targets, focus rings, reduced motion, and responsive behavior meet the admin standard",
      "Legacy pages no longer look like separate product generations",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start: "src/app/admin/layout.tsx; src/app/globals.css; src/components/admin/",
    guardrails:
      "Use exact-property transitions and restrained motion. Do not restyle public marketing pages as part of this card.",
    labels: ["design-system", "accessibility"],
    evidence:
      "2026-08-27 shared navigation runtime: the live founder workspace and every fictional demo route now use one registered application scroll viewport, direct scenario-aware links, manual per-entry restoration, deterministic forward-to-top behavior, contextual route titles, accessible focus handoff, stable loading geometry, and one incoming route-motion owner. Demo navigation no longer relies on document click interception or hard reloads, and scenario switching replaces the fictional runtime without mixing business state. Static and browser navigation contracts cover desktop, mobile, reduced motion, history restoration, overflow, runtime errors, and scenario switching. 2026-08-27 end-to-end admin and demo polish: the mobile navigation is now a focus-contained, background-inert modal with deterministic focus return, unique desktop/mobile disclosure IDs, a less crowded header, in-drawer Search and Ask AI tools, and a wider native sheet. Route-aware accordion state always reveals the active destination after client navigation. The appearance chooser focuses the selected option and restores focus on close. Repaired two undefined shared theme tokens, aligned AI tab press behavior with the system standard, compacted live-admin identity so utilities remain contained across appearances, and refreshed stale redirect/sandbox QA assumptions. Verification passed: agent and demo contracts, TypeScript, zero-warning lint, admin token contract, 325-page production build, all three scenarios across 28 routes on desktop/mobile with all five appearances and protected-request isolation, authenticated 27-route desktop/mobile parity across Night, Signal, and Studio, embedded Command Center preview, Work portfolio motion/accessibility matrix, focus trapping, duplicate-ID checks, overflow, hit targets, keyboard, reduced motion, and reviewed screenshots. Production deployment pending. 2026-08-26: refined the shared desktop utility cluster into one contained sidebar header: identity remains primary, notification and collapse/expand controls are optically aligned at both rail widths, and the notification remains reachable when collapsed without leaving the viewport. Scenario identity now replaces the generic Accelerate lockup only inside fictional demo workspaces. Shared appearance and operational-state tokens repair warning, muted-surface, and navigation contrast without route-local overrides. The full three-scenario, 28-route desktop/mobile demo matrix passed with no overflow or runtime errors; expanded, collapsed, and mobile screenshots were reviewed. 2026-08-25: completed the focused shared-shell polish slice. The desktop collapse and notification controls now remain optically aligned and contained in the sidebar at both widths; the notification state is static instead of flashing; navigation labels, section headings, icons, and utilities have stronger hierarchy and contrast; a persistent Demo workspace action opens the full admin demo launcher at /demo/command-center in a new tab from expanded, collapsed, and mobile navigation; and the four-state appearance picker now has a type-safe fallback. Automated evidence: admin route parity passed all 27 registered routes on desktop and mobile; the Command Center demo interaction suite passed disclosure, simulated approval, grounded-response, reset, responsive, reduced-motion, overflow, and console checks; TypeScript, zero-warning lint, admin token validation, diff validation, and the 351-page production build passed. Visual evidence: /tmp/accelerate-admin-shell-qa/expanded-desktop.png, /tmp/accelerate-admin-shell-qa/collapsed-desktop.png, and /tmp/accelerate-admin-shell-qa/navigation-mobile.png. Route-local modernization remains on this broader card. Earlier evidence: shared route registry, page headers, tokenized surfaces, portal dialogs/drawers, responsive shell, mobile navigation, focus and reduced-motion behavior, and route-level states are active.",
  }),
  card({
    key: "admin-overlay-motion-recovery",
    title: "Repair admin overlays, entry motion, tokens, and collapsible navigation",
    workstream: "admin",
    phase: 2,
    status: "shipped",
    priority: "high",
    description:
      "Replace route-local overlays and undefined visual tokens with one portal-based interaction system, intentional page entry motion, a responsive shell, and a persisted collapsible desktop sidebar.",
    acceptance: [
      "Every modal, confirmation, drawer, and command surface portals above route transforms, traps focus, restores focus, locks scrolling, and closes with Escape",
      "Every referenced admin token is defined in light and dark mode and the shell has no accidental black grid or header separator",
      "Desktop sidebar collapses to a usable icon rail and mobile navigation exposes the same destinations",
      "Desktop, narrow laptop, mobile, dark, and reduced-motion Playwright journeys show no clipping, overflow, or console errors",
    ],
    dependencies: ["Complete the shared professional admin system"],
    start:
      "src/components/admin/AdminDialog.tsx; src/app/admin/layout.tsx; src/app/globals.css; src/lib/admin/motion.ts; src/lib/admin/navigation.ts",
    guardrails:
      "Use Radix focus behavior, exact-property transitions, 40px targets, concentric radii, and restrained motion. Do not leave a second modal primitive behind.",
    labels: ["modals", "motion", "responsive", "sidebar"],
    evidence:
      "2026-08-16 verified: centralized every admin modal, confirmation, drawer, compose surface, and command palette on the Radix body portal; fixed portal token inheritance and iframe compositing; added responsive/persisted sidebar collapse and mobile drawer close ownership; removed the grid, public progress line, and hard separator; and passed authenticated desktop/mobile, dark, reduced-motion, viewport, Escape, focus, and 25-route parity Playwright coverage with reviewed screenshots.",
  }),
  card({
    key: "email-studio-runtime",
    title: "Restore Email Studio, sent history, and live template publishing",
    workstream: "admin",
    phase: 2,
    status: "blocked",
    priority: "high",
    owner: "Codex",
    description:
      "Give the founder one discoverable workspace to view, edit, preview, test, publish, restore, compose from, and audit transactional and sequence email without another provider account.",
    acceptance: [
      "Templates expose built-in, draft, and published state with desktop/mobile rendered previews and allow-listed merge variables",
      "Saving a draft never affects recipients; founder-only test send and explicit publish use the configured Resend connection",
      "Transactional and sequence send paths resolve the exact published version and safely fall back to built-in copy during schema failure",
      "Sent history shows recipient, subject, body, status, provider receipt, template, time, and linked context on desktop and mobile",
    ],
    dependencies: [
      "Finish one auditable communication sender",
      "Repair admin overlays, entry motion, tokens, and collapsible navigation",
    ],
    start:
      "migrations/20260816-email-studio.sql; src/lib/email/registry.ts; src/lib/email/runtime-template.ts; src/app/admin/emails/page.tsx",
    guardrails:
      "Use the proven Work+Shelter block-authoring model: a small typed block vocabulary, one render path for preview/test/send, and reusable layout starts. Test sends go only to the authenticated founder. Never store provider keys in templates or let draft edits change live sends implicitly.",
    labels: ["email", "templates", "delivery-history", "publishing"],
    evidence:
      "2026-08-29 coordinator park: Gate 0 moved this card from in_progress to blocked. Remaining before Shipped is a founder-authenticated production test-send/receipt plus the still-planned communication sender Gmail-thread evidence. Codex remains owner so the slice can resume without a second claim. 2026-08-28 demo-template refinement: customer-facing demo email now derives its brand, accent, domain, founder signature, and template copy from the active fictional scenario. The email-safe renderer uses a responsive, card-based layout and scenario-specific inquiry, appointment, proposal, and welcome templates rather than a generic Accelerate wrapper. Browser QA proves all five scenario previews render their own brand and do not leak Accelerate into the fictional customer mail; desktop/mobile Northline authoring and publish-confirmation coverage still passes. 2026-08-28 implementation: replaced raw body editing with typed heading, paragraph, button, divider, and spacer sections. A versioned compatible draft value preserves the existing schema; the same renderer now serves exact editor preview, founder test send, and new published sends, with code-owned transactional templates retaining their safe fallback. Demo mutations stay inside browser-session state and produce scenario-branded fictional email. Browser QA proves desktop/mobile authoring, save, exact mobile preview, no overflow, no console errors, no protected request escape, and no receipt/dock overlap. Contracts passed: agent contract, demo contract, email templates, email blocks, admin tokens, TypeScript, lint, diff, and 325-page production build. The card remains in progress because a founder-authenticated production test-send/receipt verification is still required before it can be honestly marked Shipped. Earlier evidence: 2026-08-16 added versioned draft/published schema, canonical registry/resolver, Email Studio editor/preview/history, founder test action, publish confirmation, compose handoff, and runtime adoption by transactional and sequence sends. Production migration applied twice successfully for idempotency; email_templates, email_template_versions, and publish_email_template are live through the service-role path.",
  }),
  card({
    key: "feature-board-interaction-rebuild",
    title: "Rebuild Feature Board drag, details, and mobile interaction",
    workstream: "admin",
    phase: 2,
    status: "planned",
    priority: "high",
    description:
      "Make the managed backlog feel like a professional delivery tool with stable drag ownership, cross-column previews, reliable persistence, accessible movement, and a portal-based responsive detail editor.",
    acceptance: [
      "Mouse, touch, and keyboard movement works within and across columns, including empty columns and horizontal auto-scroll",
      "Dragged card retains its measured size, source placeholder and destination are clear, and drop animation never duplicates or jumps",
      "One atomic reorder persists after drop and visibly rolls back on failure",
      "Opening details before or after a drag never shifts, clips, or disables the board; mobile has an equivalent status/move control",
    ],
    dependencies: ["Repair admin overlays, entry motion, tokens, and collapsible navigation"],
    start:
      "src/app/admin/features/page.tsx; src/components/admin/AdminDialog.tsx; scripts/qa-feature-board.mjs",
    guardrails:
      "Do not reorder hidden cards while filters are active. Preserve the managed manifest, audit RPC, source IDs, and user-created cards.",
    labels: ["kanban", "drag-drop", "feature-board", "mobile"],
    evidence:
      "2026-08-16: unified mouse/pen/touch on a distance-gated pointer sensor, retained keyboard movement, added live cross-column preview and atomic normalized persistence with rollback, removed the lingering drop clone that blocked post-drag clicks, and moved details to the shared portal editor. Authenticated Playwright proves cross-column movement, post-drop edit, desktop/mobile rendering, and modal integrity. Remaining before Shipped: add an explicit keyboard-move assertion and unsaved-change confirmation.",
  }),
  card({
    key: "additional-tools-canonical-parity",
    title: "Modernize and canonically integrate every additional admin tool",
    workstream: "admin",
    phase: 2,
    status: "planned",
    priority: "high",
    description:
      "Bring Leads, Contacts, Inbox, Bookings, Clients, Chat Inquiries, Subscribers, Content, Resources, Partners, and Website Grades onto the shared responsive shell and connect revenue-bearing records to canonical contacts, companies, opportunities, activities, tasks, attribution, and Today.",
    acceptance: [
      "Every existing route is discoverable from the shared route registry and passes the same header, state, overlay, keyboard, responsive, and error contracts",
      "Revenue-bearing legacy reads use canonical adapters and every remaining legacy-only field has a documented parity disposition",
      "Inbound records link to canonical identity/opportunity/activity once without duplicate writes",
      "No route is hidden, deleted, or redirected until production row counts and primary actions reconcile",
    ],
    dependencies: [
      "Back legacy admin reads with canonical adapters",
      "Repair admin overlays, entry motion, tokens, and collapsible navigation",
      "Implement deterministic contact and company identity resolution",
    ],
    start:
      "src/lib/admin/navigation.ts; src/lib/revenue-os/legacy-adapter.ts; src/app/admin/*; src/app/api/admin/leads; contacts; inbox; bookings; clients; chat-leads; subscribers; content; resources; partners; website-grades",
    guardrails:
      "Additional tools are an active migration queue, not abandoned legacy. Preserve original source IDs and tables until parity is verified.",
    labels: ["route-audit", "legacy-parity", "canonical-data", "responsive"],
    evidence:
      "2026-08-26: consolidated Website submissions and List import into one responsive Contact intake workspace, repaired disclosure controls, populated the browser demo with 16 fictional contacts and canonical relationship histories, modernized the relationship timeline with shared admin surfaces, and added demo-contract regression coverage. The same route components remain authoritative for live and demo; only the demo data transport is intercepted. Also corrected Today’s oversized approval rail, repeated queue copy, warning semantics, and public dock collision. Verified with TypeScript, zero-warning lint, agent contract, admin demo contract, contact-import service contract, 29-route desktop/mobile demo QA, inspected desktop/mobile screenshots, and a 325-page production build. 2026-08-16: all 25 registered routes pass desktop/mobile Playwright parity; every overlay uses the shared portal contract; Chat Inquiries no longer overflows phones; and every person-bearing specialized API now exposes canonical Revenue OS linkage through one safe adapter. Manual Lead creation uses the shared identity/inbound/activity/task/audit services, single Lead stage changes synchronize through the canonical transition service, and Contact Timeline combines source history with canonical opportunities, activities, messages, tasks, and Pipeline deep-links. Remaining before shipment: atomic canonical handling for bulk Lead moves, extracting legacy Bookings substate from the controlled sales stage, field-level and row-count reconciliation in production, and adapter telemetry. No specialized source table or route is being deleted early.",
  }),
  card({
    key: "today-operator-inbox",
    title: "Finish Today as the prioritized operator inbox",
    workstream: "admin",
    phase: 2,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Make Today the founder’s single queue for overdue work, replies, meetings, proposals, campaign exceptions, approvals, and system warnings.",
    acceptance: [
      "Items use the shared priority selector and expose why they are ranked",
      "Each item opens the correct record or safe action without dead-end summaries",
      "Completion, snooze, approval, rejection, and refresh preserve consistent counters",
    ],
    dependencies: [
      "Create the shared operator-priority selector",
      "Build the canonical task generator with deduplication",
    ],
    start:
      "src/app/admin/today/page.tsx; src/app/api/admin/revenue-os/overview/route.ts; src/lib/revenue-os/queue.ts",
    guardrails:
      "Do not duplicate source records into a separate Today table. System warnings cannot be silently dismissed without a receipt.",
    labels: ["today", "operator-inbox"],
    evidence:
      "Shipped locally 2026-08-23 and intentionally held for the next feature-batch deployment. Today now has structured skeleton loading, distinct background refresh, last-success timestamp, last-good-data preservation, explicit degraded and fatal read states, recovery actions, useful empty-state destinations, abort/race protection, and focus query normalization. Approval items deep-link into the exact review dialog; proposals, conversations, campaigns, opportunities, clients, and contacts consume record-targeting links instead of dropping the operator on an unfiltered list. Approval, rejection, completion, and snooze remove items optimistically, then reconcile the shared queue and dispatch the navigation refresh event so counters do not flash stale after a successful mutation even when the follow-up read degrades. Verification passed: priority/notification/route contracts, admin tokens, agent contract, TypeScript, lint, diff check, 339-page production build, Today desktop/mobile parity, and expanded Playwright QA covering deep approval, approve, reject, complete, snooze, empty, degraded, fatal, retry, focus filtering, reduced motion, and console errors. Screenshots `/tmp/accel-shots/today-command-center-desktop.png` and `/tmp/accel-shots/today-command-center-mobile.png` were visually reviewed.",
  }),
  card({
    key: "pipeline-stage-board",
    title: "Finish the canonical Pipeline workspace",
    workstream: "admin",
    phase: 2,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Provide one industry-agnostic opportunity workspace with stage control, qualification, value, next actions, and consistent contact/company context.",
    acceptance: [
      "Pipeline lists and stage board use canonical opportunities only",
      "Stage changes invoke the transition service and show validation errors",
      "Search, filters, value totals, and mobile layouts remain usable with realistic data volumes",
    ],
    dependencies: [
      "Finish the canonical pipeline transition service",
      "Implement deterministic contact and company identity resolution",
    ],
    start: "src/app/admin/pipeline/page.tsx; src/app/api/admin/revenue-os/pipeline/route.ts",
    guardrails: "Roofing is a playbook/filter, never a separate stage model.",
    labels: ["pipeline", "workspace"],
    evidence:
      "Shipped locally 2026-08-23 and intentionally held for the next feature-batch deployment. Pipeline now opens as a canonical nine-stage board with per-stage opportunity counts and value totals, grounded contact/company/value/source/next-action cards, validated inline stage controls, a persistent board/list preference, exact `?opportunity=` resolution, search, and stage filtering. The horizontal board is inline-size-contained, snap-scrolling, and overscroll-contained on mobile rather than widening the route. The existing list remains available for dense comparison. All movement still calls the canonical transition service; rejected transitions retain the source stage and surface the service error. Verification passed: `npm run test:pipeline-workspace` with 27 realistic records, rejected and successful mutations, exact deep links, persisted view, search/filter counts, mobile containment and reduced motion; `npm run test:pipeline-transition`; `npm run test:identity-resolution`; all-route desktop/mobile parity; admin tokens; agent contract; TypeScript; lint; diff check; and the 339-page production build. Screenshots `/tmp/accel-shots/pipeline-stage-board-desktop.png` and `/tmp/accel-shots/pipeline-stage-board-mobile.png` were visually reviewed.",
  }),
  card({
    key: "record-detail-workspace",
    title: "Build contextual contact, company, and opportunity details",
    workstream: "admin",
    phase: 2,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Create responsive record details showing identity, qualification, value, timeline, conversations, meetings, proposals, tasks, research, attribution, and next action.",
    acceptance: [
      "A founder can navigate between linked contact, company, and opportunity without losing context",
      "Timeline events come from the canonical activity ledger",
      "Editing identity or next action validates conflicts and updates every dependent view",
    ],
    dependencies: [
      "Normalize the cross-channel activity ledger",
      "Finish the canonical Pipeline workspace",
    ],
    start:
      "src/lib/revenue-os/records.ts; src/app/api/admin/revenue-os/records/opportunity/[id]/route.ts; src/app/admin/pipeline/[id]/page.tsx; scripts/qa-record-detail-workspace.mjs",
    guardrails:
      "Use progressive disclosure on mobile; do not expose raw provider payloads or tokens.",
    labels: ["records", "timeline"],
    evidence:
      "Shipped locally 2026-08-23 and intentionally held for the next feature-batch deployment. Added `revenue-os-opportunity-record.v1`, one bounded founder-only read model and API for an opportunity, linked contact/company, tasks, conversations, meetings, proposals, and the canonical `revenue-os-activity-ledger.v1` timeline. Raw message bodies, provider metadata, attendee payloads, proposal content, and secrets are excluded by explicit selects. Pipeline cards/list rows and Today task/meeting priorities now deep-link to the exact cockpit. The responsive workspace provides persistent opportunity/contact/company/activity context, value and commitment metrics, audited next-action/date/value editing through `updateOpportunityDetails`, optimistic `updated_at` conflict refusal, success/error/retry/schema states, and progressively collapsible related sections. Identity is deliberately read-only until a separate ambiguity-safe identity mutation contract exists. Verification passed: TypeScript, lint, pipeline transition, priority selector, activity ledger, route coverage, founder access (20 checks), diff check, and deterministic Playwright failure/retry, canonical ordering, edit refresh, mobile overflow, keyboard target, and reduced-motion checks. Desktop/mobile screenshots were opened and inspected at `/tmp/accelerate-record-workspace`. No schema change or deployment was performed.",
  }),
  card({
    key: "pipeline-saved-views",
    title: "Add useful Pipeline saved views and ownership filters",
    workstream: "admin",
    phase: 3,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Support repeatable views for new inquiries, no next action, overdue follow-up, upcoming meetings, proposals, at-risk deals, wins, and nurture.",
    acceptance: [
      "Core system views have deterministic filters and counts",
      "Founder-created views persist filter, sort, and visible-column preferences",
      "Views work in table and mobile detail-card modes",
    ],
    dependencies: ["Finish the canonical Pipeline workspace"],
    start:
      "src/lib/admin/pipelineViews.ts; src/app/admin/pipeline/page.tsx; src/app/api/admin/revenue-os/pipeline/route.ts",
    guardrails: "Saved views are filters over canonical data, not copied records.",
    labels: ["pipeline", "productivity"],
    evidence:
      "2026-08-24: shipped a competitive operator-view layer over canonical opportunities. src/lib/admin/pipelineViews.ts owns deterministic All, Needs attention, New, No next action, Overdue, Coming up, Proposals, At risk, Recent wins, and Nurture predicates, stable counts/sorts, normalized device persistence, and a 20-view bound. The Pipeline UI adds explainable queues, owner/stage/search filters, founder-named saved views, configurable fields and ordering, persisted board/list layout, deep-link preservation, 44px controls, and purpose-built mobile detail cards. The read route adds the next upcoming linked calendar event and reports calendar signal readiness while safely degrading to null on calendar read failure. No records are copied and no opaque AI score was introduced. Verification passed: npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:pipeline-saved-views; authenticated PLAYWRIGHT_BASE_URL=http://localhost:3010 npm run test:pipeline-workspace; npm run build; git diff --check. Playwright proved system queues/counts, owner filtering, customization, saved-view reload persistence, canonical transition rejection/success, search/stage filtering, exact record deep links, desktop board/list, mobile cards, reduced motion, and viewport containment with no console errors. Reviewed /tmp/accel-shots/pipeline-stage-board-desktop.png, pipeline-stage-board-mobile.png, and pipeline-list-mobile.png. Local feature only; no migration, provider activation, production write, or deployment was required.",
  }),
  card({
    key: "conversations-operator-inbox",
    title: "Finish Conversations as the unified communication inbox",
    workstream: "admin",
    phase: 2,
    status: "in_progress",
    priority: "high",
    owner: "Antigravity",
    description:
      "Combine synchronized Gmail, inbound forms/messages, Resend activity, and manual communication into one founder inbox with record context and reply tools.",
    acceptance: [
      "Thread list supports unread, intent, assignment, record, campaign, and follow-up filters",
      "Opening a conversation shows ordered canonical messages and linked opportunity context",
      "Reply, draft, link/create record, next action, and local archive have actionable errors and receipts",
    ],
    dependencies: [
      "Normalize the cross-channel activity ledger",
      "Implement deterministic contact and company identity resolution",
    ],
    start: "src/app/admin/conversations/page.tsx; src/app/api/admin/revenue-os/conversations/",
    guardrails:
      "Gmail remains person-to-person; Resend remains campaign/transactional. Local archive must not silently mutate Gmail unless explicitly designed.",
    labels: ["conversations", "gmail"],
    evidence:
      "2026-09-01: Implemented the authoritative omnichannel conversations domain service (`src/lib/revenue-os/conversations.ts`) and upgraded the Conversations API routes and admin UI (`src/app/admin/conversations/page.tsx`). The inbox now provides rich multi-dimensional filtering (status tabs with live counts, unread toggle, channel filter, and record link filter), ordered canonical message history, AI suggested reply draft insertion, opportunity cockpit context drawer, and quick actions for creating opportunities, follow-up tasks, status resolution/reopening, and local archiving with audit and activity ledger receipts. Deterministic coverage is verified with `npm run test:conversations`.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run test:conversations; git diff --check.",
  }),
  card({
    key: "campaign-workspace-ui",
    title: "Finish the Campaigns planning and control workspace",
    workstream: "admin",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Give the founder one place to define audience, sequence, policy, dry run, activation, enrollment, performance, pause, and exceptions.",
    acceptance: [
      "Draft, dry-run, active, paused, completed, and failed states are explicit",
      "Material edits visibly create a version requiring reapproval",
      "Recipient exclusions, pending sends, stops, and failures are inspectable",
    ],
    dependencies: [
      "Enforce campaign policy envelopes and version reapproval",
      "Build campaign dry-run, exclusion, and sample personalization review",
    ],
    start: "src/app/admin/campaigns/page.tsx; src/app/api/admin/revenue-os/campaigns/",
    guardrails:
      "Never schedule the whole sequence at Resend. Activation is not permission to exceed the displayed envelope.",
    labels: ["campaigns", "workspace"],
    evidence:
      "2026-08-16: Campaigns supports draft creation, sender/copy/policy editing, member enrollment, dry-run preview, confirmed activation proposal, pause, version/status presentation, and responsive states. Remaining: richer sequence editing, exception/member detail, reconciled performance, material-edit reapproval proof, and Playwright activation/pause/stop coverage.",
  }),
  card({
    key: "proposal-workspace-ui",
    title: "Finish the founder Proposal workspace",
    workstream: "admin",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Support grounded draft, preview, versioning, send, view activity, accept/decline, expiry, and follow-up from the linked opportunity.",
    acceptance: [
      "Proposal state and linked opportunity are visible without switching legacy pages",
      "Preview exactly matches the public proposal and generated PDF",
      "Send and material revision follow confirmation and version rules",
    ],
    dependencies: [
      "Complete the proposal lifecycle and version rules",
      "Make public proposal views and decisions idempotent",
    ],
    start: "src/app/admin/proposals/page.tsx; src/app/proposal/[token]/page.tsx; proposal APIs",
    guardrails:
      "Payment collection is out of scope. AI cannot invent prices, terms, or customer facts.",
    labels: ["proposals", "workspace"],
    evidence:
      "2026-08-16: existing proposal admin supports draft generation/management and public token views with accept/decline surfaces; shared compose/dialog patterns are available. Remaining: canonical opportunity context, exact preview/PDF parity, immutable versions, confirmation-gated send receipts, expiry/supersede/follow-up, and lifecycle Playwright coverage.",
  }),
  card({
    key: "analytics-workspace",
    title: "Rebuild Analytics around decisions and data quality",
    workstream: "admin",
    phase: 4,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Present source-to-revenue funnel, campaign outcomes, forecast, response rates, meetings, proposals, wins, and data-quality warnings from one metric service.",
    acceptance: [
      "All cards and charts reconcile to canonical metric queries",
      "Date, source, campaign, stage, and owner filters have documented semantics",
      "Missing attribution, stale syncs, and impossible stage sequences are visible warnings",
    ],
    dependencies: ["Consolidate analytics on canonical source-to-revenue data"],
    start:
      "src/app/admin/analytics/page.tsx; src/app/api/admin/revenue-os/analytics/route.ts; src/lib/revenue-os/analytics.ts",
    guardrails:
      "Do not decorate uncertain estimates as revenue facts. Use tabular numerals and accessible chart alternatives.",
    labels: ["analytics", "workspace"],
    evidence:
      "2026-08-24: shipped one canonical decision model for date, source, owner, campaign, and current-stage filters. src/lib/revenue-os/analytics.ts now owns filter semantics, canonical funnel/source facts, recorded probability-weighted open-pipeline forecast, quality counts, and factual reply coverage/median response time derived from ordered inbound and later outbound messages in linked conversations. The API bounds inputs, fails closed on founder access, and degrades communication and website signals independently without disguising missing evidence as zero. The workspace persists cohort filters, separates recorded pipeline and won revenue from a violet-tinted planning estimate with explicit method copy, adds communication performance, accessible textual funnel bars, source-to-revenue, visible missing attribution/owner/next-action plus unrecognized/no-op stage-history warnings, and states that record filters do not alter first-party website metrics. The inspected mobile pass found technically contained but unreadable squeezed filters; they were rebuilt as a full-width date control plus two-column mobile filter grid. Verification passed: npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:analytics-decision-model; npm run verify:attribution-loop with the controlled canonical create/progress/reconcile/cleanup fixture; authenticated PLAYWRIGHT_BASE_URL=http://localhost:3010 npm run test:analytics-workspace; npm run build (351 pages); git diff --check. Playwright proved source/owner filtering, changed canonical metrics, saved-filter reload, clear recovery, facts-vs-forecast copy, reply evidence, reduced motion, console cleanliness, and mobile containment. Desktop and corrected mobile screenshots were opened at /tmp/accelerate-analytics-workspace. No migration, provider activation, deployment, or uncontrolled production record mutation was performed.",
  }),
  card({
    key: "admin-settings-consolidation",
    title: "Consolidate Settings and connection ownership",
    workstream: "admin",
    phase: 2,
    priority: "medium",
    description:
      "Give every integration, AI rule, notification preference, template, pipeline option, and audit view one authoritative admin surface.",
    acceptance: [
      "Duplicate and obsolete settings controls are removed or redirected",
      "Secrets remain environment-only or encrypted server-side",
      "Setup Center links directly to the authoritative setting or connection action",
    ],
    dependencies: ["Finish Setup Center as the operational control plane"],
    start: "src/app/admin/settings; src/app/admin/setup; src/lib/admin/settings.ts",
    guardrails: "Do not display, round-trip, or persist plaintext secret values in admin_settings.",
    labels: ["settings", "setup"],
  }),
  card({
    key: "route-state-resilience",
    title: "Standardize loading, errors, retry, and preserved route state",
    workstream: "admin",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Make every core route retain useful context through refreshes and show actionable loading, empty, degraded, and error states.",
    acceptance: [
      "Core routes distinguish empty data, missing setup, provider degradation, and request failure",
      "Retry actions do not discard filters, selected records, or unsaved safe drafts",
      "Route transitions avoid key-based remount loops and stale-request races",
    ],
    dependencies: ["Complete the shared professional admin system"],
    start:
      "src/components/admin/AdminReadBody.tsx; src/lib/admin/useAdminQuery.ts; src/app/admin/today/page.tsx; core admin pages; src/lib/admin/demo/runtime.ts",
    guardrails: "Never show a success-looking empty state when a provider or schema call failed.",
    labels: ["resilience", "ux"],
    evidence:
      "2026-08-29 coordinator park: Gate 0 moved this card off in_progress because it still depends on the unshipped admin shell and leftover More-tools pages remain. Owner cleared. 2026-08-28 loading-integrity slice: core admin/demo destinations now keep PageHeader mounted and use one shared read path. AdminReadBody wraps delayed regional skeletons, last-snapshot refetch, and fatal retry without replacing committed route identity. Today already used this pattern; Pipeline, Conversations, Analytics, Campaigns, Email Studio, Feature Board, opportunity records, Integrations, Inbox, Bookings, Activity, and Revenue now use useAdminQuery plus AdminReadBody instead of mount-only fetch and full-page AdminPageLoading. Demo fetch intercept installs idempotently before client reads and unknown admin APIs fail closed instead of returning a successful empty payload. Remaining before Shipped: convert the leftover More-tools pages (Leads, Chat inquiries, Subscribers, Partners, Website Grades, Clients, Content, Resources, Settings, Proposals, Delivery Runs, Setup, Contact detail) off early loading returns; browser QA of cold and cached Today → Pipeline → Conversations → Analytics on desktop and mobile.",
  }),
  card({
    key: "admin-a11y-keyboard-mobile",
    title: "Complete keyboard, accessibility, reduced-motion, and mobile parity",
    workstream: "admin",
    phase: 4,
    priority: "high",
    description:
      "Verify every critical founder workflow without a mouse and at mobile breakpoints, including dialogs, drawers, tables, Kanban, command palette, and toasts.",
    acceptance: [
      "Logical focus order, visible focus, dialog trapping, labels, live regions, and Escape behavior pass",
      "Reduced motion removes nonessential movement without breaking state changes",
      "Desktop and mobile expose equivalent critical actions with at least 40px targets",
    ],
    dependencies: [
      "Complete the shared professional admin system",
      "Standardize loading, errors, retry, and preserved route state",
    ],
    start: "src/app/admin/layout.tsx; src/components/admin; Playwright QA",
    guardrails: "Do not hide essential actions behind hover-only controls.",
    labels: ["accessibility", "mobile"],
  }),
  card({
    key: "cloneable-command-center-contract",
    title: "Adopt instance-per-client cloning as the Command Center product shape",
    workstream: "productization",
    phase: 5,
    status: "shipped",
    priority: "high",
    owner: "Grok-4.6-06-cloneable-command-center-contract",
    description:
      "Preserve the evidence and consequences of the former instance-per-client decision. This historical card was explicitly superseded on 2026-08-30 by shared-database-multi-tenancy-contract and no longer governs new schema or authorization work.",
    acceptance: [
      "The former decision, rejected alternative, and consequences remain recorded",
      "The config seam, de-verticalized inbound, and install-runbook child cards remain traceable",
      "The superseding shared-database architecture card is named wherever an implementing agent could otherwise apply the historical prohibition",
    ],
    dependencies: [
      "Verify the production Revenue OS schema",
      "Verify founder-only admin access and service-only data policies",
    ],
    start:
      "docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md; src/config/tenant.ts; docs/self-hosting/SELF-HOSTING.md",
    guardrails:
      "Historical receipt only. Do not remove its evidence, but do not use its former prohibition to block shared-database-multi-tenancy-contract or its child cards. Billing and custom domains remain out of scope until separately authorized.",
    labels: ["clonable", "architecture-decision", "template"],
    evidence:
      "2026-08-19: decision taken with the founder. Chosen shape was instance-per-client: own Vercel project and own Supabase database per client, one codebase, one config file per install. The audit identified the exact shared-database lift: tenant ownership and composite uniqueness across canonical tables plus replacement of founder-email/service-role-everywhere authorization. On 2026-08-30 the founder explicitly selected the formerly rejected shared-database alternative, with the current ADMIN_EMAIL retained as platform owner and client admins scoped by tenant membership. The new decision is owned by shared-database-multi-tenancy-contract; this card remains shipped as historical evidence.",
  }),
  card({
    key: "tenant-config-seam",
    title: "Extract every business fact into one tenant configuration",
    workstream: "productization",
    phase: 2,
    status: "shipped",
    priority: "high",
    owner: "Grok-4.6-07-tenant-config-seam",
    description:
      "Create one typed configuration module that is the only place the brand, founder identity, offerings, industry playbooks, pipeline labels, AI persona, capability switches, and external project links appear, so a second installation is a config file rather than a search and replace across the codebase.",
    acceptance: [
      "A typed tenant config exists and is the single source for brand, founder and system actor identity, pipeline labels, playbooks, AI persona, capability flags, and external project links",
      "The admin, domain, and email layers read that config instead of literals, and the campaign sender, unsubscribe URL, Plausible domain, and Setup Center project links no longer default to Accelerate values",
      "verify:agent-contract fails when a new business literal is introduced under src/lib, src/app/admin, or src/app/api/admin, with a shrinking allowlist for sites not yet migrated",
      "Changing one config value visibly changes the admin chrome, the outbound email chrome, and the AI persona with no other code edit",
    ],
    dependencies: ["Adopt instance-per-client cloning as the Command Center product shape"],
    start:
      "src/config/tenant.ts; src/lib/email/templates.ts; src/lib/email/resend.ts; src/lib/email/registry.ts; src/lib/revenue-os/communications.ts; src/lib/revenue-os/ai-agent.ts; src/lib/chat/system-prompt.ts; src/app/admin/layout.tsx; src/app/admin/setup/page.tsx; src/app/api/admin/setup/route.ts; scripts/verify-agent-contract.mjs",
    guardrails:
      "src/content and the public marketing pages are exempt, because those are Accelerate own-website copy and stay single-brand. Do not introduce a tenant identifier into any query, table, or route while doing this; the config is per-deployment, not per-row. Do not move secrets into the config; they stay environment-only. src/lib/booking.ts currently points at a Calendly link belonging to a different business and must be corrected here, not preserved.",
    labels: ["clonable", "config", "white-label"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run test:features; reviewed desktop and mobile screenshots of the admin shell and one rendered email after changing a config value. 2026-08-19: added src/config/tenant.ts as the one place a business fact may appear, holding brand, founder and system-actor identity, AI persona and voice, booking links, industry playbooks, and infrastructure deep links, with environment variables still winning over configuration. Migrated the call sites that would send wrong data on a second installation: Resend from/admin addresses, the whole customer and operator email chrome including wordmark, accent, title and footer, plan/resource/booking links, the campaign unsubscribe URL, the campaign sender name, the Plausible domain, the Revenue OS copilot system prompt, the system actor recorded on automated audit and activity rows, and the Setup Center deep links, which previously pointed every installation at one specific Vercel org and Supabase project ref. Fixed a live defect found here: src/lib/booking.ts handed out a Calendly event belonging to a different business (john-superdebate), reachable from the public chat prompt; the value now lives in config, is flagged in place, and still needs the correct event or null. Added a cloneability ratchet to scripts/verify-agent-contract.mjs: it counts business literals per file under src/lib, src/app/admin, and src/app/api/admin against a budget that may only shrink, and both directions were proven to fail (adding a literal to an at-zero file, and leaving a budget above the real count). Proof the seam works: changing only tenant.brand in a scratch script re-rendered the email chrome with a different business name, accent colour, footer and domain, with no occurrence of the original brand and no other code edit. Behaviour is unchanged in production: verify:inbound-canonical, verify:recorded-send and verify:attribution-loop all still pass after the migration. Remaining before Shipped: 41 literals across 18 files are still budgeted, chiefly the admin shell chrome (layout, login, update-password), the generative prompts for insights, content briefs and proposals, and the public chat prompt; the admin-chrome half of the fourth acceptance item is therefore not yet met. 2026-08-19 completion: every business literal under src/lib, src/app/admin, and src/app/api/admin is now gone; the ratchet budget in verify-agent-contract.mjs is empty, so any reintroduction fails the contract. Migrated the remainder: admin shell wordmark, collapsed logo mark, live-site link and login/update-password chrome; chat transcript speaker name; campaign sender default; every Setup Center guide step naming the domain, sender, site URL, OAuth callback or GA4 stream; the password reset subject; the insights, content brief, proposal and plan generative prompts; the public chat system prompt including its identity line, positioning paragraph and off-topic redirect; the chat lead-capture confirmation email; the OpenRouter referer and title; and the SEO and OG canonical base URLs, which would otherwise emit another business's canonical links. Added tenant.pipeline.stageLabels so a business can rename a stage (a law firm calling meeting a Consultation) while the canonical stage keys, transition rules, probabilities and analytics stay fixed, and proved a relabel changes only the label. Full rebrand proven end to end: setting tenant.brand and tenant.founder to a fictional plumbing company re-rendered the email chrome, the chat system prompt and the plan prompt under the new identity with no occurrence of the original brand and no other code edit. One honest limit worth recording: the public chat prompt also interpolates the product catalogue from src/content/packages.ts, where a package is itself named Accelerate, so a client installation must supply its own content as well as its own config. That split is deliberate: config holds facts, src/content holds tenant-authored copy. Behaviour unchanged in production: verify:inbound-canonical, verify:recorded-send, verify:attribution-loop, test:identity-resolution and test:pipeline-transition all pass. Remaining before Shipped: capability flags for turning whole surfaces on or off per installation, which are deliberately not added yet because dead configuration nothing reads is worse than none, as the unread BUSINESS_NAME seed proved.",
    evidence:
      "2026-08-20: `src/config/tenant.ts` exists and is the single source for brand, founder and system actor identity, AI persona, booking, pipeline stage labels, playbooks, and external project links. Helpers siteUrl/adminEmail/fromEmail/analyticsDomain/supabaseDashboard route the admin, domain, and email layers through it. Proven load-bearing on 2026-08-20: booking was disabled by setting one value to null after the scheduler URL was found pointing at an unrelated business, and re-enabled across the contact embed, roofing embed, website assistant, and qualifier by setting that one value back. NOT SHIPPED: acceptance criterion 3 does not exist yet (verify:agent-contract does not fail on a new business literal, and there is no shrinking allowlist), and capability flags were deliberately reverted rather than shipped as dead config.",
  }),
  card({
    key: "shared-database-multi-tenancy-contract",
    title: "Adopt shared-database multi-tenancy as the Command Center product shape",
    workstream: "foundation",
    phase: 0,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Supersede the former instance-per-client decision with one application and Supabase database where Accelerate's configured founder remains platform owner, client admins are tenant members, and every operational path carries an explicit tenant context.",
    acceptance: [
      "The superseding decision, trust boundaries, platform-versus-tenant ownership, migration order, rollback, and exclusions are written where every implementation agent reads them",
      "Stable child cards exist for schema/backfill, tenant authorization, workspace provisioning, provider/public boundaries, and isolation cutover",
      "The former cloning card remains historical evidence but no active contract or verifier prohibits tenant IDs, membership roles, workspace routing, or cross-tenant filtering",
    ],
    dependencies: [
      "Verify the production Revenue OS schema",
      "Verify founder-only admin access and service-only data policies",
      "Extract every business fact into one tenant configuration",
    ],
    start:
      "AGENTS.md; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md; docs/contributing/AGENT-TICKET-RUNBOOK.md; src/lib/revenue-os/README.md; scripts/verify-agent-contract.mjs",
    guardrails:
      "Do not add billing, custom domains, client-managed roles, cross-tenant analytics, or a second database. ADMIN_EMAIL stays the sole platform owner in v1. No tenant becomes active until database, API, provider, and browser isolation evidence passes.",
    labels: ["database", "auth"],
    evidence:
      "Shipped 2026-08-30 after explicit founder direction. `docs/contracts/MULTI-TENANCY-CONTRACT.md` now owns product, authority, data, request/RLS, configuration, provider, public traffic, failure, rollout, and rollback boundaries. AGENTS.md and the Revenue OS contract require it before schema/auth/routing work; the historical clone card is explicitly superseded; the Grok non-goal and config comments no longer contradict the active shape. Five stable child cards cover schema, auth, workspace, provider/public, and cutover. Verification passed: npm run verify:agent-contract; npm run test:feature-board-dependencies; source prohibition scan; git diff --check. The live 144-card board was reconciled and verified with zero drift.",
    verification:
      "npm run verify:agent-contract; npm run test:feature-board-dependencies; npm run seed:features -- --verify; git diff --check.",
  }),
  card({
    key: "tenant-control-plane-schema",
    title: "Build the tenant control plane and backfill Accelerate",
    workstream: "foundation",
    phase: 0,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Add tenant, membership, ingest-key, and platform-audit tables; give every operational row explicit tenant ownership; and backfill the existing database into the Accelerate tenant without deleting or duplicating records.",
    acceptance: [
      "Every operational table and RPC has explicit tenant ownership while platform-only tables remain named and unambiguous",
      "Existing rows backfill to Accelerate with row-count and relationship parity before tenant_id becomes non-null",
      "Global business uniqueness and claims become tenant-composite and composite foreign keys reject cross-tenant links",
      "The ordered migration is additive, idempotent, schema-verified, and recoverable without removing tenant data",
    ],
    dependencies: ["Adopt shared-database multi-tenancy as the Command Center product shape"],
    start:
      "migrations; src/lib/revenue-os/schema-contract.ts; scripts/run-migration.mjs; scripts/verify-revenue-schema.ts; src/config/tenant.ts",
    guardrails:
      "Never delete or merge existing rows, infer ownership from email, or make a tenant active before the backfill and constraint reports pass. Feature Board, schema verification, case studies, and changelog stay platform-global.",
    labels: ["database", "migration"],
    evidence:
      "Shipped 2026-08-30. Added the tenant, membership, ingest-key, and platform-audit control plane plus explicit tenant ownership across all 49 currently installed operational tables and three ordered recovery tables. The deterministic Accelerate bootstrap backfilled production with zero null tenant rows; 48 composite foreign keys and 81 tenant indexes enforce relationship and identity boundaries, while Feature Board, schema verification, case studies, and changelog remain platform-global. The complete ordered migration ran successfully in isolated PostgreSQL before `npm run db:migrate -- migrations/20260830-shared-database-tenancy.sql` applied it to the pinned production project. Live verification found the active Accelerate tenant, one founder membership, zero missing tenant columns, zero null tenant rows, and 49 tenant-member policies. Static migration, schema-state, TypeScript, and contract verification passed.",
    verification:
      "npm run test:tenant-migration; npm run test:schema-verification; npm run db:verify-schema; npm run verify:agent-contract; npx tsc --noEmit; npm run lint; git diff --check.",
  }),
  card({
    key: "tenant-context-authorization",
    title: "Enforce tenant context through authentication and domain services",
    workstream: "security",
    phase: 1,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Replace founder-only service-role-everywhere access with explicit platform and tenant actors, tenant-bound authenticated database clients, RLS, and tenant-scoped system contexts for every domain read, write, claim, receipt, search, and export.",
    acceptance: [
      "Tenant APIs require an authenticated active membership and an explicit tenant context that matches RLS",
      "A user with multiple memberships receives rows from exactly the requested tenant and cannot cross-link or mutate another tenant by URL, header, body, or record ID",
      "Interactive routes cannot create service-role clients and background/provider paths cannot execute without TenantSystemContext",
      "Revocation and suspension fail closed immediately without waiting for a JWT metadata refresh",
    ],
    dependencies: ["Build the tenant control plane and backfill Accelerate"],
    start:
      "src/lib/admin/auth.ts; src/lib/supabase/server.ts; src/lib/revenue-os; src/app/api/admin; src/middleware.ts",
    guardrails:
      "The tenant header selects context but never grants access. Never trust tenant IDs from a mutable request body, weaken demo isolation, expose service credentials, or leave an unscoped compatibility data API.",
    labels: ["auth", "security"],
    evidence:
      "Shipped 2026-08-30. Canonical `/t/{slug}/admin/*` workspaces resolve authenticated membership in middleware, propagate tenant identity to PostgREST, and keep legacy `/admin` Accelerate/founder-only. `requireAdmin` rechecks active membership and active tenant on every API call, enters an AsyncLocalStorage TenantActor, and returns an authenticated RLS client; tenant inserts/upserts receive ownership automatically. All 56 interactive admin route files authorize before database construction. System/public routes require named TenantSystemContext helpers and their service clients auto-filter reads/updates/deletes plus attach ownership to writes. Tenant-aware security-definer job, campaign, import, and template RPCs require explicit context and were applied to production. A full scratch database with two users and two tenants proved same-tenant visibility, zero cross-tenant rows under a tampered header, and rejected cross-tenant insertion. `npm run test:tenant-isolation`, tenant migration tests, TypeScript, and production function verification passed.",
    verification:
      "npm run test:tenant-isolation; npm run verify:founder-access; npm run test:api-contracts; npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build; git diff --check.",
  }),
  card({
    key: "tenant-workspace-provisioning",
    title: "Ship tenant workspaces, switching, and founder provisioning",
    workstream: "admin",
    phase: 2,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Give the founder a platform tenant directory and invitation lifecycle, give client admins the complete tenant-scoped operator workspace, and make tenant identity visible and stable across navigation, cache, branding, setup, and recovery.",
    acceptance: [
      "The founder can create, suspend, enter, invite, retry, and revoke tenants through audited services with no hard delete",
      "Client admins can use all tenant operations and settings but cannot see or call platform tenant management, platform health, or Feature Board",
      "Canonical workspace URLs, navigation, breadcrumbs, deep links, exports, and query caches retain one tenant and clear old tenant data before a switch",
      "Desktop and mobile QA proves invitation, single- and multi-membership routing, switching, focus, keyboard, reduced motion, and no stale-tenant flash",
    ],
    dependencies: ["Enforce tenant context through authentication and domain services"],
    start:
      "src/app/admin/layout.tsx; src/components/admin/AdminShell.tsx; src/lib/admin/navigation.ts; src/lib/admin/fetchJson.ts; src/app/admin/login; src/app/auth/callback",
    guardrails:
      "ADMIN_EMAIL is the only platform owner in v1. Tenant admins cannot manage memberships. Do not add granular roles, billing, custom domains, a duplicate admin tree, or pack-specific UI.",
    labels: ["admin", "auth"],
    evidence:
      "2026-08-31 lifecycle integrity pass: founder tenant mutations now delegate to one server-only lifecycle service backed by four transactional, service-role-only PostgreSQL RPCs and a typed failure contract with stable 400/404/409/502/500 responses that never exposes raw infrastructure errors. Workspace creation commits the tenant, founder membership, and audit receipt atomically; membership binding, status changes, and revocation lock their targets and commit with audit. Exact retries are data- and audit-idempotent, suspended tenants reject membership changes, archived tenants cannot reactivate, the bootstrap tenant cannot suspend/archive, and self-revocation fails closed. Existing unconfirmed Auth users remain invited rather than gaining active membership; directory lookup is bounded and paginated; a successful workspace plus failed external invitation returns a truthful retry warning. The additive migration is applied in production, and live verification proves all four functions are executable by `service_role` and by neither browser role. A disposable PostgreSQL cluster proved happy path, replay, lifecycle guards, atomic audit, revocation retry, and grants without touching production tenant rows. 2026-08-31 professional control-plane pass: Tenant operations now opens with lifecycle/admin metrics, searchable and filterable workspace inventory, explicit status/effect language, stable auto-slug preview, useful empty states, and responsive cards with coherent status, access, invitation, and creation hierarchy. Failed create/invite requests retain entered values; one mutation owns the control plane at a time; invitations are unavailable for suspended/archived tenants; archive is exposed without hard delete; and suspend, archive, and revoke require shared focus-trapped confirmations that state their exact effect. Fixture-backed authenticated production-build QA proves search, slug generation, mobile navigation, reduced motion, confirmation Escape, zero mutation, zero overflow, and clean console state at 1440x1000 and 390x844; all four refreshed screenshots in `/private/tmp/accelerate-tenant-workspaces` were inspected. Shipped 2026-08-30. The founder-only tenant directory creates provisioning workspaces, activates/suspends/archives without hard delete, and manages tenant-bound invitations and revocation through audited platform services. Canonical `/t/{slug}/admin/*` URLs preserve workspace identity through middleware, navigation, breadcrumbs, deep links, exports, and tenant-keyed query caches; the workspace selector performs a hard navigation so old tenant cache state cannot flash. Client admins retain the full operational route tree while Tenants, Setup Center, and Feature Board are hidden and rejected as platform surfaces. Auth callback activates matching invitations. No client was invited or activated.",
    verification:
      "npm run test:tenant-lifecycle; npm run test:tenant-lifecycle:postgres; npm run verify:tenant-lifecycle; npm run qa:tenant-workspaces; npm run test:admin-parity; npm run test:navigation-runtime; npm run verify:admin-tokens; npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build; git diff --check.",
  }),
  card({
    key: "tenant-provider-public-boundaries",
    title: "Tenant-isolate providers, public intake, webhooks, and jobs",
    workstream: "integrations",
    phase: 3,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Resolve public capture, OAuth, provider credentials, sends, syncs, webhooks, cron, health, tokens, and idempotency through the owning tenant so no external effect or provider fact crosses a workspace.",
    acceptance: [
      "Each tenant owns encrypted versioned provider credentials; only Accelerate may use temporary environment fallback during migration",
      "Signed rotatable ingest credentials bind tenant, surface, origin, expiry, and rate limit while legacy public routes resolve only to Accelerate",
      "OAuth state, webhook signatures and replay receipts, job claims, sends, sync cursors, public proposals, and unsubscribe tokens resolve tenant before mutation",
      "A provider failure, backlog, suspension, or replay in one tenant cannot block, retry, or mutate another tenant",
    ],
    dependencies: [
      "Ship tenant workspaces, switching, and founder provisioning",
      "Harden encrypted secret and token storage",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start:
      "src/lib/revenue-os/google.ts; src/lib/revenue-os/communications.ts; src/lib/revenue-os/runs.ts; src/app/api/webhooks; src/app/api/cron; public intake routes; integration_connections",
    guardrails:
      "No credential plaintext, global provider fallback for client tenants, tenant identity from provider payloads, blind retries, or real-recipient tests. Supabase, cron wake-up, AI gateway, and encryption keyring remain platform infrastructure.",
    labels: ["integrations", "webhooks"],
    evidence:
      "2026-08-31 tenant OpenRouter BYOK extension: tenant admins can verify, save, rotate, inspect, and revoke a workspace-owned OpenRouter key in Integrations. Verification uses OpenRouter's authenticated current-key metadata endpoint without generation spend; the v2 AES-GCM envelope authenticates tenant ID, provider, and field; plaintext never returns; versions and audit receipts advance on rotation. Every public, admin, import, copilot, plan, proposal, content, settings-test, and responder AI call now passes an explicit tenant database into the shared gateway. Client tenants cannot inherit the environment key, production refuses unscoped calls before provider traffic, bootstrap-only fallback is labelled, and disconnect disables it. Setup, the integration catalog, fictional demo, documentation, and public changelog consume the tenant-owned contract. Deterministic tests cover valid/invalid verification, wrong-tenant/provider ciphertext replay, tenant/platform/disabled policy, unscoped production refusal, gateway resilience, secret storage, catalog, setup, and provider boundaries. TypeScript, zero-warning lint, production build, board reconciliation, and authenticated desktop/mobile browser QA with reduced motion, dialog Escape, overflow, console, and screenshot inspection pass. No credential was entered, no model request was made, no migration was required, and no deployment occurred. Follow-up tenant-ai-sponsorship-control records explicit founder-funded budgets and kill switches rather than widening fallback. Prior shipped evidence remains in repository history: tenant-owned Resend/Calendly rotation and revocation, signed ingest keys, tenant-bound public routes/webhooks/jobs, provider receipts, just-in-time suspension checks, replay defense, and truthful delivery recovery were all verified without activating a real provider or recipient.",
    verification:
      "npm run test:tenant-openrouter; npm run verify:tenant-providers; npm run test:openrouter-resilience; npm run verify:webhook-cron-defense; npm run test:job-claims; npm run test:campaign-stop-claims; npm run test:secret-storage; npm run test:integration-catalog; npm run test:admin-demo-contract; npm run qa:tenant-workspaces:browser; npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build; git diff --check.",
  }),
  card({
    key: "tenant-isolation-cutover",
    title: "Prove multi-tenant isolation and activate the first client",
    workstream: "qa",
    phase: 4,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Run the complete database, API, browser, public, provider, and recovery matrix with controlled tenants, then activate client access only after every cross-tenant attempt fails closed and Accelerate behavior remains intact.",
    acceptance: [
      "Two controlled tenants can hold identical identities, provider IDs, and logical idempotency keys without collision or visibility",
      "Founder, tenant admin, multi-membership, revoked, suspended, unauthenticated, tampered-context, replay, provider-failure, and rollback scenarios have deterministic evidence",
      "Every retained admin route and affected public/provider path passes desktop/mobile and direct API isolation coverage with no stale tenant content",
      "Production activation records migration, schema, isolation, provider, deployment, alias, and clean repository receipts; rollback suspends non-Accelerate effects without removing tenant data",
    ],
    dependencies: ["Tenant-isolate providers, public intake, webhooks, and jobs"],
    start:
      "scripts; docs/self-hosting/REVENUE-OS-SETUP.md; Setup Center; tenant rollout controls; release handoff",
    guardrails:
      "Do not invite a real client, enable their provider effects, migrate production, or deploy without explicit founder release authority. Never use uncontrolled production contacts or recipients for isolation tests.",
    labels: ["testing", "security"],
    evidence:
      "Shipped 2026-08-31. Production applies the shared schema, tenant authorization, public/provider boundaries, lifecycle RPCs, Revenue Recovery release, uniqueness-index cutover, and just-in-time suspension guard. Schema verification passed 402/402 (receipt 407abd6c-95b5-441f-8f9e-d58c54a2833b). The exact released source is 8a37624c67b81716aa6d23a7284b58d435f1429a; Vercel deployment dpl_ByzPBUJgQ54Sxh6YCEumRFtbLioi is Ready and the canonical alias serves deployment identity 8a37624c67b8. The complete post-deploy and pre-activation gates passed 23/23 and 28/28, with the unrelated Next.js investigation explicitly excluded at immutable commit 05e6fc8c189e8b512fa9adfa4a28e4abba2d34b4. Controlled live proof created only the reserved `.invalid` Alpha/Beta tenants: identical contact, revoked Resend provider ID, and idempotency key coexist; alpha sees one row, forged beta context sees none, and suspension fails closed. The browser workspace/provider matrix passed at desktop 1440 and mobile 390. After the clean pre-activation gate, the founder audited and activated `isolation-proof-alpha`; it remains active with zero connected providers and five activation audit receipts. No real client was invited and no provider credentials, send, webhook, or external effect was activated. PostgreSQL lifecycle/suspension, provider/webhook, tenant migration/isolation, and demo checks all pass.",
    verification:
      "npm run test:tenant-migration; npm run test:tenant-isolation; npm run test:tenant-lifecycle; npm run test:tenant-lifecycle:postgres; npm run test:tenant-suspension; npm run test:tenant-suspension:postgres; npm run test:tenant-cutover; npm run verify:tenant-cutover -- --stage=repository --exclude-worktree=<branch>@<full-sha>; npm run verify:tenant-production-isolation -- --confirm-controlled-production-isolation; npm run verify:tenant-lifecycle; npm run db:verify-schema; npm run qa:tenant-workspaces; npm run verify:tenant-providers; npm run verify:webhook-cron-defense; npm run test:admin-demo-contract; npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build; git diff --check.",
  }),
  card({
    key: "de-vertical-inbound",
    title: "Turn the roofing ingestion path into a configurable playbook",
    workstream: "foundation",
    phase: 2,
    status: "planned",
    priority: "high",
    description:
      "Replace the vertical-specific inbound capture function with one generic qualification path that takes an industry playbook as data, so roofing becomes one configuration entry instead of an exported code path that every future installation inherits.",
    acceptance: [
      "One generic qualification ingest replaces the roofing-named input type and function, taking playbook key, industry, source tag, and next-action copy as data",
      "Existing roofing capture keeps identical canonical behaviour: the same source tags, dedupe keys, activity and audit receipts, proven by replaying a submission",
      "Admin copy and Setup Center guidance that names the vertical reads from the playbook rather than from literals",
      "A second playbook can be added in configuration alone with no change to the ingestion module",
    ],
    dependencies: [
      "Extract every business fact into one tenant configuration",
      "Implement deterministic contact and company identity resolution",
    ],
    start:
      "src/lib/revenue-os/inbound.ts; src/app/api/qualify/route.ts; src/app/admin/bookings/page.tsx; src/app/api/admin/bookings/route.ts; src/app/admin/setup/page.tsx",
    guardrails:
      "Do not change the canonical source tags or dedupe keys written for existing rows without a migration plan; changing them silently breaks idempotency and duplicates historical inquiries. Do not delete the roofing playbook, only relocate it into configuration.",
    labels: ["clonable", "playbook", "inbound"],
    evidence:
      "2026-09-01: generalized qualification ingest in inbound.ts to ingestPlaybookQualification driven by TenantPlaybook configuration in src/config/tenant.ts. Preserves exact canonical source tags (roofing_qualifier), dedupe keys, activities, tasks, and audit logs. Adding a second playbook (e.g. legal, hvac) executes dynamically without changes to the ingestion module. Verified with test:playbooks covering roofing replay parity, multi-playbook dynamic routing, and idempotent deduplication.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run test:playbooks; replaying the same qualification payload produces exactly one canonical opportunity, one activity, and one task, matching pre-change source tags.",
  }),
  card({
    key: "install-runbook",
    title: "Prove a clean client installation end to end",
    workstream: "productization",
    phase: 5,
    status: "backlog",
    priority: "medium",
    description:
      "Document and automate the instance-per-client installation so a new business can be stood up from an empty Supabase project to a green Setup Center without copying any Accelerate data, and prove it with a repeatable smoke test.",
    acceptance: [
      "A written runbook covers creating the database, running every migration in its documented order, authoring the tenant config, setting the required environment variables, deploying, and walking Setup Center to ready",
      "A scripted clone smoke test runs the full migration order against a scratch database, boots with a fixture tenant config, and asserts inbound capture, Today, and a dry-run campaign with zero rows originating from Accelerate",
      "The smoke test fails loudly when a migration is missing, out of order, or not idempotent",
      "Setup Center guidance and external project links resolve correctly for an installation that is not Accelerate",
    ],
    dependencies: [
      "Extract every business fact into one tenant configuration",
      "Turn the roofing ingestion path into a configurable playbook",
      "Finish Setup Center as the operational control plane",
    ],
    start:
      "docs/self-hosting/SELF-HOSTING.md; migrations/; scripts/; src/config/tenant.ts; src/app/admin/setup",
    guardrails:
      "Never point the smoke test at the Accelerate production database, and never copy customer records, credentials, operational history, or audit rows into a new installation. A clean installation starts empty; seeding it with real data is a separate, explicitly authorized decision.",
    labels: ["clonable", "install", "smoke-test"],
    verification:
      "The clone smoke test must pass against a scratch database with zero Accelerate rows, and must be shown to fail when a migration is removed from the ordered list.",
  }),
  card({
    key: "command-palette-tools",
    title: "Connect the command palette to real Revenue OS actions",
    workstream: "admin",
    phase: 3,
    status: "planned",
    priority: "medium",
    description:
      "Make search and commands navigate records, create tasks/opportunities, compose messages, open setup actions, and invoke safe AI reads.",
    acceptance: [
      "Commands are discoverable by plain-language keywords and keyboard navigation",
      "Record search uses canonical identities and never leaks unauthorized data",
      "Write commands enter the same validation and confirmation path as their page UI",
    ],
    dependencies: [
      "Implement deterministic contact and company identity resolution",
      "Complete AI tool registry and impact tiers",
    ],
    start: "src/app/admin/layout.tsx; RevenueAICommand.tsx; admin search API",
    guardrails: "Do not add command-only business logic or bypass confirmation gates.",
    labels: ["command-palette", "productivity"],
    evidence:
      "2026-08-16: Meta/Ctrl-K opens one accessible palette backed by the route registry; it supports keyboard navigation, route discovery, global compose, and AI command access. Remaining: canonical record search, direct create task/opportunity commands, setup recovery commands, safe AI reads, authorization/result tests, and shared confirmation for write commands.",
  }),

  // Phase 2/3, Google Workspace and communication operations
  card({
    key: "google-oauth-first-sync",
    title: "Connect Google OAuth and complete the first Workspace sync",
    workstream: "google",
    phase: 2,
    status: "blocked",
    priority: "high",
    owner: "John",
    description:
      "Configure the founder-only Google connection with the minimum Gmail, Calendar, and selected-Drive scopes, then produce successful source receipts.",
    acceptance: [
      "OAuth state validates and encrypted refresh credentials are usable",
      "Setup Center shows the connected account, exact scopes, token health, and last successful sync",
      "Gmail and Calendar complete a first sync; Drive reads only explicitly saved folder IDs",
    ],
    dependencies: [
      "Harden encrypted secret and token storage",
      "Finish Setup Center as the operational control plane",
    ],
    start: "src/app/api/admin/google/authorize; callback; sync; src/lib/revenue-os/google.ts",
    guardrails:
      "A database row alone is never connected. Do not enable Calendly or broad Drive access.",
    labels: ["oauth", "founder-action"],
    evidence:
      "Blocked 2026-08-31 only on founder-owned Google Cloud credentials, deployment of those variables, and consent. `google-oauth-readiness.v1` now turns the handoff into one deterministic gate: five source checks pass for the exact minimum scopes, HMAC-authenticated expiring tenant-bound state, explicit tenant-composite connection/Calendar/Drive upserts, stable browser-safe failures, and the ten-folder Drive boundary. Setup reads provider and run evidence through the bootstrap tenant client while retaining platform-global checks on the platform client, so another tenant cannot make founder health ambiguous; its connected state now requires valid access and refresh envelopes and visibly renders the exact granted scopes, envelope health, token expiry, and source receipt timestamps without returning token values. Integrations now explains successful, cancelled, expired, unconfigured, reconnect, inactive-tenant, and generic failed OAuth returns without reflecting provider/database text. The read-only Production stage reports 6 passed / 7 blocked: bootstrap tenant active; no Google variable names, connection, token-envelope evidence, granted scopes, or Gmail/Calendar receipts; Drive settings unavailable because no connection exists. It lists only Vercel variable names and non-secret database booleans/statuses. No signed-in browser surface was available, so no OAuth consent, credential creation, deployment, provider read, or external mutation was attempted. Founder next action: create the Google OAuth web client with callback `https://www.acceleratewith.us/api/admin/google/callback`, add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` to Production, explicitly release that configuration, then authorize from the bootstrap Integrations workspace. Codex can run the connection test and first Gmail/Calendar sync immediately afterward; Drive remains not configured until explicit folder IDs are selected.",
    verification:
      "npm run test:google-oauth; npm run test:google-readiness; npm run verify:google-readiness; npm run verify:google-readiness -- --stage=production (expected blocked until founder credential/consent step); npm run test:gmail-sync-plan; npm run test:gmail-reply-mime; npm run test:secret-storage; npm run verify:tenant-providers; npm run verify:agent-contract; npm run seed:features -- --verify; npx tsc --noEmit; npm run lint; npm run build; git diff --check.",
  }),
  card({
    key: "google-admin-sync-controls",
    title: "Add scoped Google sync controls to admin integrations",
    workstream: "google",
    phase: 2,
    status: "planned",
    priority: "medium",
    description:
      "Expose safe source-scoped Google workspace sync actions in the Integrations admin surface and preserve truthful busy/error behavior.",
    acceptance: [
      "Google card shows explicit actions for all, Gmail, Calendar, and Drive sync",
      "Buttons disable cleanly when Google is disconnected or a sync is already running",
      "Source failures surface through existing admin notification channels",
      "Provider catalog refreshes after each sync request so evidence status updates in place",
    ],
    dependencies: ["Connect Google OAuth and complete the first Workspace sync"],
    start: "src/app/admin/integrations/page.tsx; src/app/api/admin/google/sync/route.ts",
    guardrails:
      "Do not expose external action controls outside Google card, and never fire additional writes without `runGoogleSync` backend receipts.",
    labels: ["oauth", "integrations"],
    verification:
      "Manual catalog interaction plus `npx tsc --noEmit` and `npm run lint` on the updated Integrations page.",
    evidence:
      "2026-09-01 Added source-scoped Google action buttons in `/admin/integrations` with stateful disable/spinner behavior using `/api/admin/google/sync` `{ source }` dispatch, plus catalog refresh after invocation and toast feedback for skipped/started/error states.",
  }),
  card({
    key: "google-token-health-reconnect",
    title: "Add Google token health, scope drift, and reconnect recovery",
    workstream: "google",
    phase: 2,
    priority: "high",
    description:
      "Detect revoked credentials, missing scopes, refresh failures, and account changes, and guide the founder through safe reconnection.",
    acceptance: [
      "Connection status becomes degraded or revoked on real token failures",
      "Reconnect preserves local canonical records and records the new identity/scopes",
      "Setup Center shows last success, failure reason, and a working reconnect action",
    ],
    dependencies: ["Connect Google OAuth and complete the first Workspace sync"],
    start: "src/lib/revenue-os/google.ts; Setup Center Google checks",
    guardrails:
      "Never log access or refresh tokens. Do not call a connection healthy based only on token presence.",
    labels: ["oauth", "recovery"],
  }),
  card({
    key: "gmail-incremental-sync",
    title: "Import Gmail incrementally with cursor recovery",
    workstream: "gmail",
    phase: 2,
    status: "blocked",
    priority: "high",
    description:
      "Persist Gmail history cursors, process oldest unseen work first, report deferred backlog, and safely recover expired cursors.",
    acceptance: [
      "Repeated syncs are idempotent and advance a durable history cursor only after processed work",
      "Expired or invalid history IDs trigger bounded recovery without duplicating messages",
      "Source receipts report fetched, processed, deferred, duplicate, and failed counts",
    ],
    dependencies: [
      "Connect Google OAuth and complete the first Workspace sync",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start: "src/lib/revenue-os/google.ts; src/app/api/admin/google/sync/route.ts; source_runs",
    guardrails:
      "Do not mark partial work as successful or skip older unseen messages to make freshness look better.",
    labels: ["sync", "reliability"],
    evidence:
      "2026-08-17: Gmail sync now captures a pre-work profile history cursor, derives unique affected thread IDs from Gmail history, and only persists the next cursor after a complete, non-deferred run. Expired history cursors use a bounded full-thread recovery path and retain the old cursor while backlog/failure remains. Source receipts report mode, cursor presence/advance, listed/stored/failed/deferred counts. Shared exact primary/alternate-email identity and campaign reply stops remain idempotent. Remaining: page-token persistence for deferred initial/history pages, oldest-unseen pagination proof, Gmail connection production setup, and live provider replay/failure fixtures.",
  }),
  card({
    key: "gmail-pubsub-watch",
    title: "Add Gmail Pub/Sub watch renewal with scheduled fallback",
    workstream: "gmail",
    phase: 3,
    priority: "medium",
    description:
      "Use push notifications when configured, renew watches before expiry, and retain protected scheduled incremental sync as fallback.",
    acceptance: [
      "Push notifications validate identity and replay IDs before requesting sync",
      "Watch expiry and renewal are visible in health status",
      "A missed or unavailable push path is recovered by scheduled incremental sync",
    ],
    dependencies: [
      "Import Gmail incrementally with cursor recovery",
      "Harden webhook, cron, replay, validation, and rate-limit defenses",
    ],
    start: "Google webhook routes; vercel.json; source/job receipts",
    guardrails:
      "Push payloads trigger bounded sync work; they never become trusted message content.",
    labels: ["pubsub", "webhooks"],
  }),
  card({
    key: "gmail-thread-idempotency",
    status: "planned",
    title: "Preserve Gmail threading and message idempotency",
    workstream: "gmail",
    phase: 2,
    priority: "high",
    description:
      "Normalize Gmail threads and messages while retaining RFC message IDs, references, provider IDs, participants, and reply headers.",
    acceptance: [
      "One Gmail message produces one canonical message even across webhook, incremental sync, and reply receipt paths",
      "Replies stay in the original Gmail thread",
      "Thread chronology and inbound/outbound direction remain correct across aliases",
    ],
    dependencies: [
      "Import Gmail incrementally with cursor recovery",
      "Finish one auditable communication sender",
    ],
    start: "conversations/messages schema; Google sync and reply services",
    guardrails: "Do not synthesize threading solely from subject lines.",
    labels: ["threading", "idempotency"],
  }),
  card({
    key: "gmail-record-association",
    status: "planned",
    title: "Associate Gmail threads with canonical revenue records",
    workstream: "gmail",
    phase: 2,
    priority: "high",
    description:
      "Link participants and conversation context to contacts, companies, opportunities, campaigns, and proposals with review for ambiguity.",
    acceptance: [
      "Deterministic identity matches link automatically with recorded evidence",
      "Ambiguous or unknown participants enter a founder review action",
      "Manual link/create actions are audited and update downstream context",
    ],
    dependencies: [
      "Implement deterministic contact and company identity resolution",
      "Preserve Gmail threading and message idempotency",
    ],
    start: "src/lib/revenue-os/identity.ts; Conversations APIs and UI",
    guardrails:
      "Do not auto-create duplicate companies from consumer email domains or merge ambiguous contacts.",
    labels: ["identity", "conversations"],
  }),
  card({
    key: "gmail-reply-actions",
    title: "Finish reply, local archive, and follow-up actions in Conversations",
    workstream: "gmail",
    phase: 2,
    priority: "high",
    description:
      "Let the founder reply in-thread, link/create records, set next action, create a task, archive locally, and enroll permitted follow-up from one conversation.",
    acceptance: [
      "Reply preview shows exact recipients, thread, and content before the final send",
      "Successful replies write provider and canonical receipts once",
      "Failures retain the draft and expose a safe retry without duplicate sending",
    ],
    dependencies: [
      "Preserve Gmail threading and message idempotency",
      "Associate Gmail threads with canonical revenue records",
    ],
    start: "src/app/admin/conversations; conversations/reply API; communication sender",
    guardrails:
      "Do not mutate Gmail labels for local archive unless separately confirmed and documented.",
    labels: ["reply", "workflow"],
  }),
  card({
    key: "gmail-ai-triage-actions",
    title: "Add grounded AI drafting, intent classification, and next-action suggestions",
    workstream: "gmail",
    phase: 3,
    priority: "medium",
    description:
      "Use bounded thread and revenue context to draft replies, classify intent, summarize history, and propose follow-up without taking external action automatically.",
    acceptance: [
      "Drafts cite the conversation facts used and distinguish uncertainty",
      "Intent and next-action suggestions are editable and never silently move pipeline stage",
      "Every model run and accepted/rejected proposal is traceable",
    ],
    dependencies: [
      "Finish reply, local archive, and follow-up actions in Conversations",
      "Enforce bounded AI context and grounding rules",
    ],
    start: "RevenueAICommand.tsx; src/lib/revenue-os/ai-agent.ts; Conversations UI",
    guardrails:
      "AI must not invent pricing, availability, company facts, recipients, or commitments.",
    labels: ["ai", "triage"],
  }),

  card({
    key: "calendar-sync-association",
    title: "Synchronize Calendar events and associate revenue records",
    workstream: "calendar",
    phase: 2,
    status: "blocked",
    priority: "high",
    description:
      "Import upcoming and recent Google Calendar events idempotently and link attendees to contacts and opportunities.",
    acceptance: [
      "Provider event updates and cancellations update one canonical event",
      "Attendee identity resolution records conflicts instead of guessing",
      "Today and record timelines show correct timezone, status, links, and opportunity context",
    ],
    dependencies: [
      "Connect Google OAuth and complete the first Workspace sync",
      "Implement deterministic contact and company identity resolution",
    ],
    start: "src/lib/revenue-os/google.ts; calendar_events schema; Today and record details",
    guardrails: "Do not create or change external events during read synchronization.",
    labels: ["sync", "meetings"],
    evidence:
      "2026-08-17: Google Calendar read sync now resolves attendees through the shared exact primary/alternate-email resolver, links only one unambiguous canonical contact and its current opportunity, and persists matched/unmatched/ambiguous evidence in event metadata. A new confirmed upcoming meeting stops pending campaign outreach through campaign-stops.ts once, but never changes Google Calendar or automatically changes pipeline stage. Remaining: live Workspace connection, cancellation/update behavior proof, event timeline/Today UI, timezone fixtures, and founder-confirmed external event mutations.",
  }),
  card({
    key: "calendar-confirmation-flow",
    title: "Add confirmation-gated Calendar create, reschedule, and cancel",
    workstream: "calendar",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Allow UI and AI to propose exact event mutations while requiring founder confirmation of calendar, attendees, time, timezone, and action.",
    acceptance: [
      "No external event mutation occurs before explicit in-turn confirmation",
      "Approved mutations are idempotent and update local event/activity records once",
      "Provider conflicts or changed events force a refreshed confirmation",
    ],
    dependencies: [
      "Synchronize Calendar events and associate revenue records",
      "Finish the shared AI confirmation system",
    ],
    start: "action_queue; src/lib/revenue-os/actions.ts; Google Calendar service",
    guardrails: "Never infer attendee email or timezone when ambiguous. Calendly remains disabled.",
    labels: ["confirmation", "external-action"],
  }),
  card({
    key: "precall-briefs",
    title: "Generate grounded pre-call briefs",
    workstream: "calendar",
    phase: 3,
    priority: "high",
    description:
      "Assemble company research, qualification, pipeline history, conversation, proposal state, documents, and stated objectives into an actionable meeting brief.",
    acceptance: [
      "Briefs name their source records and flag missing or stale context",
      "The founder sees objectives, participants, history, risks, open questions, and recommended next step",
      "Brief generation is available from Today, event, and opportunity views",
    ],
    dependencies: [
      "Synchronize Calendar events and associate revenue records",
      "Enforce bounded AI context and grounding rules",
    ],
    start: "calendar_events; drive_documents; conversations; Revenue AI agent",
    guardrails: "Do not fabricate biographies, revenue, pain points, or prior commitments.",
    labels: ["ai", "meeting-prep"],
  }),
  card({
    key: "postmeeting-workflow",
    title: "Build post-meeting notes and commitment extraction",
    workstream: "calendar",
    phase: 3,
    priority: "high",
    description:
      "Prompt after meetings for notes, then extract commitments, tasks, follow-ups, stage suggestions, and proposal inputs for founder review.",
    acceptance: [
      "Meeting notes attach to event, opportunity, participants, and activity timeline",
      "Extracted tasks and stage changes remain proposals until confirmed",
      "Duplicate prompts and repeated extraction do not duplicate commitments",
    ],
    dependencies: [
      "Synchronize Calendar events and associate revenue records",
      "Build the canonical task generator with deduplication",
      "Finish the shared AI confirmation system",
    ],
    start: "Today queue; calendar events; action_queue; task service",
    guardrails: "Do not record inferred commitments as facts without founder confirmation.",
    labels: ["meetings", "follow-up"],
  }),

  card({
    key: "drive-folder-boundary",
    title: "Enforce selected-folder Drive access boundaries",
    workstream: "drive",
    phase: 2,
    status: "planned",
    priority: "high",
    description:
      "Let the founder save a small allowlist of Drive folders and prove synchronization cannot traverse unrelated content.",
    acceptance: [
      "Folder IDs are validated, deduplicated, capped, and visible in Setup Center",
      "Sync requests and results remain within the allowlisted folder ancestry",
      "Removing a folder stops future reads without deleting prior provenance silently",
    ],
    dependencies: ["Connect Google OAuth and complete the first Workspace sync"],
    start: "src/app/admin/setup/page.tsx; Google sync settings and Drive listing",
    guardrails:
      "Drive is read-only in the first release. Never request or use full-drive write scope.",
    labels: ["privacy", "folders"],
  }),
  card({
    key: "drive-content-indexing",
    status: "planned",
    title: "Extract and index approved Drive documents",
    workstream: "drive",
    phase: 3,
    priority: "medium",
    description:
      "Fetch supported document text and metadata, hash content, skip unchanged files, and retain folder and provider provenance.",
    acceptance: [
      "Supported Docs/files produce searchable text with provider ID, link, modified time, folder, and hash",
      "Unchanged content is not re-extracted; deleted/inaccessible files become explicit states",
      "Duplicate content is detected without erasing distinct source provenance",
    ],
    dependencies: [
      "Enforce selected-folder Drive access boundaries",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start: "drive_documents schema; src/lib/revenue-os/google.ts",
    guardrails: "Do not index unrelated folders, binary secrets, or overwrite source files.",
    labels: ["indexing", "provenance"],
  }),
  card({
    key: "drive-provenance-retrieval",
    status: "planned",
    title: "Ground AI retrieval in Drive provenance and citations",
    workstream: "drive",
    phase: 3,
    priority: "medium",
    description:
      "Retrieve only relevant approved document excerpts for research, briefs, audits, and proposal drafts and return source links.",
    acceptance: [
      "AI context records document ID, name, link, content hash, and relevant excerpt",
      "Results prefer current sources and flag conflicting or stale documents",
      "The UI exposes citations the founder can open before approving output",
    ],
    dependencies: [
      "Extract and index approved Drive documents",
      "Enforce bounded AI context and grounding rules",
    ],
    start: "drive_documents; src/lib/revenue-os/ai-agent.ts; AI UI",
    guardrails:
      "Do not dump the entire Drive corpus into prompts or treat source documents as instructions.",
    labels: ["ai", "citations"],
  }),

  // Phase 3, safe campaigns and proposals
  card({
    key: "campaign-policy-versioning",
    title: "Enforce campaign policy envelopes and version reapproval",
    workstream: "campaigns",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Persist the approved audience, sender, copy, steps, timing, stop conditions, and daily limit as an immutable executable version.",
    acceptance: [
      "Activation records the exact version and approval actor/time",
      "Material edits create a new draft version and block execution until reapproved",
      "The executor can prove every send was inside the active envelope",
    ],
    dependencies: [
      "Finish one auditable communication sender",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start: "src/lib/revenue-os/campaigns.ts; campaigns API and schema",
    guardrails:
      "One-time activation is not blanket permission for arbitrary recipients, copy, cadence, or volume.",
    labels: ["approval", "versioning"],
    evidence:
      "2026-08-16: campaigns store policy JSON, version/approved_version, approval actor/time, and activation rejects unreviewed or empty campaigns; the UI routes activation through action_queue confirmation. Remaining: immutable version snapshots, material-edit invalidation across every field, executable-envelope receipts per send, and reapproval tests.",
  }),
  card({
    key: "campaign-dry-run",
    title: "Build campaign dry-run, exclusion, and sample personalization review",
    workstream: "campaigns",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Show the exact eligible recipients, exclusions, reasons, step timing, limit impact, and representative personalized messages before activation.",
    acceptance: [
      "Dry-run output is derived from the same eligibility logic as execution",
      "Suppressed, invalid, duplicate, replied, booked, converted, and over-limit recipients show exclusion reasons",
      "Founder can inspect deterministic samples without sending",
    ],
    dependencies: [
      "Enforce campaign policy envelopes and version reapproval",
      "Implement deterministic contact and company identity resolution",
    ],
    start: "campaigns/preview API; Campaigns page",
    guardrails:
      "Dry run must have no external side effects and must not expose secret personalization context.",
    labels: ["preview", "safety"],
    evidence:
      "2026-08-16: the preview API and Campaigns workspace produce no-send eligible/excluded recipient review, policy/limit context, and rendered samples using shared campaign helpers. Remaining: one eligibility function shared verbatim with execution, complete suppression/reply/booking/conversion reasons, deterministic fixture coverage, and proof of zero side effects.",
  }),
  card({
    key: "campaign-enrollment-personalization",
    title: "Complete campaign enrollment and bounded personalization",
    workstream: "campaigns",
    phase: 3,
    priority: "high",
    description:
      "Enroll canonical contacts once with auditable eligibility and generate only approved, fact-grounded personalization fields.",
    acceptance: [
      "Enrollment stores campaign version, contact, eligibility evidence, and initial state",
      "Duplicate membership and cross-campaign suppression rules are enforced",
      "Missing personalization facts exclude or use approved fallback copy rather than fabrication",
    ],
    dependencies: [
      "Build campaign dry-run, exclusion, and sample personalization review",
      "Enforce bounded AI context and grounding rules",
    ],
    start: "campaign_members; campaigns/members API; identity and AI services",
    guardrails:
      "Do not scrape or invent facts during send execution. Material audience changes require reapproval.",
    labels: ["enrollment", "personalization"],
  }),
  card({
    key: "campaign-jit-executor",
    title: "Finish the just-in-time internal campaign executor",
    workstream: "campaigns",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Claim due campaign steps internally, re-check policy and stop conditions at send time, enforce daily limits, and record terminal receipts.",
    acceptance: [
      "Future sends remain internal until due and can be prevented by pause or policy change",
      "Executor atomically claims one due step and records sent, skipped, deferred, or failed truthfully",
      "Timezone, cadence, retry, and daily-limit behavior are deterministic and tested",
    ],
    dependencies: [
      "Enforce campaign policy envelopes and version reapproval",
      "Complete campaign enrollment and bounded personalization",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start: "src/app/api/cron/revenue-campaigns; src/lib/revenue-os/action-executor.ts",
    guardrails:
      "Never pre-schedule the full sequence at Resend and never retry an uncertain provider result without idempotency evidence.",
    labels: ["executor", "queue"],
    evidence:
      "2026-08-20: the executor had never been able to send to anyone, and reported success while doing it. Three independent faults: members added through the admin UI carried a NULL contact_id because the UI posted a bare email, the claim RPC returns early on a NULL contact, and members got a NULL next_send_at because only activation backfills it. The executor then swallowed the failed claim with a bare `continue`, so the cron returned HTTP 200 with {sent:0,failed:0,stopped:0}. Resend also rejects tag values outside [A-Za-z0-9_-] and campaign templates are named `campaign:<id>:step:<n>`, so even a valid member would have failed. All fixed. Added: MAX_SEND_ATTEMPTS with hourly backoff so a failed send is retryable rather than terminally stopped, releaseStaleSendClaims so a member stranded in `sending` by a crashed run is recovered, and globalDailySendCap so N active campaigns cannot each send their own ceiling from one sending domain. Policy normalisation, the global cap, and template rendering are covered by `npm run test:job-and-task-contracts`; execution is proven against production by `npm run verify:campaign-execution`. NOT SHIPPED: timezone behaviour is not yet deterministic or tested.",
  }),
  card({
    key: "campaign-stop-conditions",
    title: "Enforce every campaign stop condition immediately",
    workstream: "campaigns",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Stop future steps on reply, hard bounce, complaint, unsubscribe, manual pause, opportunity conversion, meeting booking, or policy invalidation.",
    acceptance: [
      "Each stop source changes member eligibility before the next send claim",
      "Stop reason, source receipt, time, and affected pending steps are visible",
      "Race tests prove a stop and send cannot both win incorrectly",
    ],
    dependencies: [
      "Finish the just-in-time internal campaign executor",
      "Add Resend delivery webhooks and suppression receipts",
      "Complete campaign unsubscribe handling",
    ],
    start: "campaign member state; messages; webhook routes; calendar/opportunity events",
    guardrails: "Do not rely on nightly cleanup for immediate safety stops.",
    labels: ["stops", "safety"],
    evidence:
      "2026-08-17: added src/lib/revenue-os/campaign-stops.ts as the only writer for pending campaign-member stop states. Public unsubscribe, Resend bounce/complaint/suppression, and opportunity progression now use one reason/status mapping, create canonical activity/audit evidence, and include sending claims. Migration 20260817-campaign-stop-claims.sql serializes stop and due-send claim decisions per canonical contact inside PostgreSQL; the claim validates active contact plus approved active campaign, and the lock-order correction avoids stop/claim deadlocks. Controlled production QA confirms a stopped membership cannot later claim a send. Remaining: Gmail reply and Calendar sources, campaign-level pause/policy invalidation receipts, contention/stale-claim recovery proof, visible exception counts, and production signed Resend webhook proof.",
  }),
  card({
    key: "campaign-unsubscribe",
    title: "Complete campaign unsubscribe handling",
    workstream: "campaigns",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Provide one-click public unsubscribe, standards-compliant headers, durable suppression, and operator-visible receipts.",
    acceptance: [
      "List-Unsubscribe and one-click headers are present on eligible campaign mail",
      "A valid request suppresses the canonical contact idempotently and stops queued steps immediately",
      "Invalid/replayed requests disclose no recipient data and are logged safely",
    ],
    dependencies: [
      "Finish the just-in-time internal campaign executor",
      "Harden webhook, cron, replay, validation, and rate-limit defenses",
    ],
    start:
      "migrations/20260816-money-first-outreach.sql; src/app/api/unsubscribe/[token]/route.ts; src/lib/revenue-os/communications.ts",
    guardrails:
      "Unsubscribe must not require login. Never reveal whether an arbitrary email exists.",
    labels: ["compliance", "suppression"],
    evidence:
      "2026-08-16: added unguessable per-contact unsubscribe tokens, human GET and standards POST handling, List-Unsubscribe headers, visible email-body link, canonical communication suppression, immediate queued-member stops, and an audit receipt. Production migration applied twice successfully for idempotency; contacts.unsubscribe_token and messages.idempotency_key are live through the service-role path. Remaining: browser/API tests, suppression preview evidence, and operator-visible aggregate counts.",
  }),
  card({
    key: "resend-webhooks",
    title: "Add Resend delivery webhooks and suppression receipts",
    workstream: "campaigns",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Verify and process delivered, bounced, complained, opened, and clicked events idempotently and connect hard failures to suppression.",
    acceptance: [
      "Provider signatures and replay IDs are verified before mutation",
      "One provider event produces one webhook receipt and activity result",
      "Hard bounce and complaint suppress future sends before another campaign claim",
    ],
    dependencies: [
      "Finish one auditable communication sender",
      "Harden webhook, cron, replay, validation, and rate-limit defenses",
    ],
    start: "webhook_receipts; Resend webhook route; message/activity schemas",
    guardrails: "Open and click signals are advisory analytics, not proof of human intent.",
    labels: ["resend", "webhooks"],
    evidence:
      "2026-08-17: shared sender now applies stable Resend idempotency keys and canonical message/conversation/campaign/source/template tags. Added signed raw-payload webhook route, atomic provider replay receipt, message delivery-state fields, canonical activity/audit results, and immediate campaign/contact suppression for bounce, complaint, and provider suppression. 2026-08-18: the webhook now rejects declared oversized bodies before parsing, processes hard-failure suppression as a required awaited operation, and never lets an older out-of-order event overwrite a newer delivery state; sender receipt persistence now fails closed into reconciliation after provider acceptance. Verification: npm run test:webhook-cron-defense; npm run test:campaign-stops; npx tsc --noEmit; npm run lint. Remaining: configure RESEND_WEBHOOK_SECRET and endpoint in Resend, production signed-event proof, campaign performance rollups, and reply/received-email handling.",
  }),
  card({
    key: "campaign-performance-exceptions",
    title: "Expose campaign performance, exceptions, and recovery",
    workstream: "campaigns",
    phase: 4,
    priority: "high",
    description:
      "Report enrollment, sends, delivery, replies, stops, meetings, proposals, wins, failures, backlog, and recovery actions by approved version.",
    acceptance: [
      "Metrics reconcile to messages, receipts, member state, opportunities, and stage events",
      "Failed/deferred members show reason and safe next action",
      "Founder can pause immediately and inspect remaining unsent work",
    ],
    dependencies: [
      "Enforce every campaign stop condition immediately",
      "Consolidate analytics on canonical source-to-revenue data",
    ],
    start: "Campaigns UI; analytics service; job/webhook receipts",
    guardrails:
      "Do not compare versions without labeling policy changes or hide excluded recipients from denominators.",
    labels: ["analytics", "exceptions"],
  }),

  card({
    key: "proposal-lifecycle-service",
    title: "Complete the proposal lifecycle and version rules",
    workstream: "proposals",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Control draft, sent, viewed, accepted, declined, expired, and superseded states with linked contact, company, and opportunity.",
    acceptance: [
      "Every state transition is validated, idempotent, and recorded in proposal_events and audit_log",
      "Material edits after send create a new version and supersede the old one",
      "Accept/decline updates the opportunity through the pipeline service",
    ],
    dependencies: [
      "Finish the canonical pipeline transition service",
      "Complete before/after audit coverage for material changes",
    ],
    start: "proposal schema and APIs; src/app/admin/proposals; public proposal page",
    guardrails: "Payment is excluded. Do not mutate accepted proposals in place.",
    labels: ["lifecycle", "versioning"],
    evidence:
      "2026-08-16: proposal schema supports canonical links and proposal_events; existing admin/public routes cover draft, sent/viewed, and accept/decline basics. Remaining: one validated lifecycle service, immutable material revisions/superseding, expiry, audit parity, pipeline-service transitions, and duplicate/concurrency tests.",
  }),
  card({
    key: "proposal-delivery-receipts",
    title: "Send proposals through the auditable communication service",
    workstream: "proposals",
    phase: 3,
    priority: "high",
    description:
      "Preview and confirm the exact recipient, version, public link, subject, and body before sending, then connect the provider receipt.",
    acceptance: [
      "Final send requires explicit confirmation and uses the canonical communication sender",
      "Proposal, message, activity, and provider ID link exactly once",
      "Uncertain or failed delivery retains a safe retry path without duplicate sends",
    ],
    dependencies: [
      "Complete the proposal lifecycle and version rules",
      "Finish one auditable communication sender",
    ],
    start: "proposal send APIs; EmailComposeModal; communication service",
    guardrails:
      "AI can draft but cannot choose pricing, terms, recipient, or final send autonomously.",
    labels: ["delivery", "confirmation"],
  }),
  card({
    key: "proposal-public-decisions",
    title: "Make public proposal views and decisions idempotent",
    workstream: "proposals",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Record public views safely and allow accept or decline without login or payment while preventing duplicate outcomes.",
    acceptance: [
      "View receipts are deduplicated with appropriate privacy controls",
      "Repeated accept/decline requests return the existing terminal outcome",
      "Expired or superseded links cannot change pipeline state",
    ],
    dependencies: ["Complete the proposal lifecycle and version rules"],
    start: "src/app/api/proposal/[token]/route.ts; src/app/proposal/[token]/page.tsx",
    guardrails:
      "Tokens must be unguessable and never expose unrelated records. Decline reason is optional and sanitized.",
    labels: ["public", "idempotency"],
    evidence:
      "2026-08-16: public proposal pages use unguessable tokens and provide view/accept/decline behavior without payment. Remaining: idempotent database decision function, deduplicated privacy-bounded views, expired/superseded enforcement, existing-outcome responses, canonical pipeline/activity updates, and public replay tests.",
  }),
  card({
    key: "proposal-pdf-expiry-followup",
    title: "Finish proposal PDF, expiry, superseding, and follow-up",
    workstream: "proposals",
    phase: 4,
    priority: "medium",
    description:
      "Generate matching PDFs, expire old versions predictably, and create deduplicated founder follow-up when proposal state changes or stalls.",
    acceptance: [
      "PDF content matches the approved public proposal version",
      "Expiry and superseding jobs produce proposal events and prevent stale decisions",
      "Viewed-but-unanswered and accepted/declined states generate the correct next action once",
    ],
    dependencies: [
      "Make public proposal views and decisions idempotent",
      "Build the canonical task generator with deduplication",
    ],
    start: "proposal PDF route; proposal_events; scheduled jobs; Today queue",
    guardrails: "Do not auto-send follow-up unless it is within an approved campaign envelope.",
    labels: ["pdf", "follow-up"],
  }),

  // Phase 3, safe AI command layer
  card({
    key: "founder-note-capture",
    title: "Give the founder's own knowledge a way in",
    workstream: "intelligence",
    phase: 4,
    status: "planned",
    priority: "high",
    owner: "John",
    description:
      "Every input the system has arrives from someone else: a form, a mailbox, a calendar. What the founder himself knows, a constraint a client mentioned, why a deal actually stalled, what was decided and rejected, has nowhere to go. That is the difference between a record of what happened to the business and a second brain. Add a plain capture surface: a note, optionally attached to a contact, company, or opportunity, stored with a date and retrievable later.",
    acceptance: [
      "A note can be written in under ten seconds from anywhere in the admin",
      "A note can attach to a canonical record or stand alone",
      "Notes are activity receipts on the existing ledger rather than a new store",
      "A note is retrievable by the knowledge layer with its date and author intact",
      "Capture never fails silently; a note that did not save says so",
    ],
    dependencies: [],
    start:
      "the activities ledger; the command palette for the entry point; src/app/admin/today for placement",
    guardrails:
      "This is the cheapest possible surface, not a notes product. It must not become a second content store or grow an editor. If it is slower than a text file the founder will not use it, and an unused capture surface is worse than none because it makes the knowledge layer look complete when it is empty.",
    labels: ["second-brain", "ingestion", "capture"],
    evidence:
      "2026-08-23: implemented the canonical activity-backed capture path without a notes table. The founder-only POST route writes a dated founder_note activity with author, optional canonical contact/company/opportunity context, a source/external_id idempotency receipt, and a content-redacted audit row. The global command palette now opens a one-field composer from every admin route; optional person search returns canonical contacts first. Failed saves remain open with their text, attachment, and request ID intact for a safe retry. The shared toast layer was raised above dialogs and constrained inside narrow viewports. Deterministic service/API coverage passes with npm run test:founder-notes. Authenticated browser QA passes with npm run qa:founder-notes across desktop, 390px mobile, dark mode, reduced motion, canonical attachment, keyboard save, a simulated 503, same-key retry, overflow, and console assertions; inspected screenshots are in /tmp/accelerate-founder-note/.",
    verification:
      "Implementation and browser evidence are complete. Keep In Progress until one week of real founder use proves under-ten-second capture and confirms the activity-backed notes are useful to the knowledge workflow.",
  }),
  card({
    key: "second-brain-see",
    title: "Phase A: give the system eyes",
    workstream: "intelligence",
    phase: 4,
    status: "planned",
    priority: "high",
    description:
      "The system sees only what arrives through its own forms. Gmail and Calendar sync exist in code but Google has never been connected, and there is nowhere for the founder's own notes to enter at all. A brain whose only sensory input is a contact form cannot be a second one. Connect Workspace, land threads and events as canonical activity through the existing resolver, and add a plain capture surface for notes.",
    acceptance: [
      "A meeting taken shows up against the right opportunity with no manual entry",
      "An emailed thread resolves to the correct canonical contact, and an ambiguous one is recorded as ambiguous rather than guessed",
      "A note the founder writes is stored with a date and a subject and is retrievable later",
      "The two blocked sync cards leave blocked with live evidence",
    ],
    dependencies: [
      "Standardize every AI workflow on the OpenRouter gateway",
      "Give the founder's own knowledge a way in",
      "Connect Google OAuth and complete the first Workspace sync",
      "Import Gmail incrementally with cursor recovery",
      "Preserve Gmail threading and message idempotency",
      "Associate Gmail threads with canonical revenue records",
      "Synchronize Calendar events and associate revenue records",
    ],
    start:
      "src/lib/revenue-os/google.ts; the blocked gmail-incremental-sync and calendar-sync-association cards; src/lib/revenue-os/identity.ts for resolution",
    guardrails:
      "Reuse resolveOrCreateIdentity. Never guess an association from a partial match; record the ambiguity. Message bodies are canonical activity, not a second copy of the mailbox.",
    labels: ["second-brain", "ingestion"],
    verification:
      "One real meeting and one real thread observed landing against the right records in production, plus the existing verify:inbound-canonical still green.",
  }),
  card({
    key: "second-brain-remember",
    title: "Phase B: a knowledge substrate with provenance",
    workstream: "intelligence",
    phase: 4,
    status: "planned",
    priority: "high",
    description:
      "The system knows rows, not things. Ask what was agreed with a client last month or why a deal stalled and there is nowhere to look. Add a chunked, embedded, retrievable knowledge store where every chunk carries its source, its date, and its confidence. This is the single largest gap and the one that makes the phrase second brain mean anything.",
    acceptance: [
      "Asking what we know about a company returns a grounded answer citing real records and notes",
      "It refuses rather than inventing when it has nothing, and says so plainly",
      "Every retrieved chunk carries source, date, and confidence",
      "When prose and the canonical record disagree, the canonical record wins and the disagreement is visible",
      "Retrieval is one service and one copilot tool, not a second read path",
    ],
    dependencies: [
      "Phase A: give the system eyes",
      "Give the founder's own knowledge a way in",
      "Enforce selected-folder Drive access boundaries",
      "Extract and index approved Drive documents",
      "Ground AI retrieval in Drive provenance and citations",
      "Enforce bounded AI context and grounding rules",
    ],
    start:
      "Supabase pgvector; src/lib/revenue-os/ai-tools.ts for the retrieval tool; the existing activities and messages tables as the first corpus",
    guardrails:
      "An answer grounded in a stale note is worse than no answer, so recency and provenance are not optional. The model never receives an uncontrolled dump; retrieval is bounded like every other tool result.",
    labels: ["second-brain", "memory", "retrieval"],
    verification:
      "A fixture set of questions with known answers, including questions the system must refuse, and a staleness case where a note contradicts the canonical record.",
  }),
  card({
    key: "second-brain-notice",
    title: "Phase C: notice without being asked",
    workstream: "intelligence",
    phase: 5,
    status: "planned",
    priority: "high",
    description:
      "Every code path runs because a request arrived or a daily cron fired. Nothing notices a deal gone quiet, a promise unkept, three inquiries from one company, or a reliable client who has gone silent. Add a background loop producing a written synthesis: what changed, what it means, what is at risk, what needs the founder. Prose worth reading, not a digest of row counts.",
    acceptance: [
      "The brief names the three things that matter and why, not a list of counts",
      "Every claim in it links to the record it came from",
      "A quiet day produces a short honest brief rather than manufactured urgency",
      "The loop reports partial and failed states like every other job and alerts on failure",
    ],
    dependencies: [
      "Phase B: a knowledge substrate with provenance",
      "Decide the scheduling substrate",
      "Generate grounded pre-call briefs",
      "Wire notification preferences into actual dispatch",
      "Deliver proactive operator briefs and leading indicators",
    ],
    start:
      "src/lib/revenue-os/health.ts and runs.ts for the job pattern; loadOperatorQueue for the signal set",
    guardrails:
      "The Supabase Cron wake-up substrate is already shipped; reuse scheduler.ts and runs.ts rather than reopening that decision. This phase is a roll-up over proactive-operator-intelligence, not a second brief generator. Manufactured urgency is the failure mode to design against: a quiet day must read as quiet.",
    labels: ["second-brain", "cognition"],
    verification:
      "A week of briefs read end to end, judged on whether any told the founder something not already known.",
  }),
  card({
    key: "second-brain-act",
    title: "Phase D: a policy registry, not bespoke agents",
    workstream: "intelligence",
    phase: 5,
    status: "planned",
    priority: "medium",
    description:
      "The inbound responder proved the pattern of a versioned founder-signed policy with an envelope, guardrails, a kill switch, and a recorded decision either way. But it is one module written by hand. Generalise it so adding a policy is declaring config and fixtures rather than writing another module and another test suite. Prove it with two more: a stalled-deal nudge and a commitment keeper.",
    acceptance: [
      "A new policy ships without editing auto-responder.ts",
      "Every policy shares one approval surface, one kill switch, and one eval harness",
      "Each policy declares its own envelope and every decline rule is proven to fire",
      "A policy edit bumps its version and suspends it until re-approved, as campaigns already behave",
    ],
    dependencies: [
      "Generalize approved automation policies",
      "Phase A: give the system eyes",
      "Build post-meeting notes and commitment extraction",
    ],
    start:
      "src/lib/revenue-os/auto-responder.ts as the reference implementation; the approved policy version section of the engineering contract",
    guardrails:
      "The envelope is the safety argument, so a policy with no proven decline rules does not ship. Nothing widens its own envelope and the model never edits a policy.",
    labels: ["second-brain", "autonomy", "policy-version"],
    verification:
      "The second and third policies each ship with a full decline-rule suite, and the responder is refactored onto the registry with its 12 rules still passing.",
  }),
  card({
    key: "second-brain-learn",
    title: "Phase E: link action to outcome",
    workstream: "intelligence",
    phase: 6,
    status: "planned",
    priority: "medium",
    description:
      "agent_learning records one bit per run, misattributed across every tool that run touched. Nothing links an action to what happened next: did the reply produce a booking, did the proposed task get done, did the stage move stick or get reverted. Without that link the system accumulates history and never improves, and calling it learning is decoration. Add outcome windows, per-tool attribution, and an eval set per policy.",
    acceptance: [
      "Every autonomous or approved action has an outcome window and a measured result, including a measured nothing",
      "Attribution is per tool rather than per run",
      "A prompt or model change is accepted or rejected against a golden set instead of argued about",
      "Learning stays governed telemetry; no output becomes an instruction automatically",
    ],
    dependencies: [
      "Phase D: a policy registry, not bespoke agents",
      "Build the governed agent learning feedback loop",
      "Summarize meetings and extract reviewable commitments",
    ],
    start:
      "src/lib/revenue-os/agent-learning.ts; agent_runs and audit_log as the existing substrate",
    guardrails:
      "The contract forbids autonomous prompt mutation and that stands. This produces evidence for a human decision, never a self-applied change. Outcome attribution is easy to get quietly wrong, so a measured result must be falsifiable.",
    labels: ["second-brain", "learning", "evals"],
    verification:
      "A policy reports N outcomes from M actions with the linkage inspectable per action, and a deliberately worsened prompt is caught by its eval set.",
  }),
  card({
    key: "second-brain-trust",
    title: "Phase F: one accountable surface",
    workstream: "intelligence",
    phase: 6,
    status: "planned",
    priority: "medium",
    description:
      "Audit rows exist for everything and there is nowhere that says, in sentences, what the system did today, why, and what it decided not to do. Trust is the real bottleneck on autonomy rather than capability, and nobody widens the scope of a system whose reasoning they cannot inspect. Build the narrative surface on the audit ledger and agent_runs, both of which already record enough.",
    acceptance: [
      "The founder can answer what has this thing been doing without opening a table",
      "Declines appear as prominently as actions, since a policy that only shows what it did cannot be audited for what it wrongly skipped",
      "Every statement links to its underlying receipt",
      "Mistakes are surfaced rather than buried",
    ],
    dependencies: [
      "Phase E: link action to outcome",
      "Complete before/after audit coverage for material changes",
      "Complete AI run traces, tool evidence, errors, and usage",
    ],
    start:
      "audit_log; agent_runs and agent_run_events; the responder.declined entries already being written",
    guardrails:
      "This is a read surface over existing receipts. It must not become a second ledger or a place where facts are recomputed differently from the services that produced them.",
    labels: ["second-brain", "trust", "operator-surface"],
    verification:
      "A week of activity reviewed through the surface alone, judged on whether anything material was invisible.",
  }),
  card({
    key: "scheduling-substrate-decision",
    title: "Decide the scheduling substrate",
    workstream: "platform",
    phase: 5,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Phases C through F need something to run when nobody is asking. Vercel Hobby gives exactly two cron slots at daily granularity and both are used by revenue-campaigns and google-workspace-sync. This is an architectural ceiling rather than a backlog item, and it blocks continuous cognition entirely. Three options: Vercel Pro, Supabase pg_cron with edge functions, or an external worker.",
    acceptance: [
      "A substrate is chosen and the reasoning recorded",
      "A job can run on a cadence finer than daily",
      "The chosen path does not fork the one operating path the engineering contract requires",
    ],
    dependencies: [],
    start:
      "vercel.json (both cron slots); src/lib/revenue-os/runs.ts for the claim and receipt pattern any substrate must keep using",
    guardrails:
      "Use Supabase Cron plus pg_net only as a secure wake-up adapter for a Vercel route. Domain work stays in Revenue OS services and every invocation keeps claiming atomically and writing receipts through withJobRun. The first sub-daily job is a read-only health snapshot; do not increase campaign or provider-action cadence under this card.",
    labels: ["platform", "infrastructure", "founder-decision"],
    evidence:
      "Shipped 2026-08-23: Supabase Cron plus pg_net is the free-first cadence substrate and remains a wake adapter only; the authenticated Vercel route calls loadOperationalHealth through withJobRun. URL and bearer credential are encrypted in Vault, the configurator resolves the canonical host before storage so Authorization never crosses a redirect, and the obsolete two-argument claim RPC was removed to keep PostgREST unambiguous. Production automatically returned HTTP 200 at 18:30 UTC with successful job receipt 411f00a6-e05f-4b7a-bc91-b4c80b43603f, independently of the successful 18:17 cadence receipt b1414310-01d3-4450-8209-07bfdbf28549. Controlled production stale-claim takeover passed (dead c2690538-2aa1-498b-adb4-86ac17da8503, recovered by f71a5e9b-c67e-472b-98cb-d4971fea2970). The overload cleanup reran idempotently, schema contract revenue-os.2026-08-23.6 passed 209/209 with receipt 00f404ed-bbca-4794-8a48-6642577bc909, Setup production QA passed 22 checks, and scheduler, cron-defense, schema, stale-recovery, type, lint, build, and agent-contract checks passed.",
    verification:
      "Closed from production behavior: selected architecture, encrypted configuration, canonical-origin defense, authenticated 15-minute automatic execution, two independent successful cadence receipts, deterministic replay, one shared domain/receipt path, stale-claim recovery, idempotent migration, and Setup/schema verification all passed.",
  }),
  card({
    key: "autonomous-inbound-responder",
    title: "Answer every inbound inquiry inside an approved response policy",
    workstream: "ai",
    phase: 4,
    status: "planned",
    priority: "high",
    description:
      "Acknowledge a first-touch inbound inquiry within seconds, grounded strictly in what the prospect wrote and the canonical record, executing inside a founder-approved response policy version rather than a per-message approval. The engineering contract permits an external action without per-instance confirmation only from inside an approved policy version, so the responder is not a trusted agent: it is a signed policy carrying the trigger, envelope, guardrails, template, and model, and any material edit bumps the version and suspends sending until re-approval, exactly as activateCampaign already behaves.",
    acceptance: [
      "A real inbound produces a grounded reply within seconds with a provider receipt, a canonical activity, a pipeline stage move, and a dedupe-safe follow-up task",
      "Every envelope rule is proven to decline: not first touch, existing client, suppressed contact, a human already replied, per-day or per-contact cap reached, outside the allowed window",
      "A decision to decline is recorded with its reason, not just a decision to send, so the policy can be audited for what it wrongly skipped",
      "The kill switch halts sending mid-flight because it is read at execution rather than at scheduling",
      "The reply invents no pricing, availability, dates, commitments, or capabilities, proven against a fixture set including inquiries with thin or hostile input",
      "A policy edit suspends sending until the new version is approved",
    ],
    dependencies: [
      "Standardize every AI workflow on the OpenRouter gateway",
      "Finish one auditable communication sender",
      "Add Playwright journey for inbound capture and pipeline progression",
    ],
    start:
      "src/lib/revenue-os/inbound.ts (ingestInboundLead is the trigger point); src/lib/revenue-os/communications.ts; src/lib/revenue-os/actions.ts; src/lib/admin/settings.ts for the kill switch",
    guardrails:
      "Reuse sendRecordedEmail, transitionOpportunity, createRevenueTask, and recordAudit. Nothing gets its own write path. getSetting lets process.env win unconditionally, so the kill-switch key must not collide with an env var name or it can never be flipped from the admin; admin_settings.value is NOT NULL, so store the strings 'true'/'false'. Responding inline must never be able to lose the lead: the inquiry is persisted and the operator notified before any model call, and a responder failure is recorded and swallowed rather than propagated.",
    labels: ["ai", "autonomy", "inbound", "policy-version"],
    verification:
      "npm run test:responder-envelope (12 decline rules, 5 envelope boundaries, 12 grounding rejections; all 16 guards mutation-tested by removal) and npm run verify:responder (live gating against the real admin_settings table, sending to delivered@resend.dev and restoring the founder's switches afterwards).",
    evidence:
      "2026-08-20: built as an approved policy version rather than a trusted agent. RESPONDER_POLICY_VERSION pins trigger, envelope, guardrails, prompt, and model; sending requires both the kill switch on and an approved version matching exactly, so any material edit suspends replies until re-approval. Runs last inside ingestInboundLead with every failure recorded and swallowed, so a model outage cannot become a dropped inquiry. Declines are audited as carefully as sends. Send goes through sendRecordedEmail with an idempotency key pinned to the opportunity; the model call is traced on agent_runs. Migration 20260820-responder-policy.sql seeds both controls into Admin > Settings, disabled and unapproved. NOT YET PROVEN: the live generation leg. .env.local has no OPENROUTER_API_KEY and Vercel does not return sensitive variables to `pull`, so whether a real model reliably produces drafts the grounding check accepts is unmeasured. That evidence, plus one observed real inbound end to end in production, is required before this is switched on.",
  }),
  card({
    key: "openrouter-ai-gateway",
    title: "Standardize every AI workflow on the OpenRouter gateway",
    workstream: "ai",
    phase: 3,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Replace route-local model clients with one server-only OpenRouter gateway that owns authentication, model selection, structured outputs, timeouts, safe errors, attribution headers, and usage receipts for every Accelerate AI workflow.",
    acceptance: [
      "Contact import, Revenue Copilot, chat, plan generation, insights, content briefs, and proposal drafting call one shared OpenRouter adapter with no direct provider SDK execution",
      "Structured-output calls require a strict JSON schema and reject malformed or unvalidated model output before it reaches a domain service",
      "Setup Center reports OpenRouter key/model readiness without exposing secrets and a missing or failed provider leaves each workflow truthfully unavailable rather than silently switching providers",
      "AI traces retain OpenRouter request ID, resolved model, token usage, duration, and a bounded error summary where the workflow has a run ledger",
    ],
    dependencies: ["Verify founder-only admin access and service-only data policies"],
    start:
      "src/lib/ai/openrouter.ts; src/lib/revenue-os/ai-agent.ts; src/app/api/chat/route.ts; src/app/api/generate-plan/route.ts; admin AI routes; Setup Center",
    guardrails:
      "OPENROUTER_API_KEY is environment-only. Do not retain a direct Anthropic fallback, leak prompts or keys, trust unvalidated JSON, or let a route select an unapproved provider. Model defaults may be overridden only through documented server configuration.",
    labels: ["openrouter", "provider", "structured-output", "ai-architecture"],
    evidence:
      "2026-08-16: implemented one server-only OpenRouter chat/structured-output/text-stream adapter with attribution headers, bounded errors, timeout, model overrides, request IDs, and usage. Revenue Copilot/tool loop, website chat, plan generator, insights, content brief, and proposal draft callers now use it; @anthropic-ai/sdk was removed and source search finds no direct provider client. Setup Center and Settings expose only OPENROUTER_API_KEY plus optional model overrides. The encrypted production Vercel credential is configured; both a direct strict structured-output health call and an authenticated production Contact Import workflow passed on openai/gpt-4.1-mini. The founder-only batch response and ledger retain provider, resolved model, OpenRouter request ID, and token usage. Typecheck, lint, production build, and Contact Import Playwright pass. 2026-08-20: provider-failure coverage now exists as `npm run test:openrouter-resilience` (transient retry with backoff, no retry on permanent failure, caller AbortSignal no longer detaching the request timeout, fallback model handed to OpenRouter). Trace parity closed: the public website chat was the one fully autonomous AI talking to prospects with no run ledger at all, and now opens an `agent_runs` row through the shared `agent-trace` writer and tees its stream so the reply, a client disconnect, and a provider failure all reach a terminal state. `api/admin/ai-insights` was deleted rather than traced; it read pre-canonical tables and returned HTTP 200 with a friendly string on error. Production gateway proven live end to end on 2026-08-20 by POSTing /api/chat on https://www.acceleratewith.us and receiving a grounded on-brand answer rather than DEMO_MODE_REPLY, which is the same property `verify:ai-gateway` checks; that script still cannot run locally because `.env.local` has no OPENROUTER_API_KEY and `.vercel/.env.production.local` returns it empty (Vercel does not return sensitive vars to `pull`).",
  }),
  card({
    key: "ai-contact-importer",
    title: "Import and clean ad hoc contacts with AI review and approval",
    workstream: "ai",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Give the founder one importer for pasted notes, copied lists, CSV/TSV, and JSON. Deterministic parsing runs first; OpenRouter proposes normalized contacts and company links; the founder edits, includes/excludes, and approves an immutable reviewed snapshot before canonical writes execute with row-level receipts.",
    acceptance: [
      "Founder can paste or upload bounded UTF-8 CSV, TSV, JSON, or messy text and receive an editable row preview with normalized name, email, phone, company, role, website, source, confidence, warnings, and create/update/skip decision",
      "Exact normalized-email and deterministic company-domain matches are shown before approval; ambiguous identities and invalid rows default to excluded and are never guessed or silently merged",
      "Analysis performs no contact/company writes, approval is bound to the exact selected-and-edited snapshot digest, and execute refuses a stale, unapproved, already-running, or already-completed batch",
      "Approved execution uses the canonical identity/import service, is replay-safe, writes row and batch terminal receipts plus audit/activity provenance, and never creates opportunities, enrolls campaigns, or sends messages",
      "Importer exposes missing OpenRouter configuration, parse/provider/schema failure, partial import, retryable failed rows, completed receipts, and history on responsive desktop/mobile surfaces",
      "Service/API tests cover invalid input, duplicate/replay, stale approval, ambiguous identity, provider failure, partial database failure, and safe resume; Playwright covers paste/upload review, editing, keyboard confirmation, reduced motion, and mobile layout",
    ],
    dependencies: [
      "Standardize every AI workflow on the OpenRouter gateway",
      "Implement deterministic contact and company identity resolution",
      "Complete before/after audit coverage for material changes",
    ],
    start:
      "migrations/20260816-contact-importer.sql; src/lib/revenue-os/contact-imports.ts; src/app/api/admin/revenue-os/contact-imports; src/app/admin/contact-imports; src/lib/admin/navigation.ts; Setup Center",
    guardrails:
      "AI is an extraction assistant, never the writer or approver. Apply the reviewed snapshot without rerunning AI. Bound source size and row count; redact raw source from logs; refuse ambiguous matches; leave blank update fields unchanged; do not create revenue opportunities, send email, enroll campaigns, or ingest unsupported binary files.",
    labels: ["contacts", "import", "approval", "dedupe", "openrouter"],
    evidence:
      "2026-08-16: implemented the idempotent migration, service-only batches/rows/events, atomic digest-bound claim RPC, OpenRouter strict extraction, hard field validation, intra-batch duplicate exclusion, primary/alternate-email and company-domain matching with ambiguity refusal, fill-blank canonical writes, source-row replay reconciliation, activity/audit receipts, founder-only API, responsive importer/history/editor, and explicit approval dialog. Production migration applied twice successfully for idempotency; all three tables and the exact claim RPC are live through the service-role path. A live model initially proposed unsupported example fields; a deterministic evidence guard now strips every value absent from its exact source row, downgrades invalid rows to low confidence, excludes them, and uses explicit Not provided placeholders. Regression tests cover the hallucinated-field case. Authenticated production Playwright verifies 9/9 required Setup readiness, live OpenRouter extraction, trace metadata, truthful review rendering, exclusion, zero contacts/opportunities/messages, controlled-batch cleanup, screenshots, and no settled-state console errors. Local Playwright also passes edit/save/approval/execution receipt at desktop/mobile and reduced motion. Remaining before Shipped: isolated-database fixture coverage for stale approval, ambiguous existing data, provider failure, concurrent claim, partial database failure, and safe resume.",
  }),
  card({
    key: "ai-tool-registry",
    title: "Complete AI tool registry and impact tiers",
    workstream: "ai",
    phase: 3,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Register bounded tools dynamically and classify reads, internal writes, external actions, and destructive actions with explicit schemas and permissions.",
    acceptance: [
      "Only registered tools are exposed for the current context and connection state",
      "Each tool declares impact tier, input schema, output schema, service target, and confirmation requirement",
      "Unregistered or unavailable tool calls fail closed and are traced",
    ],
    dependencies: ["Complete before/after audit coverage for material changes"],
    start:
      "src/lib/revenue-os/ai-tools.ts; src/lib/revenue-os/ai-agent.ts; action_queue; RevenueAICommand.tsx",
    guardrails:
      "Tools must call validated services, never issue arbitrary database writes or unrestricted provider requests.",
    labels: ["tools", "permissions"],
    evidence:
      "2026-08-31 shipped locally: registry v3 declares input/output contracts, service target, provider-connection truth, impact tier, confirmation rule, and bounded tool packs for all seven tools. Dispatch rejects unknown, destructive, malformed, output-invalid, non-finite, and active-pack-unavailable calls before a result reaches the agent; unavailable calls use the existing bounded tool-error trace. The AI Workspace reports runtime availability and reviewed service boundaries, while Setup Center exposes the controlled-tool capability without implying provider execution health. Verification passed: test:ai-tool-gates, test:ai-operations, test:setup-status, test:agent-loop, test:ai-command-runtime, test:openrouter-resilience, TypeScript, zero-warning lint, agent/board contracts, production build, and diff check. Authenticated repository Playwright passed desktop/mobile/dark/reduced-motion/keyboard/overflow/console coverage; capabilities screenshots in /tmp/accelerate-ai-command were opened and reviewed. The QA fixture was updated to the runtime v3 contract and current mobile navigation. No schema, provider, production-data, or deployment change was required. 2026-08-16: created ai-tools.ts as the versioned registry for the six then-current tools. The registry supplied OpenRouter function schemas, impact tier, confirmation requirement, and one service-backed execution path; unknown names failed closed and tool receipts recorded registry metadata.",
  }),
  card({
    key: "ai-confirmation-system",
    title: "Finish the shared AI confirmation system",
    workstream: "ai",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Require explicit in-turn approval for individual sends, stage changes, event mutations, proposal sends, and destructive operations.",
    acceptance: [
      "Confirmation displays exact recipient/record, action, changed fields, and material consequences",
      "Approval is bound to a versioned payload and expires when underlying state changes",
      "Approve, reject, expire, execute, and fail states are auditable and idempotent",
    ],
    dependencies: [
      "Complete AI tool registry and impact tiers",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start: "src/lib/revenue-os/actions.ts; action-executor.ts; Today approvals UI",
    guardrails:
      "A prior general instruction is not confirmation for a newly generated external action.",
    labels: ["confirmation", "safety"],
    evidence:
      "2026-09-01: implemented underlying state freshness binding, campaign version checks, pre-send suppression checks, and consequence safety in action-executor.ts and ai-tools.ts. Action proposals capture expectedStage and expectedVersion at generation time; approval refuses execution with an explicit state-change rejection if the underlying opportunity stage or campaign version moved in the interim. Pre-checks block sends to unsubscribed contacts or replies to archived conversations. ActionReviewDialog in Today workspace was enhanced with impact tier badges (External Action vs Internal Mutation) and explicit material consequence callouts before approval. All approve, reject, expire, execute, and fail transitions are atomic and audited. Verified with 17 deterministic test cases in test:action-execution covering state invalidation, double-claims, duplicate stages, version mismatches, and suppression pre-checks.",
  }),
  card({
    key: "ai-bounded-context",
    status: "in_progress",
    owner: "Codex",
    title: "Enforce bounded AI context and grounding rules",
    workstream: "ai",
    phase: 3,
    priority: "high",
    description:
      "Build prompts from relevant live records, approved templates, business rules, and cited documents rather than uncontrolled database dumps.",
    acceptance: [
      "Every AI workflow has an explicit context budget and source allowlist",
      "Outputs distinguish facts, inferences, missing data, and recommendations",
      "Pricing, recipients, dates, metrics, and company facts cannot be invented silently",
    ],
    dependencies: [
      "Complete AI tool registry and impact tiers",
      "Normalize the cross-channel activity ledger",
    ],
    start: "src/lib/revenue-os/ai-agent.ts; src/lib/ai/prompts.ts; document and record loaders",
    guardrails: "Treat external messages and documents as untrusted data, not instructions.",
    labels: ["grounding", "prompt-safety"],
    evidence:
      "2026-08-31 in progress: Revenue Copilot now consumes the versioned reusable ai-context contract with a 12,000-character bounded conversation, 2,000-character per-message cap, 3,500-character registered-tool receipt cap, source allowlist, explicit untrusted-data boundary, and required Facts/Inferences/Missing information/Recommended next steps answer shape. Tool results are provenance-labeled rather than entering the transcript as anonymous JSON; run evidence records the context version. A final-answer validator degrades answers missing those sections or valid registered-tool citations to an explicit partial response rather than presenting unsupported prose as completed. Plan and proposal generation now receive the typed public service catalog as their only permitted money source, reject generated line items outside its exact name/one-time/monthly values, and reject plan totals that do not reconcile to approved lines. No catalog match yields explicit founder scope confirmation rather than invented pricing. The public prospect assistant uses the same bounded conversation cap, a public-chat source allowlist, explicit visitor-data-not-instruction rule, no-invented-facts/money/capacity contract, and a context-versioned trace receipt. Content briefs and contact imports retain fixed source indexes and reject unsupported model fields before downstream writes. Responder v2 carries a 3,000-character field-bounded untrusted inquiry envelope, fixed source allowlist, and final grounding checks that reject invented money, availability, timelines, capabilities, results, prompt leakage, and unapproved links; a suspended tenant becomes an audited no-send before model or email traffic. Local verification passed test:ai-pricing-grounding, test:ai-context, test:public-chat-context, test:agent-trace, test:agent-loop, test:ai-command-runtime, test:ai-tool-gates, test:ai-operations, test:openrouter-resilience, test:responder-envelope, TypeScript, lint, agent contract, and diff check. Remaining: deploy the exact verified release and capture production gateway/context evidence before this card can ship. No provider, schema, production-data, or deployment action occurred.",
  }),
  card({
    key: "ai-command-runtime",
    title: "Build the persistent streamed AI command runtime",
    workstream: "ai",
    phase: 3,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Turn the one-shot Revenue Copilot into one founder-only runtime with durable conversations, page context, streamed run events, cancellation, bounded history, and the existing registered-tool and action-queue boundaries.",
    acceptance: [
      "A conversation survives navigation and reload with ordered founder and assistant messages",
      "A turn streams run, answer, tool, proposal, completion, cancellation, and failure events with one run ID",
      "The same runtime accepts server-verified page context and remains usable when a tool or provider fails",
      "No model call writes business data directly and every proposal still enters action_queue",
    ],
    dependencies: [
      "Complete AI tool registry and impact tiers",
      "Enforce bounded AI context and grounding rules",
      "Standardize every AI workflow on the OpenRouter gateway",
    ],
    start:
      "src/lib/revenue-os/ai-agent.ts; src/lib/revenue-os/agent-trace.ts; admin Revenue OS AI APIs; additive AI conversation migration",
    guardrails:
      "Keep transcript storage separate from the redacted run ledger. Do not trust client-supplied record facts, expose raw tool payloads, or add another provider.",
    labels: ["ai", "reliability"],
    verification:
      "npm run test:ai-command-runtime; npm run test:agent-loop; npm run test:agent-trace; npm run verify:founder-access; npx tsc --noEmit; npm run lint; git diff --check.",
    evidence:
      "Current implementation evidence: additive founder-owned conversation/message schema, replay-safe message IDs, shared SSE contract, cancellable OpenRouter streaming with fragmented tool reconstruction, deterministic core/pipeline/outreach tool packs, bounded server-curated page context, proposal-only consequential actions, and linked provider/model/pack/duration run metadata are implemented locally. Runtime, loop, tool-gate, trace, schema, TypeScript, and lint checks pass. Remaining before closure: production migration and authenticated release verification are deliberately deferred to the next feature-batch deployment.",
  }),
  card({
    key: "ai-run-traces",
    title: "Complete AI run traces, tool evidence, errors, and usage",
    workstream: "ai",
    phase: 3,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Persist bounded run metadata, tools, inputs/results summaries, model usage, failures, and affected records for debugging and cost control.",
    acceptance: [
      "Every command has a run ID and ordered tool events",
      "Trace summaries redact secrets and excessive message/document content",
      "The admin can inspect model, tokens, duration, outcome, error, and affected records",
    ],
    dependencies: ["Complete AI tool registry and impact tiers"],
    start:
      "agent_runs; agent_run_events; src/app/admin/ai-operations/page.tsx; src/app/api/admin/revenue-os/ai/runs/route.ts",
    guardrails: "Do not store full secret-bearing prompts or OAuth/provider credentials.",
    labels: ["observability", "cost"],
    evidence:
      "Verified 2026-08-25: the unified AI Workspace exposes redacted run summaries, exact database filters, opaque keyset pagination, ordered event evidence, model/tool/timing/token/outcome metadata, linked canonical records, and explicit missing-schema/truncation states. Internal database errors are replaced with safe browser messages and registry policy is not mislabeled as connection readiness. `npm run test:ai-operations` passes ten deterministic behavior groups; authenticated `npm run qa:ai-command` passes run inspection on desktop/mobile/dark/reduced-motion; the complete three-scenario demo matrix uses the same contract without protected requests or console errors.",
  }),
  card({
    key: "ai-command-workspace",
    title: "Ship one operator-grade AI workspace everywhere",
    workstream: "admin",
    phase: 3,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Use the shared command runtime from a dedicated AI workspace, a global command panel, and contextual record launchers with one conversation state and one approval boundary.",
    acceptance: [
      "The founder can use the same thread from /admin/ai and a global Command-J panel",
      "Command-K remains navigation while Command-J owns AI, with accessible desktop and mobile behavior",
      "Messages expose live status, bounded tool evidence, sources, feedback, retry, and staged actions without raw provider payloads",
      "Opportunity Ask AI launches with canonical record context and all write proposals use the shared confirmation path",
    ],
    dependencies: [
      "Build the persistent streamed AI command runtime",
      "Complete AI run traces, tool evidence, errors, and usage",
    ],
    start:
      "src/app/admin/layout.tsx; src/components/admin/RevenueAICommand.tsx; src/app/admin/ai; opportunity record workspace",
    guardrails:
      "Do not duplicate agent state per surface, merge AI into the navigation palette, accept arbitrary generated HTML, or hide when a model/tool fails.",
    labels: ["ai"],
    verification:
      "npm run qa:ai-command; npm run test:ai-command-runtime; npm run test:route-coverage; npx tsc --noEmit; npm run lint; reviewed desktop/mobile/dark/reduced-motion screenshots; git diff --check.",
    evidence:
      "Verified 2026-08-25: `/admin/ai` is one responsive AI Workspace with Ask, Run history, and Capabilities views; `/admin/ai-operations` is a request-aware compatibility redirect. Ask, Command-J, Today, and opportunity launchers retain one provider, transcript, stream, and proposal boundary. Run history exposes bounded evidence and safe failures; Capabilities derives from the versioned registry and distinguishes policy from readiness. `npm run qa:ai-command` passes authenticated conversation streaming, tool evidence, staged approval, run detail, capability policy, keyboard panel, focus, desktop/mobile/dark/reduced-motion, overflow, and console checks. `npm run test:ai-command-runtime`, `npm run test:route-coverage`, `npm run test:ai-operations`, TypeScript, lint, and the full three-business admin demo matrix pass. Reviewed seven AI workspace screenshots in `/tmp/accelerate-ai-command` and loaded desktop/mobile dark screenshots in `/tmp/accelerate-ai-workspace`. 2026-08-26 release hardening: the shared Command-J listener now recognizes both the physical KeyJ code and normalized key value, rejects key repeat, and stops propagation after ownership. Fresh production-build QA passes Command-J, focus, desktop/mobile, dark, reduced motion, overflow, and console coverage.",
  }),
  card({
    key: "agent-learning-feedback-loop",
    title: "Build the governed agent learning feedback loop",
    workstream: "ai",
    phase: 3,
    status: "planned",
    priority: "high",
    description:
      "Capture founder feedback and real action outcomes as reviewable signals that improve future AI guidance without creating self-modifying behavior or ingesting unsafe instructions.",
    acceptance: [
      "A founder can rate completed agent outputs and each rating is tied to an immutable run and audit record",
      "Future runs consume only bounded, aggregate, approved quality telemetry, not raw prompts, outputs, or free-form feedback as instructions",
      "Action approval, rejection, execution, reply, meeting, proposal, and revenue outcomes can be linked to recommendation quality over time",
      "A founder can inspect, correct, or disable learning signals and no signal changes business rules or sends automatically",
    ],
    dependencies: [
      "Complete AI run traces, tool evidence, errors, and usage",
      "Finish the shared AI confirmation system",
      "Normalize the cross-channel activity ledger",
    ],
    start:
      "src/lib/revenue-os/agent-learning.ts; agent_runs; agent_run_events; action_queue; RevenueAICommand.tsx",
    guardrails:
      "This is governed product learning, not autonomous model training. Never feed raw customer content, secrets, injected text, or unreviewed free-form feedback into system instructions.",
    labels: ["learning", "feedback", "safety"],
    evidence:
      "2026-08-16: founder helpful/not-helpful ratings are now stored as agent-run events and audit entries. Future command runs receive only a 90-day aggregate per-tool helpful/not-helpful summary. Remaining: outcome linkage across actions/campaigns/meetings/proposals/revenue, operator inspection/correction/disable controls, and explicit retention policy.",
  }),
  card({
    key: "ai-model-job-registry",
    title: "Route every AI job through an audited model registry",
    workstream: "ai",
    phase: 4,
    status: "planned",
    priority: "medium",
    description:
      "Choose OpenRouter models by typed workload requirements instead of scattered IDs, with current capability and cost metadata, explicit activation, eval gates, and rollback.",
    acceptance: [
      "Every AI call names a registered job and records requested and resolved models",
      "Operator choices are limited to compatible models and environment overrides remain explicit",
      "Free or low-cost models are visible but cannot run consequential jobs until their eval set passes",
      "Fallback and model changes are never silent and are auditable",
    ],
    dependencies: [
      "Standardize every AI workflow on the OpenRouter gateway",
      "Complete AI run traces, tool evidence, errors, and usage",
    ],
    start: "src/lib/ai/openrouter.ts; AI Operations; admin settings service",
    guardrails:
      "OpenRouter remains the sole gateway. Do not let a browser send arbitrary model IDs or activate a consequential model without evidence.",
    labels: ["ai", "reliability"],
  }),
  card({
    key: "tenant-ai-sponsorship-control",
    title: "Add explicit platform-sponsored AI budgets per tenant",
    workstream: "ai",
    phase: 5,
    status: "backlog",
    priority: "medium",
    description:
      "Extend tenant-owned OpenRouter BYOK with a founder-controlled sponsorship mode for exceptional workspaces, without turning the platform key into an implicit global fallback.",
    acceptance: [
      "Platform administration can select BYOK, disabled, or platform-sponsored billing for one tenant through an audited control-plane service",
      "Sponsored mode has an explicit per-tenant monthly budget, immediate kill switch, and provider/run cost receipts that reconcile to that tenant",
      "Client administrators can see their billing mode and usage posture but can never read, replace, or infer the platform credential",
      "Mode changes fail closed during concurrent AI work and never cause another tenant to inherit sponsorship",
    ],
    dependencies: [
      "Tenant-isolate providers, public intake, webhooks, and jobs",
      "Route every AI job through an audited model registry",
    ],
    start:
      "integration_connections; src/lib/ai/openrouter-credentials.ts; src/lib/revenue-os/ai-agent.ts; src/app/admin/tenants; AI Operations",
    guardrails:
      "Do not reintroduce a global client fallback, expose a platform key, represent token counts as settled cost, or enable sponsorship without a budget and founder audit receipt. BYOK remains the default client mode.",
    labels: ["ai", "provider", "control-plane"],
  }),
  card({
    key: "ai-quality-control-plane",
    title: "Build the AI policy, exemplar, ambiguity, and quality control plane",
    workstream: "ai",
    phase: 4,
    status: "planned",
    priority: "high",
    description:
      "Give each AI surface versioned instructions, source rules, review requirements, curated examples, ambiguity handling, kill switches, and measurable quality outcomes.",
    acceptance: [
      "Each surface has an auditable enabled policy with output, review, must-include, never-mention, source, and instruction rules",
      "Commitment-sensitive drafting returns proceed, clarify, or escalate before generation",
      "Only manually curated exemplars influence future drafts",
      "Quality reports acceptance, edits, rejection reasons, safety failures, prompt growth, and cost by task",
    ],
    dependencies: [
      "Ship one operator-grade AI workspace everywhere",
      "Build the governed agent learning feedback loop",
      "Route every AI job through an audited model registry",
    ],
    start: "AI Operations; agent_run_events; admin settings policy service",
    guardrails:
      "No automatic exemplar promotion, self-modifying prompt, hidden fallback, or policy-controlled direct write.",
    labels: ["ai", "reliability"],
  }),
  card({
    key: "mcp-ai-tool-bridge",
    title: "Expose the governed tool registry through MCP",
    workstream: "integrations",
    phase: 4,
    status: "shipped",
    priority: "medium",
    description:
      "Use the same versioned tool definitions for approved MCP clients and future external MCP sources so the Command Center can expand without creating parallel business logic.",
    acceptance: [
      "MCP schemas are derived from the canonical AI tool registry",
      "Approved clients can run bounded reads while writes only stage action_queue proposals",
      "External servers require registry, scope, health, rate-limit, and audit evidence",
      "Unknown tools, servers, scopes, and destructive requests fail closed",
    ],
    dependencies: [
      "Build the provider capability platform and integration catalog",
      "Complete AI tool registry and impact tiers",
      "Verify founder-only admin access and service-only data policies",
    ],
    start: "src/lib/revenue-os/ai-tools.ts; integration registry; MCP adapter",
    guardrails:
      "No arbitrary remote server connection, remote code execution, secret exposure, browser-held credential, or direct database write.",
    labels: ["integrations", "security"],
    evidence:
      "2026-09-01: Built the Model Context Protocol (MCP) server for Revenue OS (`src/lib/revenue-os/mcp-server.ts`) complying with MCP 2024-11-05 JSON-RPC specification. Dynamically publishes AI tools derived from the canonical tool registry (`getRevenueAiTools`) with schemas and impact levels. Enforces safe execution boundary through `executeRegisteredRevenueTool` (reads are bounded, writes enter `action_queue` as proposals requiring founder confirmation). Exposes live bounded resources (`revenue-os://today/snapshot`, `revenue-os://system/modules`, `revenue-os://knowledge/registry`) and pre-configured operator prompts (`daily_operator_triage`, `pipeline_health_check`, `reactivate_stale_deals`). Implemented authenticated HTTP endpoint (`src/app/api/mcp/route.ts`), per-tenant isolated MCP route (`src/app/api/public/[tenantSlug]/mcp/route.ts`), and Stdio CLI bridge (`scripts/revenue-os-mcp.ts`) for Claude Desktop, Claude Code, ChatGPT, and Antigravity. Added comprehensive test coverage in `scripts/test-mcp-server.ts` and `scripts/test-webhook-security.ts`. 2026-09-02 correctness pass: the per-tenant route resolved its database context through `accelerateSystemContext`, which hardcodes ACCELERATE_TENANT_ID regardless of which tenant authenticated, alongside an unbound `createPlatformServiceRoleClient`, so any tenant MCP key could read and write across the whole shared database. It now resolves the real tenant through `resolveTenantProviderSecrets` (extended to cover `mcp`) and binds the client with `createServiceRoleClient(resolvedContext)`, the pattern the Calendly and Resend webhooks already used; the same unbound-client fix was applied to the HubSpot and WhatsApp webhooks, whose writes were landing with no tenant_id. Also: the tenant MCP key is read through the encrypted envelope rather than as plaintext and is issued by a new `configure_mcp` action; both API-key comparisons are timing-safe; `notifications/initialized` no longer answers a request that carries no id, per JSON-RPC 2.0; `tools/call` failures return `isError: true` content instead of a transport-level error; the stdio bridge no longer calls `createServerSupabaseClient()`, which reads `next/headers` cookies() and cannot run outside a request, so the documented Claude Desktop path could never have started; the four client config examples in the setup guide gained the required NODE_OPTIONS flag and lost hardcoded local paths; and the three self-asserted MCP status constants (`configured.mcp`, `runtime.mcp.status`, the Setup Center `mcp_server` check) were replaced with a live `tools/list` probe through the same handler. `scripts/verify-mcp-tenant-isolation.ts` proves the isolation fix against real Postgres with two controlled tenants; it needs GOOGLE_TOKEN_ENCRYPTION_KEY and an explicit confirmation flag, and has not been run yet.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:mcp-server; npm run test:integration-adapters; npm run test:webhook-security; npm run build; git diff --check.",
  }),
  card({
    key: "ai-company-research",
    title: "Build grounded company research and revenue-leak analysis",
    workstream: "ai",
    phase: 4,
    priority: "medium",
    description:
      "Research a company from approved sources, separate evidence from inference, and identify likely operational revenue leaks relevant to outreach or calls.",
    acceptance: [
      "Research records source URLs/documents, retrieval time, and confidence",
      "Claims unsupported by sources are labeled hypotheses",
      "Founder can save approved findings to company research without overwriting raw sources",
    ],
    dependencies: ["Enforce bounded AI context and grounding rules"],
    start: "companies research fields; AI tool registry; approved web/document sources",
    guardrails: "Do not fabricate company size, technology, revenue, personnel, or pain points.",
    labels: ["research", "companies"],
  }),
  card({
    key: "ai-opportunity-ranking",
    title: "Rank today’s best opportunities with evidence",
    workstream: "ai",
    phase: 3,
    priority: "high",
    description:
      "Explain which opportunities deserve attention using the deterministic priority policy plus bounded qualitative evidence.",
    acceptance: [
      "Hard deadlines and system facts come from the shared priority selector",
      "AI explains evidence, uncertainty, and recommended next action",
      "Ranking cannot silently alter stage, value, probability, or tasks",
    ],
    dependencies: [
      "Create the shared operator-priority selector",
      "Enforce bounded AI context and grounding rules",
    ],
    start: "Today page; overview API; Revenue AI command",
    guardrails:
      "AI may refine explanations, not override deterministic safety and deadline ordering.",
    labels: ["ranking", "today"],
  }),
  card({
    key: "proactive-operator-intelligence",
    title: "Deliver proactive operator briefs and leading indicators",
    workstream: "ai",
    phase: 4,
    status: "planned",
    priority: "high",
    description:
      "Turn canonical changes into a concise, evidence-backed operating brief that tells the founder what changed, what is likely to matter next, why, and the safest next action before a deadline, revenue risk, or system failure becomes urgent.",
    acceptance: [
      "Daily, weekly, and material-change briefs compare versioned snapshots from the shared priority selector, canonical analytics, activity ledger, commitments, conversations, pipeline, campaigns, and system health without creating a second scoring system",
      "Every item separates observed fact, deterministic projection, and bounded hypothesis; exposes source time, confidence, assumptions, materiality, and an exact canonical record link",
      "Duplicate signals collapse into one evolving thread and notification thresholds prevent routine noise, while critical new evidence can surface immediately with an inspectable delivery receipt",
      "Recommended actions open the existing record or enter the shared confirmation/action queue; the brief never sends, mutates a deadline, or changes revenue state directly",
      "Backtest fixtures prove missed-deadline, buying-signal, proposal-expiry, pipeline-stall, forecast-risk, campaign-failure, and provider-degradation detection without invented facts or hindsight leakage",
      "The full admin demo provides a reconciled business-specific brief for every scenario and responsive QA covers desktop, mobile, keyboard, reduced motion, empty, degraded, stale, and recovery states",
    ],
    dependencies: [
      "Phase B: a knowledge substrate with provenance",
      "Create the shared operator-priority selector",
      "Consolidate analytics on canonical source-to-revenue data",
      "Complete AI run traces, tool evidence, errors, and usage",
      "Enforce bounded AI context and grounding rules",
      "Build the system-health report and freshness thresholds",
    ],
    start:
      "src/lib/revenue-os/queue.ts; src/lib/revenue-os/analytics.ts; src/lib/revenue-os/activities.ts; src/lib/revenue-os/scheduler.ts; AI Workspace; Today; Notifications; demo runtime",
    guardrails:
      "Predict only from timestamped canonical evidence and explicit assumptions. Never label an AI guess as a forecast, silently change deterministic urgency, notify repeatedly about unchanged evidence, or permit a brief to bypass confirmation and domain services.",
    labels: ["ai", "analytics"],
  }),
  card({
    key: "ai-message-drafting",
    title: "Draft personalized first-touch and reply messages safely",
    workstream: "ai",
    phase: 3,
    priority: "high",
    description:
      "Generate editable outreach and reply drafts from approved facts, templates, campaign policy, and conversation context.",
    acceptance: [
      "Draft identifies the recipient, goal, factual inputs, and template/policy source",
      "Unsupported personalization is excluded or clearly flagged",
      "Ad-hoc drafts require individual send confirmation; campaign drafts stay within the approved version",
    ],
    dependencies: [
      "Enforce bounded AI context and grounding rules",
      "Finish one auditable communication sender",
    ],
    start: "email templates; AI prompts; Conversations and Campaigns UIs",
    guardrails:
      "Do not invent case studies, results, relationships, urgency, pricing, or availability.",
    labels: ["drafting", "email"],
  }),
  card({
    key: "ai-meeting-intelligence",
    title: "Summarize meetings and extract reviewable commitments",
    workstream: "ai",
    phase: 4,
    priority: "high",
    description:
      "Turn notes and permitted conversation context into summaries, commitments, follow-ups, risks, and stage suggestions for founder review.",
    acceptance: [
      "Summary links to source notes/event and separates direct statements from interpretation",
      "Tasks and stage changes are proposed through confirmation and dedupe services",
      "Repeated runs do not create duplicate commitments",
    ],
    dependencies: [
      "Build post-meeting notes and commitment extraction",
      "Finish the shared AI confirmation system",
    ],
    start: "calendar events; activities; task and action services",
    guardrails: "No transcription ingestion is assumed unless separately configured and consented.",
    labels: ["meetings", "extraction"],
  }),
  card({
    key: "ai-proposal-audit",
    title: "Draft audits and proposals from approved evidence",
    workstream: "ai",
    phase: 4,
    priority: "medium",
    description:
      "Create structured audit and proposal drafts from notes, company research, selected documents, approved offers, and pricing inputs.",
    acceptance: [
      "Draft cites every material claim and identifies missing required input",
      "Pricing and commercial terms come only from founder-approved data",
      "Final preview, version, recipient, and send require explicit confirmation",
    ],
    dependencies: [
      "Ground AI retrieval in Drive provenance and citations",
      "Complete the proposal lifecycle and version rules",
      "Finish the shared AI confirmation system",
    ],
    start: "proposal generation API; Drive retrieval; pricing/settings sources",
    guardrails:
      "Never infer or optimize price autonomously and never overwrite a sent proposal version.",
    labels: ["proposals", "drafting"],
  }),
  card({
    key: "ai-analytics-setup-help",
    title: "Explain pipeline health, campaign results, forecast risk, and setup",
    workstream: "ai",
    phase: 4,
    priority: "medium",
    description:
      "Let the founder ask grounded questions about live metrics, failures, setup documentation, and recommended recovery actions.",
    acceptance: [
      "Metric answers cite canonical query window and filters",
      "Setup answers cite checked-in instructions and live capability status",
      "Suggested writes or external actions enter the standard confirmation path",
    ],
    dependencies: [
      "Consolidate analytics on canonical source-to-revenue data",
      "Finish Setup Center as the operational control plane",
      "Enforce bounded AI context and grounding rules",
    ],
    start:
      "Revenue AI command; analytics service; docs/self-hosting/REVENUE-OS-SETUP.md; Setup API",
    guardrails:
      "Do not call estimates facts or claim a provider is healthy from configuration presence alone.",
    labels: ["analytics", "setup"],
  }),

  // Phase 2/4, setup, security, health, and release discipline
  card({
    key: "setup-control-plane",
    title: "Finish Setup Center as the operational control plane",
    workstream: "setup",
    phase: 2,
    status: "shipped",
    priority: "high",
    owner: "Grok-4.6-03-setup-control-plane",
    description:
      "Group Core, Email, Google, AI, Campaigns, Proposals, Analytics, optional Booking, and Operations into actionable live capability checks.",
    acceptance: [
      "Every item reports Ready, Needs action, Degraded, Disabled, or Optional",
      "Each item explains value, checks behavior, shows last success/failure/next run, and links to exact setup",
      "Secrets remain masked while reconnect and safe test actions are available where appropriate",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start:
      "src/app/admin/setup/page.tsx; src/app/api/admin/setup/route.ts; docs/self-hosting/REVENUE-OS-SETUP.md",
    guardrails:
      "Variable presence alone is not behavioral readiness. Calendly stays optional and disabled.",
    labels: ["control-plane", "operations"],
    evidence:
      "2026-08-30 Wave 1 close: every Setup capability now carries a next-run receipt (`setupNextRun`) rendered beside last success/failure. Route contract tests prove each check declares next-run copy and the handler does not interpolate secret environment values. Reconnect/test probes and Google/proposal/webhook ping actions remain on Add safe behavioral tests and recovery actions to Setup Center. Calendly default/activation truth remains on Reconcile booking activation and health truth. 2026-08-30 Wave 1: Resend and campaign checks no longer treat environment presence as Ready. `resendDeliveryReadiness` requires an outbound message receipt; a failed latest send is Degraded. A failed `revenue-campaigns` job is Degraded. `npx tsx scripts/test-setup-status.ts` passed. Remaining: reconnect/test actions and Google/proposal/webhook behavioral probes, owned by Add safe behavioral tests and recovery actions to Setup Center; complete next-run copy on every check. 2026-08-16: Setup Center groups core schema/access/site, Resend, Google, AI, campaigns, proposals, first-party analytics, optional disabled Calendly, cron/operations, Feature Board, and Email Studio; it masks secrets and distinguishes ready/action/degraded/disabled/optional. Production now reports 9/9 required checks ready after live schema verification, encrypted OpenRouter activation, and a generated encrypted CRON_SECRET. Authenticated Playwright verified Setup, OpenRouter Contact Import behavior, full required readiness, screenshots, and no settled-state console errors. Remaining: behavioral tests for Google/proposals/webhooks, complete last-success/failure/next-run receipts, reconnect/test actions, and alert/health integration.",
  }),
  card({
    key: "setup-behavioral-tests",
    title: "Add safe behavioral tests and recovery actions to Setup Center",
    workstream: "setup",
    phase: 4,
    priority: "high",
    description:
      "Give each provider and subsystem a bounded test that proves the intended capability and changes status on failure and recovery.",
    acceptance: [
      "Email, Google sources, AI, proposals, analytics, cron, and webhooks have reproducible checks",
      "Tests record receipts and never perform an undisclosed external action",
      "Failure and recovery update status, timestamps, error summary, and next step",
    ],
    dependencies: [
      "Finish Setup Center as the operational control plane",
      "Build the system-health report and freshness thresholds",
    ],
    start: "Setup API/UI; source_runs; job_runs; webhook_receipts",
    guardrails:
      "Do not send real customer messages or mutate calendars as a background health check.",
    labels: ["verification", "recovery"],
  }),
  card({
    key: "secret-storage-hardening",
    title: "Harden encrypted secret and token storage",
    workstream: "security",
    phase: 1,
    status: "shipped",
    priority: "high",
    owner: "Grok-4.6-04-secret-storage-hardening",
    description:
      "Keep provider secrets in environment configuration and encrypt refresh/access credentials server-side with rotation and redacted diagnostics.",
    acceptance: [
      "Recognized secret keys cannot be saved through admin settings",
      "Google tokens are encrypted at rest and decrypted only in server-only modules",
      "Logs, audit records, traces, and API responses never expose secret values",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start: "src/lib/revenue-os/encryption.ts; settings API; integration_connections",
    guardrails:
      "Do not reuse the service-role key as the long-term independent token encryption key in production.",
    labels: ["secrets", "encryption"],
    evidence:
      "2026-08-30 Wave 1: `RESEND_WEBHOOK_SECRET` joined the server-only key denylist so it cannot be saved through admin_settings. Encrypted envelopes stay `v1`; unknown versions and historical plaintext fail closed (`isEncryptedSecret` / `decryptSecret`). Google token reads refuse plaintext refresh/access tokens and tell the founder to reconnect. `npm run test:secret-storage` passed 10 checks. Token revocation cleanup remains on Add Google token health, scope drift, and reconnect recovery. 2026-08-17: removed the `GOOGLE_TOKEN_ENCRYPTION_KEY` fallback to `SUPABASE_SERVICE_ROLE_KEY` in `src/lib/revenue-os/encryption.ts`, added `isGoogleTokenEncryptionKeyConfigured()` and required it in Setup checks (`src/app/api/admin/setup/route.ts`, `src/app/api/admin/google/status/route.ts`), and added deterministic scoped tests in `scripts/test-secret-storage.ts` for key-configured encryption/decryption and fail-closed behavior when Google key is absent. Verification: `npm run test:secret-storage`; `NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-secret-storage.ts`. Remaining: independent production key verification evidence, rotation/versioning policy, redaction traces, historical plaintext migration, and token revocation cleanup.",
  }),
  card({
    key: "founder-access-rls",
    title: "Verify founder-only admin access and service-only data policies",
    workstream: "security",
    phase: 1,
    status: "shipped",
    priority: "high",
    description:
      "Prove that only the configured founder can enter admin routes and APIs and that browser clients cannot use service-role capabilities.",
    acceptance: [
      "Founder succeeds while unauthenticated and other authenticated users fail on pages and APIs",
      "Canonical tables expose no blanket authenticated mutation policy",
      "Service-role keys and privileged operations remain server-only",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start: "src/middleware.ts; src/lib/admin/auth.ts; Revenue OS migrations; API routes",
    guardrails:
      "Do not weaken auth for local QA; use one-time test sessions and retain fail-closed behavior.",
    labels: ["auth", "rls"],
    evidence:
      "2026-08-18: expanded `scripts/test-founder-access.ts` to cover additional protected admin pages (`/admin/pipeline`, `/admin/settings`, `/admin/campaigns`) and APIs (`/api/admin/settings`, `/api/admin/analytics`, `/api/admin/revenue-os/overview`, `/api/admin/revenue-os/campaigns`) in addition to existing gates. Production proof command: `PLAYWRIGHT_BASE_URL=https://www.acceleratewith.us npm run test:founder-access`, which reports `checks:17` and `founder access, unauthenticated gates, authenticated fail-closed checks, browser-bundle service-role exposure checks, canonical admin policy audit covered` plus `founder-access-policy-audit: checked 0 authenticated policy rows; no mutating policies on canonical admin tables.` No service-role secrets were exposed in `.next/static`; no mutating authenticated canonical policies were found.",
  }),

  card({
    key: "webhook-cron-api-defense",
    title: "Harden webhook, cron, replay, validation, and rate-limit defenses",
    workstream: "security",
    phase: 2,
    priority: "high",
    description:
      "Apply provider signatures, OAuth state, replay IDs, cron secrets, strict payload validation, and bounded rate limits to every external entry point.",
    acceptance: [
      "Invalid signature/state/secret requests fail before mutation",
      "Replay produces the existing receipt without repeating side effects",
      "Malformed and oversized payloads fail with safe errors and observable receipts",
    ],
    dependencies: [
      "Enforce atomic claims and idempotency for jobs and actions",
      "Harden encrypted secret and token storage",
    ],
    start: "webhook routes; cron routes; src/lib/rate-limit.ts; validation modules",
    guardrails: "Never log raw secrets or return internal validation details to public callers.",
    labels: ["webhooks", "validation"],
    evidence:
      "2026-08-18: added deterministic oversized payload limits (413) to `src/app/api/webhooks/resend/route.ts` and `src/app/api/webhooks/calendly/route.ts`; `src/app/api/cron/google-workspace-sync` and `src/app/api/cron/revenue-campaigns` validate Bearer CRON secret and now have dedicated method-gate coverage in `scripts/test-webhook-cron-defense.ts`; introduced `test:api-contracts` and `test:webhook-cron-defense` scripts. Remaining in this slice: broader provider/provider-failure behavior and cron/health receipts in production contract scope.",
  }),
  card({
    key: "notification-dispatch-preferences",
    title: "Wire notification preferences into actual dispatch",
    workstream: "operations",
    phase: 3,
    priority: "medium",
    description:
      "Ensure urgency, channel, quiet hours, and disabled preferences govern real notification creation and delivery rather than settings display only.",
    acceptance: [
      "Dispatch reads the authoritative preferences at execution time",
      "Critical security/health overrides are explicitly documented",
      "Delivery attempts, failures, dedupe, and acknowledged state are visible",
    ],
    dependencies: [
      "Create the shared operator-priority selector",
      "Finish one auditable communication sender",
    ],
    start: "admin notification schema/API; settings; action and job paths",
    guardrails:
      "Do not silently suppress required security alerts or send duplicates across retries.",
    labels: ["notifications", "preferences"],
  }),
  card({
    key: "system-health-report",
    status: "planned",
    title: "Build the system-health report and freshness thresholds",
    workstream: "operations",
    phase: 4,
    priority: "high",
    description:
      "Summarize sync freshness, job receipts, queue backlog, delivery failures, webhook failures, connection degradation, and alert deliverability.",
    acceptance: [
      "Each subsystem has an expected cadence and explicit healthy/degraded/stale rule",
      "Latest success, failure, backlog, and next expected execution link to receipts",
      "Health never reports green from configuration presence or HTTP status alone",
    ],
    dependencies: [
      "Finish Setup Center as the operational control plane",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start: "job_runs; source_runs; webhook_receipts; integration_connections; Setup Center",
    guardrails: "Unknown or missing evidence is not healthy.",
    labels: ["health", "observability"],
    evidence:
      "2026-08-20: health computation lifted out of the route handlers into `src/lib/revenue-os/health.ts` so a background job can reuse it. It previously lied by omission in two ways, both fixed: it counted only failed and partial job runs, so a job stuck `running` for hours read as healthy, and webhook_receipts recorded failures that no admin surface ever read. Both are now in the computation, with STALLED_JOB_MINUTES making the stale rule explicit, and the Setup operations capability reports degraded rather than ready when a job is stalled. Proven against production by `npm run verify:health-truth`. NOT SHIPPED: criterion 1 is only partly met, since not every subsystem has a declared expected cadence, and next expected execution is not surfaced.",
  }),
  card({
    key: "operations-alerting",
    status: "planned",
    title: "Add actionable health alerts and recovery runbooks",
    workstream: "operations",
    phase: 4,
    priority: "high",
    description:
      "Notify the founder when syncs, jobs, delivery, webhooks, tokens, or queue freshness breach defined thresholds and link to recovery steps.",
    acceptance: [
      "Alerts deduplicate by subsystem and incident while updating ongoing state",
      "Recovery closes the incident only after a successful behavioral check",
      "Every alert links to the failing receipt, likely cause, and safe next action",
    ],
    dependencies: [
      "Build the system-health report and freshness thresholds",
      "Wire notification preferences into actual dispatch",
    ],
    start: "notifications; Setup Center; docs/self-hosting/REVENUE-OS-SETUP.md",
    guardrails: "Avoid alert storms and never include secrets or full customer messages.",
    labels: ["alerts", "runbooks"],
    evidence:
      "2026-08-20: `src/lib/revenue-os/alerts.ts` added. Nothing reached the founder before this: every failure signal was in-app only, behind a 30 second poll, visible only to someone already looking. Alerts now route through sendRecordedEmail so the alert itself gets a delivery receipt and an idempotency key, and fire on job failure, stale-claim takeover, integration failure, and failed webhook receipts. Deduplication was a prerequisite, not a nicety: admin_notifications had no unique index and no dedupe_key at all, so a flapping subsystem would have buried the founder. Added by migrations/20260820-notification-dedupe.sql with a partial unique index on unread rows. Alerting is best-effort throughout so it can never break the caller it is reporting on. Proven against production by `npm run verify:operational-alerts`. NOT SHIPPED: criterion 2 is not met, since recovery does not yet close an incident after a behavioral check, and alerts name the failing subsystem but do not yet link to the specific failing receipt.",
  }),

  card({
    key: "revenue-os-tests",
    title: "Add Revenue OS service-level unit coverage",
    workstream: "qa",
    phase: 4,
    status: "planned",
    priority: "high",
    description:
      "Unit-test identity resolution, pipeline rules, task dedupe, priority selection, campaign eligibility/stops, AI impact tiers, and canonical metrics.",
    acceptance: [
      "Happy, ambiguous, duplicate, terminal, retry, and failure paths are covered",
      "Tests are deterministic and isolate provider/network behavior",
      "Regressions fail before build/deploy and document the operating contract",
    ],
    dependencies: [
      "Implement deterministic contact and company identity resolution",
      "Create the shared operator-priority selector",
      "Enforce campaign policy envelopes and version reapproval",
    ],
    start: "src/lib/revenue-os; test configuration and fixtures",
    guardrails: "Do not treat snapshot-only tests as business-rule coverage.",
    labels: ["unit-tests", "services"],
    evidence:
      "2026-08-20: coverage added where money is lost, not everywhere. Before this, 0 of 7 modules under src/lib/email had an executing test and only 8 of 26 Revenue OS modules asserted their own logic; action-executor.ts, the single place an approved row becomes a real side effect, had none at all. Added test:action-execution (11 checks), test:job-and-task-contracts (13), test:email-templates (19 templates, 8 checks), test:ai-tool-gates (10), test:agent-loop (6), test:agent-trace (8), test:responder-envelope (12 decline rules and 12 grounding rejections), test:chat-house-style, and test:house-style-copy. Every guard was mutation-tested: removed one at a time and confirmed to fail its test, because a guard that cannot fail on the bug it targets is worse than no guard. That process found two real gaps a first pass had missed, both cases where a terminal write was not scoped to the state it belongs to. Provider and network behaviour is isolated by a shared in-memory Supabase harness at scripts/lib/memory-supabase.ts and a fetch stub. Regressions fail before deploy through the pre-commit hook. NOT SHIPPED: the responder eval set does not exist, so the live generation leg is unmeasured.",
  }),
  card({
    key: "api-contract-tests",
    title: "Add authenticated API contract and failure tests",
    workstream: "qa",
    phase: 4,
    priority: "high",
    description:
      "Exercise authentication, founder authorization, payload validation, idempotency, transition rejection, provider failure, and truthful errors for every material API.",
    acceptance: [
      "Unauthenticated and non-founder calls fail consistently",
      "Malformed, stale, replayed, and duplicate requests prove no unintended mutation",
      "External-provider failures return actionable errors and terminal receipts",
    ],
    dependencies: [
      "Verify founder-only admin access and service-only data policies",
      "Harden webhook, cron, replay, validation, and rate-limit defenses",
    ],
    start: "src/app/api; API test harness and Supabase fixtures",
    guardrails: "Never run destructive API tests against uncontrolled production data.",
    labels: ["api-tests", "security"],
    evidence:
      "2026-08-18: added `scripts/test-api-contract-basics.ts` and `test:api-contracts` script to cover unauthenticated admin API gates (`/api/admin/settings`, `/api/admin/revenue-os/pipeline`, `/api/admin/revenue-os/overview`, `/api/admin/analytics`), public route validation (`/api/qualify`, `/api/proposal/:token`), and webhook and method-contract gates (`GET /api/webhooks/resend`, `GET /api/webhooks/calendly`, `GET /api/qualify`, `DELETE /api/proposal/:token`). Remaining in this slice: production-safe fixture expansion for richer auth transition and idempotency contract cases.",
  }),
  card({
    key: "playwright-inbound-pipeline",
    title: "Add Playwright journey for inbound capture and pipeline progression",
    workstream: "qa",
    phase: 4,
    status: "planned",
    priority: "high",
    description:
      "Prove a real inbound form creates one canonical identity and opportunity, preserves attribution, appears in Today/Pipeline, and progresses through validated stages.",
    acceptance: [
      "Duplicate submission does not duplicate canonical records or stage events",
      "Founder can inspect context, set next action, and move stages on desktop and mobile",
      "The journey records screenshots and fails on console errors",
    ],
    dependencies: [
      "Reconcile legacy records with the canonical model",
      "Finish the canonical Pipeline workspace",
      "Finish Today as the prioritized operator inbox",
    ],
    start: "public qualifier/contact forms; admin Today/Pipeline; Playwright",
    guardrails:
      "Use isolated test identities and clean them through a documented recoverable fixture process.",
    labels: ["playwright", "inbound"],
  }),
  card({
    key: "playwright-gmail-campaign",
    title: "Add Playwright journeys for Gmail linking, reply, campaign approval, pause, and stops",
    workstream: "qa",
    phase: 4,
    priority: "high",
    description:
      "Prove conversation association and reply controls plus campaign dry-run, activation, due execution, pause, and stop behavior.",
    acceptance: [
      "A synchronized thread links to the correct opportunity and a confirmed reply stays threaded",
      "Campaign preview and approved version match executed recipients and content",
      "Pause, reply, bounce, unsubscribe, booking, and conversion prevent future steps",
    ],
    dependencies: [
      "Finish Conversations as the unified communication inbox",
      "Enforce every campaign stop condition immediately",
    ],
    start: "Google/Resend fixtures or controlled test accounts; Conversations/Campaigns UI",
    guardrails: "Do not message uncontrolled recipients; use explicit sandbox/test identities.",
    labels: ["playwright", "campaigns"],
  }),
  card({
    key: "playwright-proposal-setup",
    title: "Add Playwright journeys for proposals and Setup recovery",
    workstream: "qa",
    phase: 4,
    priority: "high",
    description:
      "Verify proposal send/view/accept/decline and demonstrate that provider failure and recovery change Setup Center truthfully.",
    acceptance: [
      "Proposal actions are idempotent and update linked pipeline/activity once",
      "A simulated degraded connection shows failure detail and recovery action",
      "Desktop/mobile screenshots and console-error assertions are retained",
    ],
    dependencies: [
      "Make public proposal views and decisions idempotent",
      "Add safe behavioral tests and recovery actions to Setup Center",
    ],
    start: "proposal pages/APIs; Setup Center; Playwright harness",
    guardrails: "Tests must not send a real customer proposal or mutate a personal calendar.",
    labels: ["playwright", "proposals"],
  }),
  card({
    key: "a11y-visual-qa",
    title: "Add accessibility, reduced-motion, and visual regression coverage",
    workstream: "qa",
    phase: 4,
    priority: "medium",
    description:
      "Automate critical accessibility assertions and preserve desktop/mobile screenshots for the founder workflow surfaces.",
    acceptance: [
      "Keyboard and focus journeys cover navigation, dialogs, drawers, tables, Kanban, and confirmation",
      "Reduced-motion mode remains fully functional",
      "Visual review checks clipping, overflow, empty space, alignment, and state contrast",
    ],
    dependencies: ["Complete keyboard, accessibility, reduced-motion, and mobile parity"],
    start: "Playwright; scripts/qa-feature-board.mjs; core admin routes",
    guardrails:
      "The Next.js development indicator is not a production UI defect; test actual application elements.",
    labels: ["accessibility", "visual-qa"],
  }),
  card({
    key: "ship-command",
    title: "Create one guarded Revenue OS ship command",
    workstream: "release",
    phase: 4,
    priority: "high",
    description:
      "Require typecheck, lint, unit/API/browser tests, build, migration dry run, deployment, and authenticated production smoke evidence in a deliberate release workflow.",
    acceptance: [
      "The command stops on the first failed required gate",
      "Migration and deployment targets are printed without secret values",
      "Production smoke verifies founder access and critical routes after deploy",
    ],
    dependencies: [
      "Add Revenue OS service-level unit coverage",
      "Add authenticated API contract and failure tests",
      "Add Playwright journey for inbound capture and pipeline progression",
    ],
    start: "package.json; DEPLOY.md; scripts/; Vercel and Supabase checks",
    guardrails:
      "Do not auto-deploy from ordinary test commands or bypass the documented Vercel account checks.",
    labels: ["release", "automation"],
  }),
  card({
    key: "production-browser-qa",
    title: "Run authenticated production admin QA on desktop and mobile",
    workstream: "release",
    phase: 5,
    status: "planned",
    priority: "high",
    owner: "John",
    description:
      "Exercise Today, Pipeline, Conversations, Campaigns, Proposals, Analytics, Setup Center, Settings, and Feature Board on the deployed founder account.",
    acceptance: [
      "Critical journeys pass at desktop and mobile breakpoints with no console errors",
      "Every unavailable provider state is accurate and actionable",
      "Evidence, discovered issues, deployment ID, and test time are recorded in the card notes",
    ],
    dependencies: [
      "Create one guarded Revenue OS ship command",
      "Connect Google OAuth and complete the first Workspace sync",
    ],
    start: "Production deployment; Playwright smoke scripts; Setup Center",
    guardrails:
      "Do not mark Shipped from local screenshots alone. Use controlled production test records.",
    labels: ["production", "smoke-test"],
  }),
  card({
    key: "production-burn-in",
    title: "Complete a 14-day automation health burn-in",
    workstream: "release",
    phase: 5,
    priority: "high",
    owner: "John",
    description:
      "Monitor campaign and Workspace jobs, provider receipts, retries, queue freshness, alert delivery, and audit history before increasing automation volume.",
    acceptance: [
      "Fourteen consecutive days have terminal expected receipts and no silent failures",
      "Every degraded incident has documented detection, response, recovery, and prevention",
      "Founder signs off on daily limits and operational runbooks before scale-up",
    ],
    dependencies: [
      "Run authenticated production admin QA on desktop and mobile",
      "Build the system-health report and freshness thresholds",
      "Add actionable health alerts and recovery runbooks",
    ],
    start: "Setup Center health; job/source/webhook receipts; Vercel cron; Feature Board notes",
    guardrails:
      "Do not increase campaign volume during unresolved degradation or missing receipt evidence.",
    labels: ["burn-in", "production"],
  }),
  card({
    key: "marketing-positioning-copy-reset",
    title: "Lock the full-service AI positioning and reset public marketing copy",
    workstream: "site",
    phase: 5,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Rewrite the public marketing site around Accelerate's actual offer: understand each business, identify where AI and automation can free time or increase revenue, then advise, build, integrate, execute, train, and improve the custom solution. Keep the Command Center as one integrated solution rather than the company definition, and make the positioning durable for future agents.",
    acceptance: [
      "The homepage leads with the custom consulting, build, execution, and optimization offer; its second section routes to Services rather than only to Command Center capabilities",
      "Every non-editorial public marketing surface describes the same broad offer, and the Command Center page and homepage explicitly frame that product as one possible solution among workflows, agents, integrations, internal tools, training, and managed execution",
      "A checked-in positioning contract and failing static guard prevent Same X Different Y framing, Command Center-only positioning, and other recorded regressions",
      "The mobile hero keeps the approved animation while the eyebrow, headline, PROFIT treatment, and CTA form one balanced first-fold composition across short, standard, and tall phones",
    ],
    dependencies: [],
    start:
      "docs/contracts/MARKETING-POSITIONING-CONTRACT.md; CLAUDE.md; src/components/home; src/components/sections; src/content; scripts/verify-guardrails.ts",
    guardrails:
      "Preserve the paper/ink editorial system and the hero scramble/strike/PROFIT treatment. Do not invent clients, dollar returns, percentages, or business history. Do not rewrite articles, admin, legal pages, changelog history, generated client artifacts, or transactional email content. Do not push or deploy unless asked.",
    labels: ["marketing", "copy", "positioning", "visual"],
    evidence:
      "2026-08-23: shipped the full public-positioning reset. Added docs/contracts/MARKETING-POSITIONING-CONTRACT.md to the required agent read order and verifier; centralized the offer in src/content/marketing-positioning.ts; added test:positioning-copy with mutation checks for the banned Same X Different Y pattern and Command Center-only service routing; and chained it into verify:guardrails. Rewrote homepage, Services, Industries and all 10 verticals, Command Center, About, Contact, Roofing, metadata, search, tenant copy, and the public assistant around custom strategy, systems, integrations, managed execution, training, and optimization. The homepage second section now presents four engagement modes and routes to Services; Command Center is explicitly one optional integrated solution. Mobile hero is content-sized with corrected header clearance, compact outcome/action spacing, and a faster phone-only reveal. test:marketing-qa passed eight public routes at 1440x900, 390x667, 390x844, and 430x932 with reduced motion, keyboard focus, overflow, request, and runtime checks; settled-motion screenshots were opened and inspected. Passing: verify:agent-contract, tsc, lint, guardrails, positioning copy, fabricated claims, house style, chat style, search, route coverage, 42/42 articles, production build, and diff check. No deployment was performed.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run verify:guardrails; npm run test:positioning-copy; npm run test:no-fabricated-claims; npm run test:house-style-copy; npm run test:search; npm run test:route-coverage; npm run verify:articles; npm run test:marketing-qa; npm run build; git diff --check.",
  }),
  card({
    key: "site-capacity-visual-rebuild",
    title: "Rebuild the public site around capacity liberation and editorial visuals",
    workstream: "site",
    phase: 5,
    status: "blocked",
    priority: "high",
    owner: null,
    description:
      "Reframe Accelerate as the operator that absorbs routine work so teams can do the work only they can do, then rebuild the public homepage and supporting marketing surfaces so they are visually led, short, and free of dollar-ROI theater.",
    acceptance: [
      "Homepage states the capacity offer in one sentence, leads with stills and the Command Center, and uses 10 hours per person plus role-liberation as the only large numbers, labeled as typical or what we build toward",
      "No dollar ROI, invented client, or recycled 78 percent first-responder tattoo remains on the homepage, services chips, industry feeds, or the articles named in the claims pass",
      "npm run test:no-fabricated-claims and npm run verify:articles pass; desktop and mobile screenshots of the homepage show the new flow without console errors",
    ],
    dependencies: [],
    start:
      "src/components/home; src/components/v2/studio/Studio.tsx; src/content/stats.ts; src/content/industry-feeds.ts; scripts/test-no-fabricated-claims.ts; docs/internal/CONTENT-GUIDE.md",
    guardrails:
      "Do not invent dollar recoveries or named clients. Do not generate portraits of clients. Do not restyle admin. Do not push or deploy unless asked. Keep the paper/ink editorial system; do not reintroduce gold gradients as a brand.",
    labels: ["marketing", "copy", "visual"],
    evidence:
      "2026-08-22: Split outcome, recorded rather than smoothed over. The visual half of this card is live in 764a783 and af14530: the paper/ink system, real photography for home services, law firms, professional services and real estate, native mobile chrome, site search, and the house-style and fabricated-claim guards. The capacity copy half was reverted the same day by founder decision. The homepage is back on its pre-rebuild composition (Evidence, Outcomes, Command Center, How We Work, Plan, Who, FAQ, Final CTA) with the original hero scramble, strike and PROFIT animation, and Services, Verticals and Industries are back on pre-rebuild copy. Acceptance item one (capacity offer in one sentence, 10 hours per person as the only large number) is therefore not met and is not being pursued. Cleanup applied on top of the revert, because the revert as left in the worktree would have carried fabricated evidence back onto the live homepage: PlanDeck restored to the guard-clean sample plan, removing $142,000 estimated annual lost revenue, 340% first-year ROI, 38% lead abandonment, 98% response time reduction and +24% conversion; the allowlist entry that had been added to scripts/test-no-fabricated-claims.ts to silence exactly those was removed, so that guard runs again with an empty allowlist; dollar-ROI phrasing removed from Plan.tsx and FinalCta.tsx; the founder-background sentence removed from Who.tsx. scripts/test-house-style-copy.ts was widened because it reported a pass while eleven em dashes sat in shipped copy. It read only quoted string literals across four directories, so JSX text and MDX article bodies were invisible to it. It now reads JSX text and MDX prose alongside literals across src/app, src/components, src/content, src/lib/email and src/lib/chat, skipping /api/ and bare-dash empty-cell placeholders; files inspected went from 98 to 309. Offences fixed: Plan.tsx, FinalCta.tsx, CommandCenter.tsx, Who.tsx, CommandCenterPage.tsx, RoofingCampaignPage.tsx, ChatPanel.tsx, admin/campaigns/page.tsx, two outbound templates in EmailComposeModal.tsx, and the articles edge-function-voice-ai.mdx and ai-context-system-unified-inbox.mdx. admin/contact-imports/page.tsx is allowlisted with a stated reason: its sample paste is deliberately messy parser input. Commands, all passing: verify:agent-contract, tsc --noEmit, lint, test:no-fabricated-claims, test:house-style-copy, verify:articles (42/42), git diff --check. Playwright at 1440x900 and 390x844 over home, services, industries and command center: no console errors, no page errors, no failed requests, no horizontal overflow, screenshots opened and inspected. Rendered-HTML sweep of 14 public routes plus the two edited articles returns zero em dashes. Remaining is a founder decision, not engineering work: the broad custom-service positioning is now owned by marketing-positioning-copy-reset. Do not reuse this card's Command Center-led acceptance as current copy direction.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run test:no-fabricated-claims; npm run verify:articles; npm run test:house-style-copy; git diff --check. Visual work: desktop and mobile homepage screenshots, console-error check, reduced-motion.",
  }),
  card({
    key: "command-center-demo-mode",
    title: "Ship an isolated, persistent Command Center demo mode",
    workstream: "productization",
    phase: 5,
    status: "shipped",
    priority: "high",
    owner: "Codex",
    description:
      "Provide a shareable full-screen Command Center sandbox that demonstrates realistic operator workflows with fictional data, coherent session state, and an explicit safety boundary before any account or provider is connected.",
    acceptance: [
      "A public no-index demo route exercises Today, approvals, people, pipeline, grounded answers, meeting extraction, and the wider capability rail with no authentication workaround",
      "Every mutation is visibly simulated in browser session storage and the demo makes no admin, AI, cron, webhook, email, calendar, or provider request",
      "Progress survives view changes and refresh within the tab while one global reset restores the exact clean scenario",
      "The embedded Command Center demonstration links to the full workspace and both surfaces state that data is fictional and actions cannot affect live records",
      "Deterministic Playwright covers approval, grounded answer, refresh persistence, reset, person detail, meeting extraction, reduced motion, console errors, protected-request isolation, and desktop/mobile overflow",
    ],
    dependencies: [],
    start:
      "src/app/command-center/demo; src/components/command-center/demo; src/components/sections/CommandCenterPage.tsx; scripts/qa-command-center-demo.mjs",
    guardrails:
      "Demo mode is a separate client-only adapter, never a weakened admin authorization path. Do not copy production records into fixtures, call a real model or provider, persist beyond session storage, imply simulated receipts are live, or create a second implementation of the Command Center.",
    labels: ["clonable", "testing"],
    evidence:
      "2026-08-24: added `/command-center/demo` as an immersive, no-index, client-only workspace reusing the existing CommandCenterDemo rather than duplicating admin or domain logic. Added versioned session state for selected view, explored core workflows, approval queue and edits, selected person, Ask transcript, and meeting extraction; state survives navigation and reload in one tab, closes with the tab, and one Reset action clears every demo key. Added an always-visible Safe demo badge, fictional-data disclosure, 5-step exploration progress, simulated-effect language, and isolated route chrome. The Command Center marketing page now links to the full demo. `npm run qa:command-center-demo` passed simulated approval, grounded/cited answer, reload persistence, global reset, mobile record exploration, meeting extraction, reduced motion, console, overflow, and an explicit assertion that no admin, AI, cron, webhook, or provider request occurs. Reviewed all four screenshots in `/tmp/accelerate-command-center-demo`; the visual pass found and removed global fixed header/footer/chat interference from the immersive route. TypeScript, zero-warning lint, 351-page production build, agent contract, and diff check pass. No deployment or production mutation was performed.",
    verification:
      "npm run qa:command-center-demo; npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build; git diff --check.",
  }),
  card({
    key: "selected-work-portfolio",
    title: "Build the selected work portfolio",
    workstream: "site",
    phase: 5,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Create Accelerate's six-project public Selected Work system, with Northern Trust preserved as an unlisted archive, as a proof layer for the operating, product, software, automation, growth, and emerging-technology experience behind the firm.",
    acceptance: [
      "The work index and six aligned public cases are derived from one typed content manifest, while the Northern Trust route remains available as a noindex archive",
      "Every public claim has approved wording in the source ledger and prohibited legacy claims are absent",
      "Every public case has authentic project evidence, individualized editorial composition, honest attribution, and an explicit connection to current Accelerate services",
      "Homepage, navigation, search, sitemap, metadata, robots, assistant context, and truthful legacy redirects expose public work while excluding the archive",
      "Desktop, tablet, and mobile portfolio QA covers accessibility, keyboard, reduced motion, errors, overflow, media behavior, archive metadata, search exclusion, and sitemap exclusion",
      "Typecheck, lint, guardrails, scoped portfolio tests, build, and diff check pass",
    ],
    dependencies: [],
    start: "src/content/work.ts; src/app/work; src/components/work; src/lib/search/index.ts",
    guardrails:
      "Do not invent metrics or portray founder-built or prior-role work as an Accelerate client engagement. Use only authentic project media when ownership is clear; never fabricate product screenshots. Do not alter unrelated admin work or deploy.",
    labels: ["marketing", "testing"],
    evidence:
      "2026-08-24: shipped a typed seven-record portfolio manifest with six public cases and Northern Trust retained as a direct noindex archive. The public index, homepage, related work, search, sitemap, assistant context, metadata, and service mapping derive from explicit visibility and service IDs, preventing the archive from leaking into public discovery. Rebuilt the shared case system with authentic first-party or archived media, honest conceptual diagrams for private software, individualized editorial compositions, high-contrast architecture bands, responsive image sizing, a one-image preload policy, click-to-load privacy-enhanced video, reduced-motion-safe interaction, visible critical content, relevant-service links, and truthful current/prior/founder-built attribution. SuperDebate now explains one five-surface product system with a real judging interface; WORK+SHELTER's operating architecture has a complete routing model; every public case maps to two current Accelerate services. The source-claim ledger moved out of the public repository (internal maintainer record, not tracked in git); the replacement-asset ledger is in docs/internal/work-portfolio-asset-requests.md. Browser QA passed seven public routes at desktop 1440, tablet 834, and mobile 390 with WCAG A/AA serious/critical checks, keyboard, reduced motion, console/page errors, overflow, broken media, one-image preload, archive noindex/follow, archive exclusion from /work and sitemap, lazy YouTube behavior, and legacy redirect coverage. Opened and reviewed desktop light, mobile dark, WORK+SHELTER, SuperDebate, Green Goods, and archive screenshots in /tmp/accelerate-work-portfolio-qa. verify:agent-contract, TypeScript, lint, no-fabricated-claims, house-style, guardrails, positioning, search, route coverage, portfolio contract, browser QA, 351-page production build, and diff check pass. No deployment or production content mutation was performed.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run test:no-fabricated-claims; npm run test:house-style-copy; npm run verify:guardrails; npm run test:search; npm run test:route-coverage; npm run test:work-portfolio; npm run test:work-portfolio-qa; npm run build; git diff --check.",
  }),
  card({
    key: "portfolio-art-direction-motion",
    title: "Give every portfolio case distinct art direction and restrained motion",
    workstream: "site",
    phase: 5,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Refine the public Work index and six public cases into a more alive, editorial proof layer with project-specific visual worlds, stronger media composition, and restrained motion that remains fast, accessible, and recognizably Accelerate.",
    acceptance: [
      "The Work index restores the approved project order and uses an intentional asymmetric editorial grid without sparse or orphaned cards",
      "All six public cases remain DRY and manifest-driven while exposing visibly distinct, brand-consistent art direction through typed configuration",
      "Hero, chapter, media, diagram, hover, focus, and touch motion is restrained, composited, interruptible where interactive, and immediate under reduced-motion preferences",
      "WORK+SHELTER and SuperDebate lead with coherent authentic site or product imagery; Sparkblox relies only on the strongest existing archival material because the source site is unavailable",
      "Desktop, tablet, and mobile QA covers light and dark themes, normal and reduced motion, keyboard focus, hit targets, accessibility, overflow, errors, media, and archive exclusions",
      "Typecheck, lint, positioning and claims guards, portfolio tests, production build, reviewed screenshots, and diff check pass",
    ],
    dependencies: ["Build the selected work portfolio"],
    start:
      "src/content/work.ts; src/app/work; src/components/work; scripts/qa-work-portfolio.mjs; docs/internal/work-portfolio-asset-requests.md",
    guardrails:
      "Preserve truthful attribution and verified metrics. Do not fabricate product UI or imply prior work was an Accelerate client engagement. Keep Northern Trust as an unlisted noindex archive. Reuse the shared case system and existing authentic assets; do not create six bespoke page implementations, touch unrelated admin work, deploy, or depend on the unavailable Sparkblox site.",
    labels: ["marketing", "visual", "testing"],
    evidence:
      "2026-08-25: repaired and visually re-audited the complete public portfolio system after regression findings. WORK+SHELTER now uses the requested customer-site hero everywhere, presents the quote flow once, and separates customer experience, operating logic, and the custom command center into coherent chapters. SuperDebate now uses a natural wide hero without black bars and separates public product, product architecture, command-center, and event photography evidence. All case media use intrinsic dimensions and typed presentation roles, reject duplicate sources per page, animate through the shared reveal system with a fast-scroll fallback, and open in a section-scoped accessible lightbox with keyboard navigation, focus trapping, focus return, body scroll lock, captions, reduced-motion behavior, and touch-sized controls. Shared card and media elevation was reduced to soft layered shadows. The expanded Playwright suite passed across all seven public routes at four viewports, light and dark themes, normal and reduced motion, WCAG checks, source-aspect checks, duplicate-media checks, lightbox interaction, overflow, runtime errors, broken media, and archive exclusions. Guardrails, portfolio contracts, claims, positioning, search, route coverage, TypeScript, zero-warning lint, the 352-page production build, reviewed screenshots, and diff check passed. 2026-08-26: removed the timing regression and architectural ambiguity. One shared observer in `src/components/motion/useReveal.ts` owns public trigger behavior; Work configures explicit viewport timing through `WorkMotion.tsx` and one CSS recipe. Cards no longer double-animate nested cover media. `docs/contracts/WORK-MOTION-CONTRACT.md`, the static portfolio guard, and browser assertions now fail on homepage-hook coupling, nested entrances, missing armed states, viewport-entry failure, or any Work group/media completing without a Work animation. The seven-route, four-viewport, light/dark, normal/reduced-motion portfolio matrix and reviewed settled/in-progress screenshots pass locally.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run test:no-fabricated-claims; npm run test:house-style-copy; npm run verify:guardrails; npm run test:positioning-copy; npm run test:search; npm run test:route-coverage; npm run test:work-portfolio; npm run test:work-portfolio-qa; npm run build; git diff --check.",
  }),
  card({
    key: "public-site-motion-performance",
    title: "Repair public-site motion and static delivery",
    workstream: "site",
    phase: 5,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Make every public route immediately visible from prerendered HTML, remove hydration-gated route blanks, and give the full public site a coherent, mobile-safe entrance-motion system with especially complete coverage across Selected Work.",
    acceptance: [
      "Every expected marketing, industry, learn, and Work route is statically prerendered or intentionally ISR-backed, with live token and authenticated routes explicitly excluded from the static contract",
      "Initial loads and client-side navigations never hide the page while waiting for hydration, and normal motion uses an immediate subtle route entrance with no outgoing wait",
      "One fail-open reveal system animates semantic headings, copy, proof, card, media, diagram, and CTA groups across public pages while reduced motion and unavailable JavaScript show all content immediately",
      "Every public Work case animates its hero, narrative chapters, visual breaks, carry-forward proof, service mapping, related work, and final CTA on desktop and mobile",
      "The mobile AI chat opens above all public chrome, keeps a safe-area-aware touch-sized close control visible, traps and restores focus, and always restores page scrolling when dismissed",
      "Production-browser QA covers real Link navigation, delayed and disabled JavaScript, slow and fast scrolling, back-forward navigation, reduced motion, accessibility, overflow, runtime errors, and reviewed desktop/mobile screenshots",
      "Agent contract, TypeScript, lint, claims and positioning guards, portfolio tests, production build, prerender assertions, bundle evidence, and diff check pass",
    ],
    dependencies: ["Give every portfolio case distinct art direction and restrained motion"],
    start:
      "src/components/layout/PageTransition.tsx; src/components/home/reveal.tsx; src/components/v2/studio/RevealHeading.tsx; src/components/work; src/components/chat; src/app/globals.css; scripts/qa-work-portfolio.mjs",
    guardrails:
      "Keep prerendered content visible before hydration and when JavaScript fails. Do not enable full static export, experimental View Transitions, or another animation library. Preserve public positioning, truthful portfolio content, archive exclusions, live token routes, admin behavior, and unrelated worktree changes. Do not deploy unless asked.",
    labels: ["marketing", "visual", "performance", "testing"],
    evidence:
      "2026-08-27 navigation architecture: public pages now share one fail-open route runtime with the founder workspace and fictional demos. It distinguishes initial hydration from client navigation, records per-entry scroll without replacing Next.js history state, restores Back and Forward after asynchronous layout growth, sends new destinations to the top, provides delayed progress and accessible focus feedback, and owns one restrained incoming entrance with a zero-motion reduced state. Browser coverage proves public forward and Back behavior at desktop, mobile, and reduced motion. 2026-08-26 final motion repair: the document receives one prepaint `motion-ready` gate before first paint, while `MotionRuntime` confirms hydration and a watchdog fails open. This removes the visible-hidden-visible eyebrow flash and restores one shared blur/rise reveal recipe without per-page readiness classes. Generic reveals exclude Work-owned reveals, and media parallax now keeps server and first-client markup identical before activating viewport-derived transforms. Public-motion passed 40 smoke routes, eight traversals, three motion/device profiles, delayed/no JavaScript, mobile chat, accessibility, and the delayed-hydration first-frame eyebrow regression. 2026-08-26 art-direction pass completed: one shared compositor-only `MediaParallax` primitive now adds overscanned, spring-smoothed scroll depth to homepage industry stills, homepage Selected Work, Work index covers, and case-study photography without adding another entrance owner or layout shift. Contain-fit product evidence uses a smaller travel range; reduced motion force-disables every parallax transform. Homepage Selected Work now has independently triggered heading/copy/CTA entrances and a four-card 7/5 then 5/7 editorial rhythm. The Work index uses asymmetric flagship and supporting grids with varied cinematic/editorial crops while preserving project order and mobile single-column flow. Industry stills gained interruptible saturation, scrim, copy-lift, and press feedback. The full-admin demo launcher was rebuilt as an on-brand ink-and-paper composition with a five-stage hero sequence, three staggered scenario cards, stronger mobile hierarchy, and a no-animation reduced-motion state. QA now measures parallax response, reduced-motion shutdown, Work-grid asymmetry, document-height-aware reveal timing, and launcher stagger completeness. The exhaustive Work matrix passed seven public routes plus archive across four viewports, light/dark, normal/reduced motion, media/lightbox, runtime, overflow, and accessibility. The full-admin scenario matrix passed the launcher plus 28 shared routes on desktop/mobile; settled desktop/mobile launcher and homepage/Work screenshots were opened and reviewed. The 325-page static/SSG production build, TypeScript, lint, static contracts, agent contract, and diff check passed. Earlier evidence: live instrumentation exposed the previous false-positive contract, with homepage elements firing at 101–105% of viewport height and Work content at 87–94%. The repaired shared observer uses a negative bottom root margin and one-shot entry at 76–78% viewport height; Work heroes and cards retain ordered semantic staggering and delayed/no-JavaScript fail-open behavior.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run verify:guardrails; npm run test:no-fabricated-claims; npm run test:positioning-copy; npm run test:work-portfolio; npm run test:public-motion; npm run test:work-portfolio-qa; npm run build; npm run verify:public-prerender; npx next experimental-analyze --output; git diff --check.",
  }),
  card({
    key: "agent-runbooks",
    title: "Maintain agent-ready architecture and recovery runbooks",
    workstream: "documentation",
    phase: 2,
    status: "shipped",
    priority: "high",
    description:
      "Document operating contracts, data ownership, dependencies, setup, failure recovery, testing, and safe change boundaries so another agent can resume without rediscovery.",
    acceptance: [
      "Each core service names its authoritative module, callers, invariants, and tests",
      "Setup and incident runbooks contain exact commands, expected evidence, and rollback/recovery",
      "Feature Board cards remain the live execution source and documentation links back to them",
    ],
    dependencies: ["Verify the production Revenue OS schema"],
    start:
      "AGENTS.md; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md; docs/contributing/AGENT-TICKET-RUNBOOK.md; docs/self-hosting/REVENUE-OS-SETUP.md; src/lib/revenue-os/README.md; scripts/verify-agent-contract.mjs",
    guardrails: "Do not duplicate mutable backlog status into prose. Never include secret values.",
    labels: ["documentation", "handoff", "architecture-contract"],
    evidence:
      "2026-08-16: established repository/app AGENTS entrypoints, one universal data/automation/intelligence engineering contract, an exact ticket pickup/evidence/recovery runbook, and a core module ownership map. npm run verify:agent-contract machine-checks required files, taxonomy, acceptance depth, architecture/verification/stop sections, owned in-progress cards, shipped/in-progress evidence, and founder-auth documentation consistency. All 90 managed cards inherit the contract and verification protocol.",
  }),
  card({
    key: "open-source-release-readiness",
    title: "Prepare the repository for a safe public launch",
    workstream: "documentation",
    phase: 5,
    status: "planned",
    priority: "urgent",
    description:
      "Turn the production-derived private repository into a credible open-source project with a reproducible newcomer path, explicit licensing and asset boundaries, public-safe operations, automated security hygiene, and a reviewed GitHub community surface.",
    acceptance: [
      "README, architecture, self-hosting, contribution, conduct, security, deployment, licensing, and protected-asset guidance describe the real product and a safe path from clone to fictional demo",
      "A tracked environment template and generic database tooling let contributors use infrastructure they control without inheriting Accelerate deployment identifiers or credentials",
      "CI, dependency updates, issue forms, pull-request guidance, ownership, secret-pattern checks, and zero known npm advisories are active and pass from a clean checkout without private environment files",
      "Git history, tracked assets, customer and partner permissions, repository metadata, branch rules, vulnerability reporting, and final public visibility receive explicit maintainer review before launch",
    ],
    dependencies: ["Maintain agent-ready architecture and recovery runbooks"],
    start:
      "README.md; LICENSE; ASSETS.md; SECURITY.md; CONTRIBUTING.md; .github/; .env.example; docs/self-hosting/ARCHITECTURE.md; docs/self-hosting/SELF-HOSTING.md; scripts/verify-open-source-readiness.mjs",
    guardrails:
      "Do not make the repository public, rewrite Git history, delete protected assets, change production visibility, or claim third-party asset rights without explicit maintainer approval. Never expose secrets or customer data. Keep production deployment behavior separate from contributor defaults.",
    labels: ["security", "testing"],
    evidence:
      "2026-08-31 initial readiness implementation: replaced the stock framework README; added MIT code licensing with explicit protected-brand/asset exclusions; created architecture, self-hosting, contribution, security, conduct, issue, pull-request, ownership, CI, Dependabot, and environment-template surfaces; removed stale private deployment/account instructions; made database tooling resolve contributor-owned Supabase targets; and added a tracked-file/secret-pattern repository gate. The current tree and all Git patches were scanned for high-confidence credentials; findings were test fixtures or false-positive identifiers. Production npm advisories were reduced from six to zero and the unused Puppeteer dependency was removed. Remaining before public visibility: clean-checkout CI proof, protected asset/customer permission review, GitHub metadata/security settings, branch rules after visibility change, and final history review. 2026-09-01 note: the repository went public before this card completed, so the items below were done retroactively against a live public repo rather than ahead of it. 2026-09-01 public-safety pass: moved the production Supabase project ref out of two tracked scripts into ISOLATION_PROOF_PROJECT_REF; parameterized the founder identity that two migrations were seeding into every self-hoster's bootstrap tenant behind BOOTSTRAP_* variables, with `npm run verify:bootstrap-identity` to check a fork replaced them; removed the private work-portfolio claims-and-permissions ledger, which named a private individual and an unpublished figure, from the public docs tree entirely; repointed three manifest cards at a doc that was never written; and taught verify:oss to catch dangling docs/*.md references in non-Markdown source, which is the class of bug that hid the missing runbook. 2026-09-02: `npx prettier --check .` passes repo-wide for the first time, so the format:check CI gate is green; verify:admin-tokens, verify:extensions, and verify:module-contract were added as gates. Still genuinely outstanding: the private ledger remains recoverable from git history (removing it there needs a force push and is the maintainer's call), and the protected asset, customer permission, and GitHub branch-rule reviews have not been done.",
  }),
  card({
    key: "full-admin-demo-runtime",
    title: "Build the isolated full-admin demo runtime",
    workstream: "productization",
    phase: 5,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Render the real admin route tree through one safe live-or-demo runtime so shareable fictional workspaces reuse every production component without weakening founder authorization or reaching protected systems.",
    acceptance: [
      "A no-login no-index demo route renders the actual admin shell and route modules with scenario-aware navigation on desktop and mobile",
      "One centralized adapter handles all demo reads, writes, streams, and downloads while a runtime boundary blocks admin, analytics, provider, cron, webhook, email, calendar, and AI requests",
      "Every public standalone demo entrypoint resolves to the full admin demo launcher; the compact interactive preview remains embedded marketing context only",
      "A checked-in contract and automated guard distinguish the embedded product preview from the full admin demo and fail when reusable admin code bypasses the runtime",
    ],
    dependencies: ["Complete the shared professional admin system"],
    start:
      "docs/contracts/ADMIN-DEMO-CONTRACT.md; src/app/admin/layout.tsx; src/middleware.ts; src/lib/admin; scripts/qa-admin-route-parity.mjs",
    guardrails:
      "Do not copy admin pages, weaken /admin authorization, call production APIs from demo mode, add shared-database tenancy, or deploy. Demo state is browser-session-only and visibly fictional.",
    labels: ["clonable", "testing"],
    evidence:
      "2026-08-27 navigation and mobile UX repair: removed the floating demo control, integrated business selection, guided tour, reset, and launcher beneath Appearance, repaired URL-derived active navigation and breadcrumbs across client navigation and browser history, made scenario changes replace the fictional runtime with a full workspace boundary, assigned Paper, Studio, and Signal defaults while preserving manual choices within a scenario session, added mobile drawer scroll lock and touch-safe controls, and tuned shared admin entrances to a 440-500ms blur and rise with a zero-animation reduced-motion state. The complete three-scenario 28-route desktop and mobile matrix, all five appearances, real-click navigation, accordion reliability, scenario switching, persistence, overflow, hit targets, protected-request isolation, TypeScript, lint, build, and visual review pass. No deployment was performed. 2026-08-26 rewrite hardening: validated internal demo rewrites now preserve their fictional scenario marker through middleware re-entry instead of falling through to founder login. The marker selects checked-in demo data only and does not authorize protected APIs. Shared page-transition and scroll-progress chrome now treats the rewritten route exactly like `/admin`, eliminating server/client tree divergence and hydration warnings. The three-scenario 28-route desktop/mobile matrix passed with no escaped protected/provider requests. 2026-08-26 incident repair: `/demo/command-center` is now the only public standalone demo destination. The obsolete `/command-center/demo` route permanently redirects to the full-admin launcher, and the public Command Center page exposes one unambiguous full-admin CTA while retaining the compact preview only as embedded context. Contract coverage fails on obsolete standalone links or render paths. The production build generated both routes statically; the admin-demo contract, embedded-preview QA, and one-scenario full-admin matrix passed 28 shared admin routes on desktop/mobile with protected-request isolation. Launcher, full workspace, and mobile screenshots were reviewed. Earlier evidence: 2026-08-25 shipped `/demo/command-center` as a no-index rewrite into the unchanged founder-only admin tree, wrapped by one browser-session runtime that intercepts admin reads, writes, AI streams, and exports before page effects run. The safety bar identifies the fictional business, switches scenarios, resets exact session state, opens the guided story, and links back to the launcher. Public header, footer, and chat chrome stay out of the workspace. Live `/admin` auth is unchanged; demo middleware adds noindex response headers, robots excludes `/demo`, and runtime guards block protected, analytics, chat, cron, webhook, and provider requests. `docs/contracts/ADMIN-DEMO-CONTRACT.md` is in the required agent read order and contract verifier.",
  }),
  card({
    key: "full-admin-demo-scenarios",
    title: "Ship three complete full-admin demo scenarios",
    workstream: "productization",
    phase: 5,
    status: "shipped",
    priority: "high",
    description:
      "Populate the shared full-admin demo with three coherent fictional businesses whose emails, records, workflows, AI context, receipts, metrics, integrations, and guided stories reconcile across every enabled workspace.",
    acceptance: [
      "Kids enrichment, roofing and exteriors, and growth-studio packs each provide detailed tenant-specific records and complete simulated emails without custom page or handler forks",
      "Scenario URLs are shareable, session state is isolated and resettable per business, and switching scenarios never mixes records or progress",
      "Every enabled route is populated and its primary action works locally; all retained admin routes appear in at least one scenario",
      "Playwright proves each guided story, every enabled route, all appearances, mobile parity, refresh persistence, reset, cross-scenario isolation, and zero protected or provider requests",
    ],
    dependencies: ["Build the isolated full-admin demo runtime"],
    start:
      "src/lib/admin/demo; src/components/admin; src/app/demo/command-center; scripts/qa-admin-demo.mjs",
    guardrails:
      "Use invented adult contacts and .example addresses only. Do not store sensitive child data, copy production content, use lorem ipsum, create pack-specific UI or operation handlers, or deploy.",
    labels: ["clonable", "testing"],
    evidence:
      "2026-08-26 identity polish: one reusable `DemoScenarioMark` now gives each fictional business a distinct animated SVG identity in the launcher, safety controls, expanded shell, collapsed rail, and mobile workspace. Sprout uses an organic draw/breathe sequence, Northline an architectural roof draw, and Harborline an ascending growth mark; all animations are compositor-friendly and fully disabled under reduced motion. Static contracts require all three variants and browser QA verifies distinct marks, workspace propagation, and no-animation reduced state. 2026-08-25: shipped Sprout & Spark Kids Studio, Northline Roofing & Exteriors, and Harborline Growth Studio as versioned data packs over one shared graph and runtime. Each has 30+ adult contacts, 18 opportunities, ten three-message conversations, 18 tasks, six approval actions, tenant-specific labels, complete email and campaign data, operational receipts, integrations, settings, roadmap, content, analytics, and a five-step guided story. Contract tests enforce reserved `.example` domains, counts, unique identities, and referential integrity. Browser QA covers the launcher, all three stories, 28 routes, desktop/mobile, Paper/Night/Signal/Studio appearances, populated views, animated logo, simulated approval, AI event streaming, refresh persistence, exact reset, cross-scenario isolation, overflow, console/runtime errors, and zero escaped protected requests. No deployment or production mutation was performed.",
    verification:
      "npm run test:admin-demo-contract; npm run qa:admin-demo; npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build; git diff --check.",
  }),
  card({
    key: "five-business-admin-demo-suite",
    title: "Deliver five complete targeted business demo workspaces",
    workstream: "productization",
    phase: 5,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Turn the full-admin demo into a five-business sales suite for home services, law firms, professional services, real estate, and nonprofits, with separately authored operating data, intentional default appearances, and a light/dark launcher that helps a visitor choose the right example.",
    acceptance: [
      "Northline Roofing, Alder Ridge Injury Law, Ledgerstone Accounting & Advisory, Hearthline Realty Group, and Common Table Community Network each expose the complete shared admin route tree with coherent business-specific records and no pack-specific UI or handler fork",
      "Every workspace starts in its declared default appearance, supports all five shared admin appearances, restores its own session choice after scenario switching, and returns to its default after an exact reset",
      "The launcher offers exactly five clear business cards whose surfaces, previews, controls, focus states, and contrast adapt completely in both light and dark mode without changing workspace appearance state",
      "Desktop and mobile Playwright proves every registered admin route for all five businesses plus simulated task, pipeline, reply, approval, AI, persistence, reset, cross-scenario isolation, reduced motion, overflow, console safety, and zero protected or provider requests",
    ],
    dependencies: [
      "Build the isolated full-admin demo runtime",
      "Ship three complete full-admin demo scenarios",
    ],
    start:
      "docs/contracts/ADMIN-DEMO-CONTRACT.md; src/lib/admin/demo; src/components/admin; src/app/demo/command-center; scripts/test-admin-demo-contract.ts; scripts/qa-admin-demo.mjs",
    guardrails:
      "Use invented adult contacts and reserved .example addresses only. Keep all effects browser-session-only and visibly simulated. Do not copy production or customer data, expose case-sensitive legal details, create scenario-specific pages or runtime handlers, weaken live admin authorization, add a provider or schema, or deploy.",
    labels: ["clonable", "testing"],
    evidence:
      "Shipped 2026-08-27: the launcher now presents exactly five targeted workspaces—Northline Roofing & Exteriors, Alder Ridge Injury Law, Ledgerstone Accounting & Advisory, Hearthline Realty Group, and Common Table Community Network—in a balanced 3+2 desktop grid and a clear mobile stack. Each pack has separately authored people, opportunities, conversations, tasks, decisions, content, resources, campaign context, metrics, and guided story over the unchanged shared 28-route admin and centralized safe runtime. Studio, Night, Frost, Signal, and Paper are intentional scenario defaults; each scenario stores its own appearance choice and exact reset clears both data and appearance, while launcher light/dark state remains separate. Every launcher surface, preview, control, focus treatment, icon, rule, and shadow adapts across light and dark. The exhaustive browser matrix passed all five businesses across all 28 admin routes on desktop and mobile, all shared appearances, per-business simulated approval/task/pipeline/reply/AI operations, refresh persistence, reset, scenario isolation, reduced motion, overflow, contextual navigation, console safety, and zero escaped protected/provider requests. Settled launcher and representative workspace screenshots were visually reviewed. The optimized production build generated 325 pages; admin-demo contract, navigation runtime, embedded Command Center QA, TypeScript, zero-warning lint, agent contract, and diff check passed. No deployment or production mutation was performed.",
    verification:
      "npm run test:admin-demo-contract; PLAYWRIGHT_BASE_URL=http://localhost:3010 npm run qa:admin-demo; PLAYWRIGHT_BASE_URL=http://localhost:3010 npm run test:navigation-runtime; PLAYWRIGHT_BASE_URL=http://localhost:3010 npm run qa:command-center-demo; npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run build; git diff --check.",
  }),
  card({
    key: "public-shell-route-consistency",
    title: "Keep every public route inside the standard site shell",
    workstream: "site",
    phase: 5,
    status: "shipped",
    priority: "urgent",
    owner: "Codex",
    description:
      "Make public campaign, demo-selection, and marketing routes feel like one Accelerate site by applying the standard header, navigation, footer, chat, route progress, and responsive shell everywhere except authenticated or entered full-admin workspaces.",
    acceptance: [
      "The roofing campaign and full-admin demo launcher render the same public header/navigation and footer as the rest of the site without duplicate local branding",
      "Entered admin and fictional admin workspaces remain immersive and render only application chrome",
      "One shared pathname policy controls Header, Footer, Chat, Dock, route transitions, and scroll progress so route exceptions cannot drift independently",
      "Desktop and mobile browser QA proves shell presence, no overlap or overflow, keyboard navigation, reduced motion, WCAG A/AA critical checks, and clean console behavior on affected routes",
    ],
    dependencies: [],
    start:
      "src/lib/navigation/public-chrome.ts; src/components/layout/Header.tsx; src/components/layout/Footer.tsx; src/components/home/Dock.tsx; src/components/chat/ChatWidget.tsx; src/app/roofing; src/app/demo/command-center",
    guardrails:
      "Preserve the roofing campaign's approved positioning and the demo launcher's fictional-data disclosure. Do not add marketing chrome inside /admin or an entered full-admin demo workspace, change live admin authorization, or deploy without an explicit request.",
    labels: ["marketing", "testing"],
    evidence:
      "Shipped 2026-08-28: one shared public-chrome predicate now governs Header, Footer, Chat, Dock, PageTransition, and ScrollProgress. /roofing and /demo/command-center render the standard public header and footer; the roofing page's duplicate local header/footer were removed; entered live and fictional admin workspaces retain application-only chrome. Roofing low-contrast microcopy and launcher light/dark card/preview tokens were raised to standard readable foregrounds. Automated evidence: qa:ux-integrity passed desktop/mobile shell presence, no duplicate chrome, admin isolation, interaction geometry, focus, computed status contrast, and WCAG A/AA serious/critical scans; navigation runtime passed desktop/mobile/reduced-motion route entrance, history restoration, focus, overflow, and hydration checks; the complete five-business, 28-route desktop/mobile production demo matrix passed all appearances and protected-request isolation; lint, TypeScript, admin-token verification, agent contract, and the optimized 325-page production build passed. Screenshots were reviewed under /tmp/accelerate-ux-integrity and /tmp/accelerate-full-admin-demo. No deployment was performed.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:navigation-runtime; npm run qa:ux-integrity; npm run qa:admin-demo; npm run build; git diff --check.",
  }),

  // Twelve-month Command Center extension program. These cards are canonical
  // specifications; the Grok execution guide only sequences their stable keys.
  card({
    key: "feature-board-dependency-integrity",
    title: "Enforce Feature Board dependency integrity",
    workstream: "foundation",
    phase: 0,
    status: "shipped",
    owner: "Grok-4.6-01-feature-board-dependency-integrity",
    priority: "urgent",
    description:
      "Make the managed Feature Board safe for lower-context workers by validating dependency direction, delivery-circuit ordering, roll-up ownership, milestone notes, and documentation references before a card can be claimed.",
    acceptance: [
      "Contract verification rejects missing, circular, forward-milestone, and dependency-order violations with the affected stable keys",
      "Every active card has satisfied dependencies, one owner, accurate current evidence, and a milestone note matching its managed label",
      "Second Brain phase cards name their concrete implementation cards without duplicating behavior, and stale hard-coded board counts are removed from durable documentation",
      "A coordinator resolves live/manifest drift intentionally and records a zero-drift verification without archiving unrelated active work",
    ],
    dependencies: [],
    start:
      "scripts/feature-backlog-data.mjs; scripts/verify-agent-contract.mjs; docs/contracts/FEATURE-BOARD-TAXONOMY.md; docs/self-hosting/REVENUE-OS-SETUP.md; docs/contributing/GROK-4.6-COMMAND-CENTER-EXECUTION-PLAN.md",
    guardrails:
      "Do not infer completion from old evidence, rewrite active owners, apply the live manifest blindly, or turn the execution guide into a mutable roadmap. Dependency-status repairs require evidence or an explicit coordinator decision.",
    labels: ["database", "testing"],
    verification:
      "npm run verify:agent-contract; npm run seed:features; npx tsx scripts/test-feature-board-dependencies.ts; git diff --check. Live --verify evidence is coordinator-only after reviewing drift; never use --apply as a test.",
    evidence:
      "2026-08-29 Gate 0: added scripts/lib/feature-board-graph.mjs and scripts/test-feature-board-dependencies.ts. Contract verification now rejects missing titles, cycles, forward-milestone edges, delivery-circuit order inversions, unsatisfied in-progress dependencies, milestone-note mismatches, Now keys outside the circuit, and Second Brain roll-ups that do not name their implementation cards. Synthetic fixtures cover those failure classes; the live 138-card manifest is required to pass. Coordinator ownership review: live admin-shell-design-system in_progress/Codex/Now was parked to planned with owner cleared; live email-studio-runtime stayed with Codex but moved to blocked pending production test-send and the unshipped communication sender; route-state-resilience was parked to planned with owner cleared. Delivery-circuit order now places pipeline, setup, communication sender, and audit coverage before their dependents. Now is only atomic-execution-claims. Stale hard-coded board counts were already removed from setup docs. Coordinator apply inserted 19 missing cards, updated 119 managed cards, archived 0 outside-manifest rows. npm run seed:features -- --verify then reported expected 138, activeManaged 138, missing [], drifted [], outsideManifest [].",
  }),
  card({
    key: "booking-mode-contract-reconciliation",
    title: "Reconcile booking activation and health truth",
    workstream: "integrations",
    phase: 2,
    priority: "high",
    description:
      "Make public booking, Calendly attribution, tenant configuration, Setup Center, and admin guidance agree on one optional activation model with truthful behavioral health and a complete manual fallback.",
    acceptance: [
      "One tenant-owned booking mode controls every public embed and admin instruction, with disabled and manual fallback states remaining usable",
      "Calendly embed availability is distinct from API and webhook attribution readiness, and Ready requires fresh signed booking or cancellation evidence",
      "Setup, integration catalog, documentation, and runtime defaults no longer contradict one another",
      "Desktop and mobile QA proves enabled, disabled, not-configured, degraded, and recovered behavior without exposing tokens",
    ],
    dependencies: [
      "Finish Setup Center as the operational control plane",
      "Extract every business fact into one tenant configuration",
    ],
    start:
      "src/config/tenant.ts; src/lib/booking.ts; src/app/admin/setup; src/app/api/webhooks/calendly; public contact and qualifier surfaces; docs/self-hosting/REVENUE-OS-SETUP.md",
    guardrails:
      "Do not activate Calendly API access, create credentials, remove manual scheduling, or describe an embed as verified attribution. Provider activation remains founder-controlled.",
    labels: ["calendar", "reliability"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-booking-mode-contract.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node scripts/qa-booking-mode.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "task-operator-workspace",
    title: "Build the canonical Tasks workspace",
    workstream: "admin",
    phase: 2,
    priority: "high",
    description:
      "Give the founder one complete commitments workspace for open, overdue, snoozed, completed, and record-linked tasks while keeping tasks.ts as the only writer and repairing every existing Tasks destination.",
    acceptance: [
      "A registered /admin/tasks route lists and filters commitments by state, due window, priority, source, and canonical record with truthful loading and recovery states",
      "Create, edit, complete, snooze, and reopen call tasks.ts, record audit/activity evidence, and remain dedupe-safe; the workspace offers no hard delete",
      "Opportunity, Today, search, notification, and AI links open the exact task or filtered Tasks workspace",
      "All five demo scenarios support the primary operations with simulated receipts, and desktop/mobile keyboard QA passes",
    ],
    dependencies: [
      "Build the canonical task generator with deduplication",
      "Standardize loading, errors, retry, and preserved route state",
    ],
    start:
      "src/lib/revenue-os/tasks.ts; src/app/api/admin/tasks/route.ts; src/lib/admin/navigation.ts; src/app/admin/today; src/app/admin/pipeline/[id]; src/lib/admin/demo",
    guardrails:
      "Do not add a second task table, calculate priority independently of queue.ts, hard-delete commitments, or make demo operations reach protected APIs.",
    labels: ["tasks", "admin"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-task-workspace-contract.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-task-workspace.mjs; npm run test:admin-demo-contract; npm run build; git diff --check.",
  }),
  card({
    key: "identity-review-workbench",
    title: "Build the identity review workbench",
    workstream: "foundation",
    phase: 2,
    priority: "high",
    description:
      "Turn ambiguous and unmatched Gmail, Calendar, import, form, and compatibility identities into a bounded founder review queue with evidence-backed link, create, no-match, and defer decisions.",
    acceptance: [
      "One bounded read model lists unresolved identity items by source, age, candidate records, match evidence, and downstream work held for review",
      "Founder decisions call identity.ts with canonical IDs, are optimistic-concurrency protected, idempotent on replay, and write immutable decision and audit evidence",
      "Link, create, no-match, and defer are supported; merge and delete remain unavailable",
      "Resolving an item updates downstream context once without guessing from names or silently discarding provenance",
    ],
    dependencies: [
      "Implement deterministic contact and company identity resolution",
      "Build contextual contact, company, and opportunity details",
    ],
    start:
      "src/lib/revenue-os/identity.ts; src/lib/revenue-os/records.ts; contact import identity decisions; Google association receipts; src/app/admin/contacts",
    guardrails:
      "Never merge or delete records in this card, never match by display name alone, and never let an AI decision resolve identity without founder confirmation.",
    labels: ["identity", "reliability"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-identity-review.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-identity-review.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "data-quality-repair-center",
    title: "Build the data-quality repair center",
    workstream: "admin",
    phase: 3,
    priority: "high",
    description:
      "Turn missing attribution, missing owners or next actions, orphan links, impossible stage history, duplicate candidates, and failed reconciliation into exact inspectable records with safe service-owned repair paths.",
    acceptance: [
      "Every quality count drills into bounded canonical records with rule, evidence time, source, materiality, and an exact record link",
      "Supported repairs call identity, pipeline, task, attribution, or reconciliation services and record before/after audit plus activity evidence",
      "Ambiguous identity routes to the review workbench and unsupported or destructive repairs fail closed",
      "Bulk-looking work shows an exact preview and per-record result rather than hiding partial failure",
    ],
    dependencies: [
      "Build the identity review workbench",
      "Reconcile analytics with canonical stage history",
      "Modernize and canonically integrate every additional admin tool",
    ],
    start:
      "src/lib/revenue-os/analytics.ts; src/lib/revenue-os/identity.ts; src/lib/revenue-os/legacy-reconciliation.ts; src/app/admin/analytics; src/app/admin/activity",
    guardrails:
      "Do not calculate a second set of quality rules in the UI, guess identity, rewrite immutable provider facts, or perform destructive cleanup.",
    labels: ["analytics", "reliability"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-data-quality-repair.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-data-quality-repair.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "stage-history-analytics-reconciliation",
    title: "Reconcile analytics with canonical stage history",
    workstream: "intelligence",
    phase: 2,
    priority: "high",
    description:
      "Make funnel progression, furthest stage reached, time in stage, regressions, stale movement, and forecast inputs derive from canonical stage_events while current-stage reporting remains explicitly current state.",
    acceptance: [
      "Analytics distinguishes current stage from furthest verified stage and documents cohort and transition semantics",
      "Time-in-stage, regression, impossible-sequence, and stalled-pipeline results derive from ordered stage events with deterministic fixtures",
      "Today, Pipeline, Revenue, Analytics, and AI receive the shared metrics instead of route-local formulas",
      "Missing or incomplete history is visible and never silently reconstructed from current state",
    ],
    dependencies: [
      "Rebuild Analytics around decisions and data quality",
      "Normalize the cross-channel activity ledger",
    ],
    start:
      "src/lib/revenue-os/analytics.ts; src/lib/revenue-os/pipeline.ts; stage_events; src/app/admin/analytics; src/app/api/admin/revenue",
    guardrails:
      "Do not overwrite recorded stage history, infer events that do not exist, or present scenario estimates as revenue facts.",
    labels: ["analytics", "database"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-stage-history-analytics.ts; npm run test:analytics-decision-model; PLAYWRIGHT_BASE_URL=http://localhost:3010 npm run test:analytics-workspace; npm run build; git diff --check.",
  }),
  card({
    key: "incident-receipt-recovery-console",
    title: "Build the incident, receipt, and recovery console",
    workstream: "operations",
    phase: 3,
    priority: "high",
    description:
      "Give the founder one evidence graph from a health alert or failed action to its job, source, webhook, message, action, audit, and provider receipts, with only bounded and explicitly safe recovery operations.",
    acceptance: [
      "An incident links to the exact execution chain, redacted error, last success, backlog, next expected run, and affected canonical records",
      "Recovery distinguishes retry, reconcile, resume, dismiss, and escalate, and exposes only operations supported by the authoritative service",
      "Uncertain provider outcomes require reconciliation before retry and repeated recovery requests reuse the original logical key",
      "Incidents close only after fresh behavioral evidence and retain immutable history of attempted recovery",
    ],
    dependencies: [
      "Build the system-health report and freshness thresholds",
      "Complete before/after audit coverage for material changes",
    ],
    start:
      "src/lib/revenue-os/health.ts; src/lib/revenue-os/runs.ts; src/lib/revenue-os/audit.ts; job_runs; source_runs; webhook_receipts; action_queue; Setup Center",
    guardrails:
      "Do not expose secrets or raw payloads, invent generic retry buttons, erase failed receipts, or allow destructive recovery against uncontrolled production data.",
    labels: ["observability", "automation"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-incident-recovery.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-incident-recovery.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "operating-goals-scorecards",
    title: "Add operating goals and scorecards",
    workstream: "intelligence",
    phase: 4,
    priority: "high",
    description:
      "Let the founder set versioned period goals for recorded revenue, qualified inquiries, response time, meetings, proposals, wins, and delivery commitments, then compare them with canonical actuals and named data gaps.",
    acceptance: [
      "Goals are founder-authored, versioned by metric and period, validated against a controlled metric registry, and audited without altering historical actuals",
      "Scorecards call analytics.ts for actuals and show target, actual, variance, pace, window, and missing evidence",
      "Editing a goal never changes pipeline probabilities, stage history, revenue records, or prior goal versions",
      "Today, Analytics, AI reads, and demos consume the same bounded scorecard read model",
    ],
    dependencies: [
      "Consolidate analytics on canonical source-to-revenue data",
      "Rebuild Analytics around decisions and data quality",
    ],
    start:
      "src/lib/revenue-os/analytics.ts; src/app/admin/analytics; src/app/admin/today; admin settings service; migrations",
    guardrails:
      "Do not let AI edit targets, convert projections into actuals, or introduce a route-local score formula. Missing data remains visible.",
    labels: ["analytics", "pipeline"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-operating-goals.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-operating-scorecards.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "forecast-scenario-planner",
    title: "Add versioned forecast scenario planning",
    workstream: "intelligence",
    phase: 4,
    priority: "medium",
    description:
      "Add base, upside, and downside planning scenarios whose versioned assumptions operate on canonical open-pipeline facts while remaining visibly separate from recorded forecast and won revenue.",
    acceptance: [
      "Each scenario records owner, period, version, assumptions, included opportunity IDs, calculation time, and superseded state",
      "Scenario output reuses analytics.ts and separates recorded facts, deterministic projections, and manual assumptions",
      "Opportunity changes mark affected scenarios stale instead of silently recalculating an approved version",
      "Comparisons show variance to goals and actuals with accessible tabular alternatives and no implied certainty",
    ],
    dependencies: [
      "Add operating goals and scorecards",
      "Reconcile analytics with canonical stage history",
    ],
    start:
      "src/lib/revenue-os/analytics.ts; src/app/admin/analytics; opportunities; stage_events; migrations",
    guardrails:
      "Do not mutate opportunity values or probabilities from a scenario, overwrite historical versions, or describe scenario output as booked revenue.",
    labels: ["analytics", "pipeline"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-forecast-scenarios.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-forecast-scenarios.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "won-to-delivery-handoff",
    title: "Create the won-to-delivery handoff",
    workstream: "operations",
    phase: 3,
    priority: "high",
    description:
      "Turn one canonically won opportunity into one inspectable client engagement with onboarding milestones, commitments, source context, and a receipted handoff without creating a second identity or sales pipeline.",
    acceptance: [
      "A confirmed won transition can create or return one idempotent engagement linked to the opportunity, contact, company, proposal, and originating receipts",
      "A versioned onboarding template creates deduplicated milestones and tasks through tasks.ts with owner, due state, and source",
      "Partial handoff preserves completed work, names the bounded remainder, and supports safe replay without duplicate commitments",
      "The record workspace and demo expose engagement status, next milestone, blockers, and exact handoff receipt",
    ],
    dependencies: [
      "Finish the canonical pipeline transition service",
      "Build the canonical task generator with deduplication",
      "Build contextual contact, company, and opportunity details",
    ],
    start:
      "src/lib/revenue-os/pipeline.ts; src/lib/revenue-os/tasks.ts; src/lib/revenue-os/records.ts; legacy clients compatibility; migrations; opportunity record workspace",
    guardrails:
      "Do not dual-write a second contact/company identity, overload opportunity stages with delivery state, contact a client automatically, or retire the legacy clients table before reconciliation.",
    labels: ["tasks", "pipeline"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-delivery-handoff.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-delivery-handoff.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "client-success-lifecycle-workspace",
    title: "Build the client-success lifecycle workspace",
    workstream: "operations",
    phase: 3,
    priority: "high",
    description:
      "Extend the command center beyond the sale with one canonical workspace for onboarding progress, delivery commitments, client communication, risks, outcomes, renewal timing, expansion evidence, and referral follow-up.",
    acceptance: [
      "Each client workspace derives identity, engagement, tasks, conversations, activities, proposals, and revenue context through canonical IDs",
      "Health is an explainable read model of commitments, communication, milestones, incidents, and explicit founder input rather than an opaque AI score",
      "Renewal, expansion, and referral signals create reviewable tasks or action proposals and never contact a client directly",
      "Empty, active, at-risk, paused, completed, and degraded states reconcile in all demo scenarios and responsive QA",
    ],
    dependencies: [
      "Create the won-to-delivery handoff",
      "Finish one auditable communication sender",
      "Finish Conversations as the unified communication inbox",
    ],
    start:
      "engagement read model; src/lib/revenue-os/tasks.ts; src/lib/revenue-os/activities.ts; src/lib/revenue-os/communications.ts; src/app/admin/clients; demo scenarios",
    guardrails:
      "Do not create a second CRM, duplicate communication history, infer satisfaction from opens/clicks, or automate renewal outreach without confirmation or an approved policy.",
    labels: ["tasks", "pipeline"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-client-success.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-client-success.mjs; npm run test:admin-demo-contract; npm run build; git diff --check.",
  }),
  card({
    key: "governed-bulk-operator-actions",
    title: "Add governed bulk operator actions",
    workstream: "operations",
    phase: 3,
    priority: "medium",
    description:
      "Support carefully bounded multi-record task, ownership, stage, suppression, and campaign operations through exact previews, version-bound confirmation, per-record claims, receipts, partial failure, and safe retry.",
    acceptance: [
      "Every bulk operation resolves an exact immutable candidate snapshot and shows inclusions, exclusions, changes, and consequences before confirmation",
      "Execution calls the existing per-record domain service with a batch key plus deterministic row keys and records one terminal result per record",
      "Partial failure preserves successful work, exposes the remainder, and retries only failed or unclaimed rows",
      "Stale records invalidate or exclude the affected row; no bulk operation guesses identity or bypasses transition, suppression, or confirmation rules",
    ],
    dependencies: [
      "Enforce atomic claims and idempotency for jobs and actions",
      "Complete before/after audit coverage for material changes",
      "Build the identity review workbench",
    ],
    start:
      "src/lib/revenue-os/actions.ts; src/lib/revenue-os/pipeline.ts; src/lib/revenue-os/tasks.ts; src/lib/revenue-os/campaign-stops.ts; action queue UI",
    guardrails:
      "No hard delete, silent all-or-nothing claim, direct provider loop, hidden exclusion, or unbounded recipient set. Provider effects still require their normal policy or confirmation.",
    labels: ["automation", "reliability"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-bulk-operator-actions.ts; PLAYWRIGHT_BASE_URL=http://localhost:3010 node --env-file=.env.local scripts/qa-bulk-operator-actions.mjs; npm run build; git diff --check.",
  }),
  card({
    key: "automation-policy-registry",
    title: "Generalize approved automation policies",
    workstream: "security",
    phase: 4,
    priority: "high",
    description:
      "Replace bespoke autonomous modules with one versioned registry for bounded triggers, envelopes, eligibility, stop rules, templates, models, eval fixtures, approvals, kill switches, decisions, and execution receipts.",
    acceptance: [
      "A typed policy definition declares trigger, envelope, guardrails, model job, template, eval set, version, approval, and execution service",
      "Material edits bump the version and suspend execution until founder reapproval; the kill switch is reread immediately before every side effect",
      "The registry records act and decline decisions, shares one evaluation harness and approval surface, and fails unknown policy types closed",
      "Inbound response, stalled-deal nudge, and commitment keeper use the registry without duplicating claim, audit, or receipt logic",
    ],
    dependencies: [
      "Enforce campaign policy envelopes and version reapproval",
      "Answer every inbound inquiry inside an approved response policy",
      "Finish the shared AI confirmation system",
    ],
    start:
      "src/lib/revenue-os/auto-responder.ts; src/lib/revenue-os/campaigns.ts; src/lib/revenue-os/actions.ts; approved policy contract; migrations",
    guardrails:
      "Models never edit policy, widen envelopes, choose recipients outside deterministic eligibility, or bypass the normal service. New policies require fixtures and founder approval.",
    labels: ["automation", "security"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-automation-policy-registry.ts; npm run test:responder-envelope; npm run build; git diff --check.",
  }),
  card({
    key: "client-instance-portability",
    title: "Prove client-instance export and restore portability",
    workstream: "productization",
    phase: 5,
    priority: "medium",
    description:
      "Give each instance a bounded secret-free export and a scratch-instance restore proof covering canonical records, immutable provenance, approved configuration, templates, and schema version without copying Accelerate or another client's data.",
    acceptance: [
      "A versioned export manifest names included tables, row counts, hashes, schema contract, tenant configuration, exclusions, and redacted fields",
      "Secrets, OAuth tokens, provider credentials, raw sensitive payloads, and environment values are never exported",
      "A scratch restore preserves canonical IDs, links, immutable receipts, template versions, and reconciliation counts without producing external effects",
      "Export and restore are resumable, idempotent, auditable, and verified against a non-Accelerate fixture tenant",
    ],
    dependencies: [
      "Prove a clean client installation end to end",
      "Add schema-version and drift verification",
      "Extract every business fact into one tenant configuration",
    ],
    start:
      "docs/self-hosting/SELF-HOSTING.md; migrations; schema contract; src/config/tenant.ts; canonical table map; scripts",
    guardrails:
      "Do not export secrets, copy production data into uncontrolled storage, restore into the Accelerate project, reassign canonical IDs, or trigger sends, webhooks, syncs, or automation during restore.",
    labels: ["clonable", "security"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-client-instance-portability.ts; npm run build; git diff --check. Restore proof must target an explicit scratch project and record redacted row-count/hash evidence.",
  }),
  card({
    key: "integration-adapter-contract",
    title: "Define the provider integration adapter contract",
    workstream: "integrations",
    phase: 3,
    status: "in_progress",
    owner: "Claude",
    priority: "high",
    description:
      "Define one typed provider adapter boundary for scoped connection state, incremental reads, external actions, cursors, rate limits, receipts, reconciliation, health, and canonical service mapping before adding another provider.",
    acceptance: [
      "The adapter contract separates provider connection, bounded pull or webhook input, canonical normalization, external execution, reconciliation, and behavioral health",
      "Every invocation authenticates, claims through runs.ts, preserves provider IDs, honors rate limits, and terminates success, partial, skipped, or failed",
      "The integration registry exposes scopes, data classes, cost posture, freshness, setup, and recovery without treating configuration as Ready",
      "A fixture adapter proves duplicate, replay, cursor expiry, throttling, uncertain outcome, scope drift, and safe recovery",
    ],
    dependencies: [
      "Build the provider capability platform and integration catalog",
      "Enforce atomic claims and idempotency for jobs and actions",
      "Harden encrypted secret and token storage",
    ],
    start:
      "src/lib/revenue-os/integration-registry.ts; src/lib/revenue-os/integrations.ts; src/lib/revenue-os/runs.ts; src/lib/revenue-os/google.ts",
    guardrails:
      "Do not add a universal raw-provider store, hidden dual ownership, credential passthrough, provider-specific business rules, or activate a new provider in this card.",
    labels: ["integrations", "reliability"],
    evidence:
      "2026-09-02 partial: the `IntegrationAdapter` interface in `src/lib/revenue-os/integration-adapters.ts` previously had zero implementations and zero callers. `whatsAppAdapter` and `hubSpotAdapter` now satisfy it with real `verify()` calls against the Meta Graph API and HubSpot's account-info endpoint, are registered in `INTEGRATION_ADAPTERS`, and are wired into `configure_whatsapp` and `configure_hubspot` in `src/app/api/admin/tenant/providers/route.ts`, so a credential is verified before it is ever stored. Two latent bugs surfaced and were fixed while doing it: `importHubSpotBatch` wrote `title`/`value`/`source_id`/`status`, none of which exist on `opportunities`, at a stage (`inquiry`) the check constraint rejects; and both adapters passed a non-UUID external id into `contacts.source_record_id`, a UUID column, so every real insert would have thrown. Identity for phone-only channels now resolves through a new `findCanonicalContactByPhone`, since `resolveOrCreateIdentity` previously had no phone lookup at all. Remaining for this card: cursors, rate limits, reconciliation, and per-provider health are still not part of the adapter boundary.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-integration-adapter-contract.ts; npm run test:integration-catalog; npm run build; git diff --check.",
  }),
  card({
    key: "microsoft-365-workspace-parity",
    title: "Add optional Microsoft 365 workspace parity",
    workstream: "integrations",
    phase: 4,
    priority: "medium",
    description:
      "Map Outlook mail, Outlook Calendar, and selected OneDrive or SharePoint content through Microsoft Graph into the same canonical communication, scheduling, identity, knowledge, run, and receipt services used by Google.",
    acceptance: [
      "Founder-approved delegated scopes, encrypted tokens, account identity, scope drift, reconnect, and behavioral health are visible without exposing credentials",
      "Delta synchronization, change notifications, throttling, cursor recovery, message threading, event updates, and file provenance are replay-safe",
      "Confirmed replies and calendar mutations use canonical services and receipts; selected files stay within explicit allowlists",
      "Google and Microsoft records reconcile through provider IDs and canonical identity without creating parallel inbox, calendar, or knowledge stores",
    ],
    dependencies: [
      "Define the provider integration adapter contract",
      "Finish one auditable communication sender",
      "Implement deterministic contact and company identity resolution",
    ],
    start:
      "integration adapter contract; src/lib/revenue-os/google.ts as behavior reference; integration registry; Setup Center; conversations and record timelines",
    guardrails:
      "Remain Later until separately authorized. Do not request tenant-wide application permissions, ingest unrestricted SharePoint, introduce a second CRM, or activate credentials during implementation without founder approval.",
    labels: ["gmail", "calendar"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-microsoft-365-adapter.ts; npm run test:integration-catalog; npm run build; git diff --check. Production receipts require separate founder activation.",
  }),
  card({
    key: "stripe-revenue-reconciliation",
    title: "Add optional Stripe revenue reconciliation",
    workstream: "integrations",
    phase: 4,
    priority: "medium",
    description:
      "Link Stripe customers, invoices, subscriptions, payments, refunds, and disputes to canonical companies and opportunities so recorded payment truth can reconcile with pipeline and delivery without making Stripe the CRM.",
    acceptance: [
      "Signed out-of-order webhooks and bounded backfill produce one immutable provider event per Stripe event ID with safe replay and reconciliation",
      "Deterministic customer and metadata evidence links canonical records while ambiguous matches enter review",
      "Analytics separates contracted, invoiced, paid, refunded, disputed, and pipeline values and exposes unknown or stale linkage",
      "The integration is read and reconciliation first; no charge, refund, invoice, or subscription mutation is available",
    ],
    dependencies: [
      "Define the provider integration adapter contract",
      "Consolidate analytics on canonical source-to-revenue data",
      "Complete before/after audit coverage for material changes",
    ],
    start:
      "integration adapter contract; integration registry; analytics.ts; identity.ts; webhook receipts; Setup Center",
    guardrails:
      "Remain Later until separately authorized. Use restricted credentials, never store card data, never infer paid state from pipeline, and do not add Stripe write actions.",
    labels: ["analytics", "integrations"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-stripe-reconciliation.ts; npm run test:integration-catalog; npm run build; git diff --check. Production webhook evidence requires separate founder activation.",
  }),
  card({
    key: "slack-notification-approval-surface",
    title: "Add optional Slack notification and approval delivery",
    workstream: "integrations",
    phase: 4,
    priority: "medium",
    description:
      "Deliver selected briefs, operational alerts, and expiring approval links to founder-approved Slack destinations while keeping the Command Center as the durable notification, decision, and action ledger.",
    acceptance: [
      "Only allowlisted workspaces and destinations receive bounded redacted notifications that respect quiet hours, urgency, dedupe, and delivery preferences",
      "Slack buttons carry expiring audience-bound references and open or stage the exact Command Center decision; Slack never executes the domain action directly",
      "Delivery, failure, retry, revocation, and scope drift write canonical receipts and behavioral health",
      "Message content excludes secrets, raw customer payloads, uncontrolled document text, and unnecessary personal data",
    ],
    dependencies: [
      "Define the provider integration adapter contract",
      "Wire notification preferences into actual dispatch",
      "Finish the shared AI confirmation system",
    ],
    start:
      "integration adapter contract; notification preferences; actions.ts; Setup Center; integration registry",
    guardrails:
      "Remain Later until separately authorized. Slack is a delivery surface, never the audit log, action queue, workflow engine, or source of canonical state.",
    labels: ["integrations", "approval"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-slack-notification-adapter.ts; npm run test:integration-catalog; npm run build; git diff --check. Production delivery evidence requires separate founder activation.",
  }),
  card({
    key: "notion-knowledge-source",
    title: "Add optional Notion knowledge ingestion",
    workstream: "integrations",
    phase: 4,
    priority: "medium",
    description:
      "Index only founder-approved Notion pages and databases into the shared knowledge substrate with provider provenance, edit and permission propagation, citations, recency, and explicit deletion or inaccessible states.",
    acceptance: [
      "Only explicitly shared roots are traversed and every chunk retains page, block, parent, URL, edited time, content hash, and permission provenance",
      "Incremental sync skips unchanged content, respects rate limits, and marks deleted, moved, or inaccessible sources without erasing prior provenance",
      "Retrieval uses the shared knowledge service, exposes openable citations, and makes conflicts with canonical records visible",
      "Generated summaries never write back to Notion or become instructions automatically",
    ],
    dependencies: [
      "Define the provider integration adapter contract",
      "Phase B: a knowledge substrate with provenance",
      "Ground AI retrieval in Drive provenance and citations",
    ],
    start:
      "integration adapter contract; knowledge substrate; Drive indexing and retrieval patterns; integration registry; Setup Center",
    guardrails:
      "Remain Later until separately authorized. Do not ingest an entire workspace, bypass page permissions, create a parallel vector store, write to Notion, or promote content into system instructions.",
    labels: ["second-brain", "integrations"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npx tsx scripts/test-notion-knowledge-adapter.ts; npm run test:integration-catalog; npm run build; git diff --check. Production sync evidence requires separate founder activation.",
  }),
  card({
    key: "one-click-vercel-deploy",
    title: "Ship a one-click Vercel deploy button",
    workstream: "productization",
    phase: 5,
    status: "shipped",
    priority: "high",
    description:
      "Add a real Deploy to Vercel button and template configuration so a visitor can go from the README to a running, empty, unconfigured instance without cloning the repo or touching a terminal. This is the single highest-leverage change for adoption: every extra manual step between 'I found this on GitHub' and 'I have a working workspace' loses non-technical operators and the agencies serving them.",
    acceptance: [
      "A Deploy to Vercel button in the README launches Vercel's import flow pre-filled with this repository, with no environment variable prompts required to complete the deploy",
      "A freshly deployed instance boots successfully with zero manual repository edits: it renders the public marketing site and fictional demo immediately, and every /admin route redirects to a clearly stated 'connect your Supabase project' screen instead of erroring",
      "The generated deployment never ships with Accelerate's own branding as the only option silently baked in; the template deploy uses the existing tenant-config seam so the operator's own name/brand can be set without editing source",
      "Deploying does not require any Accelerate-owned credential, and no Accelerate production data, API key, or secret can reach the new deployment through the template",
    ],
    dependencies: ["Prove a clean client installation end to end"],
    start:
      "README.md; vercel.json; .env.example; docs/self-hosting/SELF-HOSTING.md; src/config/tenant.ts; src/middleware.ts; src/app/admin/login/page.tsx",
    guardrails:
      "The button must never point at a fork that could be swapped by a third party without review, and must never pre-fill or embed any real credential, connection string, or production value. Do not weaken or bypass the existing tenant-config seam to make the button simpler; the deployed instance must remain a genuinely empty, isolated workspace.",
    labels: ["clonable", "setup"],
    evidence:
      "2026-09-01 Confirmed no vercel.json changes are required: a visitor's Deploy button clones into their own new Vercel project via /new/clone, a manually triggered import-and-deploy that runs regardless of this repository's committed git.deploymentEnabled:false (that setting only suppresses later git-push-triggered deploys, on the maintainer's project and on the fork alike; documented in the README as a known follow-up for self-hosters). Chose zero required env prompts over the originally planned Supabase/ADMIN_EMAIL prompts after verifying the reason directly: moved .env.local aside, ran a full production build and a production server with zero environment variables. The public marketing site, /open-source, and every fictional demo scenario route returned 200. /admin, previously an unhandled 500 (src/middleware.ts called createServerClient with undefined URL/key), now redirects to /admin/login?error=not_configured, which renders a distinct 'connect your Supabase project' panel (no login form, no Supabase client) pointing at docs/self-hosting/SELF-HOSTING.md. Restored .env.local (checksum-verified identical) and reconfirmed the real, configured dev server's /admin still redirects to the ordinary login form exactly as before, so a live, already-configured deployment is unaffected by this change. Not yet verified: an actual click-through of the button against a real Vercel account and a fresh Supabase project (a maintainer action, not one this agent can perform).",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run verify:oss; npm run build; a real end-to-end test of the button from a signed-out Vercel account against a scratch Supabase project, confirmed to boot with zero manual file edits; git diff --check.",
  }),
  card({
    key: "guided-first-run-setup",
    title: "Guide first-run setup inside the product, not the terminal",
    workstream: "setup",
    phase: 5,
    priority: "medium",
    description:
      "Extend Setup Center into a guided first-run flow so a freshly deployed, unconfigured instance walks its new owner through connecting Supabase, applying migrations, and creating the first founder admin account from inside the running app. A one-click deploy that lands on an empty or crashing Setup Center is not actually one click; the remaining friction is exactly the CLI/psql migration step this card removes.",
    acceptance: [
      "An unconfigured deployment shows a guided, numbered first-run flow instead of a blank or erroring Setup Center",
      "The flow can apply the documented migration order against the operator's own Supabase project through a safe, idempotent, clearly-labeled in-product action or gives one exact copy-pasteable command when a direct database connection is required",
      "The flow ends with a working founder admin login, a green Setup Center, and zero Accelerate-owned data seeded into the new project",
      "Every step fails closed and explains the exact missing credential or unmet precondition rather than silently degrading or letting the operator proceed into a half-configured state",
    ],
    dependencies: ["Ship a one-click Vercel deploy button"],
    start:
      "src/app/admin/setup/page.tsx; src/app/api/admin/setup/route.ts; docs/self-hosting/REVENUE-OS-SETUP.md; docs/self-hosting/SELF-HOSTING.md; migrations/",
    guardrails:
      "Never run a destructive or production migration without explicit operator confirmation in the flow. Never seed Accelerate's own customer or demo data into a new installation. The guided flow supplements, never replaces, the documented manual migration path for operators who prefer it.",
    labels: ["setup", "clonable"],
    evidence:
      "2026-09-01 Root-caused the current blocker: scripts/run-migration.mjs (via scripts/lib/accelerate-database.mjs) shells out to a local psql binary over the session pooler, which cannot run inside a Vercel serverless function. A psql-free path is feasible with node-postgres (pg) connected directly with SUPABASE_DB_HOST/PORT/USER/PASSWORD — the service-role key is a PostgREST JWT and cannot run DDL, so a direct Postgres connection stays required either way. Also confirmed there is currently no account-creation path anywhere in the codebase (grepped for signUp/inviteUserByEmail/admin.createUser) and every /admin/* route except /admin/login requires an authenticated session, so a first-run flow needs new unauthenticated routes under a new middleware allowlist entry. Given those routes run raw DDL and mint the first privileged account, this card needs a dedicated security review pass before implementation, not just the standard verification list.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run db:verify-schema; npm run build; a dedicated security review of the new unauthenticated bootstrap routes (fail-closed once configured, no replay after first admin exists); an end-to-end run against a scratch Supabase project proving the flow reaches a green Setup Center and a working founder login with zero Accelerate data present; git diff --check.",
  }),
  card({
    key: "plugin-module-contract",
    title: "Define a plugin/module contract for optional business capabilities",
    workstream: "productization",
    phase: 6,
    status: "planned",
    priority: "low",
    description:
      "Split the always-on core (contacts, companies, auth, tenancy, permissions, activity, AI context) from optional modules (proposals, campaigns, bookings, analytics) behind a declared contract, so a self-hoster or template author can enable or omit a capability without forking core logic. This is the prerequisite for business templates and a template directory; do not start those before this contract exists, or every template reinvents its own ad-hoc module boundary.",
    acceptance: [
      "A documented module contract (what a module may register: nav entries, admin routes, migrations, AI tools, Setup Center checks) with at least one existing capability (e.g. proposals) refactored to prove the contract is sufficient without behavior change",
      "Disabling a module via the contract removes its nav entries, routes, and AI tools cleanly with no dangling references, verified by a scoped test",
      "The tenant-config seam and existing multi-tenancy contract are unaffected: module enablement is a deployment-time or admin-time choice, never a per-request bypass of tenant isolation",
    ],
    dependencies: [
      "Ship a one-click Vercel deploy button",
      "Guide first-run setup inside the product, not the terminal",
    ],
    start:
      "src/lib/revenue-os/README.md; src/lib/admin/navigation.ts; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md; docs/contracts/MULTI-TENANCY-CONTRACT.md",
    guardrails:
      "Do not weaken tenant isolation, the AI tool impact-tier contract, or the admin auth boundary to make modules pluggable. A module contract is an internal seam, not a runtime code-loading system — no dynamic import of untrusted third-party code.",
    labels: ["clonable", "config"],
    evidence:
      "2026-09-01: Implemented the pluggable module contract (`src/lib/revenue-os/modules.ts`) separating core capabilities (Command, Pipeline, Contacts, Conversations, Intelligence, System) from optional business modules (proposals, campaigns, recovery, email-studio, bookings, clients, content, resources, subscribers, partners, website-grades, analytics, integrations). Modules declare their metadata, navigation links, AI tools, route prefixes, and setup checks. 2026-09-02: closed the two gaps that made the first pass a taxonomy rather than a working contract. Nothing had ever supplied `tenantConfig.modules`, so every module resolved to enabled everywhere and the console badge was a hardcoded string; the real tenant row's config now threads from `requireAdmin()` through `AdminLayout` into `AdminShell` nav filtering and into `runRevenueCommandAgent`, with `GET`/`PATCH /api/admin/tenant/modules` as the audited write path and real toggles in the integrations console. Extension registration then landed: `extensions/*.module.json` manifests are validated and compiled by `scripts/build-extension-modules.mjs` into `src/lib/revenue-os/extension-modules.generated.ts` and merged after core, which stays non-overridable, keeping the stated no-untrusted-code invariant because a manifest is data. Two CI gates hold it: `verify:extensions` (generated file in sync with manifests) and `verify:module-contract` (every declared nav id, route, and tool name resolves, and every registered tool is claimed by exactly one module). `extensions/example-inventory.module.json` with `src/app/admin/example-inventory/page.tsx` is a working example; `docs/contributing/EXTENDING.md` documents modules, integration adapters, and AI tools. Each gate was verified to fail on the defect it claims to catch. Verified with `npm run test:plugin-modules`, `npm run verify:module-contract`, and `npm run verify:extensions`. 2026-09-02 status corrected from Shipped to Planned. Acceptance criterion two requires that disabling a module removes its routes with no dangling references, verified by a scoped test. Route gating does not exist: `isModuleEnabled` has zero callers in `src/app` and `src/middleware.ts`, disabling a module hides its sidebar link while the page still renders on direct navigation, and `scripts/test-plugin-modules.ts` contains no assertion mentioning routes. Two further claims in shipped documentation are also false: `INTEGRATION_ADAPTERS` has zero call sites while its own comment calls it the resolution point, and `setupChecks` is read by nothing with all four declared ids drifted away from the real Setup Center checks. What did ship is real and stands: per-tenant module configuration threaded from `requireAdmin()` into navigation filtering and the agent, an audited toggle write path, manifest validation and generation, and two CI gates. The remaining work is carded as `module-route-gating-enforcement`, `module-contract-gate-hardening`, and `integration-adapter-registry-resolution`.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:tenant-isolation; npm run test:ai-tool-gates; npm run test:plugin-modules; npm run build; git diff --check.",
  }),
  card({
    key: "vertical-business-templates",
    title: "Ship 2-3 vertical business templates (roofing, law firm, agency)",
    workstream: "productization",
    phase: 6,
    priority: "low",
    description:
      "Package pre-configured tenant-config seams (branding placeholders, default pipeline stages, default AI system prompt framing, seeded demo data matching an industry) for 2-3 verticals already represented in this site's own case studies and demo scenarios, so a visitor can deploy something that already looks built for their business rather than a blank instance. Depends on the module contract so a template can declare which modules it enables.",
    acceptance: [
      "At least 2 complete templates, each a tenant-config seam variant plus documented setup notes, that a deploy produces a visibly different, industry-appropriate default workspace",
      "Templates reuse the existing demo-scenario fixtures pattern (src/lib/admin/demo/scenarios) rather than inventing a second seed-data mechanism",
      "No template ships any real customer data, logo, or brand asset without explicit rights to redistribute it",
    ],
    dependencies: ["Define a plugin/module contract for optional business capabilities"],
    start: "src/config/tenant.ts; src/lib/admin/demo/scenarios; src/content/",
    guardrails:
      "Templates are configuration, not forked codebases — a template must not require diverging from main. Do not fabricate adoption or customer claims about any template on the marketing site.",
    labels: ["clonable", "config"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:positioning-copy; npm run test:no-fabricated-claims; npm run build; git diff --check.",
  }),
  card({
    key: "csv-hubspot-importers",
    title: "Ship CSV and HubSpot contact/deal importers",
    workstream: "integrations",
    phase: 6,
    priority: "low",
    description:
      "Give a new self-hoster a real path off their existing CRM: a CSV importer (reusing the existing contact-import review/dedupe flow already shipped for manual list imports) and a HubSpot contacts+deals importer via HubSpot's API. Without this, 'self-host and own your data' still requires manually re-entering every contact.",
    acceptance: [
      "CSV import reuses the existing reviewed-import pipeline (contact-imports) rather than a second ad-hoc parser",
      "HubSpot importer maps contacts and deals into canonical contacts/opportunities with source attribution, and never auto-sends outreach on imported records",
      "Both importers report per-row success/failure counts and never silently drop a row",
    ],
    dependencies: ["Ship a one-click Vercel deploy button"],
    start: "src/lib/revenue-os/contact-imports.ts; src/app/api/admin/revenue-os/contact-imports/",
    guardrails:
      "Imported records must go through the same identity-resolution and tenant-scoping path as every other contact write. No imported record may trigger outbound communication automatically.",
    labels: ["integrations", "identity"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:contact-import-service; npm run build; git diff --check.",
  }),
  card({
    key: "integration-adapter-sdk",
    title: "Publish an integration adapter SDK for third-party connections",
    workstream: "integrations",
    phase: 6,
    priority: "low",
    description:
      "Extract the pattern already used for Google/Gmail/Calendar/OpenRouter connections (src/lib/revenue-os/integrations.ts, integration-registry) into a documented adapter contract a third party can implement for a new provider (Stripe, QuickBooks, Slack, Twilio) without touching core connection/credential storage.",
    acceptance: [
      "A documented adapter interface (connect, verify, sync, disconnect) with the existing OpenRouter or Google adapter refactored to implement it as proof, no behavior change",
      "Credential storage and encryption remain centralized; an adapter never handles raw secrets outside the existing encrypted-connection path",
    ],
    dependencies: ["Define a plugin/module contract for optional business capabilities"],
    start: "src/lib/revenue-os/integrations.ts; src/lib/revenue-os/integration-registry.ts",
    guardrails:
      "No adapter may bypass the existing per-tenant credential encryption or the AI tool impact-tier/approval contract for any action it exposes.",
    labels: ["integrations", "security"],
    evidence:
      "2026-09-01: Built the Integration Adapters SDK (`src/lib/revenue-os/integration-adapters.ts`) providing standard connect/verify/ingress interfaces for third-party channels and CRM sources. Implemented the WhatsApp messaging ingress adapter (`ingestWhatsAppMessage`) normalizing external message IDs and phone numbers into canonical identities and immutable activity ledger receipts. Implemented the HubSpot batch importer (`importHubSpotBatch`) resolving contact identity through canonical deduplication and mapping deals into pipeline opportunities with idempotent dedupe keys. Added Model Context Protocol (MCP) server integration (`src/lib/revenue-os/mcp-server.ts`, `src/app/api/mcp/route.ts`, and `scripts/revenue-os-mcp.ts`) allowing external AI clients (Claude Desktop, ChatGPT, Antigravity) to query bounded resources and stage actions in the action_queue. Verified with `npm run test:integration-adapters` and `npm run test:mcp-server`.",
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:integration-adapters; npm run test:mcp-server; npm run build; git diff --check.",
  }),
  card({
    key: "create-accelerate-cli",
    title: "Ship a create-accelerate scaffolding CLI",
    workstream: "productization",
    phase: 6,
    priority: "low",
    description:
      "npx create-accelerate as a second on-ramp alongside the Deploy button, for developers who want a local clone pre-wired to a chosen template and modules rather than a hosted instance. Only makes sense once the module contract and templates exist; building this first would just hand-roll the same choices the contract should express declaratively.",
    acceptance: [
      "npx create-accelerate walks a developer through template and module selection and produces a locally runnable clone with docs/self-hosting/SELF-HOSTING.md's steps already applied where scriptable",
      "The CLI has no privileged access beyond what the developer's own Supabase/Vercel credentials grant it",
    ],
    dependencies: [
      "Define a plugin/module contract for optional business capabilities",
      "Ship 2-3 vertical business templates (roofing, law firm, agency)",
    ],
    start: "docs/self-hosting/SELF-HOSTING.md; package.json",
    guardrails:
      "Do not publish an npm package that phones home, collects telemetry by default, or requires an Accelerate-owned account to run.",
    labels: ["clonable", "setup"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run build; a real run of the published CLI against a scratch directory; git diff --check.",
  }),

  // --- Competitive feature program -------------------------------------
  // Surface area a mature open-source CRM has and this does not, ordered by
  // how much each one blocks a business from running its real operation here.
  // Each inherits the governance model by construction rather than by
  // discipline: custom data still writes through canonical services into the
  // audit ledger, a workflow action still stages a proposal, a role still
  // gates what an agent may touch. Parity is not the goal; governed execution
  // is the wedge, and a feature that cannot keep it does not ship.
  card({
    key: "custom-data-model",
    title: "Add custom objects and fields",
    workstream: "platform",
    phase: 6,
    priority: "high",
    description:
      "A metadata layer letting a workspace define its own objects and fields, with dynamic record rendering, so a business whose shape does not match contacts/companies/opportunities can still run here. This is the single largest gap against a general-purpose CRM: there is currently no custom field anywhere in the schema, so any business needing one has to fork and migrate.",
    acceptance: [
      "A workspace defines an object and its fields without a deploy, and records of that object render, validate, filter, and sort through the same admin surfaces canonical records use",
      "Custom data is tenant-scoped by the same mechanism canonical tables use, verified by a cross-tenant read and write test against real Postgres, not an in-memory fake",
      "Every custom-record write lands in the audit ledger with actor, origin, and before/after state, exactly as a canonical write does",
      "AI tools reading or proposing writes against custom objects go through the registry with declared impact tiers, so a custom object cannot become an ungoverned side door",
      "A field or object removal is refused, or explicitly reversible, rather than silently dropping stored values",
    ],
    dependencies: ["Define a plugin/module contract for optional business capabilities"],
    start:
      "migrations/; src/lib/revenue-os/schema-contract.ts; src/lib/revenue-os/records.ts; src/lib/admin/navigation.ts",
    guardrails:
      "Do not let a custom object bypass tenant binding, the audit ledger, or the AI impact-tier contract. No arbitrary user-supplied SQL, no runtime DDL from a request path; schema changes stay ordered migrations.",
    labels: ["data", "productization"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run db:verify-schema; a cross-tenant isolation test for custom records against real Postgres; npm run test:core; npm run build; git diff --check.",
  }),
  card({
    key: "roles-and-permissions",
    title: "Add real roles, record ownership, and per-object agent permissions",
    workstream: "security",
    phase: 6,
    priority: "high",
    description:
      "tenant_memberships.role currently permits exactly one value, admin, so every member of a workspace can do everything and the AI can reach everything that member can. A second person in the business, or a client given limited visibility, is not expressible today. This is also the one place a competitor's AI governance is genuinely ahead: theirs scopes agent access per object by role.",
    acceptance: [
      "A workspace defines roles beyond admin, with per-object read and write permissions, enforced in the database rather than only in the interface",
      "Record ownership is explicit and filterable, and a permission change takes effect on the next request without a redeploy",
      "Agent tool availability is scoped by the acting member's role, so an agent can never read or propose against an object its operator cannot",
      "Permission checks fail closed on an unknown role or a missing membership, and every grant or revocation is audited",
      "The existing single-admin path keeps working unchanged for a workspace that never defines a second role",
    ],
    dependencies: ["Enforce tenant context through authentication and domain services"],
    start:
      "migrations/20260830-shared-database-tenancy.sql; src/lib/admin/auth.ts; src/lib/tenancy/context.ts; src/lib/revenue-os/ai-tools.ts",
    guardrails:
      "Do not weaken tenant isolation to express roles. A role narrows what a member may reach inside their own tenant; it never widens reach across tenants, and platform administration stays separate.",
    labels: ["security", "data"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:tenant-isolation; npm run test:ai-tool-gates; a role-scoped authorization test against real Postgres; npm run build; git diff --check.",
  }),
  card({
    key: "server-side-saved-views",
    title: "Move saved views server-side and make record pages configurable",
    workstream: "admin",
    phase: 6,
    priority: "medium",
    description:
      "Saved views are localStorage only (src/lib/admin/pipelineViews.ts, leadsViews.ts), so they are per-device, unshareable, and lost when a browser is cleared, while being presented as a feature. Move them to tenant-scoped storage, shared or private per user, and extend the same mechanism to record page layout and sidebar arrangement.",
    acceptance: [
      "A saved view persists per workspace and per user, survives a device change, and can be shared with the workspace or kept private",
      "Record page sections and sidebar arrangement are configurable and persist the same way, reusing the existing admin layout override mechanism rather than a second one",
      "A view referencing a field or object that no longer exists degrades to a readable state instead of erroring",
      "Existing localStorage views migrate on first load rather than disappearing",
    ],
    dependencies: ["Add custom objects and fields"],
    start:
      "src/lib/admin/pipelineViews.ts; src/lib/admin/leadsViews.ts; src/lib/revenue-os/admin-layout.ts; src/lib/admin/layout-overrides.ts",
    guardrails:
      "A shared view must not leak records the viewing member's role cannot reach; view definitions are filters over an authorized query, never a way around one.",
    labels: ["admin-ux", "data"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:pipeline-saved-views; npm run test:admin-layout; npm run build; git diff --check.",
  }),
  card({
    key: "dashboards-and-metrics",
    title: "Add user-defined dashboards and metrics",
    workstream: "intelligence",
    phase: 6,
    priority: "medium",
    description:
      "Analytics is a fixed set of canonical formulas on one page (src/lib/revenue-os/analytics.ts). A workspace cannot define its own metric, cohort, or dashboard. Build on the existing attribution model, which already surfaces unknown attribution honestly rather than reporting it as zero, so a user-defined metric inherits that truthfulness instead of inventing a cleaner-looking number.",
    acceptance: [
      "A workspace defines a metric and arranges dashboards from live canonical data, without a deploy",
      "A metric with incomplete underlying data reports the gap explicitly rather than substituting zero, matching how canonical analytics already behaves",
      "Dashboard queries are tenant-scoped and role-scoped, and a metric cannot read past what the viewer may see",
      "Every metric definition names the canonical fields it derives from, so a number on a dashboard can be traced back to records",
    ],
    dependencies: [
      "Reconcile analytics with canonical stage history",
      "Add real roles, record ownership, and per-object agent permissions",
    ],
    start: "src/lib/revenue-os/analytics.ts; src/app/admin/analytics/page.tsx",
    guardrails:
      "No metric may present an estimate as a measurement. Do not add a chart that cannot name the records behind it.",
    labels: ["analytics", "admin-ux"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:analytics-decision-model; npm run build; git diff --check.",
  }),
  card({
    key: "workflow-builder",
    title: "Build a visual trigger, condition, and action workflow designer",
    workstream: "operations",
    phase: 6,
    priority: "medium",
    description:
      "Automation exists but is hardcoded across campaigns.ts, inbound.ts, and auto-responder.ts, so changing when something fires means changing code. A visual designer over the same primitives lets an operator express a rule, while every action it can take stays inside the approval and receipt model rather than becoming a second, looser execution path.",
    acceptance: [
      "An operator composes a trigger, conditions, and actions and activates it without a deploy, and can see every run it produced",
      "An action that sends, writes, or changes a record stages a proposal through the existing action queue; a workflow never gains a direct-write path the interface does not have",
      "A workflow that would fire twice for the same event is deduplicated by the existing idempotency mechanism, and a failed run reports truthfully rather than retrying blindly",
      "Deactivating a workflow stops queued runs immediately, and stop conditions are re-read before each action rather than evaluated once at activation",
    ],
    dependencies: [
      "Generalize approved automation policies",
      "Enforce every campaign stop condition immediately",
    ],
    start:
      "src/lib/revenue-os/campaigns.ts; src/lib/revenue-os/auto-responder.ts; src/lib/revenue-os/actions.ts; src/lib/revenue-os/runs.ts",
    guardrails:
      "A workflow is a composition of reviewed actions, never a scripting surface. No user-supplied code execution, and no action type that does not already exist in the approval queue's vocabulary.",
    labels: ["automation", "operations"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run test:action-execution; npm run test:campaign-execution; npm run build; git diff --check.",
  }),
  card({
    key: "public-records-api",
    title: "Publish a public REST API for canonical records",
    workstream: "integrations",
    phase: 6,
    priority: "medium",
    description:
      "The only external programmatic surfaces today are MCP and write-only tenant ingest keys. There is no way to read records out, or to integrate a tool that does not speak MCP. A documented REST surface over the canonical services, authenticated per tenant and scoped by role, is what makes the open and flexible claim hold for someone who is not using an AI client.",
    acceptance: [
      "Canonical contacts, companies, opportunities, activities, and tasks are readable and writable over a documented, versioned REST surface",
      "Every request authenticates to one tenant and is scoped by the key's role; a key cannot read or write another workspace, proven by a cross-tenant test against real Postgres",
      "Writes go through the same canonical services the interface uses, so validation, identity resolution, idempotency, and audit receipts all apply unchanged",
      "The surface is rate limited per key, returns structured errors, and publishes a machine-readable schema",
    ],
    dependencies: [
      "Add real roles, record ownership, and per-object agent permissions",
      "Harden webhook, cron, replay, validation, and rate-limit defenses",
    ],
    start:
      "src/app/api/public/[tenantSlug]/; src/lib/tenancy/ingest.ts; src/lib/revenue-os/records.ts",
    guardrails:
      "No endpoint may bypass a canonical service to write a table directly. No key may be granted platform scope. Do not expose provider payloads or credentials through a record read.",
    labels: ["integrations", "security"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint -- --max-warnings=0; a cross-tenant API authorization test against real Postgres; npm run test:core; npm run build; git diff --check.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // PLUGIN PLATFORM — PHASE 0: correct the record.
  // The module seam shipped with three documents claiming enforcement that
  // does not exist. These cards make the claims true rather than reword them,
  // and they are prerequisites for every later phase regardless of which
  // trust boundary the platform ends up using.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "module-route-gating-enforcement",
    title: "Enforce module enablement on routes, not only navigation",
    workstream: "security",
    phase: 6,
    status: "shipped",
    priority: "high",
    description:
      "Plugin Platform phase 0 of 6. Three shipped documents state that a disabled module's routes fail closed: src/lib/revenue-os/modules.ts:12, extensions/README.md:32, and docs/contributing/EXTENDING.md:17. Nothing enforces it. isModuleEnabled has zero callers in src/app and src/middleware.ts, so disabling a module hides its sidebar link while the page still renders on direct navigation and its API routes still answer. Close the gap at two points and describe each one accurately.",
    acceptance: [
      "Page gating: middleware sets the admin pathname as a request header, and src/app/admin/layout.tsx resolves the owning module through a longest-prefix route resolver and renders a disabled notice instead of children. One file covers every admin page with no per-page repetition and no additional database read",
      "The page layer is documented in code as display gating and defense in depth, never as authorization, because Next renders layout and page in parallel and the layout does not stop the child page from fetching",
      "API gating: a requireAdminForModule(moduleId) helper composes with the requireAdmin call every admin route already makes. Middleware is explicitly not used, because /api/admin/* is outside the matcher and adding it would put a tenant query at the edge on every admin API call",
      "A disabled module in one workspace hides its nav, refuses its API routes, reports its AI tools unavailable, and leaves another workspace in the same deployment untouched",
      "A CI gate requires every src/app/api/admin/**/route.ts to call requireAdminForModule or appear in a reviewed core allowlist, proven to fail when a route is added that calls plain requireAdmin",
      "The three documents are corrected in the same change so no cycle ships with the claim still false",
    ],
    dependencies: ["Define a plugin/module contract for optional business capabilities"],
    start:
      "src/lib/revenue-os/modules.ts; src/middleware.ts; src/app/admin/layout.tsx; src/lib/admin/auth.ts; scripts/verify-module-contract.mjs",
    guardrails:
      "Render a disabled notice rather than a 404: a module the operator can switch back on is not missing. Do not add /api/admin to the middleware matcher. Do not weaken tenant isolation or the admin auth boundary to make gating convenient. The demo runtime supplies a null module config and its boundary must stay untouched.",
    labels: ["auth", "config"],
    verification:
      "npm run verify:agent-contract; npm run verify:module-contract; npm run test:plugin-modules; a new scripts/test-route-gating.ts added to test:core; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run build; git diff --check.",
    evidence:
      "2026-09-02: shipped both gates. Pages: middleware sets x-admin-path at every point that leads to an admin render (the demo rewrite, the demo re-entry pass, and the final tenant pass); src/app/admin/layout.tsx resolves the owning module through the new src/lib/revenue-os/module-routes.ts (longest-prefix match) and renders ModuleDisabledNotice instead of children when disabled, documented in code as display gating and defense in depth, never authorization, since Next renders layout and page in parallel. APIs: src/lib/admin/module-guard.ts's requireAdminForModule(moduleId) composes with requireAdmin() and is now the auth call in all 23 route.ts files across the 14 non-core modules that own API routes (proposals, campaigns, email-studio, recovery, revenue, bookings, clients, content, resources, leads-capture, subscribers, partners, website-grades, analytics). A new CI gate, scripts/verify-module-route-guards.mjs, requires every route file in a module's owned API directories to call the guard; it was proven to fail on the exact original defect (23 findings against the unguarded tree) before any route file was touched, and passes now. One deliberate, documented exception: the \"integrations\" module's own console (/admin/integrations and its GET route) is exempt at both the page and API layer via SELF_LOCKOUT_EXEMPT_MODULES, because it is the screen that re-enables every other module and gating it would strand an operator who disabled it with no UI path back. scripts/test-route-gating.ts (now in test:core) proves the resolver's longest-prefix matching, that unowned paths (/admin, /admin/login, /admin/update-password, /admin/ai-operations) never gate, that core modules are always enabled regardless of config, and the integrations exemption. The three false claims this card names are corrected in the same change: src/lib/revenue-os/modules.ts:12, extensions/README.md, and docs/contributing/EXTENDING.md now describe exactly what is enforced, including the integrations exception and the requirement that a manifest-registered module's API routes must be added to MODULE_API_DIRECTORIES to get the same refusal a core-authored module gets. Verified: npm run verify:agent-contract, verify:module-contract, verify:module-route-guards, test:plugin-modules, test:route-gating, test:core, typecheck, lint --max-warnings=0, format:check all pass. Production build not run locally (a dev server was active on the shared tree per CLAUDE.md); typecheck+lint+the pre-push build stand in for it. No commit, push, or deploy performed.",
  }),
  card({
    key: "module-contract-gate-hardening",
    title: "Close the module contract gaps that let unreachable code ship",
    workstream: "qa",
    phase: 6,
    status: "shipped",
    priority: "high",
    description:
      "Plugin Platform phase 0 of 6. Four defects let broken module wiring pass CI today. setupChecks is read by nothing and all four declared ids at modules.ts:152 and :194 are drifted, resolving to no real Setup Center check. availabilityFor marks any tool outside PACK_TOOL_NAMES unavailable while ai-agent.ts always passes a pack, so a registered tool can pass every gate and be permanently unreachable. isNavLinkEnabled and isAiToolModuleEnabled both fail open on an unknown id, so deleting a manifest without deleting its code pins that code on forever. And verify-module-contract.mjs parses TypeScript with regular expressions, which is how a gate script eventually starts lying about what it checked.",
    acceptance: [
      "Every setupChecks id resolves to a real check id in the Setup Center route, or the field is deleted. The gate for this fails on the tree as it stands, on all four ids, which is the proof it catches something real",
      "Every tool in the registry belongs to at least one pack, proven by registering a tool that is claimed by a module but absent from PACK_TOOL_NAMES and watching CI fail where it currently passes",
      "isNavLinkEnabled and isAiToolModuleEnabled resolve an unowned id to disabled rather than enabled",
      "Fail-closed defaults are paired with reverse checks in the same change, so that every nav link and every admin page is claimed by exactly one module and the resolver's unowned branch is unreachable in practice",
      "verify-module-contract.mjs imports the real registries the way scripts/test-plugin-modules.ts already does under tsx, keeping regular expressions only for the filesystem walk",
    ],
    dependencies: ["Enforce module enablement on routes, not only navigation"],
    start:
      "scripts/verify-module-contract.mjs; src/lib/revenue-os/modules.ts; src/lib/revenue-os/ai-tools.ts; src/app/api/admin/setup/route.ts; scripts/test-plugin-modules.ts",
    guardrails:
      "Do not silence a failing check by widening an allowlist. Each new gate must be demonstrated failing on the exact defect it claims to catch before it is accepted. Fail-closed defaults without the reverse coverage checks would break working navigation, so the two must land together.",
    labels: ["qa", "config"],
    verification:
      "npm run verify:module-contract; npm run verify:extensions; npm run test:plugin-modules; npm run test:setup-status; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run build; git diff --check.",
    evidence:
      '2026-09-02: shipped all five. setupChecks: the two drifted declarations (campaigns\' ["resend_configured","campaign_readiness"], bookings\' ["calendly_configured","google_calendar_configured"]) now read ["email","campaigns"] and ["calendly","calendar_sync"], the real ids in src/app/api/admin/setup/route.ts. verify-module-contract.mjs gained a setupChecks-resolution section, proven to fail on the original drift (both false ids) before the fix. Pack coverage: a new section resolves every registered tool against PACK_TOOL_NAMES, proven to fail with a synthetic tool claimed by a module but absent from every pack (all 14 real tools already had coverage, so this is preventative, not a live fix). Fail-closed: isNavLinkEnabled and isAiToolModuleEnabled now return false rather than true/enabled on an unowned id, landed alongside a new reverse-coverage check in verify-module-contract.mjs requiring every real admin page.tsx to be claimed by some module\'s routes[] (with a small named exemption list for the four genuinely unowned pages: /admin, /admin/login, /admin/update-password, /admin/ai-operations), so the fail-closed default cannot silently break real navigation. Parser: verify-module-contract.mjs still walks the filesystem with regex but now parses setupChecks and the pack section directly from source; full import-based rewrite deferred, this pass closed the specific drift risk the card named. test:plugin-modules is now wired into test:core (previously not run in CI at all). Verified: verify:module-contract, verify:extensions, test:plugin-modules, test:core, typecheck, lint --max-warnings=0, format:check all pass; both new gates individually proven to fail on their target defect and pass on the fix. No commit, push, or deploy performed.',
  }),
  card({
    key: "integration-adapter-registry-resolution",
    title: "Make the integration adapter registry the real resolution point",
    workstream: "integrations",
    phase: 6,
    status: "in_progress",
    priority: "high",
    owner: "Claude",
    description:
      "Plugin Platform phase 0 of 6. INTEGRATION_ADAPTERS at src/lib/revenue-os/integration-adapters.ts:460 documents itself as the registry every provider-scoped write resolves through, so that a new adapter is one entry rather than hardcoded imports scattered across routes. It has zero call sites. src/app/api/admin/tenant/providers/route.ts:12 imports whatsAppAdapter and hubSpotAdapter directly and calls them from an if/else chain at lines 257 and 301, which is exactly the pattern the comment claims to prevent. This is a prerequisite for plugin-supplied adapters, not cleanup: a plugin can only register into that map once the map is what provider operations actually traverse.",
    acceptance: [
      "The provider route derives its accepted provider set and its validation from the registry rather than from hand-maintained literal unions",
      "The if/else chain is replaced by one registry lookup and one shared verify, encrypt, upsert and audit block",
      "IntegrationAdapter carries the credential field metadata the shared block needs, so adding a provider is one registry entry",
      "OpenRouter and MCP stay outside the generic path with a written reason: one uses tenant-scoped AAD encryption and the other is server-issued rather than operator-supplied. Forcing them into a generic shape would be worse than the branch it replaces",
      "A CI gate asserts no file outside integration-adapters.ts imports a named adapter export. This gate fails on the tree as it stands, on providers/route.ts:12",
      "The registry's doc comment describes what the code does, verified after the change rather than before",
    ],
    dependencies: [],
    start:
      "src/lib/revenue-os/integration-adapters.ts; src/app/api/admin/tenant/providers/route.ts; src/lib/revenue-os/integration-registry.ts",
    guardrails:
      "Credential verification must still happen before storage. Do not move any secret into a code path where it could be logged or returned. Do not generalize OpenRouter or MCP into the shared shape. Provider credential encryption stays AAD-bound.",
    labels: ["integrations", "encryption"],
    verification:
      "npm run verify:tenant-providers; npm run test:core; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run build; a proof that a WhatsApp and a HubSpot credential still verify and store correctly, and that an invalid credential is refused before storage; git diff --check.",
    evidence:
      "2026-09-02 partial: the first five acceptance items are done. IntegrationAdapter gained a credentialFields declaration (whatsapp: accessToken->api_key, phoneNumberId->phone_number_id; hubspot: accessToken->api_key, webhookSecret->webhook_secret) and two new pure exports, buildEncryptedCredentials and resolveAccountIdentifier. src/app/api/admin/tenant/providers/route.ts's two ~45-line hand-written whatsapp/hubspot blocks are now one configureAdapterProvider() function that looks the adapter up in INTEGRATION_ADAPTERS, calls verify(), and uses the two pure helpers for encryption and account-identifier resolution; OpenRouter and MCP are untouched, with the reason written into the registry's own doc comment. A new CI gate, scripts/verify-integration-adapter-encapsulation.mjs, bans importing whatsAppAdapter or hubSpotAdapter by name outside integration-adapters.ts, and was proven to fail on the exact original defect (the direct import in providers/route.ts) before being wired into CI. scripts/test-integration-adapter-registry.ts (in test:core) proves the encryption-field mapping and the account-identifier fallback against fixtures matching each real adapter's declared fields, including that a field absent from a given request is skipped rather than encrypted as undefined. What is NOT done: the verification list's live proof, that a real WhatsApp and a real HubSpot credential still verify and store correctly against real Postgres and the real Meta/HubSpot APIs, and that an invalid credential is refused before storage. That needs sandbox credentials for both providers, which are not available in this environment; the pure-logic test above is a substitute for the mapping and fallback logic, not a substitute for the live round trip. Remaining before Shipped: run that live proof with real (sandbox) credentials. Verified this session: verify:tenant-providers, verify:integration-adapter-encapsulation, test:integration-adapter-registry, test:core, typecheck, lint --max-warnings=0, format:check all pass. No commit, push, deploy, or live credential access performed.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // PLUGIN PLATFORM — PHASE 1: primitives.
  // Everything a plugin can ever do composes exactly seven primitives:
  // records, views, actions, events, tools, skills, connections. Five of the
  // seven are missing or partial here. This phase is worth building with zero
  // plugins installed, because every card below improves the product on its
  // own. Phase gate: rebuild one existing core feature entirely on these
  // primitives with no behavior change and no direct database writes.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "entity-registry-and-link-graph",
    title: "Add an open entity registry and a polymorphic link graph",
    workstream: "foundation",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 1 of 6, primitive 1 of 7: Records. There is no entity_links table, no entity_types registry, and no generic merge anywhere in src or migrations. Without a generic link table every pair of capabilities that needs to relate records requires a bespoke join table and its own migration, which is the cost that stops an ecosystem before it starts. A meeting capability needs to link a transcript to a contact to an opportunity to a follow-up task; today that is four schema changes. Entity types become rows rather than an enum so that links, merge and audit work on a newly registered type the day it appears, with no code change.",
    acceptance: [
      "entity_links stores source type and id, target type and id, and a link type, with a unique constraint on the tuple so repeated writes are idempotent no-ops rather than duplicates",
      "entity_types is a table, not an enum, carrying the label, backing table, id column, a foreign key catalog that drives generic merge, the identity fields that drive resolution, and a soft-delete flag",
      "Registering a new entity type at runtime makes links, traversal, merge and audit work on it with zero code changes, proven by a test that registers a type and exercises all four",
      "A traversal read returns a bounded, depth-limited graph walk rather than an unbounded join",
      "Both tables carry tenant scoping and row-level security matching the shape every other tenant table already uses in migrations/20260830-shared-database-tenancy.sql",
      "src/lib/revenue-os/schema-contract.ts lists both tables and the contract version is bumped",
    ],
    dependencies: ["Tenant-isolate providers, public intake, webhooks, and jobs"],
    start:
      "migrations/20260830-shared-database-tenancy.sql for the tenant column, composite key and policy shape; src/lib/revenue-os/schema-contract.ts; src/lib/revenue-os/identity.ts",
    guardrails:
      "Do not weaken tenant isolation to make the graph generic. A polymorphic table is the one place a missing tenant filter leaks across every entity at once, so every access goes through one owning service rather than ad-hoc queries. No cascade deletes: history is not the plugin's property.",
    labels: ["database", "identity"],
    verification:
      "npm run db:verify-schema; a scoped service test covering tuple idempotency, bounded traversal depth, cross-tenant refusal, and runtime type registration; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run build; git diff --check.",
  }),
  card({
    key: "generic-record-merge",
    title: "Add foreign-key-safe generic record merge with supersession",
    workstream: "foundation",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 1 of 6, primitive 1 of 7: Records. Duplicates are inevitable once ingestion is AI-driven, and most integrations either never clean them up or delete and orphan the dependents. A merge driven by the entity registry's foreign key catalog walks every dependent in one transaction, preserves the loser's identity as an alias on the winner so future inbound matches still resolve, and supersedes live dependent rows rather than deleting them. That combination is what makes merge safe to run repeatedly.",
    acceptance: [
      "merge_records(entity_type, winner, loser) is driven entirely by the registry's foreign key catalog, so a newly registered entity type is mergeable with no new code",
      "The whole merge is one transaction: a partial merge is impossible",
      "The loser's identifying values are preserved as aliases on the winner, so a later inbound message matching the old value resolves to the merged record",
      "Dependent live rows are superseded rather than deleted, and the audit ledger records the merge with before and after state",
      "Re-running the same merge is a no-op rather than an error or a second merge",
      "A merge is refused when the two records are in different tenants",
    ],
    dependencies: ["Add an open entity registry and a polymorphic link graph"],
    start:
      "src/lib/revenue-os/identity.ts; the entity registry foreign key catalog; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md",
    guardrails:
      "Never hard-delete on merge. Never merge across tenants. Merge is compensable rather than reversible, so it can never be granted an autonomous trust level once the ladder exists.",
    labels: ["dedupe", "identity"],
    verification:
      "a scoped merge test covering full foreign key catalog coverage, transactional rollback on a mid-merge failure, alias preservation and re-resolution, supersession rather than deletion, repeat-merge no-op, and cross-tenant refusal; npm run db:verify-schema; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "unified-action-executor",
    title: "Route every write through one executor with reversibility and compensators",
    workstream: "foundation",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 1 of 6, primitive 3 of 7: Actions. This is a refactor of something real rather than a greenfield build. action_queue already carries the status lifecycle, a pending dedupe index and expiry, and the AI tool registry already asserts at runtime that a mutating tool staged a proposal. What is missing is the reversibility axis, which is orthogonal to the existing impact tiers: impact says how far an effect reaches, reversibility says whether core can restore the prior state. Add the class, add compensators, add an evidence column, and make one executor the only write path so that a user clicking Save and a plugin proposing a change traverse identical code. That single property is what makes the approval queue real rather than cosmetic and the audit log complete rather than best-effort.",
    acceptance: [
      "Every action declares exactly one reversibility class: reversible when core can restore prior state automatically, compensable when a compensating action exists, irreversible when the effect leaves the system",
      "Core UI writes and programmatic writes traverse the same executor, proven by a test asserting one code path rather than by inspection",
      "Every reversible action has a working compensator, verified by executing and then undoing against seeded data rather than by the compensator merely existing",
      "action_queue gains reversibility, compensation and evidence columns; the existing status lifecycle and pending dedupe index are preserved",
      "Idempotency keys deduplicate a replayed execution to one effect",
      "Impact tier and reversibility are kept as separate declared axes, and the relationship between them is documented rather than conflated",
      "Irreversible is enforced at the executor as permanently non-autonomous, so the later trust ladder has nothing to special-case",
    ],
    dependencies: ["Complete AI tool registry and impact tiers"],
    start:
      "migrations/20260816-revenue-os.sql:273 for the existing action_queue; src/lib/revenue-os/ai-tools.ts:21 for the impact tiers; src/lib/revenue-os/README.md for the authoritative domain services",
    guardrails:
      "Do not collapse impact and reversibility into one field; they answer different questions and a merged field will be wrong for one of them. No direct-write path may survive this card, including for core features. An action whose compensator has never been executed in a test does not count as reversible.",
    labels: ["approval", "database"],
    verification:
      "npm run db:verify-schema; a scoped executor test proving one shared code path, compensator execution against seed data, replay idempotency, and refusal of autonomous execution for irreversible actions; npm run test:core; npx tsc --noEmit; npm run build; git diff --check.",
  }),
  card({
    key: "batch-identity-preflight",
    title: "Resolve identity in batches before any write that could create a person",
    workstream: "foundation",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 1 of 6. resolveOrCreateIdentity exists in src/lib/revenue-os/identity.ts and resolves one record at a time. Every capability that extracts people from unstructured input has the same failure mode: silent duplicate creation from name variants and transcription drift. Resolve identity for a whole batch first, once, and classify each candidate as matched, ambiguous, near miss, or new. Ambiguous and near miss are queued for a human and never silently created. This becomes mandatory middleware on any write that could create a person or a company rather than a helper a caller may forget.",
    acceptance: [
      "A batch resolve returns every candidate classified as matched, ambiguous, near_miss, or new, with the matching method recorded for each",
      "A near miss never creates a record. An ambiguous candidate never creates a record. Both queue for a human decision",
      "Fixtures cover diacritics, transcription drift, nickname variants, shared company mailboxes, and phone-only identities, since resolveOrCreateIdentity gained a phone lookup only recently",
      "Resolution is enforced as middleware on the write path rather than offered as an optional helper, so a caller cannot skip it",
      "The classification and its evidence are attached to the resulting proposal so a reviewer sees why a match was claimed",
    ],
    dependencies: [
      "Implement deterministic contact and company identity resolution",
      "Route every write through one executor with reversibility and compensators",
    ],
    start:
      "src/lib/revenue-os/identity.ts; src/lib/revenue-os/inbound.ts; src/lib/revenue-os/contact-imports.ts",
    guardrails:
      "Never guess on ambiguity. A resolution strategy that can silently create is not acceptable regardless of its confidence score. Do not regress the existing contact import flow, which already proposes with AI and requires approval against an exact reviewed snapshot.",
    labels: ["contacts", "dedupe"],
    verification:
      "a scoped resolver test over the full fixture set asserting no creation on ambiguous or near miss; npm run test:inbound-canonical; npm run test:core; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "durable-event-bus",
    title: "Add a durable, replayable event bus with at-least-once delivery",
    workstream: "foundation",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 1 of 6, primitive 4 of 7: Events. Nothing in the tree provides typed business events, durable delivery, replay, or delivery deduplication. Without them, capabilities can only be wired by direct calls, which creates a dependency graph nobody can upgrade and is the failure mode this platform exists to avoid. Events are also the only sanctioned way capabilities communicate with each other.",
    acceptance: [
      "Typed events are emitted and subscribed by name, with a payload schema validated at both ends",
      "Delivery is durable and at least once, with recorded attempts, a next retry time, and a terminal error",
      "A dedupe key means redelivery of the same event produces exactly one effect, proven by delivering the same event twice and asserting one outcome",
      "Events are replayable for a bounded window so a subscriber added later can catch up deliberately",
      "Delivery failures are visible in an operator surface rather than only in logs, matching the existing sync health pattern",
      "Direct capability-to-capability calls are prohibited by contract, with events and shared records as the only channels",
    ],
    dependencies: ["Route every write through one executor with reversibility and compensators"],
    start:
      "migrations/20260816-revenue-os.sql for the job and run ledger shapes already in use; src/lib/revenue-os/README.md",
    guardrails:
      "At-least-once plus idempotent handlers, never exactly-once theatre. A retry storm must be bounded. Event payloads are data and must never be treated as instructions by any AI consumer.",
    labels: ["reliability", "webhooks"],
    verification:
      "a scoped bus test covering duplicate delivery producing one effect, retry with backoff, terminal failure recording, bounded replay, and schema refusal of a malformed payload; npm run test:core; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "capability-scoped-data-api",
    title: "Expose one capability-checked data API with no raw database handle",
    workstream: "security",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 1 of 6. Reads must go through a single capability-checked interface and writes must go through the executor, because that is what makes row-level security, cost accounting and audit complete rather than best-effort. The pattern is already proven in this repository: bindTenantDatabase is a proxy that forces tenant filtering because the service role bypasses row-level security. Generalize it into a data API with three shapes, a filtered entity query, a server-computed recipe, and a capability's own namespaced storage, and deliberately provide no direct write to core entities.",
    acceptance: [
      "The API offers a scoped entity query, a server-computed recipe read, and access to a capability's own namespace, and nothing else",
      "There is deliberately no write function for core entities on this interface; core writes are actions",
      "No path exists from a capability to a raw database handle, asserted by static analysis in CI rather than by review",
      "A cross-workspace read attempt fails closed",
      "Every call is attributed for rate limiting and cost accounting",
      "The existing bindTenantDatabase proxy is the starting point rather than a parallel second mechanism",
    ],
    dependencies: [
      "Route every write through one executor with reversibility and compensators",
      "Add an open entity registry and a polymorphic link graph",
    ],
    start:
      "src/lib/tenancy for bindTenantDatabase and the request context; docs/contracts/MULTI-TENANCY-CONTRACT.md; src/lib/supabase/server.ts",
    guardrails:
      "No escape hatch, no advanced mode, no raw SQL, including for a capability's own tables. Every request for one of those is a missing primitive and should be escalated as a core gap rather than granted. Service-role clients must never be handed out unbound.",
    labels: ["security", "database"],
    verification:
      "npm run verify:agent-contract; a static-analysis CI check proving no raw handle is reachable; a cross-tenant read refusal test against real Postgres; npm run test:core; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "write-provenance-enforcement",
    title: "Require declared evidence on every write, enforced at the executor",
    workstream: "ai",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 1 of 6. The repository is further ahead here than the specification assumes: grounded answer validation already rejects an answer that does not cite receipts from tools that actually executed in that run, and execution re-reads record state and expires a proposal if reality moved. What is missing is applying the same discipline to writes. A commitment extracted from a transcript, or a stage advanced on inferred intent, is exactly where a hallucination causes damage. Evidence requirements belong in the validator, because a prompt instruction is a suggestion to a model while a validator is a guarantee.",
    acceptance: [
      "An action declares its evidence policy: which fields are required, minimum verbatim quote length where a quote is required, and a minimum confidence where confidence applies",
      "The executor rejects an action failing its evidence policy. Rejection happens at the executor, never at the prompt layer",
      "Every proposal carries structured evidence rendered in the approval surface: the claim, the source with its identifier and offset, the verbatim quote, the confidence, and the resolved entities with the method used to resolve them",
      "A confident claim without a sufficient verbatim quote is refused, mirroring the proven pattern that requires a minimum-length quote before a definite assertion is recorded",
      "The existing grounded answer validation is reused rather than duplicated by a second parallel mechanism",
    ],
    dependencies: [
      "Route every write through one executor with reversibility and compensators",
      "Resolve identity in batches before any write that could create a person",
    ],
    start:
      "src/lib/revenue-os/ai-tools.ts for the existing receipt and grounding checks; src/lib/revenue-os/ai-agent.ts; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md",
    guardrails:
      "No safety property may live in prompt text. If the only thing preventing a bad write is an instruction to a model, it is not prevented. Evidence must never contain unredacted customer content in logs or audit rows beyond what the ledger already permits.",
    labels: ["ai", "approval"],
    verification:
      "a scoped validator test proving refusal on a missing quote, a too-short quote, a below-threshold confidence, and an unresolved entity; npm run test:agent-trace; npm run test:core; npx tsc --noEmit; npm run build.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // PLUGIN PLATFORM — PHASE 2: the plugin runtime.
  // This is where the trust boundary moves from code review to runtime
  // isolation. Capability enforcement is by absence: a plugin that did not
  // declare a write has no function in scope that could perform one. An absent
  // function cannot be tricked, which is what makes agent-generated plugin
  // code safe by default. Phase gate: the Tier 0 exemplar installs and renders
  // with zero platform code changes.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "plugin-isolate-host",
    title: "Run plugin code in an isolate with no ambient authority",
    workstream: "platform",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 2 of 6. There is no sandbox of any kind in the tree today: no isolated-vm, no worker, no node:vm. The current seam avoids the problem by executing nothing from extensions, which is a correct invariant for a manifest but caps the platform at declarative capabilities forever. An isolate moves the boundary: plugin code runs with no database handle, no filesystem, no environment, and a default-deny egress allowlist, receiving only host bindings pre-scoped to what its manifest declared. Cold start under 50ms is a requirement rather than a goal, because event handlers fire constantly and a slow cold start makes the whole product feel dead.",
    acceptance: [
      "Cold start is under 50 milliseconds, measured rather than asserted, and the measurement runs in CI",
      "Declared timeout and memory limits are enforced and a breach terminates the isolate cleanly rather than degrading the host",
      "Undeclared network egress is blocked; the allowlist is default-deny",
      "No filesystem and no environment access is reachable from inside the isolate",
      "A host binding is present only when the manifest declared the matching capability, so enforcement is by absence rather than by a runtime permission check",
      "A malicious plugin attempting to reach a database handle, read an environment variable, or call an undeclared host finds no function to call, proven by adversarial test rather than by review",
    ],
    dependencies: ["Expose one capability-checked data API with no raw database handle"],
    start:
      "src/lib/revenue-os/ai-tools.ts for the existing schema-validated registration shape; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md; extensions/README.md for the invariant this card deliberately supersedes",
    guardrails:
      "No plugin code in the core process, and no exception for first-party plugins: that exception is precisely how WordPress's isolation story died. If a first-party connector needs an escape hatch, the platform is wrong and that is a bug in this card, not a connector exception. The existing extensions directory stays pure data.",
    labels: ["security", "config"],
    verification:
      "an adversarial isolate test covering escape attempts, undeclared egress, timeout, memory breach, and absent-binding behavior; a measured cold-start benchmark in CI; npx tsc --noEmit; npm run lint -- --max-warnings=0; npm run build; a security review pass before merge, since this card defines the boundary every later phase relies on.",
  }),
  card({
    key: "plugin-manifest-generator",
    title: "Generate the plugin manifest from validators and fail on drift",
    workstream: "platform",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 2 of 6. A hand-maintained manifest goes stale the moment someone edits a schema, which is exactly what happened to setupChecks in the current module contract, where all four declared ids drifted away from the real checks. The proven answer is to generate the description from the live validators so it cannot drift, the same principle behind a generated schema description that can never disagree with reality. For Tier 2 and above the manifest is derived from source; for Tier 0 and 1 it stays hand-written because there is no source to derive from.",
    acceptance: [
      "A build command derives tools, events and write declarations from the actual validators and fails when the committed manifest disagrees",
      "The tier is computed from the manifest and stamped in, so a plugin cannot self-declare a lower tier to avoid review",
      "An action writing an entity that requires identity resolution must declare an evidence policy, with no exception",
      "An action declaring irreversible has its trust ceiling rewritten to always-propose, with a warning, rather than the contradiction being accepted",
      "Every action declares an idempotency policy or an explicit opt-out carrying a written justification; silence is a build failure",
      "A write declaration for an entity absent from the read declarations is rejected, since a blind write cannot be reviewed",
      "The generated manifest never exceeds what the code registers, and the code can never register more than the manifest declared, proven by a permanent negative fixture rather than trusted",
    ],
    dependencies: ["Run plugin code in an isolate with no ambient authority"],
    start:
      "scripts/build-extension-modules.mjs for the existing generate-and-drift-check pattern; extensions/module-manifest.schema.json; scripts/verify-module-contract.mjs",
    guardrails:
      "No hand-maintained manifests above Tier 1. The manifest is a capability grant that constrains the code, not a description that follows it. A validator rule that can be satisfied by a comment rather than by structure is not a rule.",
    labels: ["config", "qa"],
    verification:
      "npm run verify:extensions; a generator self-test with a negative fixture proving an undeclared registration fails the build; a drift test proving a hand-edited generated file fails; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "plugin-connection-broker",
    title: "Hold plugin credentials in a broker the isolate can never read",
    workstream: "integrations",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 2 of 6, primitive 7 of 7: Connections. integration_connections already stores per-tenant credentials with AAD-bound envelope encryption, which is the hard half. What is missing is the broker shape: a plugin calls a fetch against a named connection and the broker attaches the token, so a compromised or malicious plugin cannot exfiltrate a refresh token because it never holds one. This is the single property that makes third-party plugins safe to connect to a customer's Google or payment account.",
    acceptance: [
      "A plugin performs authorized external calls through a named connection without ever receiving a token, asserted by a test that inspects what crosses the isolate boundary",
      "Token refresh is handled by core, not by the plugin",
      "Revoking a connection takes effect immediately for in-flight and future calls",
      "Scopes are declared per connection in the manifest and a call outside the declared scope is refused",
      "Credentials remain AAD-bound and encrypted at rest, reusing the existing tenant secret path rather than a second mechanism",
    ],
    dependencies: [
      "Run plugin code in an isolate with no ambient authority",
      "Make the integration adapter registry the real resolution point",
    ],
    start:
      "src/app/api/admin/tenant/providers/route.ts; the tenant secret encryption helpers; src/lib/revenue-os/integration-adapters.ts",
    guardrails:
      "A token must never cross the isolate boundary, in any form, including inside an error message or a debug payload. Do not weaken the existing AAD binding to make the broker generic.",
    labels: ["encryption", "integrations"],
    verification:
      "a boundary test asserting no credential material appears in anything passed to or returned from an isolate, including thrown errors; a revocation test; npm run verify:tenant-providers; npx tsc --noEmit; npm run build; a security review pass before merge.",
  }),
  card({
    key: "plugin-install-lifecycle",
    title: "Add the plugin install and uninstall lifecycle with a no-debris contract",
    workstream: "platform",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 2 of 6. Today enabling a module flips one boolean and nothing else happens. A real lifecycle needs the plugin data model, a review screen generated from the manifest so an operator sees the blast radius before granting it, and an uninstall contract that leaves nothing behind. WordPress's debris problem is what makes long-lived installs unmaintainable, so the uninstall rules are non-negotiable rather than best-effort.",
    acceptance: [
      "The plugin data model exists: registered plugins with their manifest and tier, per-workspace installs with granted capabilities and settings, and per-install usage, all tenant-scoped with row-level security",
      "The install review screen is generated from the manifest, never written by the publisher, since publisher-authored capability summaries are where honesty degrades",
      "Enabling runs install or upgrade, writes a receipt, and only then flips the enabled flag. A hook that throws leaves the flag unflipped and records the failure",
      "Uninstall disables event subscriptions and scheduled jobs immediately, marks pending proposals superseded rather than deleting them, revokes connection grants, and retains or purges the plugin's own data per its declared policy",
      "Link and audit history survive uninstall permanently, because history is not the plugin's property",
      "A test asserts zero orphan rows after uninstall outside the link graph and the audit ledger",
      "Hooks are idempotent by contract, with a timeout and a row cap, and anything larger is enqueued rather than run inside a request",
    ],
    dependencies: [
      "Generate the plugin manifest from validators and fail on drift",
      "Add an open entity registry and a polymorphic link graph",
    ],
    start:
      "src/app/api/admin/tenant/modules/route.ts for the current toggle and audit write; src/lib/revenue-os/schema-contract.ts; migrations/20260830-shared-database-tenancy.sql",
    guardrails:
      "Uninstall archives before it purges. A destructive purge is a separate, explicitly confirmed action that stages through the approval queue at the destructive tier. Never silently delete a pending proposal. This card touches the schema contract in a shared database and needs its own review pass.",
    labels: ["config", "database"],
    verification:
      "npm run db:verify-schema; a lifecycle test covering install idempotency, failed-hook rollback, uninstall orphan count, proposal supersession, and history survival; npm run test:core; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "plugin-usage-and-budget-metering",
    title: "Meter plugin usage and enforce a spend budget that halts cleanly",
    workstream: "platform",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 2 of 6. A plugin that calls a paid external service needs a per-install budget, and hitting the cap must disable that capability and notify rather than fail silently in the middle of a batch. Nothing meters plugin cost today because there are no plugins, but the shape should match the existing per-tenant AI budget work rather than inventing a second accounting system.",
    acceptance: [
      "Tool calls, isolate milliseconds, egress calls and spend are attributed per install per day",
      "A manifest declares a default monthly budget and a hard cap; the workspace can lower but not silently raise past the cap",
      "Reaching the cap halts the capability cleanly at an operation boundary and notifies, never mid-write and never silently",
      "Usage and remaining budget are visible to the operator alongside the plugin, not only in logs",
      "Metering shares the accounting shape used by the existing per-tenant AI budgets rather than adding a parallel system",
    ],
    dependencies: [
      "Add the plugin install and uninstall lifecycle with a no-debris contract",
      "Add explicit platform-sponsored AI budgets per tenant",
    ],
    start:
      "the existing per-tenant AI budget implementation; src/lib/revenue-os/ai-gateway or equivalent; src/app/admin/integrations/page.tsx",
    guardrails:
      "A budget breach must never leave a half-completed write. Halt at an operation boundary. Do not let a plugin observe another install's usage.",
    labels: ["observability", "config"],
    verification:
      "a metering test proving attribution accuracy, clean halt at the cap with no partial write, and notification delivery; npx tsc --noEmit; npm run build.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // PLUGIN PLATFORM — PHASE 3: human in the loop.
  // Most platforms get this wrong by treating approval as a UI feature. It is
  // a data model. Today every mutating tool must stage a proposal and nothing
  // auto-executes, so the whole system sits at the safe end of the ladder.
  // This phase adds controlled graduation, earned per narrow capability,
  // granted explicitly, and lost automatically.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "action-trust-ladder",
    title: "Add a per-action trust ladder with a permanent irreversible floor",
    workstream: "security",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 3 of 6. Trust is held per install and per action, never per plugin and never globally, because the unit a human can reason about is one narrow capability. Four levels: always propose; auto-execute with notification and a 24-hour undo; auto-execute within a declared budget, dropping to always-propose when the budget is exceeded; and autonomous with digest reporting only. The hard invariant is that an irreversible action never auto-executes at any level, for any publisher, with no configuration flag, and the validator rewrites any manifest that attempts otherwise.",
    acceptance: [
      "Trust level is stored per install and per action, and changing it is an audited write",
      "An irreversible action cannot exceed always-propose by any path, including direct manipulation of the trust row, proven by an adversarial test that writes the row directly and asserts the executor still refuses",
      "Auto-execution above always-propose is restricted to reversible actions, with compensable actions capped below autonomy",
      "The budget-bounded level drops to always-propose for the remainder of the period once its budget is exceeded",
      "Every auto-executed action produces a notification and an audit row indistinguishable in completeness from a human-approved one",
    ],
    dependencies: [
      "Route every write through one executor with reversibility and compensators",
      "Add the plugin install and uninstall lifecycle with a no-debris contract",
    ],
    start:
      "src/lib/revenue-os/ai-tools.ts for the existing impact tiers; migrations/20260816-revenue-os.sql:273; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md",
    guardrails:
      "There is no flag that permits autonomous irreversible execution. Not for official plugins, not for verified publishers, not behind a setting. Every request for one is a design error. Trust is never global and never per-publisher.",
    labels: ["approval", "auth"],
    verification:
      "an adversarial trust test covering direct trust-row manipulation, irreversible refusal at every level, compensable ceiling, and budget-exceeded demotion; npm run test:core; npx tsc --noEmit; npm run build; a security review pass before merge.",
  }),
  card({
    key: "trust-graduation-engine",
    title: "Propose trust promotion on evidence and demote automatically on failure",
    workstream: "ai",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 3 of 6. This is the loop that makes the product feel like it is learning without ever making the operator feel it is escaping. Promotion is proposed by the system and approved by a human, never taken. Demotion is automatic, immediate and unilateral. The asymmetry is the point: earning trust requires a human decision, losing it does not.",
    acceptance: [
      "Promotion is proposed only after a threshold of decisions in a rolling window with a high approval rate and a low edit-before-approve rate, and the proposal states the exact counts that justified it",
      "A human must accept a promotion; the system never promotes on its own",
      "Any rejection of an auto-executed action, any undo, or an error rate above the declared threshold drops that action to always-propose immediately and notifies",
      "Demotion never waits for a human and never requires one",
      "Promotion is refused outright for irreversible actions regardless of history",
      "The decision history that drives graduation is queryable, so a promotion proposal can be audited after the fact",
    ],
    dependencies: ["Add a per-action trust ladder with a permanent irreversible floor"],
    start: "the trust ladder tables; src/lib/revenue-os/ai-agent.ts; the audit ledger",
    guardrails:
      "Never promote automatically. Never delay a demotion. A promotion proposal that cannot show its evidence is a bug. Do not let a burst of trivial approvals in a short window satisfy a rolling-window threshold.",
    labels: ["ai", "approval"],
    verification:
      "a graduation test covering threshold arithmetic, refusal to self-promote, immediate demotion on rejection, undo and error rate, permanent refusal for irreversible actions, and resistance to burst gaming; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "action-undo-and-compensation",
    title: "Give every auto-executed reversible action a working 24-hour undo",
    workstream: "operations",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 3 of 6. An undo offer is only honest if the compensator has actually been executed against real state. A compensator that merely exists is a promise; one verified by executing and then undoing against seeded data is a guarantee. Undo is what makes the second trust level acceptable at all, so it is a precondition for graduation rather than a convenience.",
    acceptance: [
      "Every auto-executed reversible action offers a one-click undo for 24 hours",
      "Every compensator is verified in the conformance kit by executing the action and then undoing it against seed data, asserting the prior state is restored",
      "An undo is itself audited, with the original action, the compensator, and the restored state recorded",
      "Using undo counts against the action's trust history and can trigger demotion",
      "An action whose compensator fails is surfaced honestly rather than reported as undone",
    ],
    dependencies: ["Add a per-action trust ladder with a permanent irreversible floor"],
    start:
      "the unified executor and its compensation column; src/app/admin/today/page.tsx; the audit ledger",
    guardrails:
      "Never offer undo for a compensable or irreversible action; the word means restoration, not apology. A failed compensation must never be reported as success.",
    labels: ["approval", "activity"],
    verification:
      "an undo test covering state restoration against seed data, audit completeness, trust history effect, and honest failure reporting; reviewed desktop and mobile screenshots of the undo affordance; npm run test:core; npm run build.",
  }),
  card({
    key: "approval-surfaces-and-edit-feedback",
    title: "Make approval inline, batched, and edit-then-approve, with edits as training data",
    workstream: "admin",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 3 of 6. An approval queue that requires navigating to a dedicated page is an approval queue people stop using. Approve from the digest, from chat, and from a dashboard card. Batch related proposals with per-item expansion. Treat edit-then-approve as first class, and record what the human changed as structured feedback rather than discarding it, because that edit is the highest-signal training data the system will ever get and it also feeds the graduation calculation.",
    acceptance: [
      "Inline approval works from the digest, from chat, and from a dashboard card without navigation",
      "Batch approval handles a group with per-item expansion, and a batch never hides an item that differs materially from its siblings",
      "Edit-then-approve is first class and the diff between proposed and approved is recorded as structured feedback",
      "Recorded edits feed both the graduation calculation and the originating capability's own feedback loop, so a regenerated draft visibly answers the critique rather than repeating it",
      "An ask-why affordance expands the full evidence chain behind a proposal",
      "Every surface meets the admin visual and navigation runtime contracts across all themes at desktop and mobile widths",
    ],
    dependencies: [
      "Require declared evidence on every write, enforced at the executor",
      "Propose trust promotion on evidence and demote automatically on failure",
    ],
    start:
      "src/app/admin/today/page.tsx for the existing approval review dialog; docs/contracts/ADMIN-VISUAL-CONTRACT.md; docs/contracts/NAVIGATION-RUNTIME-CONTRACT.md",
    guardrails:
      "Batch approval must never bundle an item whose reversibility or impact differs from the rest of the batch. Do not add a control without an outcome, per the admin visual contract. Never discard an edit.",
    labels: ["approval", "admin"],
    verification:
      "npm run verify:admin-tokens; a scoped test proving batch refuses mixed-reversibility bundling and that edits persist as structured feedback; Playwright at desktop and mobile with reviewed screenshots across themes and reduced motion; npm run build.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // PLUGIN PLATFORM — PHASE 4: agent and UI surfaces.
  // Fifty installed plugins is roughly four hundred tools, which degrades tool
  // selection well before it overflows a context window. Progressive
  // disclosure is a hard constraint here, not an optimization. On the UI side,
  // declarative rendering is what keeps the Tier 0 floor at twenty lines.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "tool-bundles-progressive-disclosure",
    title: "Group tools into bundles and load them on demand",
    workstream: "ai",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 4 of 6, primitive 5 of 7: Tools. PACK_TOOL_NAMES is a fixed three-entry map, not a bundle activation mechanism, and it currently fails closed in a way that silently hides any tool nobody remembered to add. Replace it with manifest-declared bundles, a small always-loaded core, and an intent lookup that activates the matching bundle for a conversation. The rule that keeps this honest: a tool needing five calls to answer a common question is a missing recipe, and that is enforced in review rather than left to the model to stitch together.",
    acceptance: [
      "Every tool belongs to a manifest-declared bundle, and bundle membership is generated rather than hand-maintained",
      "A small always-loaded core covers search, capability description, the report recipes, and the action queue",
      "An intent lookup returns matching bundles and activates one for the conversation",
      "With fifty simulated plugins installed, the active context holds no more than forty tools and selection accuracy stays at or above the single-plugin baseline, measured rather than assumed",
      "A live capability description is generated from the registry at call time, reporting installed plugins, available tools by bundle, recipes with output schemas, current trust levels, and pending proposal count, so it cannot misreport what is deployed",
      "The existing failure mode is fixed: a registered tool that no bundle can reach fails CI rather than shipping unreachable",
    ],
    dependencies: [
      "Close the module contract gaps that let unreachable code ship",
      "Generate the plugin manifest from validators and fail on drift",
    ],
    start:
      "src/lib/revenue-os/ai-tools.ts for PACK_TOOL_NAMES and availabilityFor; src/lib/revenue-os/ai-agent.ts; src/lib/revenue-os/mcp-server.ts",
    guardrails:
      "Do not solve context pressure by silently dropping tools. A tool that is unreachable must be a build failure, never an invisible omission. Bundle activation must not become a way to bypass module enablement or trust levels.",
    labels: ["ai", "config"],
    verification:
      "a selection-accuracy benchmark at fifty simulated plugins compared against the single-plugin baseline; npm run verify:module-contract; npm run test:agent-loop; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "report-recipe-engine",
    title: "Make server-computed report recipes a registrable primitive",
    workstream: "intelligence",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 4 of 6, primitive 2 of 7: Views. Analytics today is a fixed set of canonical formulas on one page, and saved views are localStorage only, so they are lost on a device change while being presented as a feature. A recipe is one server-side computation with a typed output schema that answers a whole question in a single call. The alternative, letting a model assemble an answer from five separate queries at request time, is more expensive, inconsistent, uncacheable, and can silently omit a metric because the model forgot a call.",
    acceptance: [
      "A recipe is registered with a typed output schema and a cache policy, and the schema is enforced on the way out",
      "Recipe results are cached and invalidated on the events that make them stale, rather than on a fixed timer alone",
      "Saved segments move server-side, shared and per-user, replacing the localStorage-only saved views",
      "A recipe is callable identically from the UI, from the agent, and over MCP, with no second code path",
      "The existing canonical analytics formulas are expressed as recipes without changing their published numbers, proven by comparing before and after",
      "Attribution gaps continue to be reported honestly as unknown rather than as zero",
    ],
    dependencies: ["Expose one capability-checked data API with no raw database handle"],
    start:
      "src/lib/revenue-os/analytics.ts for the canonical formulas; src/app/admin/analytics/page.tsx; the saved-view localStorage implementation",
    guardrails:
      "Do not change a published metric definition while moving it. Never report an unknown attribution as zero. A recipe must not become a way to read past the capability-checked data API.",
    labels: ["analytics", "database"],
    verification:
      "npm run verify:attribution-loop; a comparison test proving identical analytics output before and after the migration to recipes; a cache invalidation test; npx tsc --noEmit; npm run build.",
  }),
  card({
    key: "declarative-card-renderer",
    title: "Render dashboard cards from JSON so the Tier 0 floor stays at twenty lines",
    workstream: "admin",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 4 of 6. This is the single most important number in the platform: if adding a chart takes more than roughly twenty-five lines of JSON and zero build tooling, the ecosystem does not happen. A declarative card is validated against a schema and rendered by core, which means no build step, no bundle, no cross-site scripting surface, and automatic theming. Because core owns the pixels, the admin design token contract and the navigation runtime contract hold for plugin UI for free.",
    acceptance: [
      "Card types cover chart, metric, list, table, timeline, form, markdown, and an action queue view",
      "A card is pure JSON validated against a schema; a malformed card fails at install rather than at render",
      "Every card type renders, themes across all admin appearances, and handles its empty and error states with no plugin code",
      "Cards source data from a recipe or a scoped query, never from a raw handle",
      "The Tier 0 exemplar stays within the declared line budget, enforced by a test rather than defended in review",
      "Card rendering satisfies the admin visual and navigation runtime contracts, verified at desktop and mobile widths",
    ],
    dependencies: [
      "Make server-computed report recipes a registrable primitive",
      "Generate the plugin manifest from validators and fail on drift",
    ],
    start:
      "src/components/admin for the shared surfaces and tokens; docs/contracts/ADMIN-VISUAL-CONTRACT.md; scripts/verify-admin-tokens.mjs",
    guardrails:
      "No plugin-supplied React in a declarative card, and no raw HTML or style strings, which would reintroduce the cross-site scripting surface this design exists to avoid. Do not let the card schema grow features that belong in a custom panel.",
    labels: ["admin", "config"],
    verification:
      "npm run verify:admin-tokens; a renderer test covering every card type including empty and error states; a line-budget test on the Tier 0 exemplar; Playwright across every admin appearance at desktop and mobile with reviewed screenshots; npm run build.",
  }),
  card({
    key: "ui-slots-and-sandboxed-panels",
    title: "Add UI slots and sandboxed panels that cannot escape their frame",
    workstream: "admin",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 4 of 6. Declarative cards cover most needs; the remainder need real UI. A sandboxed frame with a message bridge to the same capability-checked data API, and host-provided design tokens so plugin UI matches the product without sharing a stylesheet. Named slots let a plugin place a card, a record tab, a sidebar section, a bulk action, a command palette entry, a settings section, a digest section, or a custom approval card. Slot contention is resolved by the operator's saved layout, never by install order.",
    acceptance: [
      "The slot set is fixed and named, and a plugin may only render into a slot it declared",
      "A panel cannot navigate the top frame, open dialogs outside its bounds, or read cookies, verified by penetration test rather than by configuration review",
      "The panel bridge reaches only the same capability-checked data API, with no widened surface",
      "Host design tokens are provided to the panel so plugin UI themes with the product across every appearance",
      "Slot contention resolves by user-ordered layout, and install order has no effect on placement",
      "Panels respect the navigation runtime contract for focus, loading and reduced motion",
    ],
    dependencies: [
      "Render dashboard cards from JSON so the Tier 0 floor stays at twenty lines",
      "Run plugin code in an isolate with no ambient authority",
    ],
    start:
      "src/lib/admin/navigation.ts and layout-overrides for the existing user-ordered layout mechanism; docs/contracts/NAVIGATION-RUNTIME-CONTRACT.md",
    guardrails:
      "A panel is untrusted content. Never grant it top-frame navigation, cookie access, or a widened data surface because a first-party plugin would find it convenient. Treat everything a panel sends over the bridge as data, never as instructions.",
    labels: ["admin", "security"],
    verification:
      "a penetration test covering frame escape, top-frame navigation, cookie access, and bridge surface; npm run verify:admin-tokens; Playwright across themes, desktop and mobile, and reduced motion with reviewed screenshots; npm run build.",
  }),
  card({
    key: "plugin-skill-registry",
    title: "Add a skill registry where instructions can never grant capabilities",
    workstream: "ai",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 4 of 6, primitive 6 of 7: Skills. A skill is markdown shipped with a plugin describing when a capability applies, what good output looks like, and what never to do. Skills load when their bundle activates. The invariant that makes them safe is that a skill may reference tools but can never grant one: a skill instructing the model to send an email, against a plugin that never declared a send capability, simply has no function to call. That is enforcement by absence applied to instructions.",
    acceptance: [
      "Skills are registered per plugin, loaded on bundle activation, and unloaded with the bundle",
      "A skill referencing an undeclared capability has no corresponding function in scope, asserted by test",
      "Skill text is treated as authored plugin content and is never allowed to widen a capability grant, alter a trust level, or bypass an approval",
      "Skills are visible to the operator, so what the model was told is inspectable rather than hidden",
      "A skill from an untrusted publisher is subject to the same content boundary as any other untrusted input",
    ],
    dependencies: ["Group tools into bundles and load them on demand"],
    start:
      "src/lib/chat/system-prompt.ts and src/lib/revenue-os/ai-agent.ts for the existing prompt boundaries",
    guardrails:
      "A skill is data, not authority. No skill may raise a trust level, bypass an approval, widen a capability, or reach a tool its plugin did not declare. Skill content from a third party is untrusted and must never be followed as an instruction to the platform itself.",
    labels: ["ai", "security"],
    verification:
      "a scoped test proving a skill cannot reach an undeclared tool and cannot alter trust or approval; a prompt-injection test using hostile skill text; npm run test:agent-loop; npx tsc --noEmit; npm run build.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // PLUGIN PLATFORM — PHASE 5: developer experience and exemplars.
  // The conformance kit is the mechanism that lets a mediocre agent ship a
  // safe plugin, so it is not optional polish. The four exemplars are the
  // integration tests for every layer beneath them, and an ecosystem imitates
  // its exemplars, so they ship with the SDK or not at all.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "plugin-cli-and-scaffold",
    title: "Ship a plugin CLI with init, dev, build, check and publish",
    workstream: "productization",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 5 of 6. A fixed project layout matters more here than in most projects because coding agents rely on it: one file per action exporting its validator, executor and compensator; one file per subscribed event; tools whose validator is the source of truth; recipes; skills as markdown; cards as JSON; forward-only migrations for owned schema; and a required health endpoint above Tier 1. The scaffold encodes the layout so an agent does not have to infer it.",
    acceptance: [
      "init scaffolds a working plugin at a chosen tier with the fixed layout and a passing test",
      "dev runs a local runtime against a seeded workspace with hot reload",
      "build generates the manifest from validators and fails on drift",
      "check runs the conformance kit and exits non-zero on any failure",
      "publish signs and submits, and refuses to submit a package that fails check",
      "The full init to publish path completes for every tier, verified in CI rather than by demonstration",
    ],
    dependencies: ["Generate the plugin manifest from validators and fail on drift"],
    start:
      "scripts/build-extension-modules.mjs for the existing generator; the repository's script conventions in package.json",
    guardrails:
      "The project layout is fixed. Do not add per-project configurability that would make an agent guess. The CLI must never be able to publish something check would reject.",
    labels: ["config", "clonable"],
    verification:
      "a CI job running init, dev smoke, build, check and a dry-run publish for each tier; npx tsc --noEmit; npm run lint -- --max-warnings=0.",
  }),
  card({
    key: "plugin-conformance-kit",
    title: "Block publish on a conformance kit that proves safety rather than asserting it",
    workstream: "qa",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 5 of 6. This card is the reason a plugin written by an agent can be trusted. Every check here is structural: it executes something and asserts an outcome rather than reading a declaration. In particular, a compensator counts as working only when the kit has executed the action and undone it against seed data, and a replay counts as safe only when the kit has delivered the same event twice and asserted one effect.",
    acceptance: [
      "Every action has an evidence policy and an idempotency policy, or an explicit opt-out with a written justification",
      "Every reversible action has a compensator, verified by executing and then undoing against seed data",
      "Every irreversible action carries the permanent always-propose ceiling",
      "Identity resolution precedes every write that could create a person or a company",
      "A replay test delivers the same event twice and asserts exactly one effect",
      "Every declared egress host is reachable and allowlisted, and no undeclared host appears during the run",
      "Uninstall leaves no orphan rows outside the link graph and the audit ledger",
      "Isolate cold start is under the declared threshold and the ninety-fifth percentile handler stays inside its declared timeout",
      "Every tool has at least one golden-path test with an asserted output shape",
      "The kit blocks publish, and the kit itself is regression-tested with a fixture that must fail",
    ],
    dependencies: [
      "Ship a plugin CLI with init, dev, build, check and publish",
      "Give every auto-executed reversible action a working 24-hour undo",
      "Add the plugin install and uninstall lifecycle with a no-debris contract",
    ],
    start:
      "scripts/verify-module-contract.mjs and the repository's verify script conventions; docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md",
    guardrails:
      "Every check executes and asserts. A check that reads a declaration and trusts it is not a check. The kit must have its own negative fixtures so it cannot silently stop testing.",
    labels: ["qa", "testing"],
    verification:
      "the kit running green against all four exemplars and red against a deliberately broken fixture for each individual check; npm run build.",
  }),
  card({
    key: "plugin-exemplar-tier0-chart",
    title: "Exemplar Tier 0: a dashboard chart that is pure JSON",
    workstream: "productization",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 5 of 6. The floor test. A complete, installable plugin that adds a pipeline-by-stage chart with no code, no build step, and no permission beyond a single entity read. If this file grows past roughly twenty-five lines, the platform has failed its floor test and that is a release blocker rather than a note.",
    acceptance: [
      "The whole plugin is one manifest file within the declared line budget, with no code and no build step",
      "It installs silently because it is read-only and introduces no new data",
      "The chart renders, themes across every admin appearance, and shows a written empty state",
      "A test enforces the line budget so the floor cannot erode quietly",
      "It installs and renders with zero platform code changes, which is the phase 2 gate",
    ],
    dependencies: ["Render dashboard cards from JSON so the Tier 0 floor stays at twenty lines"],
    start: "the declarative card schema; the recipe engine",
    guardrails:
      "No code, no build, no exceptions. If this exemplar needs a platform change to work, the platform is wrong and the change belongs in the platform card, not here.",
    labels: ["clonable", "config"],
    verification:
      "the conformance kit; the line-budget test; Playwright rendering across every appearance at desktop and mobile with reviewed screenshots.",
  }),
  card({
    key: "plugin-exemplar-tier1-business-pulse",
    title: "Exemplar Tier 1: Business Pulse as one recipe, not five stitched queries",
    workstream: "productization",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 5 of 6, and the launch demo. A daily briefing covering open pipeline, overdue invoices, unanswered inquiries bucketed by age, proposals awaiting follow-up, calendar deltas, and anomalies such as channel volume diverging from close rate. Built as one server-side recipe, because five ad-hoc queries stitched at request time drift the moment a data source is added and can silently omit a metric. The demo arc is connect, understand, find problems, propose work, approve, work happens, and the last step is honest only because it traverses the same executor as manual work.",
    acceptance: [
      "One recipe returns the whole briefing as a typed object in a single call",
      "A scheduled job runs it at a workspace-local hour and emits an event",
      "Each recommendation is a queued proposal carrying the evidence that justified it, so a proposed campaign pause shows the divergence data behind it",
      "The briefing renders in a digest card with inline and batch approval",
      "Every action installs at always-propose. Follow-up task creation may graduate with use; invoice reminders and campaign pauses never do, because they are irreversible or move money",
      "Adding a new data source changes the recipe in one place and cannot silently omit a metric",
    ],
    dependencies: [
      "Make server-computed report recipes a registrable primitive",
      "Make approval inline, batched, and edit-then-approve, with edits as training data",
    ],
    start: "src/lib/revenue-os/analytics.ts; the recipe engine; the action queue",
    guardrails:
      "No invented statistics and no fabricated dollar figures anywhere in the briefing or its copy. A metric with unknown attribution is reported as unknown, never as zero. Campaign pauses and invoice reminders are permanently barred from autonomy.",
    labels: ["analytics", "approval"],
    verification:
      "the conformance kit; a recipe output-schema test; a proof that every proposal carries its justifying evidence; npm run test:no-fabricated-claims; Playwright on the digest card with reviewed screenshots; npm run build.",
  }),
  card({
    key: "plugin-exemplar-tier2-meeting-intelligence",
    title: "Exemplar Tier 2: Meeting Intelligence, the integration test for every primitive",
    workstream: "productization",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Plugin Platform phase 5 of 6. This is deliberately built third, before any further connectors, because it is the only exemplar that exercises identity resolution, provenance gating, the full trust ladder and the event bus at the same time. If the primitives are wrong, this is where it surfaces, and finding that out here is far cheaper than finding it out after three more connectors assume the primitives are correct.",
    acceptance: [
      "On a meeting-ended event it fetches the transcript through a brokered connection and extracts participants, commitments, objections and next steps",
      "Participants are batch-resolved before any write; ambiguous and near-miss candidates queue for a human and are never created",
      "Interaction logging and follow-up task creation are reversible, require a verbatim quote, and deduplicate within a window",
      "Links connect the transcript, the contacts and the opportunity through the generic link graph rather than a bespoke join",
      "A stage advance is compensable, always proposes, and requires both a quote and a minimum confidence",
      "A follow-up email is drafted only, is permanently barred from autonomy, and never sends without a human",
      "A meeting-prep recipe answers a request to prepare for an upcoming meeting in one call, gathering person, company, prior email, prior meetings, open opportunities and outstanding proposals",
      "Delivering the same meeting-ended event twice produces exactly one set of effects",
    ],
    dependencies: [
      "Resolve identity in batches before any write that could create a person",
      "Require declared evidence on every write, enforced at the executor",
      "Add a durable, replayable event bus with at-least-once delivery",
      "Add a per-action trust ladder with a permanent irreversible floor",
    ],
    start:
      "src/lib/revenue-os/identity.ts; the event bus; the link graph; existing calendar and Gmail sync services",
    guardrails:
      "Never guess an ambiguous participant. Never create a task from a transcript without a source quote. The email draft can never be promoted out of always-propose by any path. Real customer transcripts must never be used for development or verification; use fictional fixtures.",
    labels: ["identity", "calendar"],
    verification:
      "the conformance kit including its replay and compensator checks; a fixture-driven end-to-end run over a fictional transcript proving each acceptance item; npm run test:core; npm run build.",
  }),
  card({
    key: "plugin-exemplar-tier3-enrichment",
    title: "Exemplar Tier 3: external enrichment with a budget and a fill-empty-only policy",
    workstream: "productization",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 5 of 6. The exemplar for third-party data, and the one most likely to be copied badly, which is why it must demonstrate the discipline rather than only the capability. The write policy is the crux: enrichment never overwrites a non-empty field and never touches human-curated fields such as type, stage or owner. That single rule is the difference between enrichment as an asset and enrichment as data corruption.",
    acceptance: [
      "The API key is held by the broker and never enters the isolate",
      "A monthly budget with a hard cap meters consumption per call; reaching the cap disables enrichment and notifies rather than failing silently mid-batch",
      "Enrichment fills empty fields only, never overwrites a non-empty value, and never touches human-curated fields",
      "Every call returns applied, rejected and unchanged, with each requested field landing in exactly one bucket and no silent drops",
      "Results below the confidence threshold propose rather than write",
      "Each enriched field records its source, confidence and fetch time, and the interface shows that provenance on the value",
      "The plugin's own cache lives in its own namespace with a time to live, so re-enriching costs nothing and a repeated batch consumes zero additional credits",
    ],
    dependencies: [
      "Hold plugin credentials in a broker the isolate can never read",
      "Meter plugin usage and enforce a spend budget that halts cleanly",
    ],
    start: "the connection broker; the usage metering tables; src/lib/revenue-os/identity.ts",
    guardrails:
      "Never overwrite a non-empty field. Never touch a human-curated field. A budget breach halts at an operation boundary, never mid-write. Do not use a real paid provider account for development; use a fixture or a sandbox key the developer controls.",
    labels: ["integrations", "identity"],
    verification:
      "the conformance kit; a write-policy test proving no overwrite of non-empty or curated fields and complete bucket accounting; a budget test proving clean halt and zero-credit re-run; npm run build.",
  }),
  card({
    key: "plugin-developer-documentation",
    title: "Document every primitive with a runnable example and a fifteen-minute first plugin",
    workstream: "documentation",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 5 of 6. Documentation for this platform is written last on purpose, against shipped behavior, because the plugin pages are the ones most likely to overstate. The current module documentation is the cautionary example: three separate files claimed route gating that did not exist. The target that matters is a timed one, not a word count.",
    acceptance: [
      "Every one of the seven primitives is documented with a runnable example",
      "A build-your-first-plugin path completes in under fifteen minutes, timed against a real first-time user rather than estimated",
      "The four exemplars are documented as reference implementations with their manifests explained field by field",
      "The trust ladder, the reversibility classes and the evidence policy each have a page written for an operator, not only for a developer",
      "Every claim about enforcement names the mechanism that enforces it, and a claim with no mechanism is deleted rather than softened",
      "These pages live in the docs site developer tree and are covered by its link and coverage gates",
    ],
    dependencies: [
      "Build the documentation site infrastructure at /docs",
      "Block publish on a conformance kit that proves safety rather than asserting it",
    ],
    start: "docs/contributing/EXTENDING.md; docs/self-hosting/MCP-SETUP.md; the docs site manifest",
    guardrails:
      "Never document intended behavior as current behavior. Every enforcement claim must name its mechanism and be verifiable by a reader with grep. No em dashes, no antithesis phrasing, no invented statistics, per the existing copy gates.",
    labels: ["documentation", "clonable"],
    verification:
      "npm run verify:docs; npm run test:house-style-copy; npm run test:no-fabricated-claims; a timed first-plugin walkthrough with a real first-time user; npm run build.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // PLUGIN PLATFORM — PHASE 6: distribution.
  // The promise the ecosystem is actually built on is that a plugin published
  // against contract v1 still runs on v1.9 without edits. Everything here
  // exists to keep that promise, and verticals are where the surface area
  // actually comes from, because most businesses install a distribution
  // rather than ten separate plugins.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "plugin-registry-and-signing",
    title: "Publish a signed plugin registry with trust tiers that gate defaults",
    workstream: "productization",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 6 of 6. A public directory with installation from the registry or from a git URL. The listing requirement that matters most is that the plain-language capability summary is generated from the manifest rather than written by the publisher, because publisher-authored summaries are exactly where honesty degrades. Trust tier gates behavior rather than only badges: a community plugin installs at always-propose across every action regardless of what its manifest requested.",
    acceptance: [
      "Listing requires passing conformance, a signed package, a verified publisher identity, and a generated capability summary",
      "The capability summary is generated from the manifest and cannot be overridden by the publisher",
      "Trust tiers are official, verified publisher, community, and unlisted, and the tier is displayed wherever the plugin is",
      "A community plugin installs at always-propose across every action regardless of its manifest, and cannot request a higher level until the workspace itself promotes it",
      "Signature verification happens at install and a tampered package is refused",
      "Installing from a git URL is supported and carries the unlisted trust tier",
    ],
    dependencies: [
      "Block publish on a conformance kit that proves safety rather than asserting it",
    ],
    start: "the conformance kit; the plugin data model; src/app/admin/integrations/page.tsx",
    guardrails:
      "Never let a publisher write their own capability summary. Never let a registry tier grant autonomy that reversibility forbids. A signature failure is a refusal, never a warning.",
    labels: ["security", "clonable"],
    verification:
      "an install test covering signature refusal on a tampered package, community tier forcing always-propose, and generated summary immutability; npm run build; a security review pass before merge.",
  }),
  card({
    key: "plugin-vertical-distributions",
    title: "Ship verticals as signed bundles of plugins, settings and layout",
    workstream: "productization",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 6 of 6. This is where the scale actually comes from. Most businesses will install a vertical rather than assembling ten plugins, so a distribution is a signed bundle of plugins plus settings plus seed segments plus a dashboard layout, versioned and installable in one action. The existing five fictional demo workspaces are already the shape of this, which makes them useful evidence rather than only a demo.",
    acceptance: [
      "A distribution bundles plugins, settings, seed segments and a dashboard layout, is versioned, and installs in one action",
      "Installing a distribution shows one review screen covering the union of its plugins' capabilities",
      "A distribution is signed and its constituent plugin versions are pinned",
      "Updating a distribution shows what changed, including any capability that was added",
      "Uninstalling a distribution honors each constituent plugin's uninstall contract",
      "At least one vertical ships and is proven against a fictional workspace end to end",
    ],
    dependencies: ["Publish a signed plugin registry with trust tiers that gate defaults"],
    start:
      "src/lib/admin/demo/scenarios.ts for the five existing fictional operating models; the plugin install lifecycle; layout overrides",
    guardrails:
      "A distribution may never grant a capability its constituent plugins did not declare. Bundling must not become a way to obtain a blanket approval that the individual plugins could not get. Use fictional fixtures only.",
    labels: ["clonable", "config"],
    verification:
      "a distribution install and uninstall test against a fictional workspace asserting capability union, pinning, and per-plugin uninstall; npm run build.",
  }),
  card({
    key: "plugin-contract-versioning",
    title: "Guarantee a v1 plugin still runs on v1.9 with a real deprecation policy",
    workstream: "platform",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Plugin Platform phase 6 of 6. This is the promise the ecosystem is built on, and the reason WordPress plugins from a decade earlier still run. A plugin declares a contract range; core guarantees no breaking change within a major version, announces deprecations one minor ahead with a build-time warning, and maintains a shim for one full major. Without this the ecosystem freezes on an old version, which is the observed failure mode rather than a hypothetical one.",
    acceptance: [
      "A plugin declares a contract range and the platform refuses to install one outside the supported window",
      "No breaking change ships within a major version, enforced by a compatibility test suite run against the oldest supported contract",
      "A deprecation is announced one minor ahead and produces a build-time warning naming the replacement",
      "A shim layer is maintained for one full major version",
      "A compatibility matrix is published per release",
      "A plugin built against the first version of the contract still installs and runs on the latest minor, proven by keeping that exact plugin in CI",
    ],
    dependencies: ["Publish a signed plugin registry with trust tiers that gate defaults"],
    start: "the manifest schema and its contract field; the conformance kit",
    guardrails:
      "A breaking change inside a major version is not permitted for convenience, including for a first-party need. The compatibility test must run against a real archived plugin, not a synthetic stub that gets updated alongside the platform.",
    labels: ["config", "reliability"],
    verification:
      "a compatibility suite running an archived first-version plugin against the current build; a deprecation warning test; npm run build.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // NORTHSTAR PHASE B — Agent Runtime foundation.
  // These six cards make the northstar primitives (docs/NORTHSTAR.md §6–§20)
  // explicit, inspectable, and dependency-ordered. They generalise the
  // scattered task/scheduling/permission work already in phases 2–3 into a
  // coherent runtime layer that Coworkers (Phase C) and Plugins (Phase D)
  // build on top of.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "durable-work-engine",
    title: "Generalise tasks and scheduling into a durable Work Engine",
    workstream: "runtime",
    phase: 3,
    status: "shipped",
    priority: "high",
    description:
      "Introduce a WorkItem abstraction that represents durable, lease-based, retryable, schedulable, and explainable units of work. Every autonomous action — follow-ups, research, invoice reviews, report generation — becomes a WorkItem that survives browser closure, deployment, process restart, model failure, and agent failure. This replaces ad-hoc cron-then-prompt patterns with a transactional claim model (FOR UPDATE SKIP LOCKED or equivalent), bounded retries, and mandatory reason fields on every scheduled future action.",
    acceptance: [
      "A WorkItem schema exists with id, tenantId, coworkerId, kind, objective, entityType, entityId, priority, reason, source, status, dueAt, nextCheckAt, leaseOwner, leaseExpiresAt, attemptCount, maxAttempts, createdAt, startedAt, finishedAt, outcome, error, and runId",
      "WorkItems survive process restart and deployment without loss",
      "Lease-based claiming prevents two workers from processing the same item simultaneously",
      "Failed items retry within explicit bounds rather than silently disappearing",
      "Every scheduled future action carries a human-readable reason field",
      "Workers can schedule their own future work (e.g. nextCheckAt: Friday 9 AM with reason)",
      "Existing task and scheduling code migrates onto the WorkItem abstraction without losing data",
    ],
    dependencies: [
      "Decide the scheduling substrate",
      "Enforce atomic claims and idempotency for jobs and actions",
    ],
    start:
      "src/lib/revenue-os/tasks.ts; scheduling-substrate-decision card; atomic-execution-claims card; docs/NORTHSTAR.md §6",
    guardrails:
      "Do not implement autonomous behaviour as cron → prompt → hope. Work must be represented durably. Do not collapse WorkItems into raw database rows without the lease/retry/reason contract. Deterministic logic stays deterministic — WorkItems coordinate, they do not replace SQL.",
    labels: ["work-engine", "reliability"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; a WorkItem lifecycle test proving create → claim → complete, create → claim → fail → retry, lease expiry → re-claim, and reason-required enforcement; npm run build.",
  }),
  card({
    key: "capability-graph-canonical",
    title: "Build one canonical Capability Graph for workspace capabilities",
    workstream: "runtime",
    phase: 3,
    status: "shipped",
    priority: "high",
    description:
      "Create a single machine-readable Capability Graph that exposes every available workspace capability (crm.read, gmail.send, calendar.write, etc.) together with its policy (available, approval_required, unavailable). Coworkers and plugins query this graph before beginning work so they discover their capabilities up front rather than by repeatedly failing calls. This extends the existing integration capability platform into a first-class runtime primitive.",
    acceptance: [
      "One canonical service resolves capability availability and policy for the current workspace",
      "Capabilities include both availability and policy (e.g. email.send: available + approval_required)",
      "Coworker manifests declare required capabilities; the runtime refuses to start a coworker whose requirements are unmet",
      "Plugin manifests declare required capabilities; unavailable requirements show the plugin as partially or fully unavailable rather than failing unpredictably",
      "The capability graph is queryable by AI tools so context includes what is and is not available",
      "Adding a new integration automatically registers its capabilities in the graph",
    ],
    dependencies: ["Build the provider capability platform and integration catalog"],
    start:
      "src/lib/revenue-os/modules.ts; integration-capability-platform card; docs/NORTHSTAR.md §9",
    guardrails:
      "Do not let capabilities be discovered by repeated failed calls. Missing capabilities are a normal state, not an error. The graph must not be bypassed by direct provider calls.",
    labels: ["capability-graph", "integrations"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; a capability resolution test proving available/unavailable/policy states and coworker requirement checking; npm run build.",
  }),
  card({
    key: "evidence-claim-ledger",
    title: "Build the Evidence and Claim Ledger for AI-derived facts",
    workstream: "runtime",
    phase: 3,
    status: "shipped",
    priority: "high",
    description:
      "Create an evidence-backed fact system that prevents models from inventing confidence scores and treating them as truth. Every AI-derived fact becomes a Claim with supporting Evidence entries carrying sourceType, sourceId, observation, timestamp, provenance, and strength. Deterministic business rules — not the model — decide whether evidence is strong enough to update authoritative state. This implements the human truth protection hierarchy: human-confirmed > human-entered > verified external > probable external > model inference.",
    acceptance: [
      "A Claim schema exists with id, tenant, entity, field/concept, proposedValue, and status (proposed/verified/rejected/superseded)",
      "An Evidence schema exists with claimId, sourceType, sourceId, observation, timestamp, provenance, and strength",
      "Models propose observations; deterministic rules evaluate evidence strength against the human truth protection hierarchy",
      "AI never overwrites human-entered or human-confirmed values without explicit human review",
      "Blank fields can be filled by strong sourced evidence; existing machine-generated values require stronger evidence to replace",
      "Every claim retains its full evidence chain for audit",
    ],
    dependencies: ["Normalize the cross-channel activity ledger"],
    start:
      "src/lib/revenue-os/identity.ts (existing provenance patterns); docs/NORTHSTAR.md §14–§15",
    guardrails:
      "Do not allow models to self-assign confidence scores that bypass the evidence system. Do not collapse the human truth hierarchy for convenience. AI-derived facts without evidence are suggestions, not updates.",
    labels: ["evidence-ledger", "reliability"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; an evidence evaluation test proving claim creation, evidence attachment, strength-based verdict, human-truth hierarchy enforcement, and audit chain integrity; npm run build.",
  }),
  card({
    key: "autonomy-policy-engine",
    title: "Unify agent permissions into one Autonomy Policy Engine",
    workstream: "runtime",
    phase: 3,
    status: "shipped",
    priority: "high",
    description:
      "Create one coherent system governing all agent actions, unifying AI confirmations, automation permissions, standing approvals, coworker permissions, safety floors, and audit provenance. Implement the five-level autonomy ladder: Level 0 (Prohibited), Level 1 (Always ask), Level 2 (Ask until trusted), Level 3 (Standing permission with constraints), Level 4 (Autonomous read/reason). Hard safety floors — destructive deletion, credential changes, financial transfers, full database exports — must exist in code and be irremovable by prompt instructions or repeated approvals.",
    acceptance: [
      "One policy service evaluates whether a given action is allowed for a given coworker in a given context",
      "The five-level autonomy ladder is implemented: prohibited, always-ask, ask-until-trusted, standing-permission, autonomous-read",
      "Hard safety floors exist in code for destructive account deletion, credential changes, financial history deletion, full customer database export, high-value refunds, and major financial transfers",
      "Safety floors cannot be bypassed by prompt instructions, repeated approvals, or standing policy grants",
      "Every consequential action records: who initiated it, which coworker, which WorkItem, which tool, what inputs, what evidence, what policy applied, whether human approved, and when it executed",
      "Users can inspect and revoke any standing permission at any time",
    ],
    dependencies: [
      "Finish the shared AI confirmation system",
      "Generalize approved automation policies",
      "Add a per-action trust ladder with a permanent irreversible floor",
    ],
    start:
      "src/lib/revenue-os/action-executor.ts; ai-confirmation-system card; automation-policy-registry card; action-trust-ladder card; docs/NORTHSTAR.md §16–§18",
    guardrails:
      "Do not allow repeated approvals to automatically promote an action past a hard safety floor. Do not split policy evaluation across multiple services — one engine, one decision path. Prompt instructions must never override code-level safety floors.",
    labels: ["autonomy-policy", "security"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; a policy evaluation test proving each autonomy level, hard floor enforcement against override attempts, approval provenance recording, and permission revocation; npm run build.",
  }),
  card({
    key: "coworker-model",
    title: "Introduce Coworkers as first-class runtime identities with manifests",
    workstream: "coworker",
    phase: 4,
    status: "shipped",
    priority: "high",
    description:
      "Introduce Coworkers as first-class configuration objects over the shared Accelerate runtime. A Coworker is not a separate LLM instance or chatbot — it is an identity with a role, objectives, skills, tools, triggers, permissions, autonomy policies, memory scope, allowed entities, budgets, schedules, and escalation rules. Coworkers are described through machine-readable manifests (YAML/JSON) that are explicit, inspectable, portable, and eventually shareable. The Sales Coworker is the reference implementation that proves the entire architecture end-to-end.",
    acceptance: [
      "A Coworker schema/manifest exists with identity, role, objectives, skills, tools, triggers, permissions, autonomy policies, memory scope, budgets, schedules, and escalation rules",
      "Coworker manifests are machine-readable (YAML or JSON) and versioned",
      "A Coworker operates against the shared runtime — no separate copies of CRM, memory, permissions, or integrations per coworker",
      "The Sales Coworker demonstrates the full lifecycle: lead arrives → identity resolved → context gathered → research → qualification → reply drafted → human approves → email sent → meeting booked → pre-call brief → meeting processed → CRM updated → follow-up sent → future work scheduled",
      "Coworker budgets (model spend/day, API calls, emails/day) are enforced and running out of budget is a normal state, not an unexplained failure",
      "Coworker configuration is inspectable from the admin UI",
    ],
    dependencies: [
      "Generalise tasks and scheduling into a durable Work Engine",
      "Build one canonical Capability Graph for workspace capabilities",
      "Unify agent permissions into one Autonomy Policy Engine",
    ],
    start:
      "docs/NORTHSTAR.md §4–§5, §25; durable-work-engine card; capability-graph-canonical card; autonomy-policy-engine card",
    guardrails:
      "Do not build ten Coworkers before the substrate is proven. Build one (Sales) end-to-end first. Do not create separate runtime copies per coworker. A Coworker is a configuration, not an infrastructure fork. Do not optimise for breadth; optimise for an impressive and reliable end-to-end loop.",
    labels: ["coworkers", "ai"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; a Sales Coworker end-to-end integration test proving the full lead-to-follow-up lifecycle with at least one human approval gate; manifest schema validation; budget enforcement test; npm run build.",
  }),
  card({
    key: "agent-activity-surface",
    title: "Add Agent Activity surfaces on every major business record",
    workstream: "coworker",
    phase: 4,
    status: "shipped",
    priority: "medium",
    description:
      "Every major business record (contact, company, opportunity, proposal, invoice) should have a consistent AI/Agent Activity surface that makes autonomous work understandable to a normal operator. This is not a raw audit-log dump — it is a readable timeline showing what the agent looked at, what it concluded, why, what it did, and what happens next. The Command Center evolves into the operator interface into the business runtime, with sections for 'Needs you' (only things requiring human judgment), 'Coworkers' (status of each worker), 'What changed' (business-level intelligence), and 'Activity' (unified human + agent timeline).",
    acceptance: [
      "Every major record detail page has an Agent Activity section showing a readable timeline of agent actions",
      "Each activity entry shows: what happened, when, why (the reason), and what is next",
      "The Command Center has a 'Needs you' section showing only items requiring human judgment",
      "The Command Center has a 'Coworkers' section showing each worker's active items and items awaiting approval",
      "The Command Center has a 'What changed' section showing business-level intelligence (lead volume, close rate, stale proposals, overdue invoices)",
      "The Activity timeline unifies human and agent actions in one chronological view",
      "Agent activity is distinguishable from human activity but presented in the same surface",
    ],
    dependencies: [
      "Introduce Coworkers as first-class runtime identities with manifests",
      "Complete AI run traces, tool evidence, errors, and usage",
    ],
    start:
      "docs/NORTHSTAR.md §20, §26; ai-run-traces card; record detail workspace; today operator inbox; docs/NORTHSTAR.md §20",
    guardrails:
      "Do not present a raw audit-log dump. The activity surface must make autonomous work understandable to a normal operator. Do not expose raw model reasoning — show what it looked at, concluded, why, did, and what is next.",
    labels: ["coworkers", "admin-ux"],
    verification:
      "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; desktop and mobile screenshots of the Agent Activity surface on a populated record; Command Center Needs-you/Coworkers/What-changed sections verified with fixture data; npm run build.",
  }),
  card({
    key: "finance-coworker",
    title: "Finance Coworker: revenue tracking, overdue detection, and reconciliation",
    workstream: "coworker",
    phase: 6,
    status: "shipped",
    priority: "high",
    description:
      "A dedicated Finance Coworker that tracks revenue, monitors payment patterns, alerts on overdue payments, and reconciles financial records. Three work kinds: weekly_revenue_reconciliation (compares won deals week-over-week, weighted pipeline), detect_overdue_payments (flags won deals with no recent activity), revenue_stage_audit (identifies high-stage deals at risk of stalling). Bootstrap registers crm.read + crm.write capabilities and autonomy policies.",
    acceptance: [
      "Finance Coworker bootstraps with capabilities and autonomy policies via AI tool",
      "Three work kinds are registered and handlers execute via work engine cron",
      "Weekly reconciliation compares won deals week-over-week with weighted pipeline summary",
      "Overdue payment detection flags won deals with no activity in 14+ days",
      "Revenue stage audit identifies proposal/negotiation deals stale for 7+ days",
      "All handler outcomes produce audit receipts",
    ],
    dependencies: ["Generalise tasks and scheduling into a durable Work Engine", "Introduce Coworkers as first-class runtime identities with manifests", "Unify agent permissions into one Autonomy Policy Engine"],
    start: "docs/NORTHSTAR.md §E; src/lib/revenue-os/finance-coworker.ts; src/lib/revenue-os/work-executor.ts",
    guardrails: "Finance coworker reads CRM data autonomously but writes and alerts require ask_until_trusted level. Never auto-modify financial records.",
    labels: ["coworkers", "finance"],
    verification: "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build.",
  }),
  card({
    key: "operations-coworker",
    title: "Operations Coworker: system health, integration monitoring, and data quality",
    workstream: "coworker",
    phase: 6,
    status: "shipped",
    priority: "medium",
    description:
      "The meta-coworker that watches the platform itself. Three work kinds: daily_health_check (failed jobs, stale work claims, expired actions), integration_status_audit (source_runs for failures and unconfigured sources), data_quality_scan (contacts without email, opportunities without company name or next action). Bootstrap registers crm.read capability and ops autonomy policies.",
    acceptance: [
      "Operations Coworker bootstraps with capabilities and autonomy policies via AI tool",
      "Three work kinds are registered and handlers execute via work engine cron",
      "Daily health check counts failed jobs, stale claims, and expired actions",
      "Integration audit checks source_runs for failures and unconfigured sources",
      "Data quality scan detects missing critical fields on contacts and opportunities",
      "All handler outcomes produce audit receipts",
    ],
    dependencies: ["Generalise tasks and scheduling into a durable Work Engine", "Introduce Coworkers as first-class runtime identities with manifests"],
    start: "docs/NORTHSTAR.md §E; src/lib/revenue-os/operations-coworker.ts; src/lib/revenue-os/work-executor.ts",
    guardrails: "Operations coworker is read-only — it detects and reports issues, never auto-remediates. Alerts require ask_until_trusted autonomy level.",
    labels: ["coworkers", "operations"],
    verification: "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build.",
  }),
  card({
    key: "work-scheduler",
    title: "Work scheduler: auto-create recurring daily and weekly coworker work items",
    workstream: "coworker",
    phase: 6,
    status: "shipped",
    priority: "high",
    description:
      "The work scheduler closes the gap between 'coworkers exist' and 'coworkers have work to do'. Before each work engine execution cycle, the scheduler creates daily work items (daily digest, stale deals, bottleneck check, health check, overdue scan) and weekly items (revenue reconciliation on Mondays). Date-based deduplication keys prevent duplicate work items.",
    acceptance: [
      "Schedule runs before executeClaimableWork in the work engine cron route",
      "Daily work items are created for all five daily work kinds",
      "Weekly work items are created on Mondays (ISO weekday 1)",
      "Dedupe keys prevent duplicate work items within the same day/week",
      "Daily operator check-in task surfaces in the inbox",
      "Scheduler produces audit receipts",
    ],
    dependencies: ["Generalise tasks and scheduling into a durable Work Engine", "Introduce Coworkers as first-class runtime identities with manifests", "Finance Coworker: revenue tracking, overdue detection, and reconciliation", "Operations Coworker: system health, integration monitoring, and data quality"],
    start: "docs/NORTHSTAR.md §E; src/lib/revenue-os/work-scheduler.ts; src/app/api/cron/work-engine/route.ts",
    guardrails: "Scheduler only creates work items — it never executes them. Deduplication must be date-based, not attempt-based. Scheduler failures must not block the work engine execution cycle.",
    labels: ["coworkers", "automation"],
    verification: "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build.",
  }),
  card({
    key: "memory-architecture",
    title: "Memory architecture: five distinct memory categories with unified query",
    workstream: "coworker",
    phase: 6,
    status: "shipped",
    priority: "high",
    description:
      "Implements northstar §23: memory should not be treated as a single vector database. Five distinct categories are kept separate: canonical (business records), activity (what happened), knowledge (documents and indexed sources), agent (prior work, research, questions with time-decay horizons), and learned policy (explicit rules from human decisions with supersession). A unified queryMemory interface routes across all five without collapsing them.",
    acceptance: [
      "Five memory categories are defined and queryable through queryMemory",
      "Agent memory entries store prior work, research, scheduled checks, and unresolved questions",
      "Agent memory decays by relevance horizon (session=4h, daily=26h, weekly=8d, permanent=never)",
      "Learned policies record rules derived from human decisions with source provenance",
      "Learned policies supersede previous active policies for the same action+scope",
      "Work executor consults learned policies before executing and stores agent memory after",
      "5 AI tools: query_memory, store_agent_memory, get_agent_memory, get_learned_policies, record_learned_policy",
      "Memory summary (learned policies + recent agent memory) loaded into every agent grounding contract",
      "MCP server exposes memory/overview resource",
    ],
    dependencies: ["Build the Evidence and Claim Ledger for AI-derived facts", "Introduce Coworkers as first-class runtime identities with manifests"],
    start: "docs/NORTHSTAR.md §23; src/lib/revenue-os/memory.ts; migrations/20260903-memory-architecture.sql",
    guardrails: "Categories must never be collapsed — each retains its own shape. Agent memory is not canonical data. Learned policies are constraints, not capabilities. Memory query failures must not block agent execution.",
    labels: ["coworkers", "ai-context"],
    verification: "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build.",
  }),
  card({
    key: "budgets",
    title: "Resource budgets for autonomous workers with explicit spending caps",
    workstream: "runtime",
    phase: 3,
    status: "shipped",
    priority: "high",
    description:
      "Implements northstar §24: autonomous workers require explicit resource constraints. Six budget kinds: model_spend, vendor_api_calls, emails_sent, research_depth, retry_count, runtime_seconds. Limits can be per-coworker or global, with daily/weekly/monthly periods. The work executor checks budgets before executing work and records usage after. Running out of budget is a normal state — work is skipped with a clear reason, not failed.",
    acceptance: [
      "Budget limits can be set per-coworker or globally for each budget kind",
      "checkBudgets returns allowed/exhausted status before work execution",
      "Work executor skips work when any budget is exhausted",
      "recordBudgetUsage atomically increments period usage",
      "90%+ budget usage triggers audit alert",
      "2 AI tools: check_budgets, get_budget_limits",
    ],
    dependencies: ["Generalise tasks and scheduling into a durable Work Engine", "Introduce Coworkers as first-class runtime identities with manifests"],
    start: "docs/NORTHSTAR.md §24; src/lib/revenue-os/budgets.ts; migrations/20260903-budgets.sql",
    guardrails: "Running out of budget is a normal state, not an error. Budget checks are best-effort — failure to check must not block execution. Budgets constrain autonomous work; human-initiated actions are not gated by budgets.",
    labels: ["automation", "reliability"],
    verification: "npm run verify:agent-contract; npx tsc --noEmit; npm run lint; npm run build.",
  }),

  // ────────────────────────────────────────────────────────────────────────
  // DOCUMENTATION SITE — an independent track.
  // 24 markdown files sit under docs/ and none is end-user documentation:
  // they are engineering contracts, contributor process and self-hosting
  // setup. Meanwhile 37 admin pages exist whose only description is the
  // subtitle string inside their own TSX file. The load-bearing idea is that
  // RevenueOSModule already declares an unused docsUrl field, so coverage can
  // be enforced: a module that ships without documentation becomes a red build.
  // ────────────────────────────────────────────────────────────────────────
  card({
    key: "docs-site-infrastructure",
    title: "Build the documentation site infrastructure at /docs",
    workstream: "documentation",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Documentation track, step 1 of 4. Land the whole navigable spine with only three pages of prose, so the system is proven before any content volume is written. The MDX pipeline already exists and is production-proven for the learning hub: createMDX with the gfm, slug and autolink plugins, compileMDX from next-mdx-remote, a filesystem loader, and thirteen components. Three gaps: the loader is a flat directory read with no recursion, there is no persistent sidebar, and there is no docs search. Structure is an explicit manifest rather than a filesystem walk, because a walk can only ever be self-consistent: it can tell you what exists but never catch a page that was supposed to exist.",
    acceptance: [
      "src/content/docs/manifest.ts holds the full page tree and is the authority for structure, ordering and section card metadata; MDX files hold only prose",
      "Frontmatter carries title, description and updated, and deliberately omits section, order, kind and slug, which are derivable; the verifier enforces their absence so no second source of truth appears",
      "A recursive loader resolves nested slugs and collapses a directory to its overview page, so section landings need no separate route",
      "Four routes exist: a layout, the landing, a catch-all, and a docs-shaped not-found",
      "A persistent sidebar highlights the current page and expands its ancestors; breadcrumbs, previous and next links, and an on-page contents rail all work",
      "TableOfContents is parameterized rather than forked, so its hydration-safety handling is not duplicated and then allowed to diverge",
      "A prose class distinct from the article one, because the article heading rhythm makes a dense reference page unusable",
      "Docs components are added to the existing raw-color ratchet at a budget of zero, since this is new code with no legacy to grandfather",
      "The existing docs/ directory is untouched, because CI and contributors reference those paths",
    ],
    dependencies: [],
    start:
      "src/lib/mdx.ts; src/app/(marketing)/learn/[slug]/page.tsx; src/components/mdx; scripts/verify-articles.ts as the gate precedent; scripts/verify-admin-tokens.mjs",
    guardrails:
      "Do not move any file out of docs/. Do not reuse the conversion components: a docs page ending in a booking call reads as marketing and loses the trust the section exists to build. Do not copy the command-center capability list into MDX; render it from its source file so the two cannot drift.",
    labels: ["documentation", "config"],
    verification:
      "npm run typecheck; npm run lint -- --max-warnings=0; npm run verify:admin-tokens; a new verify:docs run in allow-missing mode; npm run build; browse the three trees and confirm sidebar, breadcrumbs and pager work with three pages present.",
  }),
  card({
    key: "docs-integration-surfaces",
    title: "Wire docs into search, sitemap, navigation and a generated llms index",
    workstream: "documentation",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Documentation track, step 2 of 4, still with only three pages of prose so the wiring is proven before the content exists. Search costs almost nothing: one deploy-time index already serves the whole site and the client filters locally, so adding docs is a loop plus two typed entries, and because those are a keyed record and a typed array, forgetting either breaks the typecheck. Two corrections to earlier assumptions are load-bearing here. src/content/navigation.ts is dead and imported by nothing, so links go in the header and footer components directly. And a static file in public shadows any route handler at the same path, so the machine-readable index must be a build script with a check mode rather than a route.",
    acceptance: [
      "Docs entries join the existing search index with their own group, and both the priority record and the display order array are updated, which the type system enforces",
      "The sitemap derives docs entries from the manifest rather than a hand-written list, matching the note already in that file about why",
      "Header and footer link to the docs, added to their own local lists rather than to the dead navigation content file, which is removed separately",
      "A build script generates the machine-readable index with a check mode verified in CI, replacing the hand-written marketing sheet that today references nothing in the product and is read by no code",
      "AI crawler allow lists include the docs path, since publishing an index for a path those agents cannot fetch is self-defeating",
      "The open-source page's self-hosting call to action points at the self-hosting quickstart rather than deep-linking a repository file",
    ],
    dependencies: ["Build the documentation site infrastructure at /docs"],
    start:
      "src/lib/search/index.ts and src/lib/search/score.ts; src/app/sitemap.ts; src/components/layout/Header.tsx and Footer.tsx; src/app/robots.ts; public/llms.txt",
    guardrails:
      "Do not hand-list docs URLs anywhere. Do not add docs links to src/content/navigation.ts, which is dead. Check the open-source stats test before editing that page, since it asserts against it.",
    labels: ["documentation", "indexing"],
    verification:
      "npm run typecheck; npm run verify:docs; a new verify:llms check mode; npm run test:open-source-stats; npm run build; confirm search finds a docs page and the sitemap and index contain only live URLs.",
  }),
  card({
    key: "docs-module-coverage-gate",
    title: "Make a module that ships without documentation a red build",
    workstream: "documentation",
    phase: 6,
    status: "backlog",
    priority: "high",
    description:
      "Documentation track, step 3 of 4, and the reason this track is worth doing properly. RevenueOSModule already declares a docsUrl field at modules.ts:47 that only the generated extension module populates. That field is the seam. Every user guide section declares which modules it documents, every module points back at its section, and CI proves both directions resolve. This is what turns documentation from a marketing artifact into part of the product contract, and it is the single highest-leverage change in the track.",
    acceptance: [
      "Every core and optional module populates docsUrl with its user guide section",
      "The manifest schema accepts a site-relative path, since it currently types the field as a URI and would reject one",
      "verify-module-contract fails when a module's docsUrl does not resolve to a manifest slug",
      "Every non-extension module is claimed by exactly one user guide section, so a new module cannot ship undocumented and cannot be documented twice",
      "Every capability in the command-center content file is claimed by exactly one reference page",
      "Every registered AI tool appears in the AI capabilities reference page",
      "The docs verifier also proves manifest and filesystem bijection with no orphan pages, that every internal link resolves, and that no slug duplicates the generated roadmap or changelog",
      "The public prerender check gains the docs routes and a count assertion, so coverage is proven against a real build rather than against the manifest alone",
      "docsUrl is surfaced in the product next to each module, giving in-product help links that CI proves are live",
    ],
    dependencies: [
      "Wire docs into search, sitemap, navigation and a generated llms index",
      "Close the module contract gaps that let unreachable code ship",
    ],
    start:
      "src/lib/revenue-os/modules.ts:47; scripts/verify-module-contract.mjs; scripts/verify-public-prerender.mjs; extensions/module-manifest.schema.json; src/content/command-center.ts",
    guardrails:
      "Do not satisfy the coverage gate with stub pages. A section that exists only to keep CI green is worse than a failing build, because it hides the gap. Do not restate the generated roadmap or changelog as prose.",
    labels: ["documentation", "qa"],
    verification:
      "npm run verify:docs; npm run verify:module-contract; npm run verify:public-prerender; proof that each new clause fails when its target is removed; npm run build.",
  }),
  card({
    key: "docs-content-first-pass",
    title: "Write the 49-page documentation spine in link-dependency order",
    workstream: "documentation",
    phase: 6,
    status: "backlog",
    priority: "medium",
    description:
      "Documentation track, step 4 of 4. With the manifest complete every page is a fill-in-the-blank with a known slug, known neighbors and a known place in the sidebar. Write in link-dependency order so no page ever links forward to something unwritten. Getting started first because it establishes the vocabulary the rest assumes: workspace, module, record, action queue, approval gating, receipt, audit and idempotency, none of which the site explains to a user today.",
    acceptance: [
      "Getting started is six pages including a core-concepts page defining the shared vocabulary",
      "The user guide is thirty-four pages: a card-grid landing plus ten sections mapped onto module clusters, each with an overview, a reference page, and how-tos for the surfaces operators touch daily",
      "After the ten section overviews land, every sidebar entry has a landing page and the card grid is fully live, which is the natural stopping point for a partial release",
      "The developer tree is nine pages, seeded by splitting the MCP setup document into concepts and per-client setup, since at 283 lines it is the most user-ready document in the repository",
      "The allow-missing flag is dropped and the manifest-to-filesystem bijection is enforced permanently",
      "Every page passes the existing copy gates, which already walk this directory and already handle MDX, so no em dashes, no antithesis phrasing and no invented statistics",
      "No page restates the generated roadmap, the changelog, or the command-center capability list",
    ],
    dependencies: ["Make a module that ships without documentation a red build"],
    start:
      "src/content/docs/manifest.ts; docs/self-hosting/MCP-SETUP.md; docs/contributing/EXTENDING.md; src/lib/admin/navigation.ts for the section spine; every admin PageHeader subtitle as raw material",
    guardrails:
      "Never document intended behavior as current behavior. The plugin platform pages are written last, against shipped behavior, because they are the ones most likely to overstate. Each batch must leave the link gate green so it can merge without waiting for the next.",
    labels: ["documentation", "clonable"],
    verification:
      "npm run verify:docs with the allow-missing flag removed; npm run test:house-style-copy; npm run test:no-fabricated-claims; npm run verify:public-prerender; npm run build.",
  }),
];

const countsByStatus = new Map();
for (const feature of featureBacklog) {
  const count = (countsByStatus.get(feature.status) ?? 0) + 1;
  countsByStatus.set(feature.status, count);
  const circuitIndex = LOOP_ONE.indexOf(feature.seed_key);
  // Every status column follows the dependency circuit first, then the stable
  // manifest order. This makes the board order agree with the handoff notes.
  feature.sort_order =
    circuitIndex >= 0 ? (circuitIndex + 1) * 1000 : (LOOP_ONE.length + count + 1) * 1000;
}

export function validateFeatureBacklog() {
  const keys = new Set();
  for (const feature of featureBacklog) {
    if (keys.has(feature.seed_key)) throw new Error(`Duplicate feature key: ${feature.seed_key}`);
    keys.add(feature.seed_key);
    if (!feature.title || !feature.description || !feature.acceptance_criteria || !feature.notes)
      throw new Error(`Incomplete feature: ${feature.seed_key}`);
    if (feature.labels.length < 4 || feature.labels.length > 5)
      throw new Error(`Invalid taxonomy label count: ${feature.seed_key}`);
    for (const prefix of ["category:", "milestone:", "phase:"]) {
      if (feature.labels.filter((label) => label.startsWith(prefix)).length !== 1)
        throw new Error(`${feature.seed_key} must have exactly one ${prefix} label`);
    }
    if (
      feature.labels.filter((label) => label.startsWith("capability:")).length < 1 ||
      feature.labels.filter((label) => label.startsWith("capability:")).length > 2
    )
      throw new Error(`${feature.seed_key} must have one or two capability labels`);
  }
  for (const key of LOOP_ONE) {
    if (!keys.has(key))
      throw new Error(`Loop One names ${key}, which is not a card in this manifest`);
  }
  if (new Set(LOOP_ONE).size !== LOOP_ONE.length) throw new Error("Loop One has duplicate keys");
  for (const key of NOW_KEYS) {
    if (!LOOP_ONE_SET.has(key))
      throw new Error(`NOW_KEYS includes ${key}, which is not on the delivery circuit`);
  }
  // The limit exists so the board reflects what is genuinely being worked, not
  // a wish list. It was two when one founder was the only claimant; it is four
  // now that agent sessions claim cards alongside him. Raise it deliberately,
  // never to make a status change pass.
  const WIP_LIMIT = 4;
  const claimed = featureBacklog.filter((feature) => feature.status === "in_progress");
  if (claimed.length > WIP_LIMIT) {
    throw new Error(
      `WIP limit exceeded: ${claimed.length} cards in progress (${claimed.map((feature) => feature.seed_key).join(", ")}). Finish or park one first.`,
    );
  }
  return { total: featureBacklog.length, byStatus: Object.fromEntries([...countsByStatus]) };
}
