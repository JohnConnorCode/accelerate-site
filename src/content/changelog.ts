import type { ChangelogEntry } from "@/lib/types";

export const changelogEntries: ChangelogEntry[] = [
  {
    id: "operational-read-and-eligibility-repairs",
    slug: "operational-read-and-eligibility-repairs",
    title: "Restore Intake review, email evidence and meeting scheduling",
    description:
      "Intake review reads canonical action fields and the existing coworker task bridge, avoids duplicate bridge entries, opens exact approvals and reports failed reads. Email history uses recorded send times and provider IDs, warns when incomplete and fails clearly when both sources are unavailable. Approved email checks canonical contact eligibility; automated first replies recognize existing clients and decline when eligibility or send limits cannot be verified. Meeting briefs use the actual calendar start time, skip cancelled meetings and report repeated work as skipped.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "google-sync-optional-drive",
    slug: "google-sync-optional-drive",
    title: "Sync Gmail and Calendar before selecting Drive folders",
    description:
      "Workspace sync now reads Gmail and Calendar when no Drive folders are selected, records Drive as not configured and performs no Drive file requests. Drive-only sync still requires selected folders. Setup distinguishes an already-running sync from completed work. The Google readiness check follows the current bounded folder validation and allowlist rules.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "coworker-setup-and-evidence",
    slug: "coworker-setup-and-evidence",
    title: "Configure coworkers without resetting saved settings",
    description:
      "Coworker setup preserves saved settings, connected accounts and existing permissions, creates the coworker before its scoped policies, and reports policy failures. It repairs untouched native CRM placeholders left by older setup. Worker reports use canonical contact, opportunity and execution fields, and fail clearly when business evidence cannot be read. Meeting work keeps unresolved CRM changes waiting for review. Today refreshes recent workspace activity, Today and booking reads load consistently after a restart, and AI run details fit the mobile screen.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "demo-ai-recorded-traces",
    slug: "demo-ai-recorded-traces",
    title: "Inspect demo answers without invented evidence",
    description:
      "Demo Run history opens answers that used no tools and preserves recorded tool successes, failures and prepared proposals across reloads. Unknown token usage displays as not recorded. Older saved runs disclose missing trace evidence. The inspector no longer invents a completed tool call or links an unrelated opportunity.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "operational-health-unresolved-outcomes",
    slug: "operational-health-unresolved-outcomes",
    title: "Keep uncertain outcomes visible in operational health",
    description:
      "Setup and Today flag uncertain outbound message outcomes for receipt review, alongside failed and processing messages. Open work counts include claimed and in-progress items, so work does not disappear from the count while a worker handles it. Check the provider receipt before retrying an uncertain action.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "agent-first-setup-and-extensions",
    slug: "agent-first-setup-and-extensions",
    title: "Start and extend your workspace with a coding agent",
    description:
      "Setup and extension guides now start with a business brief for Claude Code or Codex. The agent handles configuration, source changes, registration and checks while the owner reviews the working workflow. Examples explain how shared customer records and services reduce repeated setup and status chasing, with proposed Apps kept distinct from available features. Copy controls fit mobile and show pending requests, successful copies and manual-copy recovery. Claude's entrypoint keeps generic continuation requests on the current task and reserves backlog pickup for explicit requests.",
    category: "improvement",
    publishedAt: "2026-10-07",
  },
  {
    id: "contributor-approved-source-recovery",
    slug: "contributor-approved-source-recovery",
    title: "Clearer recovery when contributor pickup cannot use its approved source",
    description:
      "Contributor pickup now names the blocked card and distinguishes a missing commit, unavailable branch, commit outside the approved branch history and failed fetch. Each message gives the relevant recovery step before ownership is claimed. Existing source, repository identity checks and revision-checked assignment remain in place. This source change still requires review and release before hosted activation.",
    category: "fix",
    publishedAt: "2026-10-06",
  },
  {
    id: "contributor-repository-readiness",
    slug: "contributor-repository-readiness",
    title: "Clearer recovery when contributor pickup cannot use a repository",
    description:
      "Contributor pickup identifies the affected card and explains whether its repository address needs a maintainer edit or the checkout needs to use the approved clone. Standard SSH addresses with explicit port 22 match their default-port aliases, while custom ports remain distinct. Unsafe addresses stay unclaimed, credentials stay hidden, and the approved branch, source commit and work history stay intact.",
    category: "fix",
    publishedAt: "2026-10-06",
  },
  {
    id: "command-destination-focus",
    slug: "command-destination-focus",
    title: "Keep typing when a command opens setup",
    description:
      "Opening a page from Search preserves focus when you start entering a field. Closing dialogs and delayed page content respect the control you are using, while ordinary dismissal still returns to the previous control. Invoice setup keeps the Stripe key field ready for keyboard input on desktop and mobile, including reduced motion.",
    category: "fix",
    publishedAt: "2026-10-09",
  },
  {
    id: "ai-reading-continuity",
    slug: "ai-reading-continuity",
    title: "Read AI answers at your own pace",
    description:
      "Ask AI keeps your place when you scroll up during a response. Jump to latest resumes following new text, and another question or a conversation change returns to the latest message. The composer grows for multiline questions and waits for input-method composition to finish before Enter can send. Starting guidance now explains what to ask without repeating the evidence and approval summary.",
    category: "fix",
    publishedAt: "2026-10-08",
  },
  {
    id: "mobile-navigation-handoffs",
    slug: "mobile-navigation-handoffs",
    title: "Keep phone navigation and tool handoffs steady",
    description:
      "More keeps scrolling and background controls paused until its menu finishes closing. Search, Ask AI and the search shortcut wait for that removal before opening their panel. Dismissal returns focus to More, while navigation focuses the destination heading once the workspace is available. Reduced motion opens and closes the menu immediately.",
    category: "fix",
    publishedAt: "2026-10-08",
  },
  {
    id: "notification-close-continuity",
    slug: "notification-close-continuity",
    title: "Close notifications without losing your place",
    description:
      "The phone dock stays paused until the notification sheet finishes closing. Dismissal returns focus to the bell after the panel leaves, while notification links keep focus with their destination. Desktop and phone panels skip animation under reduced motion.",
    category: "fix",
    publishedAt: "2026-10-07",
  },
  {
    id: "dialog-exit-continuity",
    slug: "dialog-exit-continuity",
    title: "Keep the workspace steady while dialogs close",
    description:
      "The phone navigation dock and embedded previews stay hidden while a dialog fades out, and sidebar controls remain paused until the last dialog leaves the screen. Closing a nested confirmation keeps the editor's hold in place. Reduced motion releases the workspace as soon as the dialog is removed.",
    category: "fix",
    publishedAt: "2026-10-07",
  },
  {
    id: "nested-dialog-layering",
    slug: "nested-dialog-layering",
    title: "Keep nested confirmations in focus",
    description:
      "A confirmation now dims and blocks the editor beneath it. Each dialog keeps its panel and backdrop together through entry and exit, so closing a confirmation reveals the retained draft with the same soft transition or immediate reduced-motion response.",
    category: "fix",
    publishedAt: "2026-10-07",
  },
  {
    id: "dialog-decision-polish",
    slug: "dialog-decision-polish",
    title: "Make the confirmation choice clear",
    description:
      "Delete, discard and archive confirmations use the shared danger appearance while the safer cancel choice receives initial keyboard focus. Keep editing returns to an unsaved card draft, and the action row wraps on small screens. Dialogs and backdrops open and close immediately under reduced motion, including nested confirmations, while normal motion keeps the existing soft transitions. Closing preserves focus already moved to another page control.",
    category: "improvement",
    publishedAt: "2026-10-07",
  },
  {
    id: "action-feedback-polish",
    slug: "action-feedback-polish",
    title: "Read action feedback at your own pace",
    description:
      "Brief confirmations and warnings pause while you hover over them or focus their dismiss control, then resume with their remaining reading time. Larger dismiss targets and visible keyboard focus make messages easier to clear. Stacked messages settle smoothly when one disappears; reduced motion shows and clears feedback without animation.",
    category: "improvement",
    publishedAt: "2026-10-07",
  },
  {
    id: "page-help-interaction-polish",
    slug: "page-help-interaction-polish",
    title: "Read page guidance without losing your place",
    description:
      "How this works opens a compact panel with workflow steps, saved results and clearly separated guide actions. Open and close transitions reverse when you change your mind; reduced motion skips them. Keyboard focus enters the panel, while Close help and Escape return to the page controls. Guide links keep their position on hover and provide larger touch targets. Today and Contacts starting instructions now name the specific first action.",
    category: "improvement",
    publishedAt: "2026-10-07",
  },
  {
    id: "owner-business-workspace",
    slug: "owner-business-workspace",
    title: "Find the business question and follow it into work",
    description:
      "Nine sidebar groups explain where to manage the business. Core page headers show a starting instruction, with expanded steps and saved-result context. Today begins with sourced findings across sales, customer follow-up, delivery and money, links each finding to its record and prepares contextual AI questions. Connected walkthroughs teach answering an inquiry, starting client work and following an invoice through its recorded result. Existing custom views, permissions and business records remain intact.",
    category: "improvement",
    publishedAt: "2026-10-06",
  },
  {
    id: "task-inspector-context-recovery",
    slug: "task-inspector-context-recovery",
    title: "Keep task details attached to the right work",
    description:
      "Task links reopen the same inspector after reload, load independently and offer retry on read failures. Switching links cannot reuse another task’s fields or let a late save close the next task. Edit instructions beside title, date and priority, and open the related client, contact or opportunity. Pending changes lock the form and close control, failed edits retain the draft, and completed tasks remain available for reference. Legacy Today links use stored record identifiers.",
    category: "fix",
    publishedAt: "2026-10-06",
  },
  {
    id: "client-workspace-recovery",
    slug: "client-workspace-recovery",
    title: "Keep client records, activity and follow-ups connected",
    description:
      "Client records, activity and follow-ups load independently and offer scoped retries. Failed refreshes retain loaded information and unsaved edits. Follow-ups sit beside activity and refresh Work and Today after creation. Pending submissions hold the draft fixed, failed submissions retain edits, and client values accept cents with nonnegative form validation.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "website-editor-operation-recovery",
    slug: "website-editor-operation-recovery",
    title: "Keep website edits safe during saves, reloads and imports",
    description:
      "Website editing pauses while a save, reload or import finishes, so competing actions cannot overwrite local work. Failed reloads retain your edits and undo history, and initial loading failures offer a direct retry. Incomplete or mismatched confirmations keep the exact pending change for retry. Leaving the editor stops pending requests and ignores late responses. Editing, Undo and Redo clear outdated success messages.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "private-draft-responsive-preview",
    slug: "private-draft-responsive-preview",
    title: "Check private drafts in real responsive viewports",
    description:
      "Preview saved private drafts at 390, 768 and 1440 pixels. Each size gives the page its own viewport, so responsive layouts and typography match the selected width even on a small admin screen. The preview uses public page styling, keeps links and forms inactive, and lets you open FAQ answers without leaving the editor.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "private-page-draft-demo",
    slug: "private-page-draft-demo",
    title: "Try private page drafts in the demo",
    description:
      "Create, preview, rename and discard private page drafts in each fictional business. Saved titles survive reloads, businesses keep separate copies, and confirmed changes appear as simulated activity. AI example mode uses the service template without a provider call. Drafts remain in browser-session storage until discarded or the business is reset. Preview centering preserves the gap before rename controls.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "private-page-draft-recovery",
    slug: "private-page-draft-recovery",
    title: "Recover private page drafts without losing your title",
    description:
      "Failed refreshes retain your preview and typed title. Load the latest copy after a stale or uncertain save or discard, review it, then retry. Creation keeps its brief fixed while pending, supports Enter submission, and requires a successful list refresh after an unclear result. Late replies cannot move you away from another page, and Keep draft cancels a discard choice. The optional image catalogue opens on demand and shows the eight-image selection limit.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "website-ai-review-recovery",
    slug: "website-ai-review-recovery",
    title: "Preview and recover AI website edits",
    description:
      "Review proposed pages at phone, tablet and desktop widths before applying them. Cancel a pending suggestion without changing your draft, and prepare a fresh suggestion when newer edits need protection. AI review stays with its page, custom addresses survive title changes, and visible section limits keep pages valid and saveable.",
    category: "fix",
    publishedAt: "2026-10-05",
  },
  {
    id: "homepage-dimensional-identity",
    slug: "homepage-dimensional-identity",
    title: "A new visual direction for the homepage",
    description:
      "Accelerate's three chevrons now form a dimensional studio composition beside the headline. A slow rotation and separation of the forms change their metallic reflections. A visible Pause/Play control works on desktop and mobile. The page retains readable copy, booking, history restoration and static fallbacks for reduced motion, unavailable JavaScript or graphics failure.",
    category: "improvement",
    publishedAt: "2026-10-02",
  },
  {
    id: "public-page-loading",
    slug: "public-page-loading",
    title: "Lighter public pages with publication-aware caching",
    description:
      "Public pages share a cached published website read, while publishing, rollback and unpublishing refresh that cache through the shared writer. Draft saves stay private. Search and chat load when opened, workspace styling loads with the workspace, and the homepage's lower screenshot gallery no longer competes with the first screen for image loading. Keyboard focus remains available when the delayed dialogs open.",
    category: "improvement",
    publishedAt: "2026-10-02",
  },
  {
    id: "homepage-sculptural-motion",
    slug: "homepage-sculptural-motion",
    title: "A more expressive, responsive homepage",
    description:
      "Three sculptural ink sheets sweep into the homepage and keep moving on distinct rhythms, including on phones. Pointer movement shifts opposing artwork depths and reveals a local contour response. Touch expands that response and blends repeated interactions. Late JavaScript resumes the artwork after the loading safeguard without hiding the text again. The headline stays readable and steady, with the existing full-height mobile layout, booking action, cached navigation and reduced-motion fallbacks.",
    category: "improvement",
    publishedAt: "2026-10-02",
  },
  {
    id: "homepage-composited-artwork",
    slug: "homepage-composited-artwork",
    title: "Smoother homepage artwork and interaction",
    description:
      "The homepage uses a quieter layered composition with fewer contour lines. Background movement and local pointer lighting now move prepared layers, avoiding continuously redrawn strokes and moving SVG masks. Touch uses one soft response that blends between taps. The full-height mobile layout, readable headline, booking action, cached navigation and reduced-motion fallbacks remain available.",
    category: "fix",
    publishedAt: "2026-10-02",
  },
  {
    id: "demo-navigation-continuity",
    slug: "demo-navigation-continuity",
    title: "Move through the demo without restarting the workspace",
    description:
      "The full Command Center demo keeps its current workspace as you move between pages, including invoices and module setup. Public guides and demo links in connected private workspaces continue to open the public site.",
    category: "fix",
    publishedAt: "2026-10-01",
  },
  {
    id: "homepage-hero-line-choreography",
    slug: "homepage-hero-line-choreography",
    title: "A calmer, coordinated homepage entrance",
    description:
      "The homepage reveals its headline in readable lines, with gentler pacing for the supporting copy and booking action. The artwork moves more slowly, pointer movement has a smaller range, and touch illumination fades softly. Repeated touches blend into the existing glow, and clicking keeps pointer lighting steady. Fresh and cached visits retain the complete entrance; history restoration, keyboard access and reduced motion keep the page usable.",
    category: "fix",
    publishedAt: "2026-10-01",
  },
  {
    id: "invoice-navigation",
    slug: "invoice-navigation",
    title: "Find invoices and start a new one directly",
    description:
      "Enabled invoicing now has a top-level Invoices destination in the desktop sidebar and mobile Menu. Create invoice opens the customer and line-item form without the account history above it. Workspace search finds invoice creation, or setup instructions when invoicing is off. Disconnected accounts show the connection step before creation; draft and sending approvals keep their existing review.",
    category: "fix",
    publishedAt: "2026-10-01",
  },
  {
    id: "homepage-hero-readable-typography",
    slug: "homepage-hero-readable-typography",
    title: "A balanced homepage with living ribbon artwork",
    description:
      "The branded homepage presents its complete headline in one consistent typeface, size and weight. Balanced wrapping and more comfortable line spacing replace the oversized outcome words, small connectors, italic nouns and decorative underlines. Three broader ribbons move independently on desktop and phones, with pointer and touch illumination. The artwork pauses offscreen and behind the mobile menu; reduced motion and unavailable JavaScript keep it static. The full-height section and masked word entrance remain. This correction is included in this source release; production publication is separate.",
    category: "fix",
    publishedAt: "2026-10-01",
  },
  {
    id: "mobile-hero-and-cached-motion",
    slug: "mobile-hero-and-cached-motion",
    title: "A full-height mobile homepage and reliable cached entrances",
    description:
      "The branded homepage fills the mobile viewport with a larger headline, layered acceleration ribbons and a faster staged entrance. Touches briefly move and illuminate the field. Public entrances share one scroll clock, re-arm on fresh cached visits and keep restored history readable. Touch scrolling avoids large blur effects and background media parallax. Reduced motion and unavailable JavaScript retain complete static content. These changes are included in this source release; production publication is separate.",
    category: "fix",
    publishedAt: "2026-10-01",
  },
  {
    id: "homepage-hero-entrance",
    slug: "homepage-hero-entrance",
    title: "A complete homepage entrance",
    description:
      "The homepage headline now reveals from concealed word masks in a deliberate sequence, with traced contours, drawn emphasis lines and a staged explanation and booking action. Keyboard focus exposes the booking action immediately. Reduced motion, unavailable JavaScript and failed hydration show the complete static page.",
    category: "fix",
    publishedAt: "2026-10-01",
  },
  {
    id: "conversational-command-center",
    slug: "conversational-command-center",
    title: "Review and delegate work in conversation",
    description:
      "Ask AI can show exact proposals and accept your decision inside chat. Authenticated members can preview ordered jobs, retrieve saved progress and pause, resume or cancel future steps through the shared AI and MCP tools. Bounded internal permission names records, fields, expiry and a daily limit; consequential actions keep human review. The public demo has clearer task examples and a separately configured real inference service with a shared $5 daily cap. All demo business effects remain simulated. This source change requires its migration and configuration before hosted activation; merge and deployment are separate.",
    category: "improvement",
    publishedAt: "2026-09-30",
  },
  {
    id: "editorial-home-workspace-polish",
    slug: "editorial-home-workspace-polish",
    title: "A clearer homepage and calmer daily workspace",
    description:
      "Selected work now leads the bundled homepage, with one featured case and three supporting projects. Services, process and the sample plan have distinct layouts, and the floating booking bar steps aside when a booking action is visible. The workspace keeps Search and Ask AI in persistent desktop chrome, groups Today view tools under More, and applies shared theme controls to Feature Board filters. The hero combines layered contour depth, differently paced currents, pointer and keyboard illumination, and short touch ripples. Motion pauses offscreen and in hidden tabs; reduced-motion visitors see the complete static composition. Paper gains editorial headings, compact empty states reduce unused space, and saved views, custom appearances and published website arrangements keep their existing behavior.",
    category: "improvement",
    publishedAt: "2026-09-30",
  },
  {
    id: "approved-workspace-configuration",
    slug: "approved-workspace-configuration",
    title: "Review workspace configuration with AI",
    description:
      "Ask AI and authorized MCP clients can prepare exact provider disconnects, Drive folder selections, named public preferences and bounded Google checks or syncs for human approval. The shared review shows current and proposed values. Stale approvals refuse, partial sync results retain their receipts, and secure human controls handle secrets and OAuth. Installation owner email stays server-only. All five business demos use the shared approval workflow with fictional data.",
    category: "improvement",
    publishedAt: "2026-09-29",
  },
  {
    id: "revenue-contract-read-correctness",
    slug: "revenue-contract-read-correctness",
    title: "Revenue figures agree with active client contracts",
    description:
      "Revenue now groups current active contracts by start month in UTC, so its final chart value agrees with the active monthly total and client breakdown. Missing dates stay visible, Churned Share explains its current-record basis, and accepted proposal values remain separate. Failed or incomplete reads show Retry; a failed refresh labels the previously loaded figures. The fictional demo uses the same contract calculations.",
    category: "fix",
    publishedAt: "2026-09-29",
  },
  {
    id: "leads-canonical-write-recovery",
    slug: "leads-canonical-write-recovery",
    title: "Inquiry updates keep their follow-up and recovery together",
    description:
      "Individual and bulk Leads status changes now follow the same Pipeline rules. Repeated Contacted updates reuse the existing follow-up, and Won recovery preserves the linked client engagement. Manual capture keeps the original inquiry when setup is incomplete. The form offers Retry setup or Retry save, while incomplete updates show named recovery details and retain their bulk selection. These changes are available in this source release; installation and production deployment remain separate.",
    category: "improvement",
    publishedAt: "2026-09-29",
  },
  {
    id: "canonical-gmail-followup-target",
    slug: "canonical-gmail-followup-target",
    title: "Gmail follow-up drafts use the saved contact address",
    description:
      "Assistant-prepared Gmail drafts now read the canonical contact address created by normal inquiry intake and refuse contacts marked unsubscribed or bounced. Exact human approval still saves an unsent draft. Sending and a later customer reply are confirmed by synchronization on the same follow-up work item. Collections also accepts database delivery timestamps when enforcing the reminder cooldown. Automated release checks cover sales follow-up, approved onboarding tasks and invoice-to-collections outcomes using controlled provider adapters and local PostgreSQL; they do not establish a hosted release.",
    category: "fix",
    publishedAt: "2026-09-29",
  },
  {
    id: "collections-approved-policy",
    slug: "collections-approved-policy",
    title: "Review collection policy changes from the assistant",
    description:
      "Ask AI or a connected MCP client to propose a collection pause, dispute, payment promise, owner or next action. Review the exact current and proposed values before approval. Changed invoice balances, recipients or case policies require a fresh preview. The saved change uses the same case history as Collections and sends no reminder. All six fictional demos support simulated owner, pause and resume requests.",
    category: "improvement",
    publishedAt: "2026-09-29",
  },
  {
    id: "workspace-mcp-and-import-review",
    slug: "workspace-mcp-and-import-review",
    title: "Workspace MCP connections and contact review are more reliable",
    description:
      "Stdio clients can now connect through a workspace’s authenticated HTTP endpoint without a database service-role credential. Tool discovery and invocation recheck live workspace and module access. Bearer clients can stage exact Content Calendar edits for administrator approval. Contact review shows original source values and row numbers, refuses incorrectly encoded uploads, retains cached history and pages large lists in groups of 50 without dropping source rows. Review saves commit every row, approval invalidation and history together; stale saves and edits to imported rows are refused.",
    category: "improvement",
    publishedAt: "2026-09-29",
  },
  {
    id: "approved-ai-task-lifecycle",
    slug: "approved-ai-task-lifecycle",
    title: "Ask AI can reopen tasks and revise their instructions",
    description:
      "Ask AI and connected MCP assistants can now prepare task reopening and description edits, including clearing instructions. Review the change in Approvals, then check its result in Tasks. Repeating an unchanged pending request reuses its proposal, and intervening task edits require a fresh review before execution.",
    category: "improvement",
    publishedAt: "2026-09-29",
  },
  {
    id: "contact-import-source-integrity",
    slug: "contact-import-source-integrity",
    title: "Contact imports keep every source row visible",
    description:
      "Contact import review now keeps each accepted CSV, TSV, JSON or pasted source row in its original order. Rows the AI cannot identify remain visible and excluded for review. Malformed or oversized sources stop with a specific correction instead of silently dropping rows or fields, and duplicate AI row references are refused before a review is saved.",
    category: "improvement",
    publishedAt: "2026-09-29",
  },
  {
    id: "debate-booking-production-loop",
    slug: "debate-booking-production-loop",
    title: "Debate bookings track the next confirmed commitment",
    description:
      "Debate productions now keep guest interest, pairing, question, format, date, invitation, production and publication as separate sourced stages. Today shows the first missing commitment. A reviewed invitation uses two inbound acceptance messages, exact saved contact addresses and a Google Calendar read-back; daily work rechecks linked events for cancellations, changes and participant responses. Gmail replies are checked against the complete provider thread before sending.",
    category: "improvement",
    publishedAt: "2026-09-27",
  },
  {
    id: "home-editorial-hero",
    slug: "home-editorial-hero",
    title: "A clearer homepage opening",
    description:
      "The homepage now opens with a readable statement of how Accelerate helps, one explanation of the offer, and a direct booking action. The diagram, text scramble, crossed-out outcome and electric accent have been removed. A short entrance follows the site's motion curve, and reduced-motion visitors see the complete content without animation. Desktop and mobile use the same paper-and-ink visual language as the rest of the site.",
    category: "improvement",
    publishedAt: "2026-09-27",
  },
  {
    id: "ai-readiness-evidence-and-roadmap",
    slug: "ai-readiness-evidence-and-roadmap",
    title: "AI Readiness shows the evidence behind its plan",
    description:
      "The assessment now shows which answers shaped its recommendation and explains when there is too little scored evidence for an overall score. Its report and PDF use a 90-day pilot roadmap with a measured baseline and human review points. An optional website check samples the homepage and up to three linked public pages, naming pages it could not review. Resources separates assessment engagement, report downloads and website check outcomes; these activity counts are limited to the selected window and available event records.",
    category: "improvement",
    publishedAt: "2026-09-27",
  },
  {
    id: "command-center-public-guides",
    slug: "command-center-public-guides",
    title: "Clearer Command Center setup and daily-work guides",
    description:
      "The public Command Center guides now follow a task from Today through its source record, Work, and the recorded result. Setup explains how to confirm a connection with a real sync or send, and Intake review covers its current filters, row actions, exact approval review, and refresh recovery. The feature page links directly to the operator guide and distinguishes managed workspace boundaries from self-hosted data ownership.",
    category: "improvement",
    publishedAt: "2026-09-27",
  },
  {
    id: "command-center-daily-work-navigation",
    slug: "command-center-daily-work-navigation",
    title: "Command Center puts daily work and contact context first",
    description:
      "The workspace rail now groups routes under Today, Work, Records, Conversations, Knowledge, Coworkers, Apps and Settings, with a shorter mobile dock. Today shows the source and next step for attention items. Work opens on personal tasks, keeps saved-view editing secondary, and adds keyboard triage and dated snooze through the existing task service. Contact records now bring next steps, recent open work, conversations, opportunities and history together, with Ask AI available from the record.",
    category: "improvement",
    publishedAt: "2026-09-27",
  },
  {
    id: "home-system-hero",
    slug: "home-system-hero",
    title: "A clearer, faster first impression",
    description:
      "The homepage now shows the full message and booking action immediately. A compact system diagram makes the strategy, custom build, managed execution, and team enablement offer easier to scan. The signature headline scramble and PROFIT reveal finish quickly, while the former full-screen pointer spotlight has been removed. The home navigation and service links use a restrained electric accent, and reduced-motion visitors see the complete static layout.",
    category: "improvement",
    publishedAt: "2026-09-26",
  },
  {
    id: "ask-ai-outreach-proposal-clarity",
    slug: "ask-ai-outreach-proposal-clarity",
    title: "Ask AI makes outreach proposals clearer",
    description:
      "When you ask Ask AI to email someone, its governed proposal tool is available from the start of the request. If it stages a proposal, the assistant reports that status without calling the message sent. Open Work to check the recipient and wording, approve the action, then inspect its result.",
    category: "improvement",
    publishedAt: "2026-09-26",
  },
  {
    id: "approval-queue-triage-gate",
    slug: "approval-queue-triage-gate",
    title: "A quieter approvals queue that explains itself",
    description:
      "Autonomous work now checks a proposal before it reaches your queue instead of after you dismiss it. Each proposal is scored for usefulness, evidence, attention cost and whether it needs checking first, then surfaced with its reason, checked further, or held back with a recorded receipt. Anything you asked for directly is never held back, a broken check queues the proposal anyway rather than losing it, and background sweeps that find nothing actionable finish quietly in Activity instead of reporting that they found nothing.",
    category: "improvement",
    publishedAt: "2026-09-26",
  },
  {
    id: "public-site-performance",
    slug: "public-site-performance",
    title: "The public site loads and moves between pages faster",
    description:
      "Marketing pages are served as prerendered pages, so a visit starts receiving the page immediately instead of waiting for a server render, and a fresh version is produced within a minute. Publishing a website update makes that revision visible on the next visit, so the public page still matches the saved revision. Operations styling now loads only on Command Center screens instead of on every public page, the chat panel and site search load the first time someone opens them, and the product screenshot carousel further down the home page no longer preloads an image nobody has scrolled to yet.",
    category: "improvement",
    publishedAt: "2026-09-26",
  },
  {
    id: "admin-control-affordances",
    slug: "admin-control-affordances",
    title: "Controls now show what they will do",
    description:
      "Sortable columns in the leads table state the current direction with an arrow and a spoken label, so the sort order is clear without reading the column. Disclosure controls across invoicing, plugins, error details and the work board open with the same rotating chevron, row and view actions sit in a consistent place, and the accent colors follow the active workspace appearance instead of a fixed palette.",
    category: "improvement",
    publishedAt: "2026-09-25",
  },
  {
    id: "command-center-work-and-contact-views",
    slug: "command-center-work-and-contact-views",
    title: "A clearer place for work and contact records",
    description:
      "Work brings tasks, exact approvals and coworker activity into nearby views. Connected workspaces can save the current task filters, layout and fields privately or share them with active members. Contacts opens a canonical people directory, with website requests, imports and identity matching nearby; existing submission links still work. Invoicing adds a paged account invoice list beside draft and payment operations. Proposal decline reasons stay out of audit snapshots, and the proposal transition function is restricted to the verified service role.",
    category: "improvement",
    publishedAt: "2026-09-24",
  },
  {
    id: "capy-command-center-appearance",
    slug: "capy-command-center-appearance",
    title: "A brighter, warmer appearance for Command Center",
    description:
      "Capy now pairs a graphite navigation rail and crisp white workspace surfaces with seafoam actions, monospaced titles and compact controls. The reference-led design uses a subtle warm-neutral canvas and restrained offset depth, while keeping all product icons, illustrations and copy original. The shared appearance system applies it across admin pages, the picker and fictional demos with responsive, keyboard and reduced-motion support.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "paper-admin-appearance",
    slug: "paper-admin-appearance",
    title: "A calmer Paper appearance for Command Center",
    description:
      "Paper now pairs its warm workspace canvas with a light sidebar and a quiet cobalt selection state. Primary actions keep the stronger cobalt fill, so navigation and actions have clearer visual priority.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "shared-workflow-calendar-views",
    slug: "shared-workflow-calendar-views",
    title: "See tasks and pipeline work in the view that fits",
    description:
      "Tasks & approvals now switches between list, status board and calendar views over the same task records. Pipeline adds a calendar for dated next actions while retaining its board and list. Both calendars keep undated work visible, identify overdue and upcoming items, and open the existing record editor for validated date changes. Layout, fields and filters persist in the browser by workspace and signed-in member; unsupported timeline and dependency views stay unavailable without canonical data to support them.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "ai-runtime-reliability",
    slug: "ai-runtime-reliability",
    title: "Ask AI answers faster and shows its sources",
    description:
      "Ask AI now streams its answer as it writes, and every dollar amount it states must come from your records or the conversation. Coworker work waits for your approval before a coworker starts, and each routine check runs once per period. On the Learning page you can review, correct or remove what the AI remembers, and each run shows the memories it used. Models qualify for sensitive work only after passing a recorded evaluation against the current instructions.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "approval-backed-content-calendar-edits",
    slug: "approval-backed-content-calendar-edits",
    title: "Review AI content calendar edits before they are saved",
    description:
      "Ask AI can preview and propose up to five field changes to an existing Content Calendar item. The review queue shows the exact proposed values, and saving rechecks workspace access and the item revision. The admin editor and approved AI action share the same validated update path. Approval does not publish content; creation, deletion and column reordering remain manual operations.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "shared-content-calendar-ai-read",
    slug: "shared-content-calendar-ai-read",
    title: "Ask AI can check the content calendar",
    description:
      "With the Content module enabled, Ask AI can list the five most recently added calendar items by status or category and tell you when more match. It can also prepare a grounded editorial brief when an AI provider is configured. The Content screen and assistant use the same calendar records, and generated briefs remain working copy until you review and add them.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "command-center-sign-in-clarity",
    slug: "command-center-sign-in-clarity",
    title: "A clearer Command Center sign-in",
    description:
      "The sign-in and password-recovery screens now use one focused layout. Installations that enable Google in Supabase Auth can offer Google sign-in beside email and password; workspace membership still controls access. The Google option stays hidden while the provider is disabled.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "command-center-app-auth-routing",
    slug: "command-center-app-auth-routing",
    title: "Account links return to the Command Center app address",
    description:
      "When an installation uses a dedicated Command Center address, workspace invitations and password recovery open there so the resulting session stays with the app. A configured Google Workspace connection also uses that address for its authorization callback. Installers can keep the public website on its existing address.",
    category: "improvement",
    publishedAt: "2026-09-23",
  },
  {
    id: "command-center-installable-workspace",
    slug: "command-center-installable-workspace",
    title: "Command Center can be installed as a workspace app",
    description:
      "Authenticated Command Center workspaces can be installed from the dedicated app origin on supported desktop and mobile browsers. The standalone shell keeps the tenant in its workspace, shows connection and update status, stores an approved low-risk snapshot for offline reference, and lets operators save non-sensitive local drafts without silently sending or mutating anything. Marketing pages and the public AI Readiness assessment remain browser experiences. Saved drafts can be read and reused; storage failures preserve the text. Sign-out cancels pending writes and waits for local cleanup, with recovery guidance when cleanup cannot be confirmed.",
    category: "feature",
    publishedAt: "2026-09-21",
  },
  {
    id: "shared-workspace-controls",
    slug: "shared-workspace-controls",
    title: "Consistent workspace fields and clearer recovery",
    description:
      "Clients, Analytics, Campaigns, Integrations and Proposals share themed field styling. Setup readiness stays readable across appearances, compact custom themes keep usable controls, and contact relationship errors offer a retry instead of showing an empty record.",
    category: "improvement",
    publishedAt: "2026-09-21",
  },
  {
    id: "work-desktop-layout",
    slug: "work-desktop-layout",
    title: "Clearer tasks, pipeline and contact workspaces",
    description:
      "Tasks & approvals uses a compact filter toolbar on wide screens, with aligned related records, due dates and priorities. Overdue dates stand out, completion actions have visible labels, and a result count and Reset filters make filtered views easier to navigate. Smaller screens retain the same details in a stacked layout. Pipeline keeps standard and saved views in one selector, stage and owner filters in an expandable panel, and customization tools under View options. Active filters stay visible in the result summary. Contact intake groups visibly labeled From and To dates beside search, with a reset action. Contact and client timelines share consistent card spacing, clear keyboard focus and immediate rendering without staggered entrance delays.",
    category: "improvement",
    publishedAt: "2026-09-21",
  },
  {
    id: "shared-request-protection",
    slug: "shared-request-protection",
    title: "Consistent request protection across server instances",
    description:
      "Protected actions share database-backed request limits, so adding server instances preserves the same limits. Temporary enforcement failures return a retryable response before work starts. Error screens explain how to check a submitted change before retrying, home navigation uses one accessible control, and sign-in and reset fields have associated labels. Self-hosting guidance now explains the required migration and recovery copies for records, files and configuration.",
    category: "improvement",
    publishedAt: "2026-09-21",
  },
  {
    id: "cold-start-onboarding",
    slug: "cold-start-onboarding",
    title: "A clearer path from demo to your own workspace",
    description:
      "Example credentials now show setup guidance instead of a broken login form. Installation instructions separate required settings from optional providers and walk through a saved first task. Fork deployments start without scheduled jobs and retain Git updates; existing production schedules remain explicit.",
    category: "improvement",
    publishedAt: "2026-09-21",
  },
  {
    id: "connected-admin-release-review",
    slug: "connected-admin-release-review",
    title: "Consistent record controls and clearer recovery",
    description:
      "Admin lists share keyboard-accessible record controls and retain their page identity while loading. Opening an approval from Today closes the context panel, so keyboard dismissal stays predictable. Source tools show existing canonical links and explain which fields remain source-owned. Revenue keeps opportunity totals separate from client contract values and accepted proposals. Setup, access and recovery guides explain how to verify a repair and safely resume interrupted agent work.",
    category: "improvement",
    publishedAt: "2026-09-20",
  },
  {
    id: "connected-learning-knowledge",
    slug: "connected-learning-knowledge",
    title: "Reviewed corrections and cited workspace references",
    description:
      "Independent learning rules remain active together, with explicit replacements and atomic approval history. Private PDF, DOCX and text references feed cited search; edited replies can propose reusable corrections. Meeting preparation and Client onboarding declare their shared sources and expected results. Get started follows saved work from an inquiry through a completed task and later guidance use. Source failures report incomplete coverage, large rule collections preserve official guidance, and completed first-use tasks remain recognized as more work is added. Failed evidence reviews retry independently after a cooldown, with the affected rule and remedy visible. AI readiness uses the execution credential check while manual tasks remain available. Installation requires the new migrations and an active work engine; model quality and live outcomes need separate verification.",
    category: "improvement",
    publishedAt: "2026-09-20",
  },
  {
    id: "ai-readiness-assessment-action-plan",
    slug: "ai-readiness-assessment-action-plan",
    title: "AI Readiness now produces a useful action plan",
    description:
      "The former AI Readiness Checklist is now an interactive assessment for small business leaders. It scores process, data, tools, team and guardrails separately, can inspect a prospect's public homepage for visible SEO, mobile, accessibility, trust and conversion signals, shows a useful preview before the email gate, and produces a personalized web report, true PDF and 30-day pilot plan. The Resources admin view now includes assessment funnel, website-audit count, source, constraint and lead reporting. Scores describe readiness signals and never promise savings or revenue. Concurrent retries preserve one saved report and link, tenant reports remain isolated, and requested report email uses recorded delivery without automatic marketing enrollment.",
    category: "feature",
    publishedAt: "2026-09-20",
  },
  {
    id: "fresh-fork-first-use",
    slug: "fresh-fork-first-use",
    title: "Clear next steps for a fresh installation",
    description:
      "Unconfigured installations now show the same setup guidance on direct sign-in visits and workspace links, with keyboard-accessible actions to open the installation guide or fictional demo. First-party tracking stays inactive until a database URL is configured, and unavailable analytics cannot break a site interaction. Browser checks cover the actual homepage click, setup links, demo edits and desktop/mobile accessibility.",
    category: "improvement",
    publishedAt: "2026-09-19",
  },
  {
    id: "chicago-small-business-industries",
    slug: "chicago-small-business-industries",
    title: "More small-business workflows and a Chicago services hub",
    description:
      "Ten additional industry guides bring the directory to twenty industries, with forty practical recipes for inquiry review and delivery handoffs. A Chicago services hub connects local businesses to consulting, custom systems, managed execution and training. Headquarters details now appear consistently, and industry pages distinguish current platform capabilities from custom integrations. Industry guides include business-specific pilot measures and handoff checks; the new recipe guides include concrete completion criteria and example task responsibilities.",
    category: "improvement",
    publishedAt: "2026-09-19",
  },
  {
    id: "full-product-neutral-fork",
    slug: "full-product-neutral-fork",
    title: "A complete workspace with your own editable website",
    description:
      "New forks start with a neutral Command Center homepage using the same page model as Site Studio. The full application remains included; agency content requires explicit branded configuration. Owners can customize pages and connect published workspace forms to the existing review and intake workflow. Public content, editor previews, and AI tools share the validated page schema. Existing installations must review their distribution setting before upgrading; deployment and live provider verification remain separate release steps.",
    category: "improvement",
    publishedAt: "2026-09-19",
  },
  {
    id: "site-editor-mcp-form-reliability",
    slug: "site-editor-mcp-form-reliability",
    title: "Scoped ChatGPT website editing and safer form intake",
    description:
      "The owner can configure a revocable OAuth connection for ChatGPT to prepare exact website changes, save drafts, publish and restore revisions through the shared editor services. Legacy workspace keys remain proposal-only. Form submissions and notifications now commit together, review decisions queue recoverable intake, stale edits are refused, and form rendering follows the shared theme tokens. Installation requires the new migrations and explicit OAuth setup; source availability is separate from deployment and client verification.",
    category: "improvement",
    publishedAt: "2026-09-19",
  },
  {
    id: "public-platform-value-recipes",
    slug: "public-platform-value-recipes",
    title: "Practical workflows across the platform, demos and docs",
    description:
      "The Command Center page explains connected business workflows, with readable feature summaries, implementation options and a demo chooser in the site's shared style. Three guided demos show an inquiry reply, an onboarding checklist and a simulated invoice, including the result to check. Twenty recipes across ten industries show which features and plugins to combine, how to configure them and what result to check. Documentation gives business users and builders clear starting paths and keeps existing reference links available.",
    category: "improvement",
    publishedAt: "2026-09-19",
  },
  {
    id: "demo-workspace-design-audit",
    slug: "demo-workspace-design-audit",
    title: "A clearer contact history and a complete demo workspace",
    description:
      "The contact relationship view now reads in plain language: interaction types use names like Message received instead of raw labels, record titles no longer repeat the type, and the collections follow-up and activity list have clear separation. The fictional workspaces also open Contact review and Subscriptions with realistic records instead of an unavailable message, demo pipeline stages show a varied funnel rather than the same count in every column, and the operator view tabs wrap instead of clipping the last view.",
    category: "improvement",
    publishedAt: "2026-09-14",
  },
  {
    id: "admin-theme-design-languages",
    slug: "admin-theme-design-languages",
    title: "Workspace appearances are now real design languages",
    description:
      "Each appearance owns its structure, not just its colors: corner geometry, borders, elevation, control height, label case and motion. Paper, Night, Signal, Studio and Frost keep their character, Material 2026 uses filled tonal surfaces with a pill navigation indicator and geometric titles, macOS uses denser silver chrome with grouped borderless panels, and a new Accelerate appearance matches the public site in bold black and white. Shared admin controls and utilities read the same theme tokens, so a borderless or squared appearance applies across every workspace screen instead of a handful of components. The appearance editor now also controls density, borders, shadow strength, surface material, motion, hover effects, navigation shape, label case, display type, button shape and container corners, so a custom workspace theme can express a full design language rather than a palette swap. Today renders through the same shared admin primitives as every other screen, so the interactive demo and the live workspace share one design system instead of parallel styling. Interactive controls resolve their corners from the theme's control radius, so a button or field can no longer pick up a card or container radius by accident.",
    category: "improvement",
    publishedAt: "2026-09-14",
  },
  {
    id: "form-builder-plugin",
    slug: "form-builder-plugin",
    title: "Form builder publishes shareable intake forms with reviewed responses",
    description:
      "Build lead-capture and client intake forms from a native field editor with live preview, publish a shareable link, and accept each response into the canonical pipeline after human review. Rendering uses the MIT-licensed SurveyJS library; responses never become leads on their own. The plugin starts disabled.",
    category: "feature",
    publishedAt: "2026-09-13",
  },
  {
    id: "deepseek-default-ai-model",
    slug: "deepseek-default-ai-model",
    title: "DeepSeek V4.1 Flash is the default AI model",
    description:
      "AI workflows now use DeepSeek V4.1 Flash by default through the shared OpenRouter gateway, including Command Center conversations, structured drafts and Site Studio page preparation. Existing model settings remain optional: installations and individual requests can choose another approved model, while provider keys, capability checks, budgets and usage receipts continue to apply.",
    category: "improvement",
    publishedAt: "2026-09-13",
  },
  {
    id: "customer-subscriptions",
    slug: "customer-subscriptions",
    title: "Sell and manage recurring plans in the workspace",
    description:
      "Workspace admins can create fixed monthly or annual Stripe plans. Customers use secure hosted checkout, then manage profile details, payment methods, invoices, renewal cancellation, and next-renewal plan changes from their Accelerate account.",
    category: "feature",
    publishedAt: "2026-09-13",
  },
  {
    id: "admin-theme-polish",
    slug: "admin-theme-polish",
    title: "Seven distinct appearances, one coherent workspace",
    description:
      "Workspace appearances now have distinct palettes, typography, geometry and depth. Material uses matte tonal surfaces while macOS uses silver chrome and tighter controls. The appearance picker previews each style and supports keyboard navigation. Shared controls, focus states, Today surfaces and reduced motion follow the same core tokens, with custom themes and density preserved. Navigation labels are easier to read, theme timing applies consistently, and mobile spacing keeps compact touch controls accessible.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "admin-coherent-core",
    slug: "admin-coherent-core",
    title: "A consistent core for the everyday workspace",
    description:
      "Command Center uses shared typography, controls, surfaces and responsive page layouts, with a refreshed Paper appearance. Today modules reclaim available space when panels are hidden or rearranged. Comfortable and compact density stay separate from the seven workspace appearances and persist in your browser.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "dashboard-actionable-layout",
    slug: "dashboard-actionable-layout",
    title: "A compact Today dashboard with clear next actions",
    description:
      "Today leads with decisions and follow-up, followed by business changes and separately labeled operational alerts. Compact pipeline facts, upcoming commitments and automation support the action queue. Automation details and completed results expand on demand; the standard layout omits duplicate AI prompts and empty App promotions. Section icons communicate distinct roles without repeated list icons. Existing custom views remain intact. A shared semantic entrance now fades and raises new admin sections in sequence, including fast and delayed data reads, without replaying existing sections during refresh.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "unified-task-write-path",
    slug: "unified-task-write-path",
    title: "Task saves run through the unified executor with undo",
    description:
      "Creating, updating, reopening and deleting a task now travels the same approved executor path as programmatic writes, with claim, autonomy check, audit and idempotency receipts. Reversible task writes can be undone exactly once: the prior state is restored from captured data and a second undo is refused. Irreversible effects still require human approval every time.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "public-proposal-decisions",
    slug: "public-proposal-decisions",
    title: "Keep public proposal decisions consistent when requests repeat",
    description:
      "Public proposal views share one receipt, repeated responses show the recorded decision, and expired or replaced links refuse new decisions. Customers can decline without an explanation; an optional reason stays bounded and the original decision is preserved when a response is retried.",
    category: "fix",
    publishedAt: "2026-09-12",
  },

  {
    id: "autonomy-policy-write-recovery",
    slug: "autonomy-policy-write-recovery",
    title: "Save and restore standing permissions reliably",
    description:
      "Repeated policy registration updates the intended workspace and coworker scope. Older duplicate records retain their IDs, approval can be revoked and granted again, and material policy changes clear the previous approval. Hard safety floors and audit history remain intact.",
    category: "fix",
    publishedAt: "2026-09-12",
  },
  {
    id: "stage-history-reconciliation",
    slug: "stage-history-reconciliation",
    title: "See recorded pipeline progress and history gaps",
    description:
      "Analytics separates recorded progress from current pipeline position and shows missing or incomplete history. Invalid events cannot make old movement look recent, and the assistant uses the shared calculation for custom pipeline stages.",
    category: "fix",
    publishedAt: "2026-09-12",
  },
  {
    id: "neutral-fork-distribution",
    slug: "neutral-fork-distribution",
    title: "Run a fork as your business, not ours",
    description:
      "A manifest-driven exporter creates a separate neutral starter with configured business identity, empty business collections and sample page content. Protected media and original hosting targets are omitted. The same admin and runtime remain, with fresh artifact build and fictional desktop/mobile checks in CI. The original branded installation remains the default.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "admin-guidance-clarity",
    slug: "admin-guidance-clarity",
    title: "Find the same names and guidance across Command Center",
    description:
      "Navigation, search, headings and breadcrumbs share consistent destination names. Architect, Blueprints and Learning Inbox include workflow help and linked guides. Help panels stay within the phone screen and keep longer guidance scrollable.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "services-strategy-page",
    slug: "services-strategy-page",
    title: "Explore strategy, custom builds and ongoing support",
    description:
      "The Services page explains how Accelerate helps identify useful work, build custom systems, support ongoing execution and improve results. Section links connect the offer, example work and engagement process; Command Center remains one option within that broader service.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "kanban-scroll-continuity",
    slug: "kanban-scroll-continuity",
    title: "Keep your place on shared boards",
    description:
      "Feature Board, Pipeline and Content Calendar keep manual horizontal scrolling under your control. Column buttons remain available on phones, tablets and desktops, keyboard focus reaches the board, and returning from an opportunity restores its board position. Shared loading and refresh regions retain their spacing across appearances.",
    category: "fix",
    publishedAt: "2026-09-12",
  },
  {
    id: "social-marketing-postiz",
    slug: "social-marketing-postiz",
    title: "Prepare and review LinkedIn publishing in Social Marketing",
    description:
      "The forkable app package optionally bundles Postiz with one configuration and startup command; its services stay off by default. Its optional plugin adds source-backed drafts, weekly preparation, exact batch approval, durable scheduling and publication receipts. Each tenant connects a separate organization. Deployment assets protect owner registration and draft media, refuse automatic destructive schema changes, and include isolated startup and recovery checks. Hosting, LinkedIn access and the internal pilot require verified setup before customer activation.",
    category: "feature",
    publishedAt: "2026-09-12",
  },
  {
    id: "resumable-agent-work",
    slug: "resumable-agent-work",
    title: "Continue unfinished agent work from saved checkpoints",
    description:
      "Repository agents can preserve source checkpoints and resume interrupted tasks through the usual backlog request. This release adds durable attempts and permanently fenced old sessions. Active ownership stays protected, while work volume does not block an authorized claim. Automatic takeover requires the recovery migration and an enabled project policy; hosted activation remains a separate release step.",
    category: "improvement",
    publishedAt: "2026-09-12",
  },
  {
    id: "drive-duplicate-provenance",
    slug: "drive-duplicate-provenance",
    title: "Keep Drive duplicate references across repeated syncs",
    description:
      "Unchanged Drive files retain their duplicate-source relationship across repeated syncs and listing order changes. If the original changes, disappears or loses download access, an available unchanged copy becomes the source for that content. Each file keeps its own identity, link and folder provenance.",
    category: "fix",
    publishedAt: "2026-09-12",
  },
  {
    id: "site-studio-verified-writes",
    slug: "site-studio-verified-writes",
    title: "Keep Site Studio saves bound to the verified editor",
    description:
      "Site Studio passes the verified editor directly to its existing server write service and rechecks active workspace membership. The upgrade preserves prior migration history and restores private write permissions after the compatible application release. Saved website revisions remain installation-owner controlled; private workspace drafts keep their existing access boundary.",
    category: "fix",
    publishedAt: "2026-09-12",
  },
  {
    id: "fresh-fork-install",
    slug: "fresh-fork-install",
    title: "Install from a fresh fork with the setup command",
    description:
      "Connecting a workspace now follows the guided setup command for owner, schema and membership. Fork preview hosting is documented as a project you control, not the original Vercel IDs. CI records the command and failure matrix for a clean checkout.",
    category: "improvement",
    publishedAt: "2026-09-11",
  },
  {
    id: "learning-inbox",
    slug: "learning-inbox",
    title: "Teach Command Center with reusable corrections",
    description:
      "A new Learning Inbox collects reusable corrections from everyday work. Propose a correction once with its type, scope and confidence; ignore it, keep it to the current conversation, or send it to approvals. Approved learnings become shared policy with authority and provenance, so future drafts, coworkers and agents inherit what the business already decided.",
    category: "feature",
    publishedAt: "2026-09-11",
  },
  {
    id: "today-composable-workspace",
    slug: "today-composable-workspace",
    title: "Make Today fit the way you work",
    description:
      "Save personal and shared Today views with a sourced business brief, contextual work, coworker outcomes and enabled App follow-up. Arrange modules, filter attention, pin priorities and inspect source records before acting. Sparse and empty states offer useful starting points. Live refresh holds content during interaction; optional AI interpretations use existing budgets and current supporting evidence.",
    category: "feature",
    publishedAt: "2026-09-09",
  },
  {
    id: "connected-client-demo",
    slug: "connected-client-demo",
    title: "Open clients and carry follow-ups into Work",
    description:
      "Client rows and contact links have larger targets, demo search and status filters work, and saved follow-ups open in the task inspector. Mobile summaries are compact and shared status badges follow the current theme. Timeline links preserve the exact related record. Follow-up failures retain the draft and show an error instead of disappearing silently.",
    category: "fix",
    publishedAt: "2026-09-09",
  },
  {
    id: "material-and-macos-appearances",
    slug: "material-and-macos-appearances",
    title: "Choose Material 2026 or macOS in Command Center",
    description:
      "Two refined workspace appearances are now available from the Appearance control. Material 2026 uses expressive blue tonal layers and generous geometry; macOS uses quiet translucent surfaces and familiar desktop accents. Both preserve the same responsive behavior, accessibility, and per-demo preference isolation as every other appearance.",
    category: "improvement",
    publishedAt: "2026-09-09",
  },
  {
    id: "clearer-core-admin",
    slug: "clearer-core-admin",
    title: "Navigate a clearer, more responsive Command Center",
    description:
      "Core admin navigation now uses task-based names, each destination explains its purpose and offers concise in-context guidance, and the sidebar responds smoothly while keeping your open groups in place. Errors provide a practical recovery step before optional details.",
    category: "improvement",
    publishedAt: "2026-09-09",
  },
  {
    id: "demo-marketing-contact-review",
    slug: "demo-marketing-contact-review",
    title: "Explore the business demos and clearer contact reviews",
    description:
      "The demo launcher now introduces Command Center with an interactive inquiry-to-result illustration and six business workspaces. Contact review explains matching decisions in plain language, preserves its heading during loading and errors, and no longer displays a setup warning after a successful read. Shared setup messages explain the next step without database instructions.",
    category: "improvement",
    publishedAt: "2026-09-09",
  },
  {
    id: "appearance-cross-tab-persistence",
    slug: "appearance-cross-tab-persistence",
    title: "Keep demo tabs from resetting your workspace appearance",
    description:
      "An open demo could immediately overwrite a theme selected in the live workspace. Demo businesses now use separate theme preferences, and their saved appearance is restored only when entering that business. Changing an appearance no longer restarts the demo runtime.",
    category: "fix",
    publishedAt: "2026-09-09",
  },
  {
    id: "website-authoring-model-choice",
    slug: "website-authoring-model-choice",
    title: "Create and edit website pages with a choice of AI models",
    description:
      "Installation owners can create and clone pages, review AI copy or layout suggestions, undo edits, preview phone and desktop widths, and explicitly publish or roll back saved revisions. Muse Spark 1.3 is the default. A refreshable model catalogue offers current recommendations, search, provider/cost filters and price sorting, with explicit price ceilings. Shared content, image references, collections and portable snapshots use the same versioned website document. The Work board moves advanced filters and saved views into a compact dialog. Existing source pages retain their layouts until deliberately replaced; automatic import of all existing page content remains separate work.",
    category: "improvement",
    publishedAt: "2026-09-09",
  },
  {
    id: "installation-website-private-editor",
    slug: "installation-website-private-editor",
    title: "Edit a private installation website draft",
    description:
      "Installation owners can edit homepage content, save versioned drafts, open the saved preview, and import or export a portable content snapshot. Interrupted saves reuse their request and stale saves preserve local fields. The shared fictional demo and user guide include save, recovery and fork examples. Public publishing and the remaining site migration are not part of this draft editor yet.",
    category: "improvement",
    publishedAt: "2026-09-08",
  },
  {
    id: "homepage-reduced-motion-headline",
    slug: "homepage-reduced-motion-headline",
    title: "Read the complete homepage headline with reduced motion",
    description:
      "The homepage shows the full headline immediately when your device requests reduced motion. The highlighted phrase no longer waits for the scramble animation, and the usual animation remains available for other visitors.",
    category: "fix",
    publishedAt: "2026-09-08",
  },
  {
    id: "demo-layout-settings-read",
    slug: "demo-layout-settings-read",
    title: "Inspect default layout settings in fictional workspaces",
    description:
      "Demo Settings now loads the default sidebar and Today page layouts without an error notification. The layouts have no saved override or change history, so reverting remains unavailable. The settings guide explains these states with an example.",
    category: "fix",
    publishedAt: "2026-09-08",
  },
  {
    id: "site-studio-provider-output-contract",
    slug: "site-studio-provider-output-contract",
    title: "Generate Site Studio drafts with the configured structured-output provider",
    description:
      "Page generation and section regeneration now send a complete output schema derived from the same document rules used by the renderer. Strict providers can accept the request; optional fields are normalized before validation. Catalog, link and claim checks still apply. The user guide includes a worked draft example and explains recovery and provider costs.",
    category: "fix",
    publishedAt: "2026-09-08",
  },
  {
    id: "workflow-guides-with-examples",
    slug: "workflow-guides-with-examples",
    title: "Follow worked examples for the new workspace workflows",
    description:
      "The public guides now walk through tagging and draft enrollment, campaign copying, won-to-delivery handoff, Drive indexing, and private Site Studio drafts. Each example explains its saved result and recovery. Feature descriptions and FAQ clarify that bulk changes have individual outcomes, successful changes remain saved, and suppression is not automatically reversed.",
    category: "improvement",
    publishedAt: "2026-09-08",
  },
  {
    id: "release-feature-schema-verification",
    slug: "release-feature-schema-verification",
    title: "Check the database requirements of newly integrated workflows",
    description:
      "Setup verification now checks draft version and checksum fields, Drive indexing state, campaign-copy receipts, delivery revisions, and the protected operations used by bulk and handoff actions. Missing requirements point to their owning migrations. A previous successful check must match the new schema contract before setup is considered ready.",
    category: "fix",
    publishedAt: "2026-09-08",
  },
  {
    id: "admin-appearance-and-kanban-polish",
    slug: "admin-appearance-and-kanban-polish",
    title: "Workspace themes and Kanban share a more consistent interface",
    description:
      "Admin surfaces, controls and dialogs now follow the selected appearance, with improved dark-theme contrast and shorter regional loading transitions. Branding adds a theme preview, palette and geometry controls, portable import/export and governed AI proposals. Kanban uses readable swipeable columns, mouse, touch and keyboard dragging, clear insertion feedback and saved-position recovery.",
    category: "improvement",
    publishedAt: "2026-09-08",
  },
  {
    id: "reviewed-delivery-handoff",
    slug: "reviewed-delivery-handoff",
    title: "Review a won opportunity's delivery plan and retain its handoff receipt",
    description:
      "Create one engagement with versioned source context and shared onboarding tasks. Concurrent handoffs reuse the same engagement, completed tasks stay complete, and retries preserve partial progress. A review shows the template and optional proposal before confirmation. Template publication and its audit are transactional; the fictional demo saves its own engagement and receipt.",
    category: "feature",
    publishedAt: "2026-09-08",
  },
  {
    id: "local-agent-supervisor",
    slug: "local-agent-supervisor",
    title: "Coordinate local agent jobs with durable ownership and recovery",
    description:
      "Optional developer supervision adds a shared queue and process identity registry. Cross-process state updates are transactional; stale releases preserve replacement owners. Registered interrupted threads resume through the original provider with one foreground owner, and uninstall safely resumes owned paused processes or refuses with a precise reason. Cancellation requires an explicitly registered disposable child and enabled policy. Management starts off; provider hooks and OS isolation remain separate.",
    category: "feature",
    publishedAt: "2026-09-08",
  },
  {
    id: "reviewed-bulk-contact-operations",
    slug: "reviewed-bulk-contact-operations",
    title: "Tag, suppress and stage selected contacts with individual outcomes",
    description:
      "Lead selections resolve to distinct contacts. Concurrent tag changes preserve unrelated labels, and campaign enrollment rechecks draft status and canonical email identity inside the database transaction. Per-contact outcomes show skips and failures; retries repair partially completed suppression without restoring unsubscribed contacts. The fictional demo saves these changes across reloads.",
    category: "feature",
    publishedAt: "2026-09-08",
  },
  {
    id: "atomic-campaign-duplication",
    slug: "atomic-campaign-duplication",
    title: "Duplicate campaigns into fresh drafts with durable retry receipts",
    description:
      "Copy a campaign's audience, steps, sender and policy into a fresh draft without members, sends or approvals. The source version is checked and the copy, provenance and audit commit together. Interrupted requests reuse the same receipt; the fictional workspace saves and previews its own copy.",
    category: "feature",
    publishedAt: "2026-09-08",
  },
  {
    id: "tenant-site-studio-drafts",
    slug: "tenant-site-studio-drafts",
    title: "Site Studio prepares private, versioned page drafts",
    description:
      "Enable Site Studio to create a structured page from a built-in template or configured AI, preview responsive widths, rename it or discard it. Tenant-owned database storage preserves identity through renames, checks concurrent edits, and records immutable revisions atomically with audit entries. Publishing remains separate. The guide covers setup, costs, supported controls and recovery.",
    category: "feature",
    publishedAt: "2026-09-08",
  },
  {
    id: "reviewed-agent-runtime-integration",
    slug: "reviewed-agent-runtime-integration",
    title: "Grounded coworker outcomes and focused MCP tool lists",
    description:
      "Headless coworkers now bound their context and validate final answers against successful tool receipts, retaining partial work and proposed actions when grounding fails. MCP clients can load Daily, Minimal or full tool lists with discovery and execution permissions preserved. Revoked action authority records a denied result that work recovery treats as terminal. Timed-out work remains held for receipt reconciliation instead of silently retrying; work batches have explicit deadlines and recent-failure admission controls.",
    category: "improvement",
    publishedAt: "2026-09-08",
  },
  {
    id: "drive-content-indexing",
    slug: "drive-content-indexing",
    title: "Drive sync records extracted text and explicit indexing outcomes",
    description:
      "Approved folders now index supported text formats with provider revisions, content hashes and duplicate-source hints. Paginated listings retain absent files when incomplete. Revoked download access clears indexed text on the next sync; unsupported formats and failed reads remain explicit. Google Sheets export covers the first sheet, and text extraction is limited to 2 MB per file. The setup guide explains results and recovery without equating stored text with universal AI retrieval.",
    category: "improvement",
    publishedAt: "2026-09-08",
  },
  {
    id: "platform-how-it-works-guide",
    slug: "platform-how-it-works-guide",
    title: "A single guide explains how the Accelerate runtime fits together",
    description:
      "The public docs now have a complete system map from source data to canonical records, attention signals, reviewed actions, receipts, and reusable extensions. It explains the five runtime layers, workspace boundaries, AI and MCP interfaces, plugins and Apps, coding-agent execution, failure handling, and the path to try or build each part.",
    category: "improvement",
    publishedAt: "2026-09-07",
  },
  {
    id: "natural-language-agent-pickup",
    slug: "natural-language-agent-pickup",
    title: "Any coding agent can pick up the next backlog task from plain language",
    description:
      "A request such as “pick up work from the backlog and go until it is completed and committed; follow protocol” now starts the governed developer workflow without a ticket key or provider-specific command. The entrypoint selects one eligible card, preserves claim ownership, creates the approved isolated worktree, supplies the full packet, repairs dated report drift, and continues through verification, commit and evidence submission. An owner-authorized local operator profile is detected across worktrees and uses the canonical local board without a credential prompt; remote workers keep scoped HTTPS transport. Diagnostics, pickup, heartbeat and submission now resolve the same private profile; a clean main control checkout avoids starting from an older dirty feature branch. Review, merge and deployment remain separate recorded steps.",
    category: "improvement",
    publishedAt: "2026-09-08",
  },
  {
    id: "shared-today-work-views",
    slug: "shared-today-work-views",
    title: "Today separates attention, and Work shares tasks and approvals",
    description:
      "Today groups decisions, tasks, watch signals and upcoming context by source identity. Work adds task ownership/status/source filters and editing alongside the same approval inspector. Recovery tasks keep their task controls, approvals appear once in Today, and edits, snoozes and completion retain the same saved record across views. The fictional demos use the shared task transition rules and source-linked history.",
    category: "improvement",
    publishedAt: "2026-09-07",
  },
  {
    id: "custom-app-development-guides",
    slug: "custom-app-development-guides",
    title: "Guides explain full App customization and AI-assisted development",
    description:
      "New customization and developer guides cover domain-specific records, custom work lifecycles, native queues and bespoke interfaces using shared business services. A copyable AI development brief explains the source workflow available today and clearly labels the planned in-app draft, preview and publish experience. Product descriptions now distinguish current customization from the future App builder.",
    category: "improvement",
    publishedAt: "2026-09-07",
  },
  {
    id: "visual-plugin-guides",
    slug: "visual-plugin-guides",
    title: "Visual guides explain all ten bundled plugins",
    description:
      "Explore dedicated plugin guides with fictional workspace screenshots, setup steps, approval and cost boundaries, and recovery instructions. The documentation introduction explains connected business context and extensibility. Collections demo invoices now retain complete simulated receipts, and incomplete invoice balances display as unknown instead of crashing the page.",
    category: "improvement",
    publishedAt: "2026-09-07",
  },
  {
    id: "tenant-message-upsert-repair",
    slug: "tenant-message-upsert-repair",
    title: "Shared email and message sync use compatible workspace replay indexes",
    description:
      "Fixed a database conflict-target error that could stop an approved email before provider dispatch and prevent message synchronization. An additive migration makes conversation and message upserts compatible with workspace-scoped replay keys while preserving separate tenant records and messages without external IDs.",
    category: "fix",
    publishedAt: "2026-09-07",
  },
  {
    id: "reviewed-outreach-and-runtime-integration",
    slug: "reviewed-outreach-and-runtime-integration",
    title: "Reviewed outreach joins the shared business workflows",
    description:
      "Radar can prepare a sourced draft, review the exact message and recipient, and send through the configured workspace sender after human approval. Two-party introductions require cited consent. Durable reservations, contact cooldowns and daily limits prevent repeated sends; uncertain provider acceptance remains on hold for receipt reconciliation. The same controls run with fictional data in the demo. Sending starts disabled.",
    category: "feature",
    publishedAt: "2026-09-06",
  },
  {
    id: "integrated-lifecycle-health-and-model-jobs",
    slug: "integrated-lifecycle-health-and-model-jobs",
    title: "Proposal revisions, booking readiness, health and model jobs share clearer evidence",
    description:
      "Sent proposal edits create a successor draft while retaining the original decision history. Booking distinguishes an embed from verified event attribution. Source health separates quiet syncs from missing configuration and incomplete processing, alongside live work counts. Model calls name registered jobs and retain requested-model, fallback and failure receipts; unevaluated low-cost models cannot run consequential jobs.",
    category: "improvement",
    publishedAt: "2026-09-06",
  },
  {
    id: "radar-reviewed-workspace",
    slug: "radar-reviewed-workspace",
    title: "Opportunity Radar brings sources, reviewed opportunities, and drafts together",
    description:
      "Review supplied sources, compare business opportunities using human-reviewed estimates, and save drafts through exact approval previews. Today, opportunity details, and retained history share the same admin pages across live workspaces and fictional demos. Model spending starts off; optional source briefing uses explicit model settings, call limits, cost reservations, and charge receipts. Automated discovery, publication, and independently verified outcome measurement remain unfinished. Reviewed outreach is described in its release entry.",
    category: "feature",
    publishedAt: "2026-09-06",
  },
  {
    id: "radar-source-backed-relationships",
    slug: "radar-source-backed-relationships",
    title: "Relationship reviews retain the evidence behind a contact path",
    description:
      "Radar can read canonical CRM relationships and conversation history, then propose a cited relationship assertion or revocation for human review. Current introduction offers, existing conversations, and reviewed public business contact pages remain distinct. Expired evidence, ambiguous identities, and suppressed contacts cannot produce an eligible path. A contact path never grants permission to send a message.",
    category: "feature",
    publishedAt: "2026-09-06",
  },
  {
    id: "collections-reviewed-reminders",
    slug: "collections-reviewed-reminders",
    title: "Collections connects verified balances to reviewed reminders and receipts",
    description:
      "Work from verified invoice facts, group receivables by account and currency, and record payment promises or disputes. Configured reminder sends require an exact approval and fresh checks for payment, suppression, holds, and recipient changes. Durable dispatch receipts prevent duplicate sends and keep uncertain provider results on hold until reconciliation. The shared workspace also supports fictional business demos without sending email.",
    category: "feature",
    publishedAt: "2026-09-06",
  },
  {
    id: "public-platform-docs-coverage",
    slug: "public-platform-docs-coverage",
    title: "Platform guides are organized, searchable, and checked against the build",
    description:
      "The public documentation library organizes operator tasks and developer references by platform area. Guides participate in navigation, full-text search, and the generated AI-readable index. Release checks now verify that every documented page, internal anchor, and registered tool or capability reference appears in the actual build. The Radar guide walks through a reviewed opportunity and explains setup, model costs, recovery, and the current release limits.",
    category: "improvement",
    publishedAt: "2026-09-06",
  },
  {
    id: "admin-settings-control-polish",
    slug: "admin-settings-control-polish",
    title: "Settings controls now look and behave like production controls",
    description:
      "Rebuilt notification preferences around one accessible shared switch with a 48-by-28 pill track, a centered thumb, a full 44-pixel touch target, keyboard operation, visible focus, and a truthful busy state that prevents duplicate saves. Top-level Command Center pages no longer repeat their title as a one-item breadcrumb, while record-detail breadcrumbs remain intact. Settings also sheds its nested route animation and now stacks long configuration keys and editing actions safely on compact screens. The five-business desktop/mobile Command Center regression matrix verifies switch geometry, interaction, overflow, deep links, protected-request isolation, and runtime health.",
    category: "fix",
    publishedAt: "2026-08-31",
  },
  {
    id: "home-hero-mobile-timing-parity",
    slug: "home-hero-mobile-timing-parity",
    title: "The homepage hero now keeps one animation rhythm on every screen",
    description:
      "Removed the compressed phone-only hero timeline that made the mobile entrance rush through the headline, strike, PROFIT reveal, underline, and strategy action in roughly half the authored desktop sequence. Mobile still uses its responsive type scale, composition, and proportional blur, but every entrance beat now inherits the exact desktop duration and delay. A dedicated production-browser contract compares the computed desktop and mobile timelines, captures the headline, PROFIT, and action frames at both widths, checks overflow and runtime errors, and verifies reduced-motion visitors receive the complete hero immediately.",
    category: "fix",
    publishedAt: "2026-08-31",
  },
  {
    id: "admin-record-links-and-ai-workspace",
    slug: "admin-record-links-and-ai-workspace",
    title: "Client records open reliably and the AI workspace gets a focused operating surface",
    description:
      "Repaired the fictional Command Center detail contract so every client and pipeline link resolves the exact requested record across all five businesses; unknown client, opportunity, contact, AI run, proposal, campaign, email, import, and conversation IDs now fail honestly instead of substituting another fixture. Pipeline related-work links point to the real Today workspace, generated AI runs retain their own inspectable identity, and direct tenant reads remain safely restricted. Clients and client details now use the shared appearance-aware admin surfaces instead of the legacy glass and gold layer. The AI workspace removes the stacked explainer-card preamble, keeps a compact three-view switcher, restores conversation selection on phones, keeps the composer inside a bounded viewport-aware work area, and presents assistant answers as readable editorial output with visible evidence and follow-up actions. Automated coverage now opens every client and opportunity detail on desktop and mobile for every fictional business and separately proves invalid IDs cannot cross-link to another entity.",
    category: "fix",
    publishedAt: "2026-08-31",
  },
  {
    id: "admin-layout-continuity",
    slug: "admin-layout-continuity",
    title: "Admin pages keep one coherent rhythm in every workspace",
    description:
      "Repaired the shared async content wrapper that had collapsed section spacing across Analytics, Bookings, Revenue Recovery, Pipeline, Integrations, Feature Board, and other loaded admin routes. The spacing contract now lives in the shared read primitive, so direct, cached, refreshing, live, and fictional-tenant views cannot silently push cards together. Bookings no longer leaks roofing language into other businesses, Analytics reflows its supporting note on phones, and the legacy Revenue cards and chart now use the same appearance-aware surfaces, ink, borders, and accent tokens as the rest of Command Center. Setup also receives the complete Google credential-health contract instead of crashing inside fictional workspaces. Inbox refresh no longer triggers a render-driven refetch loop: one click now performs one bounded read, exposes its busy state, and reliably returns the control to idle. Browser coverage measures real sibling gaps and overflow across the affected routes on desktop and mobile in Signal, Paper, and Night, while the complete five-business, 28-route desktop/mobile demo matrix verifies every enabled workspace and the Inbox refresh interaction.",
    category: "fix",
    publishedAt: "2026-08-31",
  },
  {
    id: "mobile-chrome-navigation-performance",
    slug: "mobile-chrome-navigation-performance",
    title: "Mobile navigation no longer fights the page underneath it",
    description:
      "Rebuilt the public mobile menu around interruptible browser-native transitions, removed the full-page blur layer from route changes, stopped decorative ambient and logo loops from running continuously on phones, and limited the homepage spotlight to real touch interaction instead of every animation frame. The opaque menu now suspends rendering work behind it while keeping the closed drawer inert, route focus no longer draws a broken outline around page headings, and a persistent-profile performance gate exercises repeated navigation, rapid open-close interruption, fresh and returning profiles, reduced motion, long tasks, overflow, focus, and runtime errors under mobile CPU throttling.",
    category: "fix",
    publishedAt: "2026-08-31",
  },
  {
    id: "tenant-openrouter-byok",
    slug: "tenant-openrouter-byok",
    title: "Each workspace can bring its own OpenRouter key",
    description:
      "Tenant administrators can now connect, verify, rotate, and revoke a dedicated OpenRouter API key from Integrations. Verification checks the key without generating tokens; storage encrypts it against the exact tenant, provider, and credential field; and the plaintext never returns to the browser. Every AI workflow resolves the active workspace before provider traffic, so client usage is billed to the client's OpenRouter account and a missing or revoked client key fails closed. Accelerate retains a clearly labelled bootstrap-only platform fallback while tenants move onto their own spend controls.",
    category: "feature",
    publishedAt: "2026-08-31",
  },
  {
    id: "tenant-admin-invitations",
    slug: "tenant-admin-invitations",
    title: "Client workspace invitations are ready for real operators",
    description:
      "Platform administration can now add a client operator through a branded, one-time invitation delivered by the verified Accelerate sender. New accounts, existing confirmed accounts, and previously unconfirmed accounts each follow an explicit path; pending invitations have a safe resend control, delivery outcomes carry provider receipts, and uncertain outcomes tell the founder to reconcile instead of sending twice. Acceptance activates exactly one matching membership and workspace, while suspension, revocation, and the shared-database isolation boundary continue to fail closed.",
    category: "feature",
    publishedAt: "2026-08-31",
  },
  {
    id: "grounded-ai-context-contracts",
    slug: "grounded-ai-context-contracts",
    title: "AI generation paths now carry stricter evidence and context boundaries",
    description:
      "Revenue Copilot, public chat, growth plans, proposal drafts, content briefs, contact imports, and first-touch responses now use explicit source allowlists and fixed context budgets whenever AI generation is configured. Live tool results carry source receipts; unsupported final answers degrade visibly instead of being presented as grounded; prices must match the published service catalog exactly; and imported rows, visitor messages, and inquiry text remain untrusted data rather than instructions. The materially stricter first-touch responder policy advances to version 2 and remains paused until that exact policy is reviewed and approved.",
    category: "improvement",
    publishedAt: "2026-08-31",
  },
  {
    id: "tenant-workspaces-and-revenue-recovery",
    slug: "tenant-workspaces-and-revenue-recovery",
    title: "Command Center is ready for secure client workspaces and revenue recovery",
    description:
      "Command Center now runs as one shared application with explicit, isolated client workspaces: tenant-scoped records, memberships, provider credentials, public intake, webhook routing, jobs, and suspension guards keep each business separate. The new Revenue Recovery workflow turns reviewed historical contacts into bounded, approval-gated reactivation campaigns for stale leads, unsold estimates, no-shows, dormant customers, and lapsed clients. It tracks replies, bookings, reopened opportunities, and wins back to the originating campaign, then puts the next human response in the priority queue. Campaign setup now separates the verified sending identity from the monitored reply inbox and refuses activation until both are ready.",
    category: "feature",
    publishedAt: "2026-08-31",
  },
  {
    id: "admin-surfaces-and-email-authoring",
    slug: "admin-surfaces-and-email-authoring",
    title: "Admin surfaces and Email Studio now share a deliberate system",
    description:
      "Operational cards now choose a semantic surface role (flat, raised, or outlined) while every appearance supplies the matching radius, shadow, and edge treatment. Legacy cards resolve through the same contract, so a theme change cannot split the workspace into visual generations. Email Studio now authors typed sections instead of raw body markup; one renderer produces its exact preview, founder test message, and future published sends, while demo edits remain entirely fictional and local. Mobile receipts clear the navigation dock rather than covering it.",
    category: "improvement",
    publishedAt: "2026-08-28",
  },
  {
    id: "navigation-cache-and-motion-continuity",
    slug: "navigation-cache-and-motion-continuity",
    title: "Navigation stays smooth in returning browser profiles",
    description:
      "Replaced post-paint route animation startup with one pre-paint CSS sequence for the public site, founder workspace, and fictional demos. Admin overlays now remain mounted for their complete entrance and exit lifecycles, refresh controls use the shared compact header position on mobile, and reduced-motion preferences no longer disable unrelated interface feedback. Prebuilt production releases now preserve one build-time Next.js deployment identity and fail closed before upload if the server output could substitute a competing runtime identity. Persistent-profile and frame-sampled browser tests cover public navigation, cached admin navigation, dialog entry and exit, and mobile continuity.",
    category: "fix",
    publishedAt: "2026-08-28",
  },
  {
    id: "admin-cold-load-continuity",
    slug: "admin-cold-load-continuity",
    title: "Cold admin loads now preserve the destination instead of flashing placeholders",
    description:
      "Fast Command Center reads now resolve without showing a skeleton at all. When a read is genuinely slow, one shared async-region primitive waits briefly, fades in a destination-shaped placeholder, and then crossfades to retained or ready content; Today keeps the same 2-by-2 mobile summary geometry throughout. Frame-by-frame browser coverage now forces an uncached route and verifies cold-load visibility, same-frame navigation feedback, sequential blur-and-rise motion, focus, scroll reset, mobile dock movement, and reduced motion against the rendered application.",
    category: "fix",
    publishedAt: "2026-08-28",
  },
  {
    id: "interface-reliability-and-brand-refresh",
    slug: "interface-reliability-and-brand-refresh",
    title: "Shared interface foundations now stay coherent across every route",
    description:
      "Repaired the viewport-owned notification layer, restored viewport-timed public reveals on industry pages, isolated the fictional-demo launcher theme from the global site preference, and gave every Today demo filter meaningful interactive work. Selected Work now uses one rounded media treatment and a header-aware hero rhythm in both themes. The 404 experience and social-share cards were rebuilt in the current Accelerate system, with one dynamic Open Graph source supplying consistent, optimized imagery across the site.",
    category: "fix",
    publishedAt: "2026-08-28",
  },
  {
    id: "admin-motion-and-composer-standard",
    slug: "admin-motion-and-composer-standard",
    title: "Admin navigation now feels continuous and intentional",
    description:
      "The founder workspace and every fictional demo now acknowledge the intended destination immediately, then resolve through one perceptible, sequential blur-and-rise entrance on direct loads and later navigation. Page identity remains visible while unresolved data uses regional geometry, and shared cancellable queries retain useful results across revisits and refreshes. The mobile dock moves as one glass selection surface, yields the bottom edge to notifications instead of overlapping them, and More opens one accessible side drawer. Today and notification queues no longer repeat decorative icons; AI commands and conversation replies share one focused composer surface. Browser contracts enforce the motion sequence, loading ownership, overlay collision rules, semantic icon use, and shared messaging controls.",
    category: "fix",
    publishedAt: "2026-08-27",
  },
  {
    id: "continuous-navigation-runtime",
    slug: "continuous-navigation-runtime",
    title: "Navigation now behaves like one continuous application",
    description:
      "Public pages, the founder workspace, and all three fictional demos now share one navigation runtime. New destinations begin at the top, browser history restores the exact prior reading position, admin navigation stays inside its application viewport, and demo links remain in the selected fictional business without hard reloads. Slow admin transitions now render one route-aware, tokenized skeleton with the same geometry as the destination instead of a blank frame or generic spinner. The real destination then resolves through one restrained, legible blur-and-rise sequence; fast prefetched routes skip the fallback, reduced motion remains immediate, and focus moves only after the committed page heading exists. AI marks are now reserved for explicit AI entry points, while approvals, notifications, prompts, and queue rows use their actual operational meaning.",
    category: "improvement",
    publishedAt: "2026-08-27",
  },
  {
    id: "work-motion-ownership-repair",
    slug: "work-motion-ownership-repair",
    title: "Every Work story now moves as one coherent system",
    description:
      "Repaired the Work index and all case studies so cards, chapters, proof, calls to action, and standalone media animate when they actually enter the viewport. One shared public observer now owns trigger behavior, while Work supplies one explicit visual recipe; nested card-and-media entrances and inherited homepage timing have been removed. A checked-in architecture contract and stricter browser assertions prevent global motion changes from silently disabling Work again while preserving reduced-motion, delayed-JavaScript, and no-JavaScript access.",
    category: "fix",
    publishedAt: "2026-08-26",
  },
  {
    id: "release-reliability-hardening",
    slug: "release-reliability-hardening",
    title: "Release reliability hardened across the public site and AI workspace",
    description:
      "Centralized date-only formatting on UTC so Learn and Changelog content renders identically on the server and in every visitor time zone. Public reveals now continuously reconcile the current viewport during scroll and responsive layout changes without prematurely consuming below-fold animation. The global AI command shortcut accepts the physical J key consistently across keyboard layouts, ignores key repeat, and retains the same shared workspace and approval boundary. Production-browser coverage exercises all 40 public route patterns and the complete AI workspace at desktop, mobile, dark, and reduced-motion settings.",
    category: "fix",
    publishedAt: "2026-08-26",
  },
  {
    id: "fail-open-public-motion",
    slug: "fail-open-public-motion",
    title: "Public pages now stay visible through every loading path",
    description:
      "Rebuilt the public motion contract so content is present in prerendered HTML and stays readable before hydration, without JavaScript, during back-forward navigation, and with reduced motion. Shared reveals now fail open instead of stranding below-fold content, animated word masks arm only after the client is ready, and the complete Work system uses the same restrained entrance language. The mobile website assistant now behaves as a real modal with safe-area geometry, background isolation, keyboard focus containment, Escape, and focus restoration. Automated coverage verifies the full generated Learn catalog, every Work case, protected-route exclusions, accessibility, mobile and desktop layouts, and real navigation.",
    category: "improvement",
    publishedAt: "2026-08-25",
  },
  {
    id: "operator-grade-ai-workspace",
    slug: "operator-grade-ai-workspace",
    title: "One professional AI workspace for questions, evidence, and control",
    description:
      "AI Command and AI Operations are now one coherent workspace with three views: Ask, Run history, and Capabilities. The existing shared conversation and approval runtime remains authoritative, while the run ledger adds redacted summaries, exact database filters, stable pagination, ordered tool evidence, honest degraded states, linked records, and safe failure responses. The capability view comes from the versioned tool registry and explicitly separates registered policy from live integration readiness. The full public admin demo uses these same components and APIs with detailed fictional runs on desktop and mobile; the old AI Operations URL remains a compatibility route.",
    category: "feature",
    publishedAt: "2026-08-25",
  },
  {
    id: "professional-admin-demo-workspaces",
    slug: "professional-admin-demo-workspaces",
    title: "Three complete businesses in one public Command Center demo",
    description:
      "The full Command Center can now be explored publicly as three detailed fictional businesses: a children's enrichment studio, a roofing and exteriors company, and a growth consultancy. The demo uses the actual admin routes and responsive components rather than a parallel mock dashboard, with populated email, conversations, pipeline, bookings, campaigns, proposals, clients, analytics, integrations, settings, AI operations, and roadmap views. Every action stays inside isolated browser-session state, every workspace has a guided story and exact reset, and the four admin appearances work across desktop and mobile. Server-validated scenario routing keeps the public URL, shared admin shell, and browser runtime synchronized without hydration errors or access to protected admin services. The shorter interactive preview and the complete admin workspace now link to each other clearly.",
    category: "feature",
    publishedAt: "2026-08-25",
  },
  {
    id: "selected-work-portfolio",
    slug: "selected-work-portfolio",
    title: "Selected Work rebuilt as an evidence-led portfolio",
    description:
      "Published six public project stories through one typed, reusable portfolio system, with Northern Trust preserved as an unlisted archive. WORK+SHELTER and SuperDebate receive flagship visual treatment with authentic product and operating-system captures, while every case uses truthful attribution, verified claims, project-specific art direction, responsive media, reduced-motion behavior, and clear connections to current Accelerate services. Search, sitemap, metadata, related work, and archive exclusions all derive from the same visibility contract.",
    category: "feature",
    publishedAt: "2026-08-25",
  },
  {
    id: "booking-restored",
    slug: "booking-restored",
    title: "Booking is live again, on the right calendar",
    description:
      "Every Book a call surface now points at the correct scheduler. The link had been disabled after it was found pointing at an unrelated business while embedded on the contact page and handed out by the website assistant. The contact embed, the roofing embed, the assistant, and the qualifier all read one value, so booking can be turned on or off everywhere at once rather than drifting apart. A signed Calendly booking now reaches the operator queue, and a redelivered booking is recognised as the same meeting instead of notifying twice.",
    category: "fix",
    publishedAt: "2026-08-20",
  },
  {
    id: "house-style-enforced-on-chat",
    slug: "house-style-enforced-on-chat",
    title: "House style enforced on assistant replies",
    description:
      "The website assistant now has its house style enforced as replies stream, not merely requested in its instructions. Prompt rules are guidance a model can drift from; this is applied to the outgoing text itself, while links, hyphenated words, dates, and numeric ranges pass through untouched. The conversation ledger records what was actually sent rather than what was first generated.",
    category: "improvement",
    publishedAt: "2026-08-20",
  },
  {
    id: "autonomous-inbound-responder",
    slug: "autonomous-inbound-responder",
    title: "Approved response policies for inbound inquiries",
    description:
      "Added the ability to acknowledge a new inquiry within seconds without a person in the loop, built as a versioned policy the founder signs rather than an agent that is trusted. The policy fixes its trigger, limits, guardrails, wording, and model; any material change suspends it until the new version is approved. It refuses to act outside a first-touch inquiry, an active contact, a daily and per-contact ceiling, and business hours, and a draft that states pricing, commits to a time, or claims work already done is rejected before anyone reads it. Every refusal is recorded with its reason, not only every send. It ships switched off.",
    category: "feature",
    publishedAt: "2026-08-20",
  },
  {
    id: "ai-tool-contract-enforced",
    slug: "ai-tool-contract-enforced",
    title: "AI tool contracts are now enforced, not advertised",
    description:
      "Tool schemas and impact levels were declared throughout the assistant layer and checked nowhere, so the system was safe only because every write happened to route through the approval queue. Tool calls are now validated against their declared schema before running, a tool marked read-only that tries to stage an action is refused, a tool that should propose but does not is refused, and destructive capability fails closed. Operational snapshots are bounded and now name any data they could not read instead of reporting an empty result as fact.",
    category: "improvement",
    publishedAt: "2026-08-20",
  },
  {
    id: "assistant-run-ledger",
    slug: "assistant-run-ledger",
    title: "Every assistant conversation is now on the record",
    description:
      "The public website assistant is the one place an AI speaks to prospects unattended, and it kept no record of what it said. It now opens a run on the same ledger as the internal copilot, tees the streamed reply into it, and reaches a final state whether the answer completes, the provider fails, or the visitor closes the tab. The copilot also now knows the current date, returns what it gathered instead of discarding the answer when it runs out of steps, and names any actions it left awaiting approval.",
    category: "improvement",
    publishedAt: "2026-08-20",
  },
  {
    id: "operational-alerting",
    slug: "operational-alerting",
    title: "Failures now reach the founder",
    description:
      "Operational failures were visible only inside the admin dashboard, behind a poll, to someone already looking. Job failures, recovered stalls, integration problems, and failed webhook deliveries now send an alert with its own delivery receipt, de-duplicated so a flapping subsystem produces one message rather than fifty. Health reporting was also corrected: it counted only outright failures, so a job stuck mid-run read as healthy, and failed webhook receipts were never read by any surface at all.",
    category: "improvement",
    publishedAt: "2026-08-19",
  },
  {
    id: "campaign-engine-repair",
    slug: "campaign-engine-repair",
    title: "Outbound campaigns can send, recover, and stay within one budget",
    description:
      "Three independent faults meant a member added through the interface could never receive anything, while the scheduled run reported success. Members now carry a resolved contact and a real due time, a send that fails is retried with backoff instead of being terminally stopped, a claim abandoned by a crashed run is recovered rather than stranded, and one account-wide daily ceiling now governs every active campaign instead of each one carrying its own.",
    category: "fix",
    publishedAt: "2026-08-19",
  },
  {
    id: "inquiry-capture-hardening",
    slug: "inquiry-capture-hardening",
    title: "No inquiry is reported saved unless it was",
    description:
      "Several public forms logged a database failure and returned success anyway, so a visitor was told their details were recorded when they were not. Every capture path now checks its write and reports honestly. A booking that produced no notification, caused by writing to a column that does not exist, was also corrected and proven end to end in production.",
    category: "fix",
    publishedAt: "2026-08-19",
  },
  {
    id: "nonprofit-practice",
    slug: "nonprofit-practice",
    title: "A dedicated practice page for nonprofits",
    description:
      "Added a purpose-built page for nonprofit organisations covering donor follow-up, volunteer coordination, grant deadlines, and the operational load that falls on small teams, including the end-to-end command centre built for WORK+SHELTER.",
    category: "feature",
    publishedAt: "2026-08-19",
  },
  {
    id: "gmail-cursor-recovery",
    slug: "gmail-cursor-recovery",
    title: "Gmail sync cursor and recovery semantics",
    description:
      "Gmail synchronization now records a durable history cursor only after a complete bounded run, derives changed threads from Gmail history without duplicate work, and exposes incremental, initial, or recovery mode with honest deferred and failure counts. Expired cursors use a bounded reconciliation path instead of silently skipping work.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "calendar-canonical-association",
    slug: "calendar-canonical-association",
    title: "Calendar events now associate through canonical identity",
    description:
      "Google Calendar synchronization now links a meeting only when exactly one canonical contact matches an attendee, records ambiguous and unmatched cases without guessing, and associates the current opportunity. A confirmed upcoming meeting safely stops pending campaign outreach once without creating or changing an external event or pipeline stage.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "gmail-reply-campaign-stop",
    slug: "gmail-reply-campaign-stop",
    title: "Gmail replies stop campaign follow-up",
    description:
      "Gmail synchronization now uses the shared exact primary/alternate-email resolver and only treats newly recorded inbound messages as reply facts. Those facts enter the canonical campaign-stop service, preserving the same receipt, audit, and send-claim safeguards as unsubscribe and Resend delivery failures.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "campaign-stop-claim-boundary",
    slug: "campaign-stop-claim-boundary",
    title: "Atomic campaign stop and send-claim boundary",
    description:
      "Campaign stop conditions and send claims now serialize on each canonical contact inside PostgreSQL. The claim verifies the contact is active and the campaign is still approved; a stop records terminal eligibility before another due step can claim. A controlled production check proves a stopped membership cannot be claimed.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "canonical-campaign-stop-service",
    slug: "canonical-campaign-stop-service",
    title: "Canonical campaign stop controls",
    description:
      "Campaign suppression now has one Revenue OS service instead of separate unsubscribe, delivery-webhook, and executor writes. It records why pending memberships stopped, preserves activity and audit evidence, and rechecks contact suppression plus campaign approval immediately before a claimed send reaches Resend.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "resend-delivery-ledger",
    slug: "resend-delivery-ledger",
    title: "Resend delivery ledger and campaign suppression",
    description:
      "The canonical sender now adds durable provider idempotency and Revenue OS tags to every Resend message. A signed, replay-safe webhook ledger records delivery outcomes, activity, and audit evidence, while hard bounces, complaints, and provider suppressions immediately prevent later campaign sends. Setup Center now distinguishes basic sending from live delivery feedback and documents the one Resend webhook configuration step.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "atomic-revenue-job-claims",
    slug: "atomic-revenue-job-claims",
    title: "Atomic claims for scheduled Revenue OS work",
    description:
      "Added one database-owned claim path for scheduled and on-demand Revenue OS jobs. Concurrent invocations now return the existing running receipt, while repeated deterministic keys return their completed receipt instead of starting a second execution. Cron and Workspace sync routes expose an honest skipped result when another worker already owns the job.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "revenue-schema-contract-verification",
    slug: "revenue-schema-contract-verification",
    title: "Verified Revenue OS schema contract",
    description:
      "Added a versioned, read-only production schema verifier and immutable verification receipts. It checks required tables, columns, constraints, indexes, PostgreSQL functions, and service-only policies; clearly reports unapplied migrations, metadata drift, or connectivity failure; and makes Setup Center show the exact verified contract version and latest successful check instead of trusting a single table query.",
    category: "improvement",
    publishedAt: "2026-08-17",
  },
  {
    id: "approval-gated-ai-contact-import",
    slug: "approval-gated-ai-contact-import",
    title: "OpenRouter contact cleanup and approval import",
    description:
      "Added one founder-only Contact Import workspace for pasted lists, CSV, TSV, JSON, and messy notes. OpenRouter proposes normalized contacts, deterministic identity checks identify new versus existing records, and a literal-evidence guard strips unsupported AI fields before low-confidence or ambiguous rows default to excluded. The founder edits and approves an exact digest-bound snapshot before canonical writes; execution creates row-level receipts and safe partial retry without creating opportunities, campaigns, tasks, or messages. Standardized every active AI caller on one server-only OpenRouter gateway, configured encrypted production AI and cron credentials, applied and idempotently verified all pending production schemas, reached 100% required Setup readiness, and added a Keychain-backed migration command so future agents own migration execution through live verification.",
    category: "feature",
    publishedAt: "2026-08-16",
  },
  {
    id: "revenue-os-agent-contract",
    slug: "revenue-os-agent-contract",
    title: "Universal agent engineering contract",
    description:
      "Codified one repository-wide framework for canonical data ownership, domain-service writes, automation claims and receipts, AI tool impact and confirmation, governed learning, failure semantics, verification, ticket pickup, evidence, and recovery. Added a core Revenue OS module map and a machine verifier that rejects thin or contradictory managed-card handoffs before implementation begins.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "admin-command-center-recovery",
    slug: "admin-command-center-recovery",
    title: "Professional Command Center recovery",
    description:
      "Rebuilt the admin interaction foundation around one responsive route registry, persisted collapsible sidebar, consistent entry motion, complete light/dark tokens, and one accessible portal dialog used by every modal and drawer. Restored Email Studio with editable drafts, rendered previews, explicit publishing, sent-message history, and compose handoff. Reworked Feature Board pointer/keyboard drag behavior and added one canonical compatibility bridge across Leads, Contacts, Chat, Clients, Subscribers, Resources, Partners, and Website Grades, including a unified person timeline and Pipeline deep-links. Verified all 25 registered admin routes at desktop and phone widths with Playwright.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "money-first-inbound-outreach",
    slug: "money-first-inbound-outreach",
    title: "Money-first inbound and outreach safety",
    description:
      "Contact, chat, and roofing inquiries now feed one canonical revenue loop with same-day follow-up. The contact page uses manual scheduling while Calendly is disabled. Campaign email adds durable idempotency, founder reply-to, one-click unsubscribe, immediate suppression, and a server-enforced one-step/10-per-day pilot limit.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "canonical-inbound-revenue-loop",
    slug: "canonical-inbound-revenue-loop",
    title: "Qualified inbound requests now enter the revenue work queue",
    description:
      "A roofing audit request now creates or enriches one canonical contact, company, and opportunity; retains source attribution; records an activity receipt and stage history; and creates a deduplicated same-day follow-up task for qualified prospects. The original nurture sequence remains non-blocking, so a delivery issue cannot lose the lead.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "turn-key-first-party-analytics",
    slug: "turn-key-first-party-analytics",
    title: "Turn-key first-party revenue analytics",
    description:
      "Analytics now works without a Plausible or other third-party analytics account. The public site records privacy-minimised page views and conversion events server-side, while the founder workspace keeps that traffic context separate from the canonical opportunity, source, stage, and won-revenue funnel. Missing attribution and an unapplied event schema are visibly flagged rather than shown as healthy zeroes.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
  {
    id: "opportunity-provenance-ledger",
    slug: "opportunity-provenance-ledger",
    title: "Opportunity provenance from creation",
    description:
      "New opportunities now write an initial pipeline-stage event and canonical activity receipt at creation, preserving their origin, linked identity, starting stage, and value for future timelines and agent context.",
    category: "improvement",
    publishedAt: "2026-08-16",
  },
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
