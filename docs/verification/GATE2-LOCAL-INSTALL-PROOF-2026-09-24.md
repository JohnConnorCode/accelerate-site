# Gate 2 — Local install-proof results (2026-09-24)

Commit: `02e68f37 (origin/main; initial measurements taken on 8b39fd17, re-validated here)` (branch `gate-launch-evidence-20260924` (based on origin/main 02e68f37)).
Scope: LOCAL automation only. No live Supabase. No hosting. No second person. This does NOT pass Gate 2.

## Passes (local)

- `npm run test:install-runbook`: PASSED (`result: passed`, receipt `/tmp/accelerate-install-runbook.json`). Docs/commands, fail-closed config, ledger integrity, demo boundary, fork isolation proven on fixtures.
- `node scripts/test-neutral-export.mjs`: PASS. Export replaces protected content, omits media/private/untracked, refuses escapes/symlinks/overwrites.
- `npm run verify:oss`: passed (1950 files, 15 community files, 7 patterns).
- Manual neutral export to `/tmp/neutral-gate1-check` (since removed): 1697 files, no `public/`, empty team, no owner identity.

## Environment note

Checkout `node_modules` was a botched nested symlink (`node_modules/node_modules`). Repaired to a proper symlink reusing the PWA worktree's installed tree (read-only reuse, no copy). Dependency skew recorded: installed tree is NEWER (next 16.3.5, react 19.3.0) than this checkout's lock (next 16.3.4, react 19.2.8). Light script results above are valid; exact-tree typecheck/lint/build remain blocked on disk (heavy gate: 4.6 GiB free, 5 GiB required — receipt retained, no bypass).

## Still required for Gate 2 pass (needs founder-provided env + people)

1. Clean clone + new independently owned Supabase + hosting, following SELF-HOSTING.md.
2. Owner sign-in, contact+task create, reload, complete, sign-out/return on desktop + phone.
3. Second person follows revised guide unaided. Every insider-knowledge fix recorded.
