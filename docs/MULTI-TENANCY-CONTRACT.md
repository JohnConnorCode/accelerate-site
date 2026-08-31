# Shared-database multi-tenancy contract

This contract implements Feature Board card
`shared-database-multi-tenancy-contract` and supersedes the former
instance-per-client product decision. It applies to schema, authorization,
admin routing, configuration, public intake, integrations, jobs, AI, exports,
and every other operational data path.

## Product and authority boundary

- One Next.js application and one Supabase database serve every tenant.
- `ADMIN_EMAIL` remains the sole platform owner in v1. Platform authority covers
  tenant provisioning, invitations, revocation, suspension, platform health, and
  the Feature Board.
- Client admins receive full operations inside active tenant memberships. They
  cannot manage memberships, platform health, other tenants, or the Feature Board.
- Tenant URLs are explicit: `/t/{tenantSlug}/admin/{route}`. The founder-only
  `/admin/*` compatibility path resolves only to the bootstrap tenant. Custom
  domains, subdomains, billing, granular roles, and cross-tenant customer
  analytics are not part of v1.
- Tenants suspend or archive; v1 has no hard delete.

## Data boundary

Every operational row has a non-null `tenant_id`. This includes legacy captures,
canonical CRM records, activities, tasks, communications, campaigns, proposals,
templates, settings, notifications, integrations, provider facts, AI history,
analytics, jobs, webhooks, audits, and import receipts. `feature_requests`,
`schema_verification_runs`, `case_studies`, and `changelog_entries` remain
platform-global.

Business uniqueness and replay are tenant-composite. Contact email, company
domain, source record, provider ID, template key, activity external ID, webhook
receipt, job claim, and idempotency key may repeat across tenants but not inside
one tenant. Child rows carry `tenant_id` and use composite foreign keys so a UUID
from another tenant cannot be linked accidentally or maliciously.

Migrations are additive and ordered: create the control plane; add nullable
ownership; create the Accelerate tenant; backfill and reconcile; add composite
indexes and foreign keys; enable policies; then enforce non-null ownership. Never
delete or merge legacy rows to make the migration pass.

## Request and database boundary

There are three explicit contexts:

- `PlatformActor` is an authenticated user whose normalized email exactly matches
  `ADMIN_EMAIL`.
- `TenantActor` is an authenticated user with an active membership plus the
  requested tenant ID, slug, role, and tenant-bound authenticated Supabase client.
- `TenantSystemContext` is an explicit tenant identity used only by an allowlisted
  cron, webhook, public intake, migration, or provider adapter.

Interactive requests use the authenticated role, not the service role. The
tenant-bound client sends `x-tenant-id`; RLS requires that header to match the row
and requires an active membership for `auth.uid()`. The header selects context but
never grants access. Missing, invalid, suspended, revoked, or mismatched context
fails closed. Service-role clients remain server-only and may operate on tenant
tables only through a `TenantSystemContext`.

Tenant identity comes from the canonical workspace URL, verified OAuth state,
verified webhook endpoint/signature, signed intake credential, or a public row's
unguessable token. It never comes from a mutable JSON body or provider payload.

## Configuration, providers, and public traffic

`src/config/tenant.ts` is Accelerate's bootstrap/default shape and public-site
identity. Workspace configuration is a versioned, runtime-validated copy of that
shape stored on the tenant. Admin, AI, email, sender identity, pipeline labels,
playbooks, and Setup consume the active configuration explicitly. Query caches,
links, breadcrumbs, exports, and downloads include tenant identity and discard
retained tenant data before a switch.

Each tenant owns its Google, Resend, OpenRouter, analytics, and optional scheduling
connections. Credentials use a versioned environment-backed encryption keyring;
ciphertext authentication binds tenant ID and provider. No client tenant may fall
back to Accelerate's environment credentials. The AI gateway is shared platform
infrastructure, but every model request resolves the active tenant's encrypted
OpenRouter key before provider traffic. Only the bootstrap tenant may use the
explicit temporary environment fallback. Supabase, cron wake-up, model-routing
policy, and the encryption keyring remain platform infrastructure.

New public capture uses a signed, rotatable tenant ingest credential bound to
tenant, surface, allowed origin, expiry, and rate limit. Existing unscoped public
routes resolve only to the configured Accelerate tenant. Provider callbacks use a
tenant-specific endpoint or state envelope and verify signature/replay before any
lookup or mutation. Claims, cursors, receipts, retries, and health are per tenant.

## Failure, rollout, and rollback

No tenant becomes active until two controlled tenants prove that identical
emails, domains, provider IDs, and logical idempotency keys remain independent;
URL/header/body/record-ID tampering fails; and every admin, public, provider, AI,
job, export, and browser path retains one tenant.

A tenant failure must not block or retry another tenant. Suspension immediately
disables membership access, ingest credentials, jobs, and provider effects while
preserving data and receipts. Rollback keeps the tenant-aware schema and code,
suspends non-Accelerate effects, and never returns to an unscoped query path.
Production migration, provider activation, invitations to real clients, and
deployment require explicit founder release authority and recorded receipts.
