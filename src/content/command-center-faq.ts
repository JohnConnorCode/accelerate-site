import type { FAQ } from "@/lib/types";

export const commandCenterFaqs: FAQ[] = [
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
    question: "Where can I explore the bundled plugins?",
    answer:
      "The public documentation includes individual guides for all ten bundled plugins, with fictional examples, setup steps, approval requirements, costs and recovery instructions. Start at /docs/plugins to explore reports, invoice workflows, Collections and Opportunity Radar, then adapt the open-source examples to your business.",
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
