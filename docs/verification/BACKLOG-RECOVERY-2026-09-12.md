# Backlog recovery — 12 September 2026

This is a dated reconciliation receipt, not a replacement for the live board.
The founder authorized recovery of abandoned claims, completion and integration
of started work, and organization of untouched backlog. Production release
remains separate.

## Inventory and dispositions

The initial inventory contained 353 cards, 27 awaiting review, four expired
claims, and 60 retained worktrees. Later unrelated agent work is excluded from
that initial cohort. No worktree, branch, dirty source or evidence was deleted.

Independent acceptance review found twelve previously integrated cards complete:
backlog-execution-quality, developer-handoff-readiness,
today-composable-business-workspace, universal-work-board,
canonical-tools-route-inventory, docs-module-coverage-gate,
sd-work-deadline-recovery, local-operator-work-board-access,
won-to-delivery-handoff, admin-shell-design-system,
admin-contact-review-copy and admin-theme-revert.
Canonical review and delivery operations recorded the acceptance, exact
source-to-merge evidence and CI links on each card. No new deployment was asserted.

Seven submissions were returned to planning with concrete acceptance gaps:
sd-task-tool-profiles, drive-content-indexing, agent-task-context-efficiency,
machine-agent-resource-supervisor, admin-communication-audit,
admin-navigation-language-standards and universal-kanban-ux-standards.
Drive and tool-profile repairs were subsequently claimed normally in isolated
recovery worktrees. They require final integration evidence and resubmission.

Four expired claims were inspected, recovered and reopened using the canonical
operator flow: site-studio-installation-editor,
command-center-product-redesign-v2, unified-action-executor and
roles-and-permissions. Their retained checkouts remain intact.

Eight original submissions still require integration or further acceptance work:
neutral-runtime-distribution, workspace-architect-generated-operations,
stage-history-analytics-reconciliation, services-strategy-rebuild,
proposal-public-decisions, sd-runtime-adoption-ratchet,
northstar-phase-b-proof and workspace-architect-review-simulation.

## Recovery system

The implementation extends the existing canonical board. Normal pickup continues
owned work, resumes eligible interrupted work, or selects a ready card. Atomic
attempt ownership fences late predecessor writes. Durable checkpoints retain
source in immutable Git refs and restore it into isolated successor worktrees.
Private credentials are never placed in checkpoints or board events. Expired
claims do not consume active WIP capacity.

The project recovery policy defaults off. Schema installation, compatible
service/worker code, and a scoped reviewer policy action are distinct activation
steps. Existing installations retain their ledger and claim history.

Controlled verification covers takeover races, idempotent retries, stale-token
rejection, project/capability boundaries, durable source recovery, lost heartbeat
and checkpoint responses, preserved legacy session aliases and bounded output.
Final integration/build evidence belongs in the submitted card and integration PR.

## Outstanding integration prerequisites

The configured database already records
`20260912-site-studio-authenticated-writes.sql`, while published main does not.
The migration ledger correctly rejects unknown history. Reconcile the historical
source and authenticated-write authorization before applying new migrations;
do not bypass the ledger or modify an already recorded checksum.

PR 82 has failing inventory, statistics, tenant-boundary and formatting checks.
PR 83 changes authenticated Site Studio write access and fails the existing
native authorization expectation. These candidates are not accepted merely
because their application builds succeeded. Compatible behavior and exact
required CI must be verified before integration.

This recovery cohort is still in progress. Untouched backlog organization and
remaining started-task completion must continue through the same live-board flow.

## Subsequent review and classification

Independent PR 82 review returned stage-history-analytics-reconciliation,
workspace-architect-generated-operations and services-strategy-rebuild to planning
with exact gaps recorded through canonical review. Proposal public decisions meets
its domain criteria, but its candidate still requires successful integration CI.
The recovery initiative now declares all 31 original started cards and both
recovery-system prerequisites as dependencies.

Nine untouched cards received missing legacy phase labels; the AI evaluation
card's three capabilities were reduced to the existing learning/testing pair.
Existing planning horizons, priorities, scope and acceptance were preserved.
Incomplete packets retain explicit refinement notes and remain unclaimable.
An unrelated database-advisor RLS finding was recorded separately for assessment,
without changing live permissions.

## First accepted integration batch

Four implementation handoffs passed their exact-source checks, application
builds and independent source review before combination:

| Card                                | Accepted source                            |
| ----------------------------------- | ------------------------------------------ |
| agent-resumable-attempts            | `bd60d2c28063701e143e9e1ec34c42249f8aae97` |
| drive-content-indexing              | `056abafcc1210a2bcc8ae637573df8b27a458b06` |
| sd-task-tool-profiles               | `2db77199dc6bc9020a975ec629bc83b9b3324fd8` |
| site-studio-write-boundary-recovery | `5adb5566b1ae4c82e9d5951ba868d88d5addb518` |

The integration combines these sources without changing their runtime logic.
Changelog entries are retained together; the combined catalog has 90 migrations
and the public statistics reflect that catalog. Reviewed route fingerprints keep
both the work-board and Site Studio boundaries. Required combined CI and exact
source-to-main tree parity must pass before merge receipts are recorded.

Site Studio's original applied grant remains byte-identical in the ledger.
The corrective revocation is staged for after compatible application release.
The resumable-attempt schema can be applied through its own catalog entry after
integration; automatic recovery still requires the scoped policy operation.
No production deployment is included in this batch.
