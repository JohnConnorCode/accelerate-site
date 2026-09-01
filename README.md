# Accelerate Revenue OS

[![CI](https://github.com/JohnConnorCode/accelerate-site/actions/workflows/ci.yml/badge.svg)](https://github.com/JohnConnorCode/accelerate-site/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An open-source, multi-tenant operating system for service businesses: CRM, pipeline, inbox, campaigns, proposals, analytics, AI-assisted operations, and a public marketing site in one Next.js application.

[Live site](https://www.acceleratewith.us) · [Interactive fictional demo](https://www.acceleratewith.us/demo/command-center) · [Architecture](docs/ARCHITECTURE.md) · [Self-hosting](docs/SELF-HOSTING.md)

![The Today command center, showing a founder's priority queue, open pipeline value, and pending approvals for a fictional roofing company workspace.](docs/images/command-center-workspace.png)

> **Project status:** Active and production-derived. The fictional demo works without provider credentials. Running a connected workspace requires your own Supabase project and optional provider accounts. Review the security and tenancy contracts before using real customer data.

## What is included

- Shared-database multi-tenancy with explicit tenant context and membership boundaries.
- Contact and company records, pipeline, tasks, conversations, proposals, and revenue recovery.
- Approval-gated campaigns, imports, and AI-assisted actions with immutable receipts.
- Tenant-owned OpenRouter credentials so each workspace can control model spend.
- Resend, Google Workspace, Calendly, Plausible, and first-party analytics integration paths.
- Five fictional Command Center workspaces for safe product exploration.
- A complete marketing site, knowledge library, qualification flows, and resource delivery.

## Technology

- Next.js 16 and React 19
- TypeScript and Tailwind CSS 4
- Supabase Auth and PostgreSQL
- TanStack Query
- OpenRouter for AI routing
- Resend for email
- Playwright for browser and accessibility coverage

## Quick start

Requirements: Node.js 22+, npm 10+, and Git.

```bash
git clone https://github.com/JohnConnorCode/accelerate-site.git
cd accelerate-site
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The public site and fictional demo are the fastest way to explore the project without connecting external services.

For a connected local workspace:

```bash
cp .env.example .env.local
# Add your own Supabase values, then apply the documented migrations.
npm run dev
```

Never copy production credentials into a fork. See [Self-hosting](docs/SELF-HOSTING.md) for migration order, environment tiers, tenant bootstrap, and provider activation.

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

Route handlers and UI components are adapters. Business writes live in `src/lib/revenue-os/`; tenant resolution lives in `src/lib/tenancy/`; database changes are ordered SQL migrations. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing these boundaries.

## Security model

- Server credentials never belong in browser bundles, source control, logs, or database settings rows.
- Operational records carry tenant ownership and are protected by membership, request context, and database policies.
- External effects require deterministic idempotency and a terminal receipt.
- AI reads bounded context; writes and external actions require the same validated services and approval rules as the UI.
- Fictional demos must never issue protected production requests.

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and keep pull requests focused. Changes to authorization, tenancy, migrations, providers, or automation require the relevant contract tests and threat-boundary evidence. Repository changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Branding and assets

The source code is MIT licensed. Accelerate names, marks, customer/case-study media, photography, marketing copy, and downloadable resources are not granted for reuse by the software license. Forks should replace them before publishing. See [ASSETS.md](ASSETS.md).

## License

Code is available under the [MIT License](LICENSE).
