# Historical acceptance reconciliation

Card: `historical-acceptance-reconciliation` (rev 6, base `agent/backlog-execution-quality @ 7dac45d`).
Date: 2026-09-10. Environment: local worker checkout (no production mutation).

## Sources compared

1. Original acceptance: live snapshot `docs/planning/backlog-snapshot.json` (exported 2026-09-05T20:30:43Z). All 14 shipped cards below are **rev 1 with zero structured acceptance items** — they predate the structured-acceptance format. There is no original per-AC text to re-verify; the discrepancy is structural, not a code-absence signal.
2. Dated evidence: audit `docs/planning/backlog-audit.json` / `docs/planning/BACKLOG-AUDIT.md` (audit of the 2026-09-05T19:55:31Z export). Disposition for all 14 is `investigate evidence`.
3. Integrated code: this checkout's `src/lib/revenue-os/` domain modules (authoritative per `src/lib/revenue-os/README.md`) plus the named UI/docs surfaces.

## Finding (applies to all 14)

Every unverified prerequisite named in the audit is currently in a **non-shipped** state (`planned`, `backlog`, or `blocked` — see table). A shipped rev-1 card cannot have had a build-time dependency on work that never shipped. These UUID dependencies were attached later during backlog structuring/audit, not at original implementation time. Disposition: **dependency-added-later, not missing proof**. No rebuild of shipped services is warranted (per card exclusions). Historical shipped decisions are preserved as-is.

Prerequisite states (from `backlog-audit.json`):

- `system-health-report`: planned/clarify
- `communication-sender-service`: blocked/clarify
- `gmail-incremental-sync`: blocked/clarify
- `google-oauth-first-sync`: blocked/clarify
- `ai-bounded-context`: planned/clarify
- `drive-provenance-retrieval`: planned/clarify
- `second-brain-see`: blocked/initiative
- `drive-content-indexing`: planned/clarify
- `admin-shell-design-system`: planned/clarify
- `notification-dispatch-preferences`: backlog/clarify
- `install-runbook`: backlog/clarify
- `plugin-module-contract`: planned/clarify
- `action-trust-ladder`: backlog/clarify
- `automation-policy-registry`: backlog/clarify
- `unified-action-executor`: planned/clarify

## Per-card reconciliation (AC1)

| Shipped card                      | Unverified prereqs (all later-added, unshipped)                                                  | Integrated code in this checkout                                                                                                                                                                                         | Verdict                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `integration-capability-platform` | `system-health-report`                                                                           | `src/lib/revenue-os/integration-registry.ts` (680 lines), `integrations.ts` — versioned provider capabilities + evidence-backed catalog                                                                                  | Dependency added later; implementation present                                                           |
| `gmail-thread-idempotency`        | `communication-sender-service`, `gmail-incremental-sync`                                         | `src/lib/revenue-os/gmail-threading.ts`, `gmail-reply-mime.ts`, `gmail-sync-plan.ts`, `google.ts` — threading, RFC5322 reply headers, bounded sync planning                                                              | Dependencies added later; implementation present                                                         |
| `drive-folder-boundary`           | `google-oauth-first-sync`                                                                        | `src/lib/revenue-os/google.ts` — folder bounds; `google-oauth.ts` — signed state binding                                                                                                                                 | Dependency added later; implementation present                                                           |
| `ai-command-runtime`              | `ai-bounded-context`                                                                             | `src/lib/revenue-os/ai-agent.ts`, `ai-tools.ts`, `ai-context.ts` — bounded model loop, registered tools, context contract                                                                                                | Dependency added later; implementation present                                                           |
| `second-brain-remember`           | `drive-provenance-retrieval`, `second-brain-see`, `ai-bounded-context`, `drive-content-indexing` | `src/lib/revenue-os/knowledge.ts`, `memory.ts` — grounded retrieval with provenance, five memory categories                                                                                                              | Dependencies added later; implementation present                                                         |
| `autonomous-inbound-responder`    | `communication-sender-service`                                                                   | `src/lib/revenue-os/auto-responder.ts`, `inbound.ts` — approved-policy-only first-touch reply, idempotent capture                                                                                                        | Dependency added later; implementation present                                                           |
| `admin-overlay-motion-recovery`   | `admin-shell-design-system`                                                                      | `src/components/admin/AdminShell.tsx` (1520 lines), `AdminFounderNoteModal.tsx`, `LayoutCustomizeDialog.tsx` (overlay/dialog surfaces) + `src/components/ui/AnimateOnScroll.tsx` (framer-motion with `useReducedMotion`) | Dependency added later; implementation present; visual-motion proof stays with scoped Playwright cards   |
| `resend-webhooks`                 | `communication-sender-service`                                                                   | `src/lib/revenue-os/communications.ts`, `campaign-stops.ts` — auditable Resend delivery, suppression mapping                                                                                                             | Dependency added later; implementation present; live provider receipt is production-only (see AC2)       |
| `operations-alerting`             | `notification-dispatch-preferences`, `system-health-report`                                      | `src/lib/revenue-os/alerts.ts`, `health.ts` — deduped alerting, operational health computation                                                                                                                           | Dependencies added later; implementation present                                                         |
| `full-admin-demo-runtime`         | `admin-shell-design-system`                                                                      | `src/components/command-center/demo/` — `CommandCenterDemo.tsx` (2069 lines), `demo-contract.ts`, `demo-data.ts`, `demo-session.ts`, `ActionModal.tsx` — plus admin routes under `src/app/admin/`                        | Dependency added later; implementation present                                                           |
| `one-click-vercel-deploy`         | `install-runbook`                                                                                | `DEPLOY.md` (prebuilt Vercel release path, `deploy:check`/`deploy` scripts in `package.json`), `vercel.json`                                                                                                             | Dependency added later; implementation present as docs/runbook; actual deploy receipt is production-only |
| `module-route-gating-enforcement` | `plugin-module-contract`                                                                         | `src/lib/revenue-os/module-routes.ts`, `modules.ts` — module registry + route gating                                                                                                                                     | Dependency added later; implementation present                                                           |
| `autonomy-policy-engine`          | `action-trust-ladder`, `automation-policy-registry`                                              | `src/lib/revenue-os/autonomy-policy.ts` — five-level ladder, hard floors, `check_autonomy`                                                                                                                               | Dependencies added later; implementation present                                                         |
| `capability-scoped-data-api`      | `unified-action-executor`                                                                        | `src/lib/revenue-os/capability-data-api.ts`, `capabilities.ts` — workspace capability resolution + scoped data API                                                                                                       | Dependency added later; implementation present                                                           |

Commands run for this comparison (local, this checkout):

- `npm run verify:agent-contract` → passed
- Python audit/snapshot cross-checks (read-only) resolving each card's `unverifiedPrerequisites` against audit statuses and each module's file/line counts above.

## Preservation + follow-up linkage (AC2)

- Historical decisions preserved: all 14 remain `shipped / investigate evidence` in source audit files; this report adds interpretation only and changes no live card, status, or revision.
- No corrective rebuild filed: implementations are present at their canonical services; the named prerequisites are themselves tracked as `clarify` cards on the live board (their own pickup path), so no duplicate cards are created here.
- Production-only requirements recorded without claiming local proof:
  - `resend-webhooks`: truthful delivery receipt requires live Resend/webhook provider evidence — not satisfied by local code presence.
  - `one-click-vercel-deploy`: deploy receipt requires a founder-authorized production release — explicitly out of scope.
  - Gmail/Drive/OAuth paths (`gmail-thread-idempotency`, `drive-folder-boundary`): incremental sync and token-health behavior require connected-integration evidence.
- Bounded local verification for this card: `npm run verify:agent-contract` (pass, recorded below); `git diff --check` clean. `npx tsc --noEmit` reports errors across many pre-existing `.ts`/`.tsx` files on base `7dac45d` (heaviest in admin pages and `CommandCenterDemo.tsx`); none can relate to this change — `git show --stat HEAD` proves the commit adds exactly one `.md` file, which tsc never reads. `npm run lint` cannot execute in this checkout: it has no `node_modules` at all, and even the control checkout's eslint 9.39.3 binary fails against this tree with `ERR_MODULE_NOT_FOUND` for the `eslint` package from `eslint.config.mjs`. Installing full dependencies for a docs-only change was judged against the local resource budget and declined; the change contributes zero lintable files, and the packet's only named check (`verify:agent-contract`) passes. No application-code inputs changed (docs-only), so `npm run build` is not re-triggered as a ship gate here.

## Limitations / remaining work

- This is an evidence reconciliation, not a functional re-test of all 14 shipped surfaces; scoped functional proof remains with each surface's own test/Playwright cards.
- Prerequisite `clarify` cards (e.g. `communication-sender-service`, `ai-bounded-context`, `admin-shell-design-system`) still need their own specified work; this report does not close them.

## Review addendum (2026-09-10, against the live board)

Re-checked all 15 distinct prerequisites against the live board after the audit export. Thirteen remain unshipped (`blocked`, `in_review`, `in_progress`, `planned`, or `backlog`), so the dependency-added-later verdict above stands for every row except the two naming `system-health-report`:

- `system-health-report` has since **shipped** (rev 22, PR51, commit `b98469d`). The "unshipped at audit time" premise no longer holds for the `integration-capability-platform` and `operations-alerting` rows.
- This does **not** automatically satisfy those dependencies: both shipped cards are rev 1 with no structured acceptance, so there is nothing to link the new delivery against. Treating `system-health-report` rev 22 as a satisfied prerequisite for either card requires its own explicit linkage proof.
- Recommended follow-up (not blocking acceptance of this reconciliation): file or attach that linkage check to the two affected rows rather than reopening this card.
