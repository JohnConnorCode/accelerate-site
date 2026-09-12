import type { FAQ } from "@/lib/types";

export const commandCenterFaqs: FAQ[] = [
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
      "Yes. Branding lets you preview colors, typography, corners and depth, then save a custom workspace theme. You can import or export its portable definition, or ask a configured AI connection to prepare a theme for approval. Text contrast is validated before saving. One custom theme is stored per workspace; each person chooses their appearance on their device. Demo business preferences are separate, so an open demo cannot reset your live workspace choice.",
  },
  {
    question: "How does the whole system fit together?",
    answer:
      "Accelerate moves business context from source data to canonical records, attention signals, reviewed work, validated execution, and recorded results. The Command Center, AI assistant, MCP clients, integrations, scheduled jobs, and coding agents reach that same runtime through different interfaces. Read the public How Accelerate works guide for the five layers, object model, approval boundary, plugin and App extension paths, and failure recovery.",
  },
  {
    question: "Can I undo a bulk contact change?",
    answer:
      "Bulk actions report each contact's result. Successful changes stay saved if another contact fails. You can deliberately remove a tag with Untag, but there is no one-click restoration of a whole batch. Suppression is not automatically reversed. For example, retry a failed draft enrollment after correcting the problem; contacts already enrolled are skipped. The Leads guide includes a worked example.",
  },
  {
    question: "Does Site Studio publish a page when I create a draft?",
    answer:
      "No. Creating, applying an AI suggestion and saving all keep the work private. The installation owner separately reviews and publishes a saved website revision. For example, create a bookkeeping page, choose Muse Spark 1.3 or browse current models by provider and price, review the copy and phone preview, save, then review publication. History supports rollback. Private tenant drafts remain separate. The Site Studio guide explains costs, recovery and importing content into your own installation.",
  },
  {
    question: "What does a complete delivery handoff mean?",
    answer:
      "It means the handoff created its onboarding tasks, not that the customer work is finished. Review the customer, template and optional proposal before confirming a won opportunity's handoff. Then assign and complete the resulting tasks as work happens. If creation stops partway through, inspect the receipt and retry: the same engagement and existing tasks are retained. The client accounts guide walks through an example.",
  },
  {
    question: "How do Today and Work fit together?",
    answer:
      "Today is a customizable daily workspace: save personal or shared arrangements of your business brief, decisions, commitments, coworker progress and enabled App follow-up. It offers useful starting points even when there is little content. Work provides task editing and the same approvals. Both use the same saved records and services; task changes and approved proposals share the executor, with atomic local results and recovery receipts. Apps retain their own lifecycles. AI interpretations cite source facts and disappear when those facts change.",
  },
  {
    question: "Can we build a completely different App or interface?",
    answer:
      "Yes. The open-source platform can be extended with domain records, custom lifecycles, native queues, integrations, AI tools and bespoke screens. Existing settings handle supported configuration; broader changes require code today. Reuse the shared customer identity, permissions and execution history while building the process your business needs. The public customization and extension guides explain both paths.",
  },
  {
    question: "Can AI create Apps inside Command Center?",
    answer:
      "That is a planned capability. The intended flow is to describe an App, preview an isolated draft, inspect its code and requested access, verify it, and publish a version that can be updated or rolled back. Today a coding assistant can build source changes through the repository's development and review workflow; the general-purpose in-app builder and development terminal are not yet available.",
  },
  {
    question: "Can I point any coding agent at the backlog?",
    answer:
      "Yes. A plain-language request such as “pick up work from the backlog and go until it is completed and committed; follow protocol” is enough. The repository entrypoint resolves the configured private transport, chooses one eligible task, creates its approved isolated worktree, supplies the full acceptance packet, and keeps the agent moving through verification, commit and evidence submission. The agent does not need a ticket key or a special provider-specific command, and it does not ask you to paste credentials.",
  },
  {
    question: "Where can I explore the bundled plugins?",
    answer:
      "The public documentation includes individual guides for all eleven bundled plugins, with fictional examples, setup steps, approval requirements, costs and recovery instructions. Start at /docs/plugins to explore reports, invoice workflows, Collections and Opportunity Radar, then adapt the open-source examples to your business.",
  },
  {
    question: "What can Opportunity Radar do today?",
    answer:
      "It keeps supplied sources, reviewed business opportunities, relationship evidence, and drafts together. You review exact changes before saving. Source briefing can use an explicitly configured model budget, with spending off by default. Reviewed outreach uses the configured sender only after an exact human approval, with cooldowns and receipt recovery. Automated discovery, publication, and verified outcome measurement are still being built. The fictional demo lets you try the review workflow without provider calls.",
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
      "Yes. Each tenant can use the shared provider configuration or bring its own OpenRouter API key and approved model settings. Keys stay server-side, and the workspace keeps provider and usage behavior inside the tenant boundary.",
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
