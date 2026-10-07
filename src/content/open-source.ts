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
    title: "Build with your coding agent.",
    scope: "Free, MIT licensed",
    description:
      "Give Claude Code or Codex the repository and describe the workflow your team needs. The agent can set up the demo, connect your authorized services and build your version on the existing customer records and business rules. You own the deployment, data and provider accounts.",
    included: [
      "The complete source, MIT licensed, no seat limits or usage tiers",
      "CRM, pipeline, inbox, campaigns, proposals, and analytics in one application",
      "AI operations with approval gates and an audit trail, using your own OpenRouter key",
      "An MCP server for supported external assistants, using the workspace's permissions and action rules",
      "Extension patterns an agent can use to build custom screens, reports and workflows",
      "An ordered database migration catalog and full documentation for tenancy and security",
      "A public roadmap, with acceptance criteria written out for every planned change",
    ],
    ctaText: "Give your agent a starting brief",
    ctaHref: "/docs/extend/first-change",
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
  { value: "123", label: "Ordered migrations", detail: "Every schema change, in sequence" },
  { value: "289", label: "Automated checks", detail: "Test and verification scripts" },
  { value: "207K", label: "Lines of TypeScript", detail: "Across 1052 source files" },

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
      "A coding agent can install and run the site and fictional demo without provider keys. For a connected workspace, you supply accounts and authorized access to a Supabase project and any required providers. The agent follows the installation guide, configures the source and verifies sign-in and saved records. You retain ownership of the accounts and review the result before using real customer data.",
  },
  {
    question: "Can I point Claude or ChatGPT at my own workspace?",
    answer:
      "The repository ships an MCP server and client-specific setup guides. A client needs your configured workspace connection; ChatGPT web also needs the documented OAuth setup. Reads respect workspace access. Changes use the same action policy and recorded result as the interface, including human review where required.",
  },
  {
    question: "Can I add my own features without forking?",
    answer:
      "Yes. Describe the workflow to Claude Code or Codex, and the agent can implement its screens, records, connections and tools using the extension contracts. It registers a module for workspace enablement and reuses shared services for access, approvals and recorded results. For example, a client review queue could keep revisions and decisions beside the existing customer record. That example needs to be built and verified for your process.",
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
      "Start with customer records, pipeline, inbox, proposals and the services that govern AI actions already implemented. Your coding agent can reuse those foundations while building the part specific to your business. A new review screen can link to an existing customer instead of creating another customer database, so the team avoids maintaining duplicate records and the agent has less shared infrastructure to rebuild.",
  },
  {
    question: "How is this different from your other services?",
    answer:
      "The underlying offer does not change. Strategy, custom builds, integrations, managed execution, and training are the same things we do for every engagement. Open-sourcing the Command Center just gives you a second way to start: read the code first, or start with a conversation.",
  },
  {
    question: "Do I need to be a developer to use this?",
    answer:
      "You can use Claude Code or Codex to handle repository setup, configuration and extension development. Your job is to describe the business rules, provide authorized account access and review what works. The agent supplies the source changes and check results for technical review. A connected production installation still needs verified permissions, backups and recovery; our managed service can take responsibility for that work with you.",
  },
];
