# Architecture

Accelerate Revenue OS is one Next.js application with three deliberately separate surfaces:

1. The public marketing and intake site.
2. Authenticated tenant workspaces under `/admin`.
3. Browser-only fictional workspaces under `/demo/command-center`.

The demo reuses the real admin interface but must not call protected APIs, providers, or production storage.

## Request path

Every capability follows the same boundary:

```text
entrypoint
  → authenticate and validate
  → resolve actor and tenant
  → claim idempotency or execution ownership
  → call a domain service
  → record activity, receipt, and audit evidence
  → return a bounded operator-facing result
```

Route handlers, UI components, cron endpoints, webhooks, and AI tools are adapters. They do not own business rules.

## Source map

| Area                  | Location                   | Responsibility                                       |
| --------------------- | -------------------------- | ---------------------------------------------------- |
| Routes                | `src/app/`                 | HTTP, rendering, authentication adapters             |
| Admin UI              | `src/components/admin/`    | Shared workspace interaction and presentation        |
| Domain services       | `src/lib/revenue-os/`      | Canonical reads, writes, validation, receipts        |
| Tenancy               | `src/lib/tenancy/`         | Tenant resolution, lifecycle, ingest, provider scope |
| Bootstrap identity    | `src/config/tenant.ts`     | Original deployment defaults; no secrets             |
| Database              | `supabase/`, `migrations/` | Ordered, additive PostgreSQL changes                 |
| Contracts and QA      | `scripts/`                 | Service contracts, drift checks, Playwright journeys |
| Product documentation | `docs/`                    | Setup, threat boundaries, operating contracts        |

## Tenancy

The chosen architecture is one application and one Supabase database. Operational rows carry `tenant_id`; tenant-composite keys protect relationships and idempotency; authenticated membership and explicit request context determine access; row-level policies are the database backstop.

Platform administration is distinct from tenant administration. Suspending a tenant disables access, ingest, jobs, and provider effects without deleting data. Read [MULTI-TENANCY-CONTRACT.md](MULTI-TENANCY-CONTRACT.md) before changing any tenant-owned path.

## External effects

Email, campaigns, webhooks, scheduled work, and AI-proposed actions require a stable claim or idempotency key and a truthful terminal receipt. HTTP success is not treated as business success. Unknown delivery or provider state remains visible and must be reconciled before retry.

## AI boundary

AI requests route through one server-only OpenRouter gateway. Context is explicitly allowlisted and budgeted. Retrieved customer content is untrusted data, not instructions. Read tools may execute directly; writes and external actions enter the approval queue and ultimately call the same validated services as the UI.

Each tenant can connect its own encrypted OpenRouter credential. Plaintext credentials never return to the browser or enter run history.

## Failure model

- Missing identity or tenant context fails closed.
- Ambiguous identity becomes review work instead of an automatic merge.
- Missing schema or provider configuration becomes a visible degraded state.
- Retries preserve request identity and do not duplicate external effects.
- One tenant's failure cannot block or expose another tenant.

The complete engineering invariants live in [REVENUE-OS-ENGINEERING-CONTRACT.md](REVENUE-OS-ENGINEERING-CONTRACT.md).
