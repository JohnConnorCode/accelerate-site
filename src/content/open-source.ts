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
      "Start with the fictional demo, then connect a Supabase project you control. The same application runs our agency workspace. You own your deployment, data and AI provider account, and can change the source around your business.",
    included: [
      "The complete source, MIT licensed, no seat limits or usage tiers",
      "CRM, pipeline, inbox, campaigns, proposals, and analytics in one application",
      "AI operations with approval gates and an audit trail, using your own OpenRouter key",
      "An MCP server for supported external assistants, using the workspace's permissions and action rules",
      "Pluggable modules a workspace turns on and off, extendable from a manifest without forking",
      "An ordered database migration catalog and full documentation for tenancy and security",
      "A public roadmap, with acceptance criteria written out for every planned change",
    ],
    ctaText: "Read the self-hosting quickstart",
    ctaHref: "/docs/self-hosting",
  },
  {
    id: "managed",
    eyebrow: "Path two",
    title: "We build and run it for you.",
    scope: "Scoped on a strategy session",
    description:
      "We start with the customer workflow your team needs, configure the shared workspace around it, and operate the agreed solution with you. The build, connections, support and costs are scoped before work begins.",
    included: [
      "Your own isolated workspace, configured around your existing tools",
      "Migrations, updates, security patches, and monitoring handled for you",
      "The integrations required by the agreed workflow, connected and verified",
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
  { value: "122", label: "Ordered migrations", detail: "Every schema change, in sequence" },
  { value: "287", label: "Automated checks", detail: "Test and verification scripts" },
  { value: "207K", label: "Lines of TypeScript", detail: "Across 1051 source files" },

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
      "The site and fictional demo run with Node.js and no provider keys. A connected workspace also needs a Supabase project you control and the documented setup. The README's Deploy with Vercel button starts the neutral site and demo first; follow the self-hosting guide to add sign-in and persisted records.",
  },
  {
    question: "Can I point Claude or ChatGPT at my own workspace?",
    answer:
      "The repository ships an MCP server and client-specific setup guides. A client needs your configured workspace connection; ChatGPT web also needs the documented OAuth setup. Reads respect workspace access. Changes use the same action policy and recorded result as the interface, including human review where required.",
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
      "It runs our agency workspace today. The repository includes ordered migrations, tenancy and security contracts, automated checks, a fictional demo and public commit history. A connected installation still needs its own Auth, provider and recovery verification before real customer data is imported.",
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
