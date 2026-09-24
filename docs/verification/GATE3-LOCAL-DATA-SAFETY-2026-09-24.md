# Gate 3 — Local data-safety results (2026-09-24)

Commit: `02e68f37 (origin/main; initial measurements taken on 8b39fd17, re-validated here)`. LOCAL only. No live Supabase. No restore into another project yet. This does NOT pass Gate 3.

## Passes (disposable local PostgreSQL)

- `npm run verify:migrations`: 116 ordered files on main tip (100 on measurement tip), exclusions classified. Exit 0.
- `npm run test:migration-ledger`: 15 PASS, exit 0, on both tips. Covers catalog completeness, populated upgrade + replay, checksum drift, unknown history, transactional failure/resume, legacy refusal, ledger privileges, concurrent runners, two-tenant business upgrade with duplicate emails preserved, conversation/message replay, Radar versioning/replay/isolation, public-source proof, relationship/proposal replay + isolation. Full log: `/tmp/gate3-ledger.log` (disposable).
- `npm run test:tenant-isolation`: passed (0 implicit-admin files, 22 explicit-system files).
- `npm run test:action-execution`: passed (idempotent execution + receipts).
- Environment note: system default `initdb` is PostgreSQL 14, which cannot parse `security_invoker` (needs 15+). Suite passes on the machine's PostgreSQL 17 (`/opt/homebrew/Cellar/postgresql@17/17.11/bin`). CI uses Supabase PG (15+), unaffected. Dependency skew note from Gate 2 applies.

## Still required for Gate 3 pass (needs founder-owned projects)

1. Controlled two-tenant live isolation run (`verify:tenant-production-isolation`) with recorded JSON.
2. Backup (`pg_dump`) + restore into a DISTINCT owned project with before/after counts, permission checks, secret handling, measured RPO/RTO.
3. Upgrade of the restored copy + restored-pending-queue proof (no duplicate external sends).
4. Operator recovery instructions published from the recorded run.
