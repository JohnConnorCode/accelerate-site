# Self-hosting

This guide separates safe local exploration from a connected deployment. Do not point a fork at the original Accelerate database, Vercel project, provider accounts, domains, or customer records.

The fastest path to seeing this running is the Deploy with Vercel button in [README.md](../../README.md#quick-start): it needs no environment variables and boots straight to the marketing site and fictional demo. This guide covers the rest, connecting a real workspace, whether you got there through that button or `npm ci && npm run dev` below.

## 1. Explore locally

```bash
npm ci
npm run dev
```

The public site and fictional Command Center demo can be explored without provider credentials.

## 2. Connect your own hosted Supabase project

For a hosted installation, use a **new empty project** you control. Copy `.env.example` to `.env.local` and configure its Supabase URL, public anonymous key, server-only service-role key, database connection, `ADMIN_EMAIL`, and your `BOOTSTRAP_*` identity. Set `BOOTSTRAP_FOUNDER_EMAIL` to the same email as `ADMIN_EMAIL`. Set `BOOTSTRAP_SCHEDULER_URL` only when you intend to activate an external scheduler; it defaults to disabled.

Enable Supabase email/password authentication and configure the application origin
and `/auth/callback` redirect URL in Auth settings. These are project settings;
a database key cannot configure them. They remain a documented dashboard step.

## 3. Plan and apply workspace setup

Set `BOOTSTRAP_BRAND_NAME`, `ADMIN_EMAIL` and `NEXT_PUBLIC_SITE_URL` alongside
the database/API credentials. Then inspect the read-only plan:

```bash
npm run setup
```

Missing or placeholder configuration returns named fixes without making changes.
A configured plan checks the database target and migration ledger and looks up the
owner. It never prints passwords or service keys. To create a new owner, set
`SETUP_OWNER_PASSWORD` in your private local environment (12–1024 characters).
Do not put the password in command arguments, Git or a shared transcript.

Apply to the exact project reference displayed by the plan:

```bash
npm run setup -- --apply --project your-project-reference
```

The command reuses an existing confirmed, active owner or creates the explicitly
configured owner with a confirmed email and password. It sends no invitation email.
Existing passwords are never reset. It verifies that the Auth owner also exists in
the configured database, applies the existing migration ledger, then verifies the
matching bootstrap workspace and active admin membership. If the owner was created
after migrations, a missing membership is established through the existing audited
lifecycle RPC. Revoked/invited memberships, suspended accounts and mismatched
workspace identities require explicit platform review; setup will not overwrite them.

First installation derives all bootstrap identity fields from your business name,
owner and site URL, with neutral defaults and optional explicit `BOOTSTRAP_*`
overrides. Existing workspace configuration is preserved. This configures the admin
workspace; replacing the original public agency site and protected assets remains a
separate step described in [ASSETS.md](../../ASSETS.md).

Auth account creation and database migration are separate operations. If a later
step fails, rerun the same command: the owner is reused and completed migration
transactions are skipped. Setup does not delete partial installations. Remove
`SETUP_OWNER_PASSWORD` after completion. Sign in at `/admin/login`, open Setup
Center, and verify the workspace in the browser. A `workspace_configured` receipt
proves configuration/membership checks, not browser login, provider readiness or
a successful production deployment.

[`scripts/lib/migration-manifest.mjs`](../../scripts/lib/migration-manifest.mjs)
is the single migration order. Each source checksum and successful file is recorded
in `accelerate_schema_migrations` in the same transaction as its changes. A failed
file rolls back. Never edit a recorded migration; add a new ordered migration.

Existing databases without a ledger require reviewed baseline adoption. Setup
refuses historical replay over such databases. Back up and test upgrades on a
restored copy before using real data. For migration-only operations, the existing
`db:migrate:all`, `db:migrate -- <path>`, `db:verify-schema` and
`verify:bootstrap-identity` commands remain available; the guided command supplies
neutral first-install defaults that a direct migration command does not derive.

The installer has controlled Auth/REST and native PostgreSQL regression coverage.
`npm run test:install-runbook` is the CI proof for a fresh checkout: it asserts
the documented commands, refuses original identity leftovers and unclassified
migrations, and writes `/tmp/accelerate-install-runbook.json`. It does not
apply schema to a live database.
A fresh hosted Auth/browser preview installation is a separate release acceptance;
do not confuse a local fixture pass with that connected proof.

## 4. Add providers incrementally

Start without external effects. Add and verify one capability at a time:

- Resend for outbound email and signed delivery webhooks.
- OpenRouter at the tenant level for AI workloads.
- Model Context Protocol (MCP) server for external AI clients (Claude Desktop, Claude Code, ChatGPT, Cursor, Antigravity) — see [MCP-SETUP.md](MCP-SETUP.md).
- Google Workspace OAuth for Gmail, Calendar, and selected Drive folders.
- Calendly only when its optional attribution path is required.
- Plausible only when external analytics are desired; first-party analytics is built in.

Provider configuration alone is not readiness. Use Setup Center and the corresponding verification command to establish a successful receipt.

## 5. Verify before real data

```bash
npm run verify:oss
npm run verify:agent-contract
npm run typecheck
npm run lint
npm run test:core
npm run build
```

Then prove tenant isolation using controlled fictional tenants. Do not invite real users or import real contacts until URL, record-ID, membership, suspension, replay, and provider-failure tests pass.

## 6. Deploy

The application can run on Vercel or another platform that supports Next.js server routes. Vercel users can link their own project and use the commands in `DEPLOY.md`. Set production variables in the hosting provider's secret manager, never in the repository.

After deployment, verify the canonical domain, exact release identity, authentication boundary, Setup Center, and a complete fictional demo journey.
