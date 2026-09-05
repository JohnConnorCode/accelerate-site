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

Before migrating, enable Supabase email authentication and create the owner user in your project's Authentication dashboard. Configure the app origin and `/auth/callback` redirect URL. The tenant migration binds that existing user's active admin membership. Creating the user after migrations does not retroactively create a membership. Create a password for the owner when creating the user. Password recovery through the app requires configured Resend delivery.

## 3. Apply and verify the schema

```bash
npm run verify:migrations
npm run db:migrate:all
npm run db:verify-schema
npm run verify:bootstrap-identity
```

[`scripts/lib/migration-manifest.mjs`](../../scripts/lib/migration-manifest.mjs) is the single source of migration order and explicit historical exclusions. The runner verifies that every SQL file is classified, rejects competing migration runners, and records each successful file and source checksum in `accelerate_schema_migrations` in the same transaction as its changes. A failed file rolls back; rerun to resume. Already-recorded files are verified and skipped, so rerunning does not reset saved settings. Never edit a recorded migration; add a new ordered file instead.

`npm run db:migrate -- <path>` applies all pending prerequisites through that manifest entry. It does not execute arbitrary files out of order. An existing database without this ledger is refused: historical replay can overwrite business configuration. Such installations need a reviewed baseline adoption before using this runner; do not delete tables or invent ledger receipts to bypass the check. Back up and test upgrades on a restored copy before using real data.

Changing `BOOTSTRAP_*` after installation does not rewrite an existing workspace. Use Branding and the canonical tenant configuration service. Replace protected assets following [`ASSETS.md`](../../ASSETS.md).

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
