# Accelerate Revenue OS agent contract

This file is the mandatory starting point for every implementation agent. The
goal is repeatable delivery by agents with different capability levels, without
rediscovering architecture or inventing new write paths.

For local exploration, follow [Start development](docs/contributing/DEVELOPER-START.md)
and open the fictional demo. It requires no provider or database credentials.
For a connected installation, follow
[the self-hosting guide](docs/self-hosting/SELF-HOSTING.md). Shared ticket pickup
also requires the scoped access described below.

<!--
agent-execution-trigger:
  intent: backlog-pickup-and-completion
  phrases: [pick up backlog work, take the next task, continue the board, finish and commit, follow protocol]
  first_action: npm run agent:go -- --json
  terminal_states: [HANDOFF_SUBMITTED, BLOCKED_REQUIRES_OPERATOR]
-->

## Natural-language execution trigger

If the user asks to pick up backlog work, take the next task, continue the
board, finish and commit, or follow protocol, treat that plain-language request
as an execution command. The user does not need to provide a card key or know a
CLI name. After reading this entrypoint, run the internal `agent:go` runner and
continue through implementation, verification, exact commit and evidence
submission. Do not stop at orientation, `git status`, `git log`, a broad
documentation scan, or a status-only answer. Stop only after handoff submission
or a precise operator-required block. Read the complete contract in
[Natural-language agent execution](docs/contributing/NATURAL-LANGUAGE-AGENT.md).

Never ask the user to paste board credentials, database credentials, tokens or
secrets, and never offer “work unclaimed” or “prepare only, wait” as choices.
Resolve the private configured transport automatically. This includes the
ignored remote profile and an explicitly authorized local-operator profile with
its named project; profiles live in the Git common directory and are available
to every worktree. If access is missing, return `SETUP_REQUIRED` with the setup
instruction and make no claim or shared work mutation.

## Operating guidance and accumulated lessons

- Read the northstar first, then this contract and the task's relevant references.
  `CLAUDE.md` is an entrypoint, not a second engineering policy. For this repository,
  the explicit resource and verification rules below replace generic every-commit
  build guidance. Keep other projects' global defaults unchanged.
- Establish facts before acting: checkout/root, origin, account, exact candidate,
  environment and work ownership. A directory name, old branch, cached remote ref,
  historical receipt or HTTP 200 is not current readiness evidence.
- Resolve routine problems inside the authorized scope. If access is missing,
  provide the actual connection step and continue independent work. Separate an
  account mismatch from a provider restriction, a missing dependency from a code
  defect, and incomplete verification from a failed product. Do not report an
  error as an unexplained dead end or invent proof to move past it.
- Repeated feedback is evidence of a shared-system defect. Fix the owning primitive
  or workflow, inspect its other consumers, and verify the user-visible outcome.
  Do not keep adding route-specific patches for shared motion or navigation.
- Preserve another agent's work even when it looks old. Completed, accepted,
  integrated and deployed are separate states. Pin handoffs, retain exclusions,
  and use the live board for claims rather than inferring ownership from files.
- Capture reusable lessons where they belong: broad operating invariants here,
  domain behavior in its linked contract, commands in the existing doctor/verifier,
  and transient SHAs or failures in dated receipts. Add a focused regression when
  a meaningful failure can be checked automatically; do not add duplicate guides,
  new approval gates or broad tests just to memorialize an incident.
- Close the loop with a concrete result: what changed, exact evidence, remaining
  limitation and the next responsible action. A written plan or green branch alone
  is not a completed integration or production release.

## Maintainer integration

Published `main` is the control baseline. Before integrating or merging agent work,
run `npm run dev:doctor -- --maintainer` and follow
[Development baseline](docs/contributing/DEVELOPMENT-BASELINE.md). Use the declared
GitHub account, retain required CI, and never introduce a self-approval deadlock.
One integration owner pins the candidate; other agents keep their isolated work.
After squash merge, record tree parity and close proven superseded PRs without
removing active worktrees. This does not authorize production deployment.

## Pick up and resume work

Run `npm run agent:go` for the natural-language backlog flow. It performs
read-only setup checks, selects one ready Now/Next card, claims it atomically,
creates the approved isolated worktree, repairs deterministic generated-report
drift there, and prints the complete continuation packet. Use `--json` for an
agent client and `--card <key>` only when the user explicitly names a card.

The lower-level `agent:next` command remains available for compatibility and
manual diagnostics. Start with [the developer handoff](docs/contributing/DEVELOPER-START.md)
when setting up a machine; do not make the user repeat those protocol details
for ordinary backlog execution.

Read [the work protocol](docs/contracts/UNIVERSAL-WORK-BOARD.md) when setup or
recovery requires detail. Configure `WORK_BOARD_URL` and a project-scoped
`WORK_BOARD_TOKEN` issued by the founder; the runner reports missing setup
without claiming work. `agent:go` delegates the atomic claim to the canonical
dispatcher and prints the full live contract. A worktree requires the card's
approved repository base branch and exact commit. Never guess a base or fall
back into another agent's checkout.

Use `agent:status`, `agent:heartbeat -- --card <key>`, and
`agent:release -- --card <key>`. `agent:complete -- --card <key>
--evidence-file <path.json>` submits named passing checks and the exact commit
for review. It preserves the worktree. Completion, review, merge, cleanup and
production deployment are separate facts/actions. Keep claim session files
private and renew within the 30-minute lease; expired work requires explicit
operator recovery. There is no force bypass.

## Read in this order

1. `docs/NORTHSTAR.md` for the platform vision: agent-native business runtime,
   Coworkers, WorkItems, capability graph, autonomy ladder, and implementation phases.
2. The live card and its structured execution packet. Git templates are historical
   references, not permission to overwrite a newer live specification.
3. `docs/contributing/AGENT-TICKET-RUNBOOK.md` for the pickup, execution, evidence, and handoff
   procedure.
4. `docs/contracts/FEATURE-BOARD-TAXONOMY.md` before adding, relabeling, promoting, or
   reorganizing backlog cards.
5. `docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md` for data, automation, AI, security,
   and failure invariants.
6. `docs/contracts/MULTI-TENANCY-CONTRACT.md` before changing schema, authorization,
   admin routing, public intake, integrations, jobs, or tenant configuration.
7. `src/lib/revenue-os/README.md` for authoritative modules and callers.
8. `docs/self-hosting/REVENUE-OS-SETUP.md` when the ticket touches schema, providers, secrets,
   health, or production activation.
9. `docs/contracts/MARKETING-POSITIONING-CONTRACT.md` before changing any public marketing
   copy, metadata, search description, public assistant positioning, or CTA.
10. `docs/contracts/NAVIGATION-RUNTIME-CONTRACT.md` before changing links, history,
    scroll restoration, route focus, loading states, or page transitions.
11. `docs/contracts/ADMIN-DEMO-CONTRACT.md` before changing either demo, the admin runtime,
    admin navigation, demo fixtures, or demo QA.
12. `docs/contracts/WORK-MOTION-CONTRACT.md` before changing Work pages, public reveal
    primitives, scroll behavior, or portfolio animation QA.

After pickup, run `npm run verify:agent-contract` in the worker checkout as part
of the packet's verification. A stale dated generated report is repaired by
`agent:go`; a true contract or card failure remains an actionable block.

## Inspect before claiming

`npm run agent:show -- --card <key>` prints the live packet without claiming.
Add `--json` for machine-readable output. A feature or bug must have an explicit
north star outcome, current gap, scope, exclusions, references, ordered steps,
recovery cases, repository base and acceptance-linked verification environments.
The service reports missing contract fields instead of claiming incomplete work.
`npm run backlog:snapshot` explicitly refreshes the dated report input; ordinary
verification is offline and does not rewrite live work or shared source files.

## One operating path

Every capability follows this sequence:

`entrypoint -> authenticate/validate -> resolve identity -> claim/idempotency -> domain service -> immutable receipt/activity -> audit -> operator surface`

- Route handlers, UI components, cron routes, webhooks, and AI tools are adapters.
  They do not own business rules.
- Domain writes belong in `src/lib/revenue-os/` and must be reused by UI, AI,
  integrations, and automation.
- External effects require a deterministic idempotency key and a truthful
  terminal receipt. HTTP 200 alone is never proof of success.
- AI reads bounded live context. AI writes and external actions enter
  `action_queue` and use the same validated service as the normal UI after the
  required founder confirmation.
- Canonical IDs win over email joins. Ambiguous identities are review work, not
  permission to guess.
- Provider facts and audit history are immutable. Human notes and configuration
  are editable through explicit services.

## AI and admin operation parity

Read [the universal AI/admin contract](docs/contracts/ADMIN-AI-PARITY.md) before
adding or changing admin business controls, mutation routes or plugin operations.
Every authorized admin operation must have a governed conversational equivalent:
shared service, exact proposal, human approval, freshness/permission recheck and
truthful receipt. Missing parity belongs on the live board, not in an implicit
exception. Update the source inventory after reviewing changed route operations.

## The live board owns work truth

- Use the configured database-backed canonical service or scoped CLI for board
  operations. Do not use browser UI for routine board management or ask the
  founder to navigate it when an authorized service path is available. Browser
  use is reserved for requested visual/interaction verification. Preserve actor
  permissions, revision checks, leases and immutable receipts; direct row updates
  are not a replacement for lifecycle operations.
- Carry explicit founder recovery authorization through the scoped recover/reopen
  operations and normal reclaim in the same task. Do not repeat the permission
  question. Keep operator recovery authority separate from worker review rights.
- Read one relevant card with `agent:show -- --card <key> --json`; summarize only
  the fields needed for the next decision. Do not dump the full board for a
  specific task. Reuse prior inspection and batch independent bounded reads.

- `/admin/features` and the shared work service own card definitions, UUID
  dependencies, revisions, claims, decisions and immutable execution events.
- Git contains schemas, card templates and explicit dated exports. Edit a live
  card through the UI, scoped HTTP/MCP API, or a reviewed import plan. Never use
  an old checkout to overwrite newer specifications or archive unlisted cards.
- `npm run seed:features -- --plan /tmp/work-plan.json --cards key1,key2` creates
  a proposal. Review its full diff before `--apply --plan /tmp/work-plan.json`.
  Revision conflicts require refresh and review; retry identical requests with
  the same request key. See the work protocol for exports and reconciliation.
- Newly discovered work becomes a detailed card with a stable key, explicit
  prerequisites, scope, references, acceptance and verification. No second roadmap.
- Keep labels inside `docs/contracts/FEATURE-BOARD-TAXONOMY.md`: one milestone,
  category, phase, and one or two reusable capabilities. Never add one-off labels.
- Submit implementation evidence for review only after every acceptance item is
  verified. Local success cannot satisfy an item that requires production proof.
- Never delete source tables or compatibility routes until the reconciliation
  card proves field and row-count parity in production.

## Documentation

Read [the documentation writing guide](docs/contributing/DOCUMENTATION-STYLE.md)
before changing product guides. Verify screen names and data-source claims against
the current code; explain the steps, saved result and recovery in plain language.

### Keep public release information synchronized

For every feature or capability change, review and update the organized public
platform guides in `src/content/docs/`, the product changelog in
`src/content/changelog.ts`, and the Command Center descriptions in
`src/content/command-center.ts` and `src/content/command-center-faq.ts` in the same
PR. Updating a repository README or an internal design document alone does not
satisfy the public documentation requirement. Use `docs/contributing/DOCUMENTATION.md`
for the required release-content review, metadata, generated index and proof.

## Safe change rules

- Preserve unrelated worktree changes. Inspect `git status --short` before edits.
- Use additive, ordered, idempotent migrations. Never silently mutate production
  schema from an application request.
- Migration delivery includes execution and live verification. Do not hand SQL
  files back for manual dashboard work. Run
  `npm run db:migrate -- <migration.sql>` only after the resolved project and
  pooler host match the intended environment. Database credentials belong in an
  approved local secret manager or environment, never in the repository or
  command output. Public contributors must use a project they control.
- Platform administration is founder-only and fail-closed through `ADMIN_EMAIL`.
  Tenant workspaces require an authenticated active membership and explicit
  tenant context in both middleware and API authorization. Never weaken either
  boundary for testing.
- Secrets remain in environment configuration or encrypted server-only storage.
  Never log or return tokens, service keys, raw customer messages, or prompts.
- Calendly remains optional and disabled unless a card explicitly activates it.
- Shared-database multi-tenancy is the chosen product shape under
  `shared-database-multi-tenancy-contract`: one application and Supabase database,
  explicit tenant ownership on every operational row, tenant-composite identity
  and idempotency, membership-plus-context RLS, and tenant-bound provider/public
  execution. The former instance-per-client card is historical evidence only.
- Do not introduce another analytics, email, AI, or scheduling provider when the
  card can use the existing first-party/Supabase, Resend, configured AI, or Google
  Workspace paths.

## Release authority and repository reconciliation

- Before hosting diagnosis, read `deployment-target.json` and the account preflight in
  [DEPLOY.md](DEPLOY.md). Verify the exact project/team with `npm run deploy:check`
  before pulling configuration or building. A wrong CLI login is not evidence of
  a provider suspension; establish account access before researching hosting errors.

- Production deployment is founder-controlled. Never deploy, alias, promote,
  roll back, or otherwise change the live site unless the founder explicitly
  instructs that production action. Completing, committing, or verifying work is
  not deployment authorization, and an earlier deployment instruction is not
  standing permission for a later release.
- When the founder explicitly requests a release, inspect every repository
  worktree and local branch before building. Reconcile all completed, in-scope
  agent work into the release branch, preserve incomplete or unrelated work, and
  stop when ownership or readiness cannot be established safely.
- Commit and verify the complete release tree before building it. Deploy that
  exact immutable commit only; if the tree changes after verification, repeat the
  required verification before deployment.
- A release handoff records the commit SHA, deployment receipt, canonical alias,
  verification evidence, and final repository status. Never claim that all agent
  work shipped from a clean primary worktree alone; the worktree and branch audit
  is required evidence.

## Local resource budget

- Run only one heavy job at a time across worktrees. Never overlap builds,
  typechecks, full suites, or browser QA on the development machine.
- `build`, `build:qa`, and `typecheck` use the shared resource gate. Wrap other
  heavy commands with `npm run resources:run -- <command> [args...]`.
- If the gate refuses or stops work, retain the failed receipt and address the
  resource constraint. Do not bypass it, retry repeatedly, or raise limits to
  force a pass. Use a suitable remote runner for larger verification.
- The optional [machine supervisor](scripts/supervisor/README.md) coordinates registered local sessions and the same heavy slot. It stays off until configured. Use its ownership-checked recovery; never delete a live holder or run old supervisor copies against migrated state.
- Reuse compatible installed dependencies; do not copy dependency trees for
  each check. Remove only your own disposable build/browser output after use.
- Close servers and browsers you start when their check ends. Inspect ownership
  before stopping any pre-existing process; never force-quit unrelated apps.

## Verification minimum

For every code ticket:

1. `npm run verify:agent-contract`
2. TypeScript validation: `npm run typecheck` or a successful production build
   of the same relevant source tree (the build includes type checking).
3. `npm run lint`
4. The closest scoped unit, API, or Playwright journey named by the card
5. `npm run build` before a shipped application-code handoff. Documentation or
   tooling-only changes use their scoped checks when application/build inputs are unchanged.
6. `git diff --check`

Run expensive verification once for the final relevant source tree, not again
merely to commit or update ticket prose. Rerun affected checks when inputs change,
a failure is fixed, or new evidence warrants it. Commit hooks must be fast and
offline; live Feature Board checks remain explicit operational commands. See
[verification workflow](docs/contributing/VERIFICATION-WORKFLOW.md).

Visual and interaction work additionally requires repository Playwright at the
affected desktop and mobile widths, opened screenshots, console-error checks,
keyboard coverage, and reduced-motion coverage where motion is involved.

Data, job, webhook, send, or integration work additionally proves happy path,
duplicate/replay, invalid input, provider failure, truthful receipt, and safe
retry behavior. Never test destructive behavior against uncontrolled production
records.

## Outcome acceptance for visual work

- Translate feedback into observable acceptance before editing. Preserve the
  user's actual outcome, not a convenient proxy. “Use icons intelligently” means
  every icon must communicate a distinct object, action, or state; it does not
  mean swapping one repeated glyph for another or enforcing an arbitrary count.
- Shared behavior belongs in a shared primitive or contract. A route, appearance,
  demo scenario, viewport, or loading path must not need a local patch to receive
  the same motion, field, surface, or navigation behavior.
- Verify the states the user can see: first/direct load, prefetched navigation,
  slow streamed navigation, committed content, mobile, desktop, reduced motion,
  empty, populated, and error states when applicable.
- Never treat source presence as visual evidence. Browser QA must assert the
  intended computed behavior and screenshots must be opened and inspected.
- Do not mark visual work complete because the implementation exists. Completion
  requires evidence that the requested outcome is perceptible, coherent, and
  consistent in the rendered product.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Plugin documentation requirement

Every plugin change must satisfy the [plugin documentation contract](docs/contracts/PLUGIN-DOCUMENTATION.md).
Ship the operator guide, public documentation link, worked example, cost and
permission boundaries, recovery steps, extension references and task-based review
evidence with the implementation. `verify:extensions` enforces bundled guide and
link presence; factual review and end-to-end proof remain required.
