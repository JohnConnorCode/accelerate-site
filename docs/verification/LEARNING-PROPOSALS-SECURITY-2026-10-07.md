# Learning proposal security assessment, 7 October 2026

The September warning that `public.learning_proposals` had row security disabled
is resolved in the configured Accelerate Agency database. Row security is enabled,
and its membership policy matches published source. A duplicate RLS repair is not
needed. Excess grants and incomplete lifecycle constraints still need a separate
repair; this assessment does not certify the complete learning boundary.

This gives coding agents a specific next step: retain the shipped tenant and
approval services, then strengthen the database boundary they share. Rebuilding
those services would add work without resolving the remaining gaps.

## Evidence and scope

- Card: `learning-proposals-rls-audit`, UUID
  `21c82ab9-b3fa-494f-a5da-7714ddfe5955`.
- Inspected source: published main
  `c2b090e51ec74c0433d368adde9c150686686b2f`.
- Verified project: Accelerate Agency, `skjypuwkceoiunyhhqlm`, PostgreSQL
  `17.6.1.063`. The configured application URL and connected project identify the
  same database. This is evidence for that installation, not every fork.
- Hosted evidence: catalog-only queries for this table, five related functions,
  indexes, foreign keys, non-internal triggers and directly dependent views;
  four read-only count queries with transaction-local synthetic caller context;
  the table's security-advisor findings captured on 7 October.
- Private receipts: `/private/tmp/accelerate-learning-rls-catalog-20261007.json`
  and `/private/tmp/accelerate-learning-rls-negative-20261007.json`. They contain
  schema metadata and exact queries, without business record content or secrets.
  Attach them to the review handoff; these machine-local paths are not downloads.
- No hosted DDL, grants, customer records, migration history or application
  deployment changed. Work-board claim and evidence operations are separate.

## Current database posture

| Object                   | Observed state                                                                                                                  | Practical meaning                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `learning_proposals`     | RLS enabled; FORCE RLS disabled; owner `postgres`                                                                               | Client roles are subject to policies. The owner and bypass roles retain privileged access. |
| `tenant_id`              | Non-null UUID                                                                                                                   | Every proposal carries tenant ownership.                                                   |
| Tenant policy            | Permissive ALL to `authenticated`, with identical USING and WITH CHECK predicates                                               | The row tenant must equal `private.request_tenant_id()` and have an active membership.     |
| Service policy           | Permissive ALL to `service_role`, predicates `true`                                                                             | Server credentials are privileged and must remain behind explicit tenant service context.  |
| Client grants            | `anon` and `authenticated` have SELECT, INSERT, UPDATE, DELETE and TRUNCATE; ACL also includes REFERENCES, TRIGGER and MAINTAIN | RLS is not a replacement for least-privilege grants.                                       |
| Approval RPCs            | SECURITY INVOKER; `search_path=public`; execute granted to `authenticated` and `service_role`, denied to `anon`                 | The RPCs retain caller privileges and validate tenant and approval state.                  |
| Proposal triggers        | No non-internal triggers                                                                                                        | The table has no database trigger enforcing the service's proposal lifecycle.              |
| Parent references        | Single-ID FKs to action queue and learned policies, with ON DELETE SET NULL                                                     | The links do not enforce matching tenant ownership at the FK boundary.                     |
| Directly dependent views | None in the queried dependency catalog                                                                                          | No direct view bypass was found; this is not a catalog of every dynamic SQL caller.        |

The tenant predicate is:

```sql
tenant_id = private.request_tenant_id()
AND private.has_active_tenant_membership(tenant_id)
```

The request helper validates `x-tenant-id` as a UUID and returns NULL on missing or
invalid input. The membership helper reads current membership and tenant status,
requires `membership.user_id = auth.uid()`, and requires both statuses to be
active. It does not derive access from user-editable metadata. These private
helpers have an empty search path and deny anonymous execution. The membership
lookup and authorized-tenant helper use their existing SECURITY DEFINER boundary;
this assessment adds no privileged function.

All five inspected live function bodies exactly match their source migration
bodies after removing the database tool's escaped newline representation and
surrounding whitespace. Their SHA-256 values are retained in the private catalog
receipt. This compares function bodies, not the installation's entire migration
history or deployed application commit.

## Checked access and remaining uncertainty

Four count-only queries ran inside `BEGIN READ ONLY`, with role, request headers
and synthetic claims set only for that transaction. Anonymous access, an
authenticated caller without a tenant header, an invalid header, and a synthetic
nonmember context each returned **zero visible proposals**. No real user was
impersonated and no proposal content was returned.

These are useful negative regressions on the current database state. They do not
replace a populated two-tenant fixture: this audit did not seed a positive control,
exercise active-member CRUD, revoke an existing membership, suspend a tenant,
attempt an unauthorized write, or issue a GraphQL request. Current policy and
function definitions support the intended cross-tenant and revocation behavior;
those transitions were inspected, not exercised here.

The advisor no longer reports disabled RLS for this table. It reports two schema
discoverability warnings: [anonymous GraphQL visibility](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed)
and [authenticated GraphQL visibility](https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed).
They concern SELECT grants and schema discovery. They are not evidence that an
unauthorized caller read another tenant's proposal content. Authenticated SELECT
is needed by the current user-session service; removing it indiscriminately would
break the Learning Inbox.

## Existing owners and migration order

1. [Shared tenancy](../../migrations/20260830-shared-database-tenancy.sql)
   owns explicit request context and current membership checks.
2. [Tenant suspension guards](../../migrations/20260831-tenant-suspension-guards.sql)
   require active tenant state for the authorized-tenant RPC context.
3. [Learning Inbox](../../migrations/20260911-learning-inbox.sql) creates the
   table, tenant-composite dedupe indexes and policies. It does **not** enable RLS
   itself. An installation stopped at this migration therefore needs the later
   connected-learning migration before learning is activated.
4. [Connected learning](../../migrations/20260920-connected-learning.sql)
   enables RLS and owns transactional approved-policy creation, explicit
   replacement, replay identity and the approval audit. Both learning migrations
   are present in the ordered [installation catalog](../../scripts/lib/migration-manifest.mjs).

The [Learning Inbox service](../../src/lib/revenue-os/learning-inbox.ts) owns
proposal validation, dedupe, disposition and approval staging. Its approval
method calls `approve_learning_proposal`. That RPC locks the tenant's proposal,
checks the linked action type, proposal ID, executing/executed state, approval
timestamp and actor, and uses `record_learned_policy` for the approved rule and
audit in one transaction. The actor string is matched to the action receipt; it
is not itself an authentication credential.

The [API adapters](../../src/app/api/admin/learning/route.ts) use
[requireAdmin](../../src/lib/admin/auth.ts), which checks the authenticated user,
active tenant and current admin membership. The [tenant-bound database client](../../src/lib/supabase/server.ts)
adds tenant ownership to inserts and relies on RLS for authenticated row access;
its service-context path adds explicit tenant filters. Direct database callers
do not receive the HTTP adapter's admin-role check. The table policy permits any
active member of the selected tenant, so database and HTTP authority are not
equivalent.

The existing [connected-learning PostgreSQL test](../../scripts/test-connected-learning-postgres.mjs)
covers approval concurrency, replay, replacement and audit rollback. Its initial
membership helper returns `true`; it does not establish real membership or
revocation isolation for proposals. It was inspected, not rerun for this
documentation-only assessment.

## Scoped repair and compatible rollout

No RLS enablement change is needed on the inspected installation. Preserve the
current row-security policy and approval RPCs. A bounded successor repair should:

1. Keep the connected-learning migration as a required installation dependency.
   Check RLS before enabling the learning runtime, and give an interrupted install
   an explicit recovery result. Preserve checksums of applied files; do not rewrite
   the original migration or create a duplicate RLS-only repair for this project.
2. Remove anonymous table privileges and client privileges that the supported
   service does not need, especially TRUNCATE, REFERENCES, TRIGGER and MAINTAIN.
   [PostgreSQL RLS does not govern TRUNCATE or REFERENCES](https://www.postgresql.org/docs/17/ddl-rowsecurity.html). This audit did not invoke it, and the
   ordinary PostgREST CRUD API does not expose it as a table action.
3. Add tenant-composite parent validation while preserving nullable links and
   ON DELETE SET NULL behavior. Inspect existing mismatches read-only before any
   constraint validation; retain evidence and never delete rows to make it pass.
4. Define database checks for the supported proposal lifecycle and audit owner.
   The current authenticated ALL policy and lack of triggers permit direct
   same-tenant table mutations to bypass service validation and its audit. Changing
   a proposal status alone is not proof that an approved learned policy was
   activated, but it can misrepresent the proposal's state to operators.
5. Prove fresh and populated migration replay, an authorized positive control,
   anonymous and nonmember denial, cross-tenant links and tenant reassignment,
   revoked/suspended access, approved activation, stale approval, audit failure,
   replay and safe retry in a disposable PostgreSQL fixture using the real
   membership helpers. Keep this distinct from provider and browser proof.

For a fork that still reports disabled RLS, a coding agent should first compare
the two learning migrations and the installed catalog, then follow the existing
[migration runner and target-verification procedure](../self-hosting/REVENUE-OS-SETUP.md).
Run the ordered, compatible migration on the explicitly authorized installation;
do not create an untracked dashboard policy or infer application release from an
RLS flag. Repeat the targeted catalog and controlled access checks afterward.

A grants or lifecycle repair must ship with the service compatibility tests and
operator recovery instructions. Preserve business records and receipts during
rollback; reverting application code must not restore anonymous access. Hosted
migration, merge and deployment remain separate authorized release actions.

The live board tracks the repair in two bounded successor cards:

- `learning-proposals-least-privilege`: remove excess grants and verify portable
  installation compatibility.
- `learning-proposals-lifecycle-integrity`: enforce supported lifecycle, atomic
  audit and tenant-owned links after the grant repair is accepted.

## Handoff result

The original disabled-RLS warning is superseded by current database evidence.
The remaining grant and lifecycle findings require their own implementation and
controlled verification. This research handoff supplies the exact current facts,
negative regressions, existing owners and repair requirements. It does not claim
that the successor repair, a full security audit, merge or deployment is complete.
