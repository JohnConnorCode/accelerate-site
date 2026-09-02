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
      "Clone the repository, connect your own Supabase project, and run the same Command Center codebase behind our own agency. You own the code, the database, and any AI provider key you connect. Nothing phones home to us.",
    included: [
      "The complete source, MIT licensed, no seat limits or usage tiers",
      "CRM, pipeline, inbox, campaigns, proposals, and analytics in one application",
      "AI operations with approval gates and an audit trail, using your own OpenRouter key",
      "37 ordered database migrations and full documentation for tenancy and security",
      "A public roadmap, with acceptance criteria written out for every planned change",
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
      "Migrations, updates, security patches, and monitoring handled for you",
      "Integrations connected: Google Workspace, Resend, Calendly, and the rest of your stack",
      "Direct support from the engineers who built it, not a support queue",
      "Training for your team and ongoing improvement as the business changes",
    ],
    ctaText: "Book a free strategy session",
    ctaHref: "/contact",
  },
];

export interface OpenSourceStat {
  value: string;
  label: string;
  detail: string;
}

/** Verifiable facts about the codebase, not illustrative figures. Recompute
    against the repo before changing a number here. */
export const OPEN_SOURCE_STATS: OpenSourceStat[] = [
  { value: "37", label: "Ordered migrations", detail: "Every schema change, in sequence" },
  { value: "119", label: "Automated checks", detail: "Test and verification scripts" },
  { value: "95K", label: "Lines of TypeScript", detail: "Across 541 source files" },
  { value: "MIT", label: "Fully open license", detail: "No seat limits, no usage tiers" },
];

export const TECH_STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind CSS 4",
  "Supabase",
  "TanStack Query",
  "OpenRouter",
  "Resend",
  "Playwright",
];

export const QUICK_START = `git clone https://github.com/JohnConnorCode/accelerate-site.git
cd accelerate-site
npm ci
npm run dev`;

export const openSourceFaqs: FAQ[] = [
  {
    question: "Is this the same product Accelerate runs internally?",
    answer:
      "Yes. This is the actual application code behind a working business, not a stripped-down version prepared for GitHub.",
  },
  {
    question: "What does self-hosting actually require?",
    answer:
      "Node.js, a Supabase project you control, and running the 37 documented migrations. A one-click deploy path that removes the terminal step entirely is on the public roadmap now.",
  },
  {
    question: "Can I self-host it now and bring you in later?",
    answer:
      "Yes. Self-hosting and a managed build are not a one-time fork in the road. You can start on your own and bring us in later for a specific integration, a migration, or to take operating it off your plate entirely.",
  },
  {
    question: "How mature is the codebase?",
    answer:
      "It runs a real, working agency today: 101 automated test and verification scripts, ordered migrations with a documented rollback path, tenant isolation enforced at the database level, and a public commit history you can read before you decide anything.",
  },
  {
    question: "Why not just build this myself?",
    answer:
      "You can. Contacts, pipeline, inbox, proposals, campaigns, and an AI layer with approval gates and an audit trail take real time to get right, and most of it looks the same no matter what business runs on it. This skips that part. Whatever makes your business different is what's worth spending that time on instead.",
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
