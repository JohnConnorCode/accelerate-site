# Xero connection foundation — handoff note

Date: 2026-10-17 UTC
Branch: `feat/xero-connection-foundation-20261017`
Base: `9a420f2e0848623481f61d950da4615d9041114a`
Status: **source complete and tested; blocked from landing by two repo gates**

## What is here

- `src/lib/revenue-os/xero-oauth.ts` — signed, tenant-bound, expiring OAuth state,
  namespaced (`xero-oauth-state.v1:`) so a Xero binding cannot be replayed as a
  Google one.
- `src/lib/revenue-os/xero.ts` — authorize URL (`offline_access`), code exchange,
  connection save, token refresh and a bounded connection probe. Encodes two Xero
  specifics: data calls need the `xero-tenant-id` header, and the refresh token
  **rotates on every refresh**, so the new value is always persisted.
- `src/app/api/admin/xero/{authorize,callback}/route.ts` — OAuth redirect routes.
- `scripts/test-xero-oauth.ts` — 11 checks (state binding, authorize URL, Basic
  auth on the token endpoint, encrypted save, rotation persistence, cached-token
  reuse, verification, `invalid_grant` → revoked, no-organisation refusal).
- `xero` added to the providers `disconnect` enum and `WORKSPACE_PROVIDERS`.

Two source bugs the tests caught and fixed: `xeroFetch` dropped the machine error
code (so `invalid_grant` would never mark a connection revoked), and a swallowed
catch rejected by `verify:agent-contract`.

## Why it cannot land yet

CI on the first revision failed two gates, and they are mutually blocking for an
OAuth-only connector:

1. **`admin-ai-inventory`** — every new `/api/admin/*` handler needs a reviewed
   semantic binding (admin/AI parity). The Google OAuth handlers are pre-existing
   unreviewed entries in the committed inventory; a *new* OAuth redirect handler
   cannot be added without a governed conversational equivalent. An OAuth redirect
   route has no honest AI-tool parity, so this needs an explicit decision, not a
   shortcut.
2. **`verify-wiring` (`unwired-module`)** — a new `src/lib/revenue-os` module needs
   a runtime caller, so the library cannot land without the routes that gate 1
   blocks.

Per the repository contract, missing parity belongs on the live board rather than
an implicit exception, so this branch is preserved and not forced through.

## What is required before this lands

1. A decision on the admin-route parity model for OAuth redirect handlers
   (reviewed semantic binding, or a documented exclusion that Google's handlers
   should also adopt).
2. The registry split: `QuickBooks / Xero` is currently one `planned` entry.
3. The invoice → canonical mapping (per-organisation, currency, tax) before any
   sync; the registry entry stays `planned` and no public changelog/docs entry is
   added until the connector is user-reachable.

## Verification on this branch

`npm run typecheck` exit 0, `npm run lint` exit 0, `npm run verify:agent-contract`
passed, `test:xero-oauth` (11 checks) and `test:google-fetch-retry` (5 checks)
passed, plus the neighbouring gmail/integration/workspace suites. CI was not green
on this branch because of the two gates above.
