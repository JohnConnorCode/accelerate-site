# Changelog

Notable changes to this repository — the codebase, tooling, and open-source infrastructure. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Product-facing updates (features, fixes, and improvements to the live application) are tracked separately at [/changelog](https://www.acceleratewith.us/changelog) and [src/content/changelog.ts](src/content/changelog.ts).

## [Unreleased]

### Fixed

- Homepage marquee ("how we help" ticker) sat invisible for 8.3s before fading in; reduced to 0.3s.
- Module enablement now actually gates routes, not only navigation. A disabled module's pages show a notice and its API routes refuse the request; before this, both still answered.
- The MCP server negotiates protocol version against the client's request instead of a hardcoded constant, and now supports CORS and session IDs, fixing real compatibility with ChatGPT's native Connectors and other current MCP clients.
- The integration adapter registry is now the actual resolution point for WhatsApp and HubSpot writes, replacing a duplicated if/else chain its own documentation had already claimed it replaced.

### Added

- Prettier formatting, enforced in CI.
- Product changelog page gained category filtering and full-text search.
- `propose_task_update`: an MCP tool and admin AI capability to complete, snooze, or edit an existing task, staged through the same approval queue as every other mutation.

### Changed

- `src/lib/revenue-os/README.md` now documents all domain modules.

## [0.1.0] — 2026-08-31

- Initial open-source release.
