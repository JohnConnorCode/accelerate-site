# Self-hosting

For recorded core versions, stable release checks and supported upgrade paths, use [Core releases and fork upgrades](RELEASES.md). Main-branch and package versions alone do not identify a supported stable release.

Use this guide to go from a fictional customer workflow to a workspace that saves your own records and tasks. Start with the demo, then connect a Supabase project you control, sign in, and verify a saved result before importing real customer data. Keep your fork separate from Accelerate's database, hosting, provider accounts and domains.

A full repository fork defaults to the [neutral distribution](NEUTRAL-DISTRIBUTION.md) profile. It includes the entire application and an editable public Command Center homepage. Every installation, including ours, can turn bundled agency presentation on with `NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded` or off with `neutral`. Use the same profile at build and runtime, then rebuild and deploy. Profile selection never changes saved drafts or publication history and does not select a different product or hosting account.

The fastest path to seeing this running is the Deploy with Vercel button in [README.md](../../README.md#quick-start): it needs no environment variables and boots straight to the neutral product homepage and fictional demo. This guide covers the rest, connecting a real workspace, whether you got there through that button or `npm ci && npm run dev` below.

For connected setup, install PostgreSQL client tools and confirm `psql --version` works. The demo only needs Node.js 22.16+, npm 10+ and Git.

## 1. Explore locally

```bash
npm ci
npm run dev
```

The public site and fictional Command Center demo can be explored without provider credentials.

## 2. Connect your own hosted Supabase project

For a hosted installation, use a **new empty project** you control. Copy `.env.example` to `.env.local` and configure its Supabase URL, publishable (or legacy anon) key, server-only secret (or legacy service-role) key, database connection, `ADMIN_EMAIL`, and `BOOTSTRAP_BRAND_NAME`. The installer derives the remaining neutral identity from your business name, owner email and site URL. Set `BOOTSTRAP_SCHEDULER_URL` only when you intend to activate an external scheduler; it defaults to disabled.

Enable Supabase email/password authentication. In Authentication → URL Configuration,
set the Auth Site URL to the origin where people open Command Center. Add that origin
followed by `/auth/callback**` to Redirect URLs. For example, if you open
`http://localhost:3000/admin/login`, allow `http://localhost:3000/auth/callback**`.
Use the same scheme, hostname and port in the browser and Auth settings;
`localhost` and `127.0.0.1` have separate sign-in cookies. The narrow wildcard
allows the query on a password-recovery callback. For a separate app hostname, set
`NEXT_PUBLIC_COMMAND_CENTER_ORIGIN` to that HTTPS origin at build and runtime,
while `NEXT_PUBLIC_SITE_URL` remains the public website. These are project settings;
a database key cannot configure them. They remain a documented dashboard step.
Password recovery uses Supabase Auth email when `RESEND_API_KEY` is unset, so confirm
that your Auth email delivery works before relying on the workspace. Supabase's
default hosted sender is limited; configure SMTP for regular use. When Resend is
configured, Command Center sends its own recovery email instead.

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

Set `NEXT_PUBLIC_BUSINESS_NAME` to the same business name for the credential-free public entry and `NEXT_PUBLIC_SITE_URL` to your canonical URL. These public values are build-time configuration; rebuild after changing them. After setup, use Site Studio's Identity and Theme controls for the published website.

First installation derives all bootstrap identity fields from your business name,
owner and site URL, with neutral defaults and optional explicit `BOOTSTRAP_*`
overrides. Existing workspace configuration is preserved. This configures the admin
workspace; the neutral public site is ready to customize in Site Studio. Retained protected source assets have separate rights described in [ASSETS.md](../../ASSETS.md).

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
- Model Context Protocol (MCP) server for compatible external AI clients. ChatGPT requires a separate OAuth connection and currently supports custom MCP apps on web only — see [MCP-SETUP.md](MCP-SETUP.md) and [WORKSPACE-MCP-OAUTH.md](WORKSPACE-MCP-OAUTH.md).
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

## Back up before importing real data

Follow [Backup and recovery](BACKUP-RECOVERY.md) to retain database records, uploaded files and encryption configuration, then restore them into an isolated target. Free-tier database access does not establish a backup or availability guarantee.

## Keep customization through updates

Use the existing saved Branding, appearance and Site Studio controls for normal customization. Keep hosting IDs in ignored `deployment-target.local.json`, credentials in your own environment, and custom source in uniquely named extensions. Before merging a fetched upstream revision, run `npm run fork:check -- --ref <commit-or-tag>`. This inspects local history without applying an update. Follow [fork customization and updates](FORK-UPGRADES.md) for conflicts, legacy edits and reduced exports.

## 6. Deploy

The application can run on Vercel or another platform that supports Next.js server routes. Vercel users can link their own project and use the commands in `DEPLOY.md`. Set production variables in the hosting provider's secret manager, never in the repository.

After deployment, verify the canonical domain, exact release identity, authentication boundary, Setup Center, and a complete fictional demo journey.

## Installation acceptance boundaries

`npm run resources:run -- npm run test:cold-start:postgres` creates a disposable
local PostgreSQL cluster, runs the guided setup against real business migrations,
and verifies owner identity, membership, neutral branding and a persisted contact
and completed task. It requires PostgreSQL 15+ binaries on `PATH` (`initdb`,
`pg_ctl`, `psql`, `pg_dump` and `pg_restore`). Auth and Storage
interfaces are simulated; the Supabase scheduler extension migration is excluded.
It does not verify hosted authentication or browser writes to a hosted project.

For your own installation, sign in, create a fictional contact and task, reload,
complete the task, and check it again. Record the project, release, result and any
failure before importing real data. Browser demo checks prove browser-local edits
only. A human first-time installation trial remains a separate acceptance step.
