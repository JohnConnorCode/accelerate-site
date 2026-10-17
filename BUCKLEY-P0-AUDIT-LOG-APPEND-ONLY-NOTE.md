# Buckley P0-B slice: `audit_log` append-only boundary — handoff note

Date: 2026-10-17 UTC
Worktree: `/Users/johnconnor/Documents/Codex/2026-10-16/task/accelerate-buckley-implementation`
Branch: `codex/buckley-audit-integrity-20261017`
Base: `9a420f2e0848623481f61d950da4615d9041114a`
Status: **source frozen, not committed / not pushed / not merged / not deployed**

## Independent conclusions (against actual source, read-only)

- `public.audit_log` DDL is created in `migrations/20260816-revenue-os.sql:424`; the
  migration grants `authenticated` `SELECT, INSERT, UPDATE, DELETE` and enables RLS
  (`migrations/20260830-shared-database-tenancy.sql:449-454`). The captured live catalog
  (`evidence/tenant-policy-risk.json`) additionally shows `anon` `UPDATE/DELETE/TRUNCATE`.
- The only non-internal trigger was `command_ownership_guard` — `BEFORE INSERT OR UPDATE`,
  SECURITY INVOKER, guarding `tenant_id`/`platform_owner_user_id` immutability
  (`migrations/20261007181105_platform_private_command_context.sql:18-75`). It does not
  protect audit content and never runs for `DELETE`/`TRUNCATE`. This matches the audit's
  high-priority integrity gap.
- Cross-tenant isolation is enforced by the tenant membership/context RLS policy
  (`Tenant member access` with `private.request_tenant_id()` and
  `private.has_active_tenant_membership`). The `Private command owner` policy is RESTRICTIVE
  and adds private-owner protection; it does not independently provide tenant isolation. No
  cross-tenant leak is claimed or addressed here.
- All audit writers found use INSERT (`src/lib/revenue-os/audit.ts:128-141` plus domain
  RPCs in migrations). The only `audit_log` mutations outside INSERT are:
  - `scripts/verify-responder.ts:73` — a **service-role** cleanup delete via
    `createServiceRoleClient()` (trusted), and
  - `scripts/test-source-authority-postgres.mjs:315` — an **owner (postgres)** update.
    Both must keep working; the fix preserves them.
- Conclusion: the smallest complete fix is an additive, fail-closed `BEFORE UPDATE OR DELETE`
  row trigger plus a `BEFORE TRUNCATE` statement trigger on `public.audit_log`, leaving
  policies, grants and canonical INSERT/read paths untouched.

## What changed (this slice)

Guarantee: **`anon`, `authenticated`, and any role that inherits either at any depth can no
longer UPDATE/DELETE/TRUNCATE `public.audit_log`.** Enforcement is fail-closed: only
`service_role`, a superuser (the table owner in Supabase), the table owner, or a role that
inherits `service_role` may mutate the ledger. Trusted checks run before any recursive
`pg_has_role` test because a superuser tests as a member of every role. Ownership/tenant
immutability is deliberately deferred to `command_ownership_guard` so its canonical refusal
is preserved; canonical INSERT is untouched.

New files:

- `migrations/20261017050301_audit_log_append_only.sql` — the migration. Filename generated
  by `supabase migration new audit_log_append_only` (Supabase CLI 2.72.7), preserving the
  CLI timestamp and moving the file into the repo's canonical `migrations/` directory.
- `scripts/test-audit-log-append-only-postgres.mjs` — native PostgreSQL regression (owned
  disposable loopback fixture).

Modified files:

- `scripts/lib/migration-manifest.mjs` — appended the migration to the ordered catalog.
- `package.json` — added `test:audit-log-append-only:postgres`.
- `.github/workflows/ci.yml` — runs the new proof in the existing PostgreSQL step.
- `docs/contracts/PLATFORM-COMMAND-PRIVACY.md` — added the append-only boundary section.
- `docs/self-hosting/REVENUE-OS-SETUP.md` — added the required migration-order paragraph.
- `src/content/changelog.ts` — public changelog entry (`audit-ledger-append-only`).
- `src/content/docs/command-center/activity.mdx` — added the narrow integrity boundary,
  privileged-writer/raw-INSERT/atomicity limits and the migration prerequisite (frontmatter
  unchanged, so the generated `public/docs-llms.txt` index is unaffected).

## Tests actually run (exact raw commands, results, and pipeline caveats)

The scoped native proof is deterministic and self-cleaning; the reviewer intends to re-run it
independently **without a pipe**, which is the authoritative way to capture its exit status.

| #   | Raw command (as run)                                                                                                                                                                                                                                                          | Piped to `tail`?                     | Exit status                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 1   | `node --check scripts/test-audit-log-append-only-postgres.mjs`                                                                                                                                                                                                                | no                                   | 0                                                                                                               |
| 2   | `POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm run resources:run -- node scripts/test-audit-log-append-only-postgres.mjs 2>&1 \| tail -100`                                                                                                                            | **yes — producer status masked**     | not captured; output showed `"result": "passed"`, 31 checks, `PostgreSQL 17.11 (Homebrew)`                      |
| 3   | `npm run verify:migrations 2>&1 \| tail -8`                                                                                                                                                                                                                                   | **yes — producer status masked**     | not captured; output `134 ordered files; exclusions explicitly classified.`                                     |
| 4a  | `PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" npm run resources:run -- npm run test:migration-ledger 2>&1 \| tail -40`                                                                                                                                                    | **yes — producer status masked**     | not captured; all sub-proofs printed `PASS`                                                                     |
| 4b  | `PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" npm run resources:run -- npm run test:migration-ledger > /private/var/folders/…/T/mig-ledger.log 2>&1; echo "EXIT=$?"; tail -5 …/mig-ledger.log`                                                                            | no (redirect, not pipe)              | **EXIT=0**                                                                                                      |
| 5   | `npm run verify:agent-contract 2>&1 \| tail -25; echo "EXIT=${PIPESTATUS[0]:-$?}"`                                                                                                                                                                                            | yes, but `${PIPESTATUS[0]}` captured | **EXIT=0** — `result: passed`                                                                                   |
| 6   | `git diff --check`                                                                                                                                                                                                                                                            | no                                   | clean                                                                                                           |
| 7   | `./node_modules/.bin/tsx scripts/generate-docs-llms.ts --check`                                                                                                                                                                                                               | no                                   | 0 — `docs llms index is current.`                                                                               |
| 8   | `./node_modules/.bin/prettier --check .github/… ci.yml docs/… package.json scripts/lib/migration-manifest.mjs src/content/changelog.ts src/content/docs/command-center/activity.mdx scripts/test-audit-log-append-only-postgres.mjs BUCKLEY-P0-AUDIT-LOG-APPEND-ONLY-NOTE.md` | no                                   | `--write` applied to the two flagged files, then re-check exit 0 (`All matched files use Prettier code style!`) |
| 9   | `./node_modules/.bin/eslint scripts/test-audit-log-append-only-postgres.mjs scripts/lib/migration-manifest.mjs src/content/changelog.ts`                                                                                                                                      | no                                   | 0                                                                                                               |

Rows 2, 3 and 4a are recorded for completeness only: their pipelines discard the producer's
exit status, so treat those as advisory. Rows 1, 4b, 5, 6, 7, 8 and 9 carry authoritative
status. The focused proof (row 2) must be re-run without a pipe to record its true exit code.

Local tool binaries for rows 7–9 came from the reuse `node_modules` symlink the reviewer
corrected in this worktree only (see "Toolchain provenance" below). No download occurred.

Receipt written by the focused proof:
`/var/folders/36/5dz3pp0971vgsnvttt8ctlf80000gn/T/accelerate-audit-log-append-only-postgres.json`
(`os.tmpdir()` on this Mac is `/var/folders/...`, not `/tmp`; the same file resolves under
`/private/var/folders/...`). The receipt records `serverVersion`, `migrationApplications: 2`,
the guarantee text and the 31-check inventory. It is written only after the owned server is
proven stopped.

The proof reproduces the pre-fix gap (authenticated UPDATE and DELETE succeed), applies the
migration twice, then proves: policies/grants retained; guard installed once; canonical
client INSERT, private-row INSERT and a representative `SECURITY DEFINER` RPC append still
work; authenticated/anon/app_member (one-hop)/leaf_writer (two-hop)/independent RLS-bypassing
role UPDATE and DELETE/TRUNCATE are refused with SQLSTATE `42501`; ownership/tenant changes
keep the `command_ownership_guard` refusal; foreign-tenant and spoofed-private-owner INSERTs
are denied; a peer member's private-row UPDATE/DELETE affects zero rows; `service_role` and
the owner retention paths still work.

## Cleanup status

- The owned Postgres 17 cluster was stopped (`pg_ctl ... stop`, status 0) and its temp data
  directory removed. Cleanup is part of pass/fail: a stop that cannot be proven fails the
  command and preserves the fixture; an attempted-but-unconfirmed start never deletes a
  possibly-running data directory.
- No leftover server process or fixture directory is expected. No production or existing
  fixture was touched.
- Note on tool fetch: an earlier `npx eslint …` attempt auto-downloaded eslint into the npm
  cache (a cache-only attempted tool fetch). It is **not** a project or global dependency
  install — nothing was added to `package.json`/`package-lock.json`, and no `eslint` package
  or binary existed in the `node_modules` at that time. The lockfile is preserved unchanged.

## Limits / explicitly outside this slice

- Protects **existing rows from untrusted (client API-role) mutation**. It is not an
  all-actor immutability guarantee: `service_role`, a superuser, the table owner and roles
  inheriting `service_role` intentionally retain governed retention/recovery.
- **Raw INSERT provenance is not constrained**: a client may still append an audit row with
  arbitrary `action`/`entity_type` content within its own tenant. App-level redaction lives in
  `src/lib/revenue-os/audit.ts`, not the database.
- **`claimAction` update-then-separate-`recordAudit` atomicity is out of scope** (as directed);
  it remains a separate concern to be reported, not broadened into this change.
- Cross-tenant isolation is enforced by the tenant membership/context RLS policy, not by the
  RESTRICTIVE `Private command owner` policy (which adds private-owner protection). This slice
  does not claim to add or change cross-tenant isolation.
- Source-only migration. **No production schema was applied, no deploy, no commit.**

## Toolchain provenance and checks not run

The reviewer corrected **only this worktree's own ignored `node_modules` symlink** to
`/Users/johnconnor/Documents/GitHub/Accelerate-agency/.agent-worktrees/release-all-completed-20261009/node_modules`.
That tree supplies matching local tool versions (`tsx`, `eslint`, `prettier`, `tsc`) with no
download and no install.

This is **not an exact lockfile reproduction.** All direct dependency/devDependency versions
match this source lock, but the reviewer's installed-lock comparison found four transitive
patch-version differences:

- `hasown` 2.0.4 (installed) vs 2.0.2 (locked)
- `side-channel` 1.1.1 (installed) vs 1.1.0 (locked)
- `side-channel-list` 1.0.1 (installed) vs 1.0.0 (locked)
- `yaml` 2.9.1 (installed) vs 2.9.0 (locked)

The lockfile (`package-lock.json`) is preserved unchanged. Final validation will disclose this
limitation; **exact dependency reproduction remains a CI/release requirement**, not something
established here.

Checks not run here (reported, not substituted):

- `npm run typecheck` and `npm run build`: not run in this slice (heavy; the reviewer will own
  independent guarded verification).
- Full-repo `npm run lint` / `npm run format:check`: only the changed files were checked
  (rows 8–9 above).
- No production catalog was re-read; all evidence referenced is the already-captured
  `evidence/` set.

## Ownership reconciliation

This is explicit targeted user work (Buckley audit P0-B), not backlog pickup; no ownership
conflict was found. Existing Accelerate (`integrate-workshop-20261016`) and SuperDebate
checkouts/sessions were read-only and untouched.

## Next owner / pending actions

1. **Independent reviewer (this Codex task):** re-run the focused proof **without a pipe** once
   the source is frozen, e.g.
   `POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm run resources:run -- npm run test:audit-log-append-only:postgres`,
   and run the remaining heavy checks (`typecheck`, `build`, full-repo lint/format) in an exact
   lockfile install. Exact dependency reproduction is a CI/release requirement.
2. **John (product/release owner):** decide whether to schedule
   `migrations/20261017050301_audit_log_append_only.sql` in the ordered catalog. John owns the
   release; the reviewer, not John, runs the tests.
3. **Security/backend owner:** the out-of-slice items above (audit-write atomicity, raw INSERT
   actor/content provenance, trusted-writer review).
