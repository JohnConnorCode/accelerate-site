# Gate 4 — Local extension-contract results (2026-09-24)

Commit: `02e68f37 (origin/main; initial measurements taken on 8b39fd17, re-validated here)`. LOCAL contract checks only. No independent third-party build yet. This does NOT pass Gate 4.

## Passes

- `npm run verify:extensions`: in-sync. 13 manifests, 10 nav links. Exit 0.
- `npm run verify:module-contract`: 62 admin routes, 111 AI tools, 26 setup checks on main tip. Exit 0.
- `npm run verify:module-route-guards`: passed, 18 modules, 32 files. Exit 0.
- `npm run test:plugin-modules`: all 34 modules (13 from manifests) + contract gates passed. Exit 0.
- `npm run test:business-workflows`: isolated plans create canonical tasks through approval; replay/invalid/disabled refused. Exit 0.
- Dependency skew note from Gate 2 applies.

## Still required for Gate 4 pass (needs a real outsider)

1. Independent builder uses ONLY public instructions (`extensions/README`, `EXTENDING.md`, `PLUGIN-DOCUMENTATION.md`, public docs) to build one small extension. No core edits, no insider help.
2. Extension installs, runs an approved workflow, survives a host upgrade (pending proposals fail closed via `contractHash`, fresh prepare succeeds, receipts survive), disables without losing history.
3. Out-of-bounds attempts (new action type, unknown source, secret setting, raw SQL) rejected with documented errors.
4. Remote/registry install and versioned contract ranges remain backlog — Gate 4 claims only the documented bundled-manifest path unless the founder scopes otherwise.
