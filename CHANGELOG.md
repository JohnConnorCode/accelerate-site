# Changelog

Notable changes to this repository — the codebase, tooling, and open-source infrastructure. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Product-facing updates (features, fixes, and improvements to the live application) are tracked separately at [/changelog](https://www.acceleratewith.us/changelog) and [src/content/changelog.ts](src/content/changelog.ts).

## [Unreleased]

### Added

- AI can now prepare exact Content Calendar item updates for administrator approval. The admin editor and approved-action executor share a tenant-scoped, revision-checked writer; approval does not publish content.

- Shared themed fields now govern Clients, Analytics, Campaigns, Integrations and Proposals; compact custom themes retain usable targets. Setup readiness inherits readable theme colors, and contact relationship failures offer retry instead of appearing empty.

### Fixed

- Bundle licensed fonts locally so production and cold-install builds no longer depend on Google Fonts availability. Existing font families and theme variables are preserved.

- Shared record openers, keyboard actions and public motion behavior are reconciled across the admin workspace. Production builds retain native document-runtime verification while using the stable Webpack path and Next.js proxy convention.
- Offline drafts report success only after a committed browser transaction. Snapshot identity and cancellation protect workspace switches and sign-out; incomplete reads cannot replace a saved summary. Storage failures retain draft text, and saved drafts are readable and reusable.

- Contact intake now labels the From/To date range, keeps both dates together and aligns search using the shared filter toolbar.

- Contact and client timeline cards now share consistent spacing, quieter surfaces, visible link indicators and keyboard focus, without cascading entrance delays.

- Tasks & approvals now uses a compact desktop filter toolbar, aligned task metadata, visible completion labels, and filter reset with a result count. Small screens retain readable stacked controls. Pipeline groups standard/saved views, preserves active-filter summaries and moves view management into a labeled disclosure.

- Sign-in and password-reset labels now identify and focus their fields for screen-reader and keyboard users.

- Shared admin error recovery no longer claims a failed screen made no changes or displays raw exception text. The public error page uses a single accessible home link instead of nested interactive controls.

- Shared request limits now use an atomic database window across server instances, preserve route-specific quotas and refuse protected actions when enforcement is unavailable. Installation and recovery documentation covers migration ordering, backups and independent launch acceptance.

- Cold installations reject missing, placeholder and malformed public database configuration before login. Forks deploy on Git pushes without paid cron requirements; original releases retain explicit production schedules. Setup guidance puts required inputs and a saved first task before optional providers.
- Cold-start verification now keeps route fingerprints, public check counts and workflow assertions synchronized. Production builds enable Next.js compiler memory optimizations while preserving TypeScript validation and existing resource limits.

- Homepage marquee ("how we help" ticker) sat invisible for 8.3s before fading in; reduced to 0.3s.
- Module enablement now actually gates routes, not only navigation. A disabled module's pages show a notice and its API routes refuse the request; before this, both still answered.
- The MCP server negotiates protocol version against the client's request instead of a hardcoded constant, and now supports CORS and session IDs, fixing real compatibility with ChatGPT's native Connectors and other current MCP clients.
- The integration adapter registry is now the actual resolution point for WhatsApp and HubSpot writes, replacing a duplicated if/else chain its own documentation had already claimed it replaced.

### Added

- Optional Command Center installation on a configured app origin, with network-only private requests, connection/update status and tenant/user-scoped local drafts.
- Agent handoffs normalize capability requirements, renew verification claims and checkpoint safe unfinished source without credentials.

- A public **How Accelerate works** guide covering the five runtime layers, shared records and evidence, approvals and receipts, interfaces, plugins and Apps, coding-agent execution, failure recovery, and the path from source data to a recorded result.
- Natural-language backlog execution for coding agents. A plain-language request selects one eligible task, creates its approved worktree, and carries the worker through verification, commit, and evidence submission without requiring a ticket key or internal command name.
- Owner-authorized local operator profiles are now detected across worktrees, so the same plain-language flow can use the canonical local Supabase board without a credential prompt; remote workers keep scoped HTTPS transport.
- Reviewed Radar outreach: shared draft preparation, exact approval, consented introductions, canonical sender, durable reservations, cooldowns, daily limits and receipt recovery. Default remains draft-only.
- Transactional proposal lifecycle and successor revisions, source-output health with live processing backlog, unified booking readiness and registered model-job attribution.

- Opportunity Radar foundations: versioned sources, reviewed assessments, shared Today/detail/history pages, saved drafts, source-backed relationship reviews, and explicit model budgets. Automated discovery, publication, and verified outcome measurement remain unfinished.
- A public Radar operator guide in the organized `/docs` library, with navigation, search, and AI-readable index coverage.
- Strict documentation coverage against built pages, internal anchors, and registered tool/capability references.

- Prettier formatting, enforced in CI.
- Product changelog page gained category filtering and full-text search.
- `propose_task_update`: an MCP tool and admin AI capability to complete, snooze, or edit an existing task, staged through the same approval queue as every other mutation.

### Changed

- `src/lib/revenue-os/README.md` now documents all domain modules.

## [0.1.0] — 2026-08-31

- Initial open-source release.
