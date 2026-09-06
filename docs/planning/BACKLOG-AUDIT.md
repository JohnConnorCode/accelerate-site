# Backlog audit and dispositions

Audit of the 250-card live board exported 2026-09-05T19:55:31.272Z. The active application checkout held only 209 of these records. Its seeder could archive all 41 unmatched cards. This implementation uses the existing universal work protocol, preserving live definitions and revision history.

## Applied changes

- 152 unclaimed specifications receive structured north star contribution, exact acceptance IDs, verification environments, source references, workflow and recovery guidance.
- 98 historical, active and submitted specifications remain unchanged.
- Eight broad cards become non-executable initiatives; 14 focused implementation or proof slices are added with explicit UUID dependencies.
- Page counts are replaced with usable task documentation outcomes. Phase completion requires accepted end-to-end evidence, not counts of shipped components.
- Live claims, owners, subtask state and historical receipts are preserved. New code remains separate from production protocol deployment.

## Execution review follow-up

A second live review corrected 153 unclaimed packets through revision-checked
operations. It preserved acceptance wording, owners, execution states, approved
bases and active attempts.

- 136 executable cards no longer present the requested outcome as an observed
  baseline. They explicitly identify that implementation evidence still needs
  comparison with the approved source.
- 107 workflows now specify inspection, implementation and verification steps;
  12 have task-specific sequences for the ready queue.
- 11 acceptance environment labels incorrectly inferred from the word
  “production” now require local proof. These cover clean local installation,
  fictional manufacturing examples and evidence reporting that explicitly does
  not claim production success.
- Seven cards now include the missing integration or production verification
  procedure. Phase proofs specify complete fixture journeys and persisted
  outcomes; general lint/build checks cannot substitute for those results.
- Five documentation packets now require source-checked task instructions,
  saved-result checks and recovery guidance. A newly added performance card also
  separates its observed failure from its intended business value.
- `npm run verify:backlog` rejects repeated goal/baseline text, “Deliver AC”
  placeholder workflows and missing acceptance environments in future exports.

The dated snapshot records this review. The live board remains authoritative;
refresh it explicitly before another planning pass. These edits improve work
instructions and do not accept the underlying feature implementations.

## Historical evidence reconciliation

Fourteen shipped cards currently refer to prerequisites without accepted verification. This may reflect requirements added later or missing proof; it is not a claim that their code is absent. `historical-acceptance-reconciliation` owns checking the original dated evidence and recording bounded follow-up work.

| Card                              | Unverified prerequisites                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `integration-capability-platform` | `system-health-report`                                                                           |
| `gmail-thread-idempotency`        | `communication-sender-service`, `gmail-incremental-sync`                                         |
| `drive-folder-boundary`           | `google-oauth-first-sync`                                                                        |
| `ai-command-runtime`              | `ai-bounded-context`                                                                             |
| `second-brain-remember`           | `drive-provenance-retrieval`, `second-brain-see`, `ai-bounded-context`, `drive-content-indexing` |
| `autonomous-inbound-responder`    | `communication-sender-service`                                                                   |
| `admin-overlay-motion-recovery`   | `admin-shell-design-system`                                                                      |
| `resend-webhooks`                 | `communication-sender-service`                                                                   |
| `operations-alerting`             | `notification-dispatch-preferences`, `system-health-report`                                      |
| `full-admin-demo-runtime`         | `admin-shell-design-system`                                                                      |
| `one-click-vercel-deploy`         | `install-runbook`                                                                                |
| `module-route-gating-enforcement` | `plugin-module-contract`                                                                         |
| `autonomy-policy-engine`          | `action-trust-ladder`, `automation-policy-registry`                                              |
| `capability-scoped-data-api`      | `unified-action-executor`                                                                        |

## Complete original inventory

Frozen-card phases below are explicit audit classifications, not changes to their historical execution contracts.

| Card | Phase | Disposition |
|---|---|
| `feature-board-dependency-integrity` | A | retain history |
| `identity-resolution-service` | A | retain history |
| `activity-ledger-normalization` | A | retain history |
| `pipeline-stage-board` | A | retain history |
| `record-detail-workspace` | A | retain history |
| `pipeline-saved-views` | A | retain history |
| `task-dedup-service` | A | retain history |
| `priority-selector-service` | A | retain history |
| `today-operator-inbox` | A | retain history |
| `canonical-attribution` | A | retain history |
| `cloneable-command-center-contract` | A | retain history |
| `tenant-config-seam` | A | retain history |
| `shared-database-multi-tenancy-contract` | A | retain history |
| `tenant-control-plane-schema` | A | retain history |
| `tenant-context-authorization` | A | retain history |
| `tenant-workspace-provisioning` | A | retain history |
| `atomic-execution-claims` | A | retain history |
| `setup-control-plane` | A | retain history |
| `secret-storage-hardening` | A | retain history |
| `tenant-provider-public-boundaries` | A | retain history |
| `tenant-isolation-cutover` | A | retain history |
| `integration-capability-platform` | A | investigate evidence |
| `communication-sender-service` | A | clarify |
| `openrouter-ai-gateway` | A | retain history |
| `founder-note-capture` | A | retain history |
| `google-oauth-first-sync` | A | clarify |
| `gmail-incremental-sync` | A | clarify |
| `gmail-thread-idempotency` | A | investigate evidence |
| `gmail-record-association` | A | retain history |
| `conversations-operator-inbox` | A | retain history |
| `calendar-sync-association` | A | clarify |
| `second-brain-see` | A | initiative |
| `drive-folder-boundary` | A | investigate evidence |
| `drive-content-indexing` | A | clarify |
| `audit-ledger-coverage` | A | retain history |
| `ai-tool-registry` | A | retain history |
| `ai-bounded-context` | A | clarify |
| `ai-command-runtime` | A | investigate evidence |
| `ai-run-traces` | A | retain history |
| `ai-command-workspace` | A | retain history |
| `ai-confirmation-system` | A | retain history |
| `drive-provenance-retrieval` | A | clarify |
| `second-brain-remember` | A | investigate evidence |
| `playwright-inbound-pipeline` | A | retain history |
| `autonomous-inbound-responder` | A | investigate evidence |
| `scheduling-substrate-decision` | A | retain history |
| `workshelter-reuse-baseline` | A | preserve active attempt |
| `business-workflow-plugin-exemplars` | E | retain history |
| `plugin-data-boundary-hardening` | D | retain history |
| `legacy-api-adapters` | A | retain history |
| `business-plugin-demo-scenarios` | E | retain history |
| `feature-board-interaction-rebuild` | B | clarify |
| `work-completion-truth` | B | retain history |
| `northstar-runtime-consolidation` | B | retain history |
| `verification-workflow-efficiency` | B | retain history |
| `admin-settings-consolidation` | A | clarify |
| `bundled-report-plugins` | E | retain history |
| `revenue-os-production-migration` | E | retain history |
| `campaign-saved-audiences` | E | clarify |
| `feature-board-operational` | B | retain history |
| `admin-a11y-keyboard-mobile` | A | clarify |
| `admin-shell-design-system` | A | clarify |
| `universal-work-board` | B | preserve active attempt |
| `email-document-composition` | E | clarify |
| `schema-drift-verification` | E | retain history |
| `email-studio-runtime` | E | clarify |
| `install-runbook` | A | clarify |
| `additional-tools-canonical-parity` | A | split |
| `google-token-health-reconnect` | A | clarify |
| `campaign-business-recipes` | E | clarify |
| `legacy-canonical-reconciliation` | A | retain history |
| `proposal-workspace-ui` | C | clarify |
| `support-conversation-triage` | E | clarify |
| `gmail-pubsub-watch` | C | clarify |
| `integration-adapter-contract` | D | clarify |
| `gmail-reply-actions` | C | clarify |
| `route-state-resilience` | A | clarify |
| `site-capacity-visual-rebuild` | E | clarify |
| `campaign-workspace-ui` | E | clarify |
| `pipeline-transition-service` | A | retain history |
| `support-coworker-plugin` | E | clarify |
| `integration-adapter-registry-resolution` | D | clarify |
| `support-knowledge-corrections` | E | clarify |
| `de-vertical-inbound` | A | clarify |
| `gmail-ai-triage-actions` | C | clarify |
| `support-demo-conformance` | E | clarify |
| `command-palette-tools` | E | retain history |
| `precall-briefs` | C | clarify |
| `plugin-record-view-contract` | D | clarify |
| `postmeeting-workflow` | C | clarify |
| `google-admin-sync-controls` | A | clarify |
| `proposal-option-presentation` | C | clarify |
| `inventory-stock-plugin` | E | clarify |
| `purchasing-receipts-plugin` | E | clarify |
| `calendar-confirmation-flow` | C | clarify |
| `proposal-delivery-receipts` | C | clarify |
| `campaign-policy-versioning` | E | clarify |
| `proposal-pdf-expiry-followup` | C | clarify |
| `production-quality-plugin` | B | clarify |
| `admin-overlay-motion-recovery` | A | investigate evidence |
| `campaign-dry-run` | E | clarify |
| `tenant-ai-sponsorship-control` | B | clarify |
| `mobile-coworker-channel` | E | clarify |
| `campaign-jit-executor` | E | clarify |
| `ai-company-research` | C | clarify |
| `campaign-stop-conditions` | E | clarify |
| `ai-opportunity-ranking` | C | clarify |
| `ai-message-drafting` | C | clarify |
| `ai-meeting-intelligence` | C | clarify |
| `analytics-workspace` | E | retain history |
| `ai-proposal-audit` | C | clarify |
| `campaign-unsubscribe` | E | clarify |
| `ai-analytics-setup-help` | B | clarify |
| `proposal-lifecycle-service` | C | clarify |
| `setup-behavioral-tests` | B | clarify |
| `webhook-cron-api-defense` | B | retain history |
| `proposal-public-decisions` | C | clarify |
| `notification-dispatch-preferences` | B | clarify |
| `ai-quality-control-plane` | B | clarify |
| `api-contract-tests` | B | clarify |
| `campaign-enrollment-personalization` | E | clarify |
| `second-brain-notice` | B | initiative |
| `campaign-performance-exceptions` | E | clarify |
| `second-brain-act` | B | initiative |
| `second-brain-learn` | B | initiative |
| `playwright-proposal-setup` | C | clarify |
| `second-brain-trust` | B | initiative |
| `a11y-visual-qa` | E | clarify |
| `ship-command` | B | clarify |
| `resend-webhooks` | E | investigate evidence |
| `ai-model-job-registry` | B | clarify |
| `production-burn-in` | B | clarify |
| `booking-mode-contract-reconciliation` | A | clarify |
| `proactive-operator-intelligence` | B | clarify |
| `system-health-report` | B | clarify |
| `task-operator-workspace` | A | clarify |
| `revenue-os-tests` | B | clarify |
| `identity-review-workbench` | A | retain history |
| `production-browser-qa` | B | clarify |
| `data-quality-repair-center` | A | clarify |
| `open-source-release-readiness` | E | retain history |
| `ai-contact-importer` | B | retain history |
| `stage-history-analytics-reconciliation` | A | clarify |
| `incident-receipt-recovery-console` | B | clarify |
| `plugin-module-contract` | D | clarify |
| `operating-goals-scorecards` | E | clarify |
| `forecast-scenario-planner` | E | clarify |
| `playwright-gmail-campaign` | C | clarify |
| `won-to-delivery-handoff` | E | clarify |
| `client-success-lifecycle-workspace` | E | clarify |
| `governed-bulk-operator-actions` | E | clarify |
| `agent-learning-feedback-loop` | B | retain history |
| `mcp-ai-tool-bridge` | D | retain history |
| `automation-policy-registry` | B | clarify |
| `client-instance-portability` | E | clarify |
| `microsoft-365-workspace-parity` | E | clarify |
| `founder-access-rls` | B | retain history |
| `stripe-revenue-reconciliation` | E | clarify |
| `slack-notification-approval-surface` | E | clarify |
| `operations-alerting` | B | investigate evidence |
| `notion-knowledge-source` | E | clarify |
| `marketing-positioning-copy-reset` | E | retain history |
| `guided-first-run-setup` | A | clarify |
| `command-center-demo-mode` | E | retain history |
| `vertical-business-templates` | E | clarify |
| `selected-work-portfolio` | E | retain history |
| `portfolio-art-direction-motion` | E | retain history |
| `csv-hubspot-importers` | A | clarify |
| `public-site-motion-performance` | E | retain history |
| `integration-adapter-sdk` | D | clarify |
| `agent-runbooks` | E | retain history |
| `create-accelerate-cli` | D | clarify |
| `full-admin-demo-runtime` | E | investigate evidence |
| `custom-data-model` | D | clarify |
| `roles-and-permissions` | B | clarify |
| `full-admin-demo-scenarios` | E | retain history |
| `server-side-saved-views` | E | clarify |
| `five-business-admin-demo-suite` | E | retain history |
| `dashboards-and-metrics` | E | clarify |
| `public-shell-route-consistency` | E | retain history |
| `workflow-builder` | E | clarify |
| `one-click-vercel-deploy` | A | investigate evidence |
| `public-records-api` | D | clarify |
| `entity-registry-and-link-graph` | D | retain history |
| `module-route-gating-enforcement` | D | investigate evidence |
| `module-contract-gate-hardening` | D | retain history |
| `generic-record-merge` | D | clarify |
| `unified-action-executor` | B | clarify |
| `durable-work-engine` | B | retain history |
| `batch-identity-preflight` | A | clarify |
| `capability-graph-canonical` | B | retain history |
| `durable-event-bus` | B | clarify |
| `evidence-claim-ledger` | B | retain history |
| `autonomy-policy-engine` | B | investigate evidence |
| `capability-scoped-data-api` | B | investigate evidence |
| `coworker-model` | B | retain history |
| `write-provenance-enforcement` | B | clarify |
| `agent-activity-surface` | B | retain history |
| `plugin-isolate-host` | D | clarify |
| `finance-coworker` | E | retain history |
| `plugin-manifest-generator` | D | clarify |
| `plugin-connection-broker` | D | clarify |
| `operations-coworker` | E | retain history |
| `work-scheduler` | B | retain history |
| `plugin-install-lifecycle` | D | clarify |
| `plugin-usage-and-budget-metering` | D | clarify |
| `memory-architecture` | B | retain history |
| `budgets` | B | retain history |
| `action-trust-ladder` | B | clarify |
| `trust-graduation-engine` | B | clarify |
| `action-undo-and-compensation` | B | clarify |
| `approval-surfaces-and-edit-feedback` | B | clarify |
| `tool-bundles-progressive-disclosure` | D | clarify |
| `report-recipe-engine` | D | clarify |
| `declarative-card-renderer` | D | clarify |
| `ui-slots-and-sandboxed-panels` | D | clarify |
| `plugin-skill-registry` | D | clarify |
| `plugin-cli-and-scaffold` | D | clarify |
| `plugin-conformance-kit` | D | clarify |
| `plugin-exemplar-tier0-chart` | D | clarify |
| `plugin-exemplar-tier1-business-pulse` | E | clarify |
| `plugin-exemplar-tier2-meeting-intelligence` | E | clarify |
| `plugin-exemplar-tier3-enrichment` | E | clarify |
| `plugin-developer-documentation` | D | clarify |
| `plugin-registry-and-signing` | D | clarify |
| `plugin-vertical-distributions` | E | clarify |
| `plugin-contract-versioning` | D | clarify |
| `docs-site-infrastructure` | E | retain history |
| `docs-integration-surfaces` | E | retain history |
| `docs-module-coverage-gate` | D | clarify |
| `docs-content-first-pass` | E | split |
| `receivables-collections-plugin` | E | initiative |
| `retainer-renewals-plugin` | E | clarify |
| `scope-change-control-plugin` | E | clarify |
| `client-approval-room-plugin` | E | clarify |
| `delivery-capacity-plugin` | E | clarify |
| `project-time-margin-plugin` | E | clarify |
| `client-document-intake-plugin` | E | clarify |
| `vendor-obligations-plugin` | E | clarify |
| `expense-approval-plugin` | E | clarify |
| `hiring-workflow-plugin` | E | clarify |
| `release-migration-ledger` | A | retain history |
| `first-value-business-journey` | A | clarify |
| `runtime-record-permission-contract` | B | clarify |
| `release-restore-upgrade-proof` | B | clarify |
| `release-performance-envelope` | B | clarify |
| `receivables-decision-engine` | E | retain history |
| `receivables-case-lifecycle` | E | retain history |
| `receivables-approved-reminders` | E | retain history |
| `receivables-workspace-demo` | E | preserve active attempt |

## Operating the improved backlog

Inspect `agent:show -- --card <key>` before pickup; `--json` exposes the same packet to another agent. Update live definitions with reviewed revision-checked plans. Regenerate reports with `backlog:snapshot` then `report:build-plan`. Never run an older checkout's blanket seeder against this board.
