# Accelerate Revenue OS

[![CI](https://github.com/JohnConnorCode/accelerate-site/actions/workflows/ci.yml/badge.svg)](https://github.com/JohnConnorCode/accelerate-site/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Accelerate Revenue OS is a self-hosted operating system for service businesses. It runs your pipeline, inbox, campaigns, proposals, and analytics in one application, and it lets people and AI agents operate that system under one set of rules. This is the actual code behind a working business, open-sourced as-is, not a demo trimmed down for GitHub.

An agent can scaffold a CRM in an afternoon now, so owning the code has stopped being the hard part. The hard part is what happens the moment something acts on a real customer's behalf. Here, every write an agent attempts becomes a staged proposal that a person approves, every answer has to cite the tools it actually read, and every external effect carries an idempotency key and ends in a receipt. Outside assistants reach the workspace over the Model Context Protocol through that same registry and the same approval queue, with no looser path than the interface has.

You own it outright: your own Supabase project, your own AI provider key, your own data. Multi-tenancy is built in from the schema up, so an agency can run several client businesses from one deployment without any of them seeing another's records.

[Live site](https://www.acceleratewith.us) · [Interactive fictional demo](https://www.acceleratewith.us/demo/command-center) · [Architecture](docs/self-hosting/ARCHITECTURE.md) · [Self-hosting](docs/self-hosting/SELF-HOSTING.md) · [All docs](docs/README.md) · [Roadmap](#roadmap)

![The Today command center, showing a founder's priority queue, open pipeline value, and pending approvals for a fictional roofing company workspace.](docs/images/command-center-workspace.png)

> **Project status:** Active and production-derived. The fictional demo works with zero setup and no provider credentials. A connected workspace needs your own Supabase project and, optionally, your own provider accounts. Read the security and tenancy contracts before you put real customer data anywhere near it.

## What it does

**Today** is the operator's front door: one ranked queue, per tenant, of replies, approvals, follow-ups, and anything else that needs a decision right now.

**Records** are canonical. Every contact, company, and opportunity is one entity with one pipeline stage, one owner, and one activity history, so different screens never quietly disagree about the same deal.

**The inbox** resolves identity on intake, so a new message from an existing contact gets merged into their record instead of spawning a duplicate.

**Campaigns, proposals, and bookings** run through approval gates and idempotent sends, so a flaky network or a doubled click never means a client gets the same email twice.

**Analytics** ties revenue back to its source, by channel, campaign, and stage, and shows where attribution data is genuinely missing instead of quietly treating it as zero.

**The AI layer is grounded, not generic.** Every model call runs against bounded, retrieved context with source citations, and every write it proposes goes through the same approval queue and audit trail as a human action. It doesn't get a side door around the rules everyone else follows.

**Tenancy is structural, not bolted on.** One shared database, explicit tenant context on every request, isolated records, and a workspace can connect its own OpenRouter key so AI spend is billed to that tenant, not to you. Five fictional demo workspaces let you explore the entire product, including a live drag-and-drop feature-board kanban, with no setup at all.

See [Roadmap](#roadmap) below for what's shipped, in progress, and planned next.

## How an agent is allowed to operate it

The rules below are enforced in code, not asked for in a prompt.

**Mutating tools propose; they never act.** The tool registry checks impact at runtime. A tool registered as a read that stages a write throws, and a tool registered as a write that fails to stage one throws too. Approved proposals then execute through the same domain services the interface uses.

**Execution re-reads reality first.** A proposal expires rather than firing if the record moved underneath it: a contact who unsubscribed, a conversation that was archived, an opportunity already past the stage the proposal assumed.

**Answers cite what they read.** A grounded answer is rejected before it reaches you unless it carries receipts from tools that actually executed in that request. A hallucinated citation fails the check.

**Every external effect is idempotent and ends in a receipt.** Sends, syncs, and webhook deliveries carry idempotency keys, so a retry cannot fire twice and an uncertain outcome is never treated as success.

**Health cannot be quietly green.** Stalled jobs and unread webhook failures surface as degraded rather than being absent from a dashboard.

Every run is traced in `agent_runs` and `agent_run_events` and readable at `/admin/ai`, and every material write lands in the audit ledger at `/admin/activity` with actor, origin, and before/after state.

## Connect your own assistant

The repository ships a Model Context Protocol server. Claude Desktop, Claude Code, ChatGPT's native Connectors, Cursor, and Antigravity connect to a workspace and get the same registered tools, the same impact tiers, and the same approval queue as the interface. Ask it what's on today's queue, or to mark a task done, snooze it, or move an opportunity's stage: reads return bounded, sourced data, and every write it proposes lands in the same review queue you'd see from a human editing the record by hand.

Setup for each client is in [docs/self-hosting/MCP-SETUP.md](docs/self-hosting/MCP-SETUP.md).

## Extend it without forking it

Modules are the unit a workspace turns on and off. A third party registers one from a JSON manifest in [`extensions/`](extensions/README.md) that declares its navigation, routes, AI tools, and Setup Center checks. The build validates every manifest and compiles it into a typed constant, so nothing in that directory is ever executed.

A registered module inherits the approval queue, the audit ledger, module gating, and MCP exposure without asking for any of them. Disable it and its navigation disappears, its routes fail closed, and its AI tools report unavailable to the agent and to MCP alike.

[docs/contributing/EXTENDING.md](docs/contributing/EXTENDING.md) covers all three extension points: modules, integration adapters, and AI tools. `extensions/example-inventory.module.json` is a complete working example.

## Technology

- Next.js 16 and React 19
- TypeScript and Tailwind CSS 4
- Supabase Auth and PostgreSQL
- TanStack Query
- OpenRouter for AI routing
- Model Context Protocol for external assistants
- Resend for email
- Playwright for browser and accessibility coverage

## Quick start

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJohnConnorCode%2Faccelerate-site&project-name=my-revenue-os&repository-name=my-revenue-os&demo-title=Accelerate%20Revenue%20OS&demo-description=Self-hosted%20revenue%20operations%2C%20CRM%2C%20and%20AI%20workspace&demo-url=https%3A%2F%2Fwww.acceleratewith.us%2Fdemo%2Fcommand-center)

The button deploys with no environment variables required: it boots straight to the public marketing site and the fictional demo, and any admin route redirects to a clearly labeled "connect your Supabase project" screen instead of erroring. Add your own Supabase project's variables in the new Vercel project's settings when you're ready for a real workspace, then follow [Self-hosting](docs/self-hosting/SELF-HOSTING.md).

This repository ships with automatic Git deployments off (`git.deploymentEnabled: false` in `vercel.json`), which exists to keep the maintainer's own production project on a separate prebuilt release path. It carries over to your fork's Vercel project too, so a `git push` after the first deploy won't redeploy until you turn Git deployments back on in your new project's **Settings → Git**.

Or run it locally instead:

Requirements: Node.js 22+, npm 10+, and Git.

```bash
git clone https://github.com/JohnConnorCode/accelerate-site.git
cd accelerate-site
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The public site and fictional demo are the fastest way to explore the project; neither one touches an external service.

To connect a real workspace instead:

```bash
cp .env.example .env.local
# Add your own Supabase values, then apply the documented migrations.
npm run dev
```

Never copy production credentials into a fork. [Self-hosting](docs/self-hosting/SELF-HOSTING.md) covers migration order, environment tiers, tenant bootstrap, and turning on providers.

## Useful commands

| Command                          | Purpose                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                    | Start the local development server                           |
| `npm run build`                  | Create a production build with an immutable release identity |
| `npm run lint`                   | Run ESLint                                                   |
| `npm run typecheck`              | Run TypeScript without emitting files                        |
| `npm run test:core`              | Run the environment-independent contract suite               |
| `npm run verify:oss`             | Check open-source repository hygiene and secret patterns     |
| `npm run qa:admin-demo -- --one` | Exercise one complete fictional workspace in Playwright      |

## Architecture at a glance

```text
Public site / Admin UI / APIs / Cron / Webhooks / AI tools
                         │
                         ▼
       Auth + validation + explicit tenant resolution
                         │
                         ▼
         Revenue OS domain services and action queue
                         │
                         ▼
       Tenant-scoped PostgreSQL + immutable receipts
```

Route handlers and UI components are thin adapters, nothing more. Every business write lives in `src/lib/revenue-os/`, tenant resolution lives in `src/lib/tenancy/`, and every database change is an ordered SQL migration, never a runtime mutation. Read [docs/self-hosting/ARCHITECTURE.md](docs/self-hosting/ARCHITECTURE.md) before you touch any of those boundaries.

## Roadmap

`scripts/feature-backlog-data.mjs` is the single source of truth for what's shipped, in progress, planned, and backlog. Every card carries acceptance criteria, dependencies, and required verification, following the [Feature Board taxonomy](docs/contracts/FEATURE-BOARD-TAXONOMY.md). Extend that manifest; don't start a second roadmap in a fork.

[**/roadmap**](https://www.acceleratewith.us/roadmap) renders that manifest publicly, with every card's real description and acceptance criteria, no signup required. A curated, dependency-satisfied subset — cards ready to pick up without waiting on other work — is also mirrored to [GitHub Issues labeled `help wanted`](https://github.com/JohnConnorCode/accelerate-site/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) via `npm run mirror:feature-board-issues -- --apply`.

You can also explore the same kanban UI the founder uses, populated with representative fictional data, inside any [demo workspace](https://www.acceleratewith.us/demo/command-center) under **System → Feature Board**. The live founder board at `/admin/features` requires authentication, so it isn't publicly browsable.

For exactly what changed and when, read [CHANGELOG.md](CHANGELOG.md) or the commit history rather than a second, hand-written summary here.

## Security model

- Server credentials never reach browser bundles, source control, logs, or a database settings row.
- Every operational record carries tenant ownership, enforced by membership checks, request context, and database policy, not by convention.
- External effects (sends, webhooks, provider calls) require deterministic idempotency and end in a terminal receipt, so retries can't double-fire them.
- AI reads run against bounded context only. AI writes and external actions go through the same validated services and approval rules the UI does; there is no separate, looser path for the model.
- Fictional demo workspaces are hard-isolated from production: they can never issue a real, protected request.

Found a vulnerability? Report it privately, as described in [SECURITY.md](SECURITY.md), rather than opening a public issue.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and keep pull requests narrowly scoped to one change. Anything touching authorization, tenancy, migrations, providers, or automation needs the relevant contract tests and threat-boundary evidence, not just a passing build. Repository-level changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Branding and assets

The source code is MIT licensed. The Accelerate name, marks, customer and case-study media, photography, marketing copy, and downloadable resources are not covered by that license. If you're publishing a fork, replace them first. See [ASSETS.md](ASSETS.md) for the exact boundary.

## License

Code is available under the [MIT License](LICENSE).
