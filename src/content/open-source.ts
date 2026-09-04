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
      "A Model Context Protocol server, so Claude Desktop, Claude Code, ChatGPT, Cursor, and Antigravity reach the same tools under the same approval rules",
      "Pluggable modules a workspace turns on and off, extendable from a manifest without forking",
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
  { value: "139", label: "Automated checks", detail: "Test and verification scripts" },
  { value: "112K", label: "Lines of TypeScript", detail: "Across 599 source files" },
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
  "Model Context Protocol",
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
      "Node.js, a Supabase project you control, and running the 37 documented migrations. There is also a Deploy with Vercel button in the README that needs no environment variables at all: it boots straight to the marketing site and the fictional demo, then points you at the setup path when you are ready to connect a real workspace.",
  },
  {
    question: "Can I point Claude or ChatGPT at my own workspace?",
    answer:
      "Yes. The repository ships a Model Context Protocol server, with setup guides for Claude Desktop, Claude Code, ChatGPT's native Connectors, Cursor, and Antigravity. Read tools return bounded queries. Anything that would change a record, complete or reschedule a task, or send a message becomes a staged proposal in the approval queue instead, so an outside assistant works under the same rules the interface does.",
  },
  {
    question: "Can I add my own features without forking?",
    answer:
      "Yes. A module registers from a JSON manifest that declares its navigation, routes, and AI tools, and the build validates it. Your module inherits the approval queue, the audit ledger, and per-workspace enable and disable without any change to core. The contributing guide covers modules, integration adapters, and AI tools.",
  },
  {
    question: "Can I self-host it now and bring you in later?",
    answer:
      "Yes. Self-hosting and a managed build are not a one-time fork in the road. You can start on your own and bring us in later for a specific integration, a migration, or to take operating it off your plate entirely.",
  },
  {
    question: "How mature is the codebase?",
    answer:
      "It runs a real, working agency today. Every automated test and verification script in the repository runs against it, migrations are ordered with a documented rollback path, tenant isolation is enforced at the database level, and the commit history is public to read before you decide anything.",
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
