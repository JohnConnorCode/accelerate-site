import type { FAQ } from "@/lib/types";

export const commandCenterFaqs: FAQ[] = [
  {
    question: "How does the workspace learn from a correction?",
    answer:
      "An edited reply or explicit correction can create a proposal in Learning Inbox. You review its scope and approve it, then relevant later work receives the saved rule with a source receipt. Independent rules remain active together. Add private reference documents when the missing piece is information, and inspect execution failures when a service needs repair. A successful action or saved rule alone does not prove that quality improved; compare later results with the original example.",
  },
  {
    question: "Can I edit my website from ChatGPT?",
    answer:
      "Yes, after your installer configures the owner-only Site Studio OAuth connection. It can read and edit website content, prepare an exact preview, save drafts, publish and restore revisions through the same editor services. Access lasts 30 days and can be revoked in Site Studio. ChatGPT manages write confirmations; the server records delegated authority and execution receipts. Ordinary workspace MCP keys remain proposal-only, and the website connection cannot operate other workspace tools.",
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
    question: "Can I navigate boards without dragging cards?",
    answer:
      "Yes. Scroll across the columns, or press Tab to a column button and press Enter. The board itself takes keyboard focus for arrow-key scrolling, and reduced motion makes the column jumps instant. Refreshing or closing an editor keeps your place, and browser Back returns you to the pipeline board.",
  },
  {
    question: "Can I actually work with clients in the demo?",
    answer:
      "Yes. Search or filter clients, open an account, save notes and add a follow-up. Open the saved follow-up in Tasks & approvals or follow a contact timeline to its specific conversation or opportunity. Changes persist in that fictional business session and never contact customers.",
  },
  {
    question: "Can I try Command Center before setting it up?",
    answer:
      "Yes. Choose one of six fictional businesses in the demo chooser. Each opens the real workspace with sample customers, conversations and tasks. No signup is required, and simulated changes stay in your browser session. The workflow recipes explain how to combine features and plugins in a connected workspace.",
  },
  {
    question: "Can we create our own workspace theme?",
    answer:
      "Yes. Branding lets you preview colors, typography, corners and depth, then save a custom workspace theme. You can import or export its portable definition, or ask a configured AI connection to prepare a theme for approval. Text contrast is validated before saving. One custom theme is stored per workspace; each person chooses their appearance on their device. Eight built-in appearances have distinct palettes, typography, corners and depth, including matte Material and silver macOS. Comfortable and compact density adjust spacing independently of the theme. Mobile panels keep consistent spacing, touch controls stay easy to reach, and transitions respect reduced motion. Demo business preferences are separate, so an open demo cannot reset your live workspace choice.",
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
      "Today puts decisions and follow-up first, then business changes and operational alerts. Pipeline facts, upcoming commitments and automation are supporting context. Automation details and completed results expand on demand. Customize preserves personal or shared arrangements; More contains view creation, duplication, deletion and the classic-view recovery option. Work provides task editing and the same approvals. Both use the same saved records and services; Apps retain their own lifecycles. AI interpretations cite source facts and disappear when those facts change.",
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
      "AI-proposed changes go through the shared approval process. You review the target and exact change, and execution checks current permissions and source state. External sends and other consequential operations retain required human approval. Internal autonomy depends on the action’s policy, and you can disable optional modules or plugins.",
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
    question: "Where does our data live?",
    answer:
      "The Command Center uses shared infrastructure with explicit tenant isolation. Your workspace has its own membership boundary, tenant-scoped records, provider configuration, and audit trail. You own the data and can export it whenever you want.",
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
    "Can I try Command Center before setting it up?",
    "Can we build a completely different App or interface?",
    "Can AI create Apps inside Command Center?",
    "Where does our data live?",
    "How do we control what AI can do?",
    "What does it cost, and how long does it take?",
  ].includes(faq.question),
);
