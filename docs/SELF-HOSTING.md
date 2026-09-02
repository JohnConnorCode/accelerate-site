# Self-hosting

This guide separates safe local exploration from a connected deployment. Do not point a fork at the original Accelerate database, Vercel project, provider accounts, domains, or customer records.

## 1. Explore locally

```bash
npm ci
npm run dev
```

The public site and fictional Command Center demo can be explored without provider credentials.

## 2. Create your environment

```bash
cp .env.example .env.local
```

Create a new Supabase project and set its URL, publishable/anonymous key, and service-role key. Public variables are safe for the browser by design; service-role and provider variables are server-only secrets.

Do not reuse the placeholder identity, domain, sender, or project references. Replace the bootstrap organization in `src/config/tenant.ts` and replace the protected assets described in [`ASSETS.md`](../ASSETS.md).

## 3. Apply the database

Install PostgreSQL client tools so `psql` is available. Set the database connection variables from `.env.example`.

```bash
npm run db:migrate:all
npm run db:verify-schema
```

`db:migrate:all` applies all 37 migrations in order (`scripts/lib/migration-manifest.mjs` is the source of truth for that order, matching [REVENUE-OS-SETUP.md](REVENUE-OS-SETUP.md)'s numbered list) by calling the single-file runner once per file. Every migration is additive and idempotent, so re-running the whole command after fixing an error is safe — already-applied files no-op. To apply one migration at a time instead, use `npm run db:migrate -- <path>` with the exact file listed in REVENUE-OS-SETUP.md.

Migration commands should target a new project you control. Inspect the resolved project and host printed by the command before confirming any production operation.

## 4. Configure authentication

Enable Supabase email authentication, set `ADMIN_EMAIL`, create that user, and configure your local and deployed callback URLs. Tenant operators require active membership in the selected tenant; platform administration remains restricted to the configured founder identity.

## 5. Add providers incrementally

Start without external effects. Add and verify one capability at a time:

- Resend for outbound email and signed delivery webhooks.
- OpenRouter at the tenant level for AI workloads.
- Google Workspace OAuth for Gmail, Calendar, and selected Drive folders.
- Calendly only when its optional attribution path is required.
- Plausible only when external analytics are desired; first-party analytics is built in.

Provider configuration alone is not readiness. Use Setup Center and the corresponding verification command to establish a successful receipt.

## 6. Verify before real data

```bash
npm run verify:oss
npm run verify:agent-contract
npm run typecheck
npm run lint
npm run test:core
npm run build
```

Then prove tenant isolation using controlled fictional tenants. Do not invite real users or import real contacts until URL, record-ID, membership, suspension, replay, and provider-failure tests pass.

## 7. Deploy

The application can run on Vercel or another platform that supports Next.js server routes. Vercel users can link their own project and use the commands in `DEPLOY.md`. Set production variables in the hosting provider's secret manager, never in the repository.

After deployment, verify the canonical domain, exact release identity, authentication boundary, Setup Center, and a complete fictional demo journey.
