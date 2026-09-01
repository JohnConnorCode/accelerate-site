import type { FAQ } from "@/lib/types";

export interface OpenSourcePath {
  id: string;
  eyebrow: string;
  title: string;
  scope: string;
  description: string;
  included: string[];
  ctaText: string;
  ctaHref: string;
  external?: boolean;
}

export const OPEN_SOURCE_PATHS: OpenSourcePath[] = [
  {
    id: "self-hosted",
    eyebrow: "Path one",
    title: "Run it yourself.",
    scope: "Free, MIT licensed",
    description:
      "Clone the repository, connect your own Supabase project, and run the same Command Center codebase behind our own agency. You own the code, the database, and any AI provider key you connect.",
    included: [
      "The complete source, MIT licensed",
      "CRM, pipeline, inbox, campaigns, proposals, and analytics in one application",
      "AI operations with approval gates and an audit trail, using your own OpenRouter key",
      "Documentation for migrations, tenancy, and the security model",
      "A public roadmap, with acceptance criteria for every planned change",
    ],
    ctaText: "View the repository",
    ctaHref: "https://github.com/JohnConnorCode/accelerate-site",
    external: true,
  },
  {
    id: "managed",
    eyebrow: "Path two",
    title: "We build and run it for you.",
    scope: "Scoped on a strategy session",
    description:
      "The same system, configured for how your team already works, deployed on infrastructure we manage, and kept running by the people who wrote it. This is managed execution, the same offer behind every Accelerate engagement, applied to this product.",
    included: [
      "Your own isolated workspace, configured around your existing tools",
      "Migrations, updates, and monitoring handled for you",
      "Integrations connected: Google Workspace, Resend, Calendly, and the rest of your stack",
      "Direct support from the engineers who built it, not a support queue",
      "Training for your team and ongoing improvement as the business changes",
    ],
    ctaText: "Book a free strategy session",
    ctaHref: "/contact",
  },
];

export const openSourceFaqs: FAQ[] = [
  {
    question: "Is this the same product Accelerate runs internally?",
    answer:
      "Yes. This is the actual application code behind a working business, not a stripped-down version prepared for GitHub.",
  },
  {
    question: "What does self-hosting actually require?",
    answer:
      "Node.js, a Supabase project you control, and running the documented migrations. A one-click deploy path that removes the terminal step entirely is on the public roadmap now.",
  },
  {
    question: "Can I self-host it now and bring you in later?",
    answer:
      "Yes. Self-hosting and a managed build are not a one-time fork in the road. You can start on your own and bring us in later for a specific integration, a migration, or to take operating it off your plate entirely.",
  },
  {
    question: "How is this different from your other services?",
    answer:
      "The underlying offer does not change. Strategy, custom builds, integrations, managed execution, and training are the same things we do for every engagement. Open-sourcing the Command Center just gives you a second way to start: read the code first, or start with a conversation.",
  },
  {
    question: "Do I need to be a developer to use this?",
    answer:
      "To self-host it, yes, someone on your team needs to be comfortable with a terminal and a database. The managed path exists for teams without that person.",
  },
];
