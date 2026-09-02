# Extensions

Drop a `*.module.json` manifest in this directory to register a new module
without editing any core array.

A manifest declares what a module _is_: its identity, the navigation entries it
owns, the admin routes it serves, the AI tools it contributes, and the Setup
Center checks it depends on. It never contains code. Revenue OS does not
execute anything from this directory, which is the invariant that lets a
workspace enable and disable modules safely, and lets an operator read exactly
what a module can reach before installing it.

## Adding a module

1. Write `extensions/<your-module>.module.json`. See
   `extensions/example-inventory.module.json` for a complete, working example
   and `docs/contributing/EXTENDING.md` for the full field reference.
2. Create the pages your manifest declares, at the paths it declares. Next.js
   file-based routing picks them up; the manifest is what makes them appear in
   navigation and the modules console.
3. Run `npm run build:extensions`. This validates every manifest and regenerates
   `src/lib/revenue-os/extension-modules.generated.ts`, which is committed.
4. Commit both the manifest and the regenerated file. CI fails if they drift.

## What a module inherits for free

Registering here means the module is governed like everything else, with no
extra work:

- Its navigation entries disappear when a workspace disables it.
- Its AI tools report as unavailable to the agent and to MCP when it is off.
- Its pages show a disabled notice rather than dangling, and its own API
  routes refuse the request if the module declares them in
  `MODULE_API_DIRECTORIES` (`scripts/verify-module-route-guards.mjs`) — a
  manifest-registered module's routes must be added there to get the same
  refusal a core module's optional routes get.
- Every write its code performs through the canonical services lands in the
  audit ledger, and every AI proposal it contributes goes through the same
  approval queue as everything else.

## What a manifest cannot do

- It cannot override or disable a core module. Core is compile-time and
  non-overridable by design.
- It cannot introduce executable code, an icon component, or a raw SQL
  migration. Icons are chosen from the allowlist in
  `scripts/build-extension-modules.mjs`; schema changes are ordered migrations
  in `migrations/`, reviewed like any other.
