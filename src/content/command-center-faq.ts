import type { FAQ } from "@/lib/types";

export const commandCenterFaqs: FAQ[] = [
  {
    question: "Can I edit my website from ChatGPT?",
    answer:
      "Yes, after your installer configures the owner-only Site Studio OAuth connection. It can read and edit website content, prepare an exact preview, save drafts, publish and restore revisions through the same editor services. Access lasts 30 days and can be revoked in Site Studio. ChatGPT manages write confirmations; the server records delegated authority and execution receipts. Ordinary workspace MCP keys remain proposal-only, and the website connection cannot operate other workspace tools.",
  },
  {
    question: "Can I run the workspace for my own business?",
    answer:
      "Yes. Export the neutral starter into a new directory, replace its fictional Harbor Operations configuration with your business details, then connect services you control. It keeps the shared workspace and demo while removing protected agency media and original hosting targets. The self-hosting guide explains the export receipt, installation and recovery.",
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
      "Yes. Open the demo, preview how an inquiry moves through an AI draft to a reviewed result, then explore one of six fictional businesses. Try the demo opens Northline Roofing directly, with no signup required. The full workspaces use sample records and simulated actions saved in your browser session.",
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
      "The public documentation includes individual guides for all fourteen bundled plugins, with fictional examples, setup steps, approval requirements, costs and recovery instructions. Start at /docs/plugins to explore reports, invoice workflows, Collections, Opportunity Radar, Social Marketing, subscriptions and the form builder, then adapt the open-source examples to your business.",
  },
  {
    question: "What can Opportunity Radar do today?",
    answer:
      "It keeps supplied sources, reviewed business opportunities, relationship evidence, and drafts together, and you review exact changes before anything saves. Source briefing can use a model budget you set explicitly, with spending off by default. Reviewed outreach uses the configured sender only after an exact human approval, with cooldowns and receipt recovery. Automated discovery, publication, and verified outcome measurement are still being built. The fictional demo lets you try the review workflow without provider calls.",
  },
  {
    question: "What stops it doing something stupid on my behalf?",
    answer:
      "Nothing it writes leaves the building until you approve it. That is how it ships on day one and it stays that way until you change it, one category of work at a time. You can also turn any single part of it off in a click.",
  },
  {
    question: "Do I have to learn new software?",
    answer:
      "We build it around the way you already work and hand it over running. Your team is trained on whatever they touch. You are not handed a blank app and a login.",
  },
  {
    question: "Our records are a mess. Should we clean them up first?",
    answer:
      "No. Waiting to tidy up is the single most common reason this never gets started. It reads what already exists, flags the duplicates for you to settle, and improves the rest as it goes.",
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
      "A notetaker gives you a transcript and a summary, and you still do the work. This reads the same call and then drafts the follow-up, updates the deal, and books the next step, and it holds all of it for your approval. The transcript is the raw material, not the product.",
  },
  {
    question: "What does it cost, and how long does it take?",
    answer:
      "The session and the written plan are free. The build is a fixed price agreed before anything starts, and ongoing support is optional. Something is running inside a couple of weeks, and because it loads your history first, there is work waiting in the queue the first morning you log in.",
  },
];
