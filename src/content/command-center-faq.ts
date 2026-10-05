import type { FAQ } from "@/lib/types";

export const commandCenterFaqs: FAQ[] = [
  {
    question: "Can I run work by talking to an agent?",
    answer:
      "Yes. Ask AI and authenticated member MCP connections can read records, prepare exact changes and start an ordered job with saved progress. Review proposals inside chat, or open the focused review link from an external agent. Background work needs an active scheduler and a finite AI call budget. You can pause, resume or cancel future steps. Interrupted work keeps its receipts for reconciliation instead of replaying effects.",
  },
  {
    question: "What can the agent do without asking every time?",
    answer:
      "You can approve bounded permission for tasks, notes, contact tags, opportunity next actions and open pipeline stages. Permission names the records, allowed fields, expiry and daily limit. Current membership and policy are checked before execution. A change outside those limits stays pending for review. Messages, publishing, billing, deletion and permission changes still require a human decision.",
  },
  {
    question: "Is the demo agent real AI?",
    answer:
      "When the dedicated demo inference service is configured and its shared $5 daily budget is available, a real model responds to your request using fictional records. Business effects remain simulated in your browser session. There is no real email, billing or publishing. Usage and model information come from the actual run. An unavailable service displays an error instead of a fabricated answer.",
  },
  {
    question: "What do the Revenue figures measure?",
    answer:
      "Monthly Recurring sums current active client agreements. The start-month chart groups those same contracts in UTC, keeps missing dates visible and ends at that total. Churned Share describes current non-onboarding client records across all recorded dates. Opportunity values, one-time agreement values and accepted proposal monthly values remain separate. If a read is incomplete or fails, use Retry; a failed refresh labels the previous figures. Check provider receipts when you need collected cash, and a dated ledger when you need historical revenue.",
  },
  {
    question: "Where do I find invoices and create a new one?",
    answer:
      "With Stripe invoicing enabled, open Invoices directly from the sidebar or the mobile Menu, then choose Create invoice. Search also finds Create invoice; if invoicing is off, search for invoice and choose Set up invoicing to reach its enable switch in Apps. A disconnected account shows the Stripe connection step first. Choose an existing customer, enter line items and review the draft before requesting approval.",
  },
  {
    question: "What should I do when an inquiry update needs attention?",
    answer:
      "Read the named result in Leads because part of the change may already be saved. Use Retry incomplete updates to finish the affected records; successful rows remain saved. A new inquiry whose setup is incomplete stays in its original form with Retry setup, while an uncertain save offers Retry save. Retrying the same change reuses its existing follow-up or client engagement. Check the linked Pipeline record after recovery, and review an identity conflict or stale change before trying again.",
  },
  {
    question: "Can I change collection follow-up from Ask AI?",
    answer:
      "Yes. With Collections and Stripe invoicing enabled, ask for a case pause, dispute, payment promise, owner or next action. The assistant checks the selected case and its current invoices, then proposes the exact change for your approval. Review it in Collections or the approval queue. A changed balance, recipient or policy requires another preview. The policy change does not send a reminder; prepare and approve that separately. Invoice tracking and refresh still use the Collections workspace.",
  },
  {
    question: "When is a debate actually booked?",
    answer:
      "Use Debate productions in Bookings to confirm each commitment separately. Topic interest or a proposed counterpart does not establish agreement. An approved invitation is sent to the two saved participants after their inbound acceptances are reviewed. Check the live Google event, its time and attendees, any requested Meet link, and both participants' responses. Today shows the first missing or disputed step, while the scheduled work engine rechecks linked invitations when configured.",
  },
  {
    question: "Can my team sign in with Google?",
    answer:
      "Yes, once the installer enables Google in Supabase Auth and configures its OAuth client. The sign-in screen then shows Continue with Google alongside email and password. Google confirms identity; active workspace membership still determines who can open a workspace. This sign-in setup is separate from connecting Google Workspace data such as Gmail, Calendar or Drive.",
  },
  {
    question: "Can I install Command Center on my computer or phone?",
    answer:
      "Yes. On the dedicated Command Center app origin, an authenticated workspace can be added to a supported browser's desktop, dock or home screen and opened as a focused app. The installed shell keeps your tenant context, works responsively on mobile, and reports when it is offline or has an update ready. Offline mode is deliberately limited: it can show an approved low-risk summary and save non-sensitive drafts on that device, but it never queues a live action or sends data silently. Saved drafts can be read and reused. Sign-out waits for local cleanup and offers recovery guidance if the browser cannot confirm it. The public marketing site and AI Readiness assessment stay normal browser pages.",
  },
  {
    question: "How does the workspace learn from a correction?",
    answer:
      "An edited reply or explicit correction can create a proposal in Learning Inbox. You review its scope and approve it, then relevant later work receives the saved rule with a source receipt. Independent rules remain active together. Add private reference documents when the missing piece is information, and inspect execution failures when a service needs repair. A successful action or saved rule alone does not prove that quality improved; compare later results with the original example.",
  },
  {
    question: "Can Ask AI check the content calendar?",
    answer:
      "Yes. With the Content module enabled, Ask AI can list the five most recently added calendar items by exact status or category and reports when more match. Ask AI and connected MCP clients can also propose an exact edit for administrator review in Approvals. It can prepare a grounded editorial brief from a title and optional keywords or category when an AI provider is configured. The brief is working copy; review it and add it to the calendar from Content.",
  },
  {
    question: "Can I edit my website from ChatGPT?",
    answer:
      "Yes, after your installer configures and verifies the owner-only Site Studio OAuth connection. Check OpenAI’s current connection instructions for account eligibility and client support. It can read and edit website content, prepare an exact preview, save drafts, publish and restore revisions through the same editor services. Access lasts 30 days and can be revoked in Site Studio. A separate workspace OAuth connection exposes registered workspace tools, with business changes staged for approval. Workspace MCP keys cannot be pasted into ChatGPT.",
  },
  {
    question: "Can I run the workspace for my own business?",
    answer:
      "Yes. Fork the complete repository: it starts with a neutral Command Center homepage, the full workspace, and fictional demos. Explore without credentials, then follow guided setup to connect your own Supabase project and owner account. Save a contact and task before connecting optional email or AI providers. Fork deployments include no scheduled jobs by default. Edit or replace the homepage in Site Studio. Agency content remains in the source and is disabled unless you explicitly enable the branded profile. A separate export remains available when you want to omit protected agency assets entirely. The self-hosting guide explains setup and recovery.",
  },
  {
    question: "If I change what it is allowed to do, do I have to approve it again?",
    answer:
      "Yes. Changing the level, the limits, or where a permission came from clears the standing approval, so a person approves it again. Changing only a label or description keeps the decision. A few actions stay behind a human decision permanently, no matter how much trust everything else has earned.",
  },
  {
    question: "Why do some agent findings never reach my queue?",
    answer:
      "Autonomous work checks a proposal before it reaches you, because a queue that cannot explain itself trains you to dismiss it. Each proposal is scored for usefulness, how well it is evidenced, how much attention it costs, and whether it needs checking before anyone is interrupted. It is then surfaced with that reason, checked further without interrupting you, or held back with a recorded receipt you can find in Activity. Nothing you asked for directly is ever held back, and if the check itself cannot run the proposal is queued anyway, so a broken heuristic cannot quietly lose real work. A workspace can also set a usefulness threshold; a workspace with no threshold keeps the previous behavior.",
  },
  {
    question: "Can I navigate boards without dragging cards?",
    answer:
      "Yes. Scroll across the columns, or press Tab to a column button and press Enter. The board itself takes keyboard focus for arrow-key scrolling, and reduced motion makes the column jumps instant. Refreshing or closing an editor keeps your place, and browser Back returns you to the pipeline board.",
  },
  {
    question: "Can I actually work with clients in the demo?",
    answer:
      "Yes. Search or filter clients, open an account, save notes and add a follow-up. Open the saved follow-up in Work or follow a contact timeline to its specific conversation or opportunity. Changes persist in that fictional business session and never contact customers.",
  },
  {
    question: "Can I try Command Center before setting it up?",
    answer:
      "Yes. Choose one of six fictional businesses in the demo chooser. Each opens the real workspace with sample customers, conversations and tasks. No signup is required, and simulated changes stay in your browser session. The workflow recipes explain how to combine features and plugins in a connected workspace.",
  },
  {
    question: "What should I connect first?",
    answer:
      "Explore a fictional business in the demo first. For your own installation, connect the database and owner account, then save a contact and a task and confirm they remain after a reload. Add Gmail, Calendar, AI or payments when a specific workflow needs them. Setup shows which connections have a successful result, while the public guides walk through the first task and recovery.",
  },
  {
    question: "Can we create our own workspace theme?",
    answer:
      "Yes. Branding lets you preview colors, typography, corners and depth, then save a custom workspace theme. You can import or export its portable definition, or ask a configured AI connection to prepare a theme for approval. Text contrast is validated before saving. One custom theme is stored per workspace; each person chooses their appearance on their device. Nine built-in appearances have distinct palettes, typography, corners and depth, including matte Material, silver macOS and the Capy-inspired graphite-and-seafoam theme. Comfortable and compact density adjust spacing independently of the theme. Mobile panels keep consistent spacing, touch controls stay easy to reach, and transitions respect reduced motion. Demo business preferences are separate, so an open demo cannot reset your live workspace choice.",
  },
  {
    question: "How does the whole system fit together?",
    answer:
      "Accelerate moves your business context from its source systems into records, attention signals, reviewed work, and recorded results. The Command Center, the AI assistant, connected MCP clients, integrations, scheduled jobs, and coding agents all reach that same runtime through different doors. The public How Accelerate works guide covers the layers, the object model, the approval boundary, and failure recovery.",
  },
  {
    question: "Can I undo a bulk contact change?",
    answer:
      "Bulk actions report each contact's result, and the ones that succeeded stay saved even if another row fails. You can remove a tag with Untag, but there is no one-click restore of a whole batch, and suppression is not reversed automatically. If a draft enrollment failed, correct the cause and retry: contacts already enrolled are skipped. The sources guide includes a worked example.",
  },
  {
    question: "Can the AI change my live website without me?",
    answer:
      "No. Creating a draft, applying an AI suggestion, and saving all keep the work private, and an installation owner reviews and publishes a saved revision separately. You can preview the copy at phone and desktop widths, choose a model by provider and price, and roll back from history. Private drafts stay separate from the published site.",
  },
  {
    question: "What does a completed delivery handoff actually mean?",
    answer:
      "It confirms the handoff created its onboarding tasks. The customer work still has to happen: review the customer, the template, and any proposal before you confirm a won opportunity, then assign and complete the tasks as the work happens. If creation stops partway, inspect the receipt and retry, and the same engagement and its existing tasks are kept.",
  },
  {
    question: "How do Today and Work fit together?",
    answer:
      "Today puts sourced decisions and follow-up first, then business changes and operational alerts. Pipeline facts, upcoming commitments and automation are supporting context. Automation details and completed results expand on demand. More contains view customization, creation, duplication, deletion and the classic-view recovery option. Search and Ask AI stay available in the desktop workspace toolbar. Work opens on your open tasks, with team work one filter away; saved views sit behind Save view. It provides task editing, dated snooze and the same approvals, with list, board and calendar layouts over the same saved tasks. The list supports j/k movement and keyboard review. Ask AI can also prepare task reopening and description edits; review the proposal in Approvals, then check its recorded result. Layout, fields and filters stay in this browser and are separated by workspace and signed-in member. Both use the same saved records and services; Apps retain their own lifecycles. AI interpretations cite source facts and disappear when those facts change.",
  },
  {
    question: "Can we build a completely different App or interface?",
    answer:
      "Yes. The open-source platform can be extended with new record types, lifecycles, queues, integrations, AI tools, and working screens that reuse your existing customer identity, permissions, and history. Settings cover the supported configuration today, and deeper changes use code. The public customization and extension guides explain both paths.",
  },
  {
    question: "Can AI create Apps inside Command Center?",
    answer:
      "That is a planned capability. The intended flow is to describe an App, preview an isolated draft, inspect its code and requested access, verify it, and publish a version that can be updated or rolled back. Today a coding assistant can build source changes through the repository's development and review workflow; the general-purpose in-app builder and development terminal are not yet available.",
  },
  {
    question: "Can I point any coding agent at the backlog?",
    answer:
      "Yes. A plain request such as “pick up work from the backlog and go until it is completed and committed; follow protocol” is enough. The agent picks one eligible task, prepares its own isolated copy of the code, and carries it through verification, commit, and evidence submission without a ticket key or a provider-specific command. It never asks you to paste credentials, and an interrupted run can be resumed from its saved state.",
  },
  {
    question: "Where can I explore the bundled plugins?",
    answer:
      "The public documentation includes individual guides for bundled plugins, with fictional examples, setup steps, approval requirements, costs and recovery instructions. Start at /docs/plugins to explore reports, invoice workflows, Collections, Opportunity Radar, Social Marketing, subscriptions and the form builder, then adapt the open-source examples to your business.",
  },
  {
    question: "What can Opportunity Radar do today?",
    answer:
      "It keeps supplied sources, reviewed business opportunities, relationship evidence, and drafts together, and you review exact changes before anything saves. Source briefing can use a model budget you set explicitly, with spending off by default. Reviewed outreach uses the configured sender only after an exact human approval, with cooldowns and receipt recovery. Automated discovery, publication, and verified outcome measurement are still being built. The fictional demo lets you try the review workflow without provider calls.",
  },
  {
    question: "How do we control what AI can do?",
    answer:
      "AI-proposed changes go through the shared approval process. If you ask Ask AI to email someone, it can stage the exact message in the conversation and directs you to Work to check the recipient and wording. Approval and execution have separate results, so inspect the receipt after approving. External sends and other consequential operations retain required human approval. Internal autonomy depends on the action’s policy. Supported branding, optional module and workspace configuration changes have exact previews and require human approval. Provider secrets, Google consent and one-time keys stay in secure human setup.",
  },
  {
    question: "Do I have to learn new software?",
    answer:
      "Start with one familiar job, such as following up on an inquiry. The demo and recipes show which screens and records are involved. You can configure and self-host the platform, or work with Accelerate to implement the workflow and train your team.",
  },
  {
    question: "Our records are a mess. Should we clean them up first?",
    answer:
      "Start with a small set of records you can verify. Contact imports support a review batch, and ambiguous identities need a person’s decision. Connect sources incrementally and check their processing results before relying on the available context.",
  },
  {
    question: "We bought an AI tool last year and nobody used it.",
    answer:
      "Usually the tool was fine and there was no rule about when to use it. This one gives you one place to go each morning and a short list of decisions sitting there. If that is not going to change anything for you, we would rather work that out on the session than after you have paid for a build.",
  },
  {
    question: "Can we keep our customization when core updates arrive?",
    answer:
      "Saved branding, appearance and website revisions belong to your installation, alongside your business records and provider settings. Fork hosting uses a local configuration file. The repository's fork:check command inspects a fetched source update without applying it and reports conflicts, unfinished work and legacy configuration edits. Custom modules use their own source paths and regenerated registrations. Back up and verify migrations, plugins and providers before deploying; a reduced export with independent Git history follows the manual adoption guide.",
  },
  {
    question: "Where does our data live?",
    answer:
      "A managed Command Center uses tenant-scoped records, active membership and an audit trail to separate business workspaces. A self-hosted installation uses the database and provider accounts you control. For a managed implementation, agree on export, backup and handoff responsibilities in the written scope.",
  },
  {
    question: "Can we control our AI provider costs?",
    answer:
      "Yes. Each workspace can use the shared provider setup or bring its own OpenRouter key and approved model settings. DeepSeek V4.1 Flash is the default and can be changed per installation or request. Keys stay server-side, and usage stays inside your workspace.",
  },
  {
    question: "How is this different from the notetaker we already have?",
    answer:
      "Command Center connects customer records, conversations, opportunities and tasks. A supported transcript source can contribute context, while Meeting commitments turns an explicitly entered checklist into reviewed tasks. The useful result is assigned follow-up linked to its source. Automatic extraction or booking depends on the specific implemented workflow and connections.",
  },
  {
    question: "What does it cost, and how long does it take?",
    answer:
      "Explore the fictional demo without an account. Self-hosting uses infrastructure and provider accounts you control, with their normal usage costs. For implementation help, start with a discovery session and written plan; scope, price and timing are agreed around the workflow and connections your business needs.",
  },
];

/** The buying questions shown on the product page and in its structured data. */
export const productFaqs = commandCenterFaqs.filter((faq) =>
  [
    "What do the Revenue figures measure?",
    "Can I try Command Center before setting it up?",
    "What should I connect first?",
    "Can Ask AI check the content calendar?",
    "Can we build a completely different App or interface?",
    "Can AI create Apps inside Command Center?",
    "Where does our data live?",
    "How do we control what AI can do?",
    "What does it cost, and how long does it take?",
  ].includes(faq.question),
);
