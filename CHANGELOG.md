# Changelog

## 2026-10-07

- Make copyable agent briefs recover clearly when clipboard access is unavailable, retain the full text for manual copying, and provide mobile-sized Copy controls. Pending copies disable repeated requests; settled feedback belongs to the mounted screen and reset timers are cleaned up. Agent entrypoint checks name missing instruction files instead of throwing file errors; regression cases cover missing files and conflicting pickup policy. Repository identity recognizes standard SSH port 22 while keeping custom ports distinct.
- Integrate contributor repository validation and approved-source recovery. Preserve the matching recovery in the natural-language runner's next step instead of suggesting credential setup for missing or mismatched source.
- Make setup and extension entry points agent-first. Owners give Claude Code or Codex a business brief and review the working result; agents handle configuration, implementation, registration and verification. Guides explain the work saved by shared records and services, distinguish proposed Apps from bundled features, and remove claims that registration automatically implements approvals or audit behavior.
- Retain a focused contributor-guide screenshot artifact alongside the complete browser evidence, so reviewers can inspect agent setup and extension guidance without downloading unrelated journeys.
- Align Claude's entrypoint with the canonical explicit-backlog rule and verify that it preserves the user's latest scope. Generic completion requests continue the current task. Contributor review captures wait for reveal readiness and finish finite animations before saving readable desktop evidence.

Notable changes to this repository — the codebase, tooling, and open-source infrastructure. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Product-facing updates (features, fixes, and improvements to the live application) are tracked separately at [/changelog](https://www.acceleratewith.us/changelog) and [src/content/changelog.ts](src/content/changelog.ts).

## [Unreleased]

### Added

- Add `npm run example:followup` to exercise the actual Pipeline follow-up report against fixed fictional opportunities. The developer guide verifies the original seven-day rule and a three-day source adaptation without provider accounts.
- Add an export-based Site Studio content-draft preparation command. It validates the website document, preserves the owner's identity, page IDs and unrelated content, includes current screenshot revisions, and writes a separate file without saving or publishing a connected website.

- Owner-first admin navigation uses one business-group registry, with visible purpose descriptions and preserved destination IDs. Page guidance adds starting instructions, saved-result context and links to connected walkthroughs. Today reviews sourced sales, customer follow-up, delivery and payment work without inventing financial totals; custom views retain their arrangements.
- Owner and daily guides now teach inquiry replies, client handoffs and invoicing through their saved results. Demo QA waits for the installed scenario runtime before reading protected API fixtures.
- Revenue and Analytics report tools and JSON/CSV exports share dashboard services. Reviewed operation mappings are generated from the tool registry; new unreviewed handlers or tools fail the inventory gate. Existing coverage gaps stay explicit.
- The Command Center search palette now opens tasks, opportunities, clients and proposals alongside people, pages and commands. Tenant-bound reads respect module configuration; grouped results include status context, keyboard selection stays visible, sequential task links cannot bind the previous task’s cached details, and proposal links resolve outside the current list filter.

- AI can now prepare exact Content Calendar item updates for administrator approval. The admin editor and approved-action executor share a tenant-scoped, revision-checked writer; approval does not publish content.

- Shared themed fields now govern Clients, Analytics, Campaigns, Integrations and Proposals; compact custom themes retain usable targets. Setup readiness inherits readable theme colors, and contact relationship failures offer retry instead of appearing empty.

### Fixed

- First-release preparation accepts an explicitly empty supported-version list. The CLI still refuses missing option values, empty required inputs, invalid source tags and unreviewed source; a clean-repository regression exercises the actual preparation command.

- Keep exact-change AI reviews at their reading position through pending reads and chat resizes. Automatic following pauses until review ends, preserving the visible consequence and decision controls. Browser acceptance resizes the real viewport and verifies all six fictional businesses on desktop and mobile.

- Feature-page images and enlargement links reuse the docs' content-hash cache keys. Refreshed gallery images use new filenames so optimized copies do not obscure interface changes; previously published assets remain available.

- Work task selection now keeps its exact URL and independent read/retry lifecycle. Editable instructions reuse the existing task writer; pending edits lock the form, failed confirmations retain drafts, and late reads or saves cannot target the next inspector. Source links use stored identifiers in Work and legacy Today.

- Client detail uses independently recoverable queries for the record, activity and follow-ups. Failed refreshes retain loaded data and local edits; native forms validate nonnegative cent values and lock pending submissions. Follow-up creation refreshes related history and Work/Today caches.

- Installation website save, reload and import now share a synchronous operation lock. Failed reloads retain local edits and undo, leaving ignores late responses, and success requires a matching version and publication receipt. Initial load failures offer a direct retry; editing and Undo/Redo clear outdated success messages.

- Private page drafts now reuse the validated iframe preview with real responsive viewports and public page styling. Links, including keyboard and middle-button activation, stay inside the preview; FAQ disclosure remains interactive.

- The fictional Site Studio demo now supports private draft creation, renaming and checksum-checked discard through shared draft rules. Scenario-local receipts appear in Activity; AI examples use the template without a provider call.

- Site Studio previews AI suggestions before applying, forwards cancellation through the existing model gateway, and rejects late or stale replies. Page-scoped tools preserve custom addresses and enforce validated section limits.
- Contributor pickup identifies the blocked card and separates missing approved commits, unavailable branches, ancestry mismatches and fetch failures before claiming. Recovery guidance preserves the approved source and directs card corrections through revision-checked edits.
- Standing-permission execution preserves partial service outcomes in the tool response instead of labeling every admitted action executed. Human-review and record-permission checks remain required.

- Analytics refuses incomplete primary datasets and discloses degraded auxiliary sources. Website capture freshness uses the latest event timestamp. AI capability search distinguishes registered tools from execution readiness and offers retry after loading failure.
- Proposal forms reset when opening another record, rejected saves retain the draft for retry, and sent/viewed edits open the returned successor draft. Late completions preserve the current record. Saved changes and failed list refreshes receive separate feedback; clipboard success waits for confirmation and failed copying selects the link for manual copying.

- A newly connected workspace can add a contact directly from Contacts and create a follow-up from that contact's record. The task is linked to the contact timeline and refuses cross-workspace contact IDs. The fictional demo persists newly added contacts instead of claiming success without saving them.

- The local cold-start PostgreSQL check now reports a clear version requirement before migrations; self-hosting and recovery guides specify PostgreSQL 15+ for this native test.

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
