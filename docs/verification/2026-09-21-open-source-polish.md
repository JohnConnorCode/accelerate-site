# Open-source polish and deployment preparation

This review covers the complete application candidate, including onboarding PR 122 and request-protection PR 123, against published main `4d1d2d30cb5fd4501683b5b9d9a0bae4cb4d3d8a`. Merge authorization is separate from production deployment. This receipt does not declare a production-ready launch.

## Findings and disposition

| Area                    | Finding                                                                                                                     | Disposition                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First use               | Missing or example credentials previously led to a broken login path.                                                       | Candidate provides explicit setup guidance, a credential-free demo and a saved first-task guide. Both full-fork configurations and the neutral starter have passing CI browser receipts.                                                                             |
| Recovery                | The shared admin error screen asserted that no work changed after any render failure. It also displayed raw exception text. | Replace the assertion with guidance to inspect a submitted change before repeating it; warn that reload may discard unsaved edits. Keep diagnostics in the existing console handler and announce the fallback as an alert.                                           |
| Public error navigation | The home link nested a button inside a link.                                                                                | Use one semantic home link with the existing button styling.                                                                                                                                                                                                         |
| Connected controls      | Process-local request limits could be bypassed across instances.                                                            | Candidate uses the service-only atomic database limiter, retryable refusal and a migration prerequisite. Concurrency, expiry, permission denial and HTTP failure checks pass.                                                                                        |
| Plugins                 | Authors need a real extension path without core-service edits.                                                              | A temporary Meeting Prep wording change was compiled and executed through the real isolate with an explicit output assertion. The trial change was removed. This is local fixture evidence, not hosted proof.                                                        |
| Responsive use          | Setup and task flows need readable layouts and persistent demo results.                                                     | Neutral desktop/mobile journeys pass; inspected mobile setup and desktop task screenshots. No console errors or content overflow were reported by that suite. Final candidate retains the broader keyboard, theme, reduced-motion and navigation-performance checks. |
| Recovery copies         | Database backups do not include uploaded Storage objects.                                                                   | Published recovery guide distinguishes database, object bytes, configuration and encryption material. Native database restore and migration replay pass. Hosted object restore remains unverified.                                                                   |

No additional redesign or new feature is required by this review. A successful demo is not evidence of connected Auth, model execution or production recovery.

## Source reconciliation

All 29 registered worktrees were inspected. Existing dirty trees remain intact. Comparing non-checkpoint local branch heads against the September 20 audit found only the two current launch branches, the already-published release branch's final head, and a new public-motion test commit `5e42c737f76b14f51c6e195153bc3780bed36b6a`.

PR 123 contains the complete PR 122 head `bb6961fa8015bb040aab855ef2706253654fe5df`. After merging, verify candidate-to-main tree equality before closing the superseded PR. Earlier completed agent work is already reconciled by PRs 118 and 119; squash ancestry alone must not cause duplicate integration.

Retain the previous exclusions documented in [the September 20 review](2026-09-20-release-review.md): source-authority/decision-memory PR 81, generated operations, and unfinished Architect review have unresolved integrity or acceptance findings. No new verified repair clears them. Preserve retained dirty predecessors.

Dependabot PRs 120 and 121 both have failed build/aggregate checks at review time. They are dependency proposals, not verified launch work, and remain separate. The new public-motion harness commit is not in the candidate and has no accepted, passing browser handoff in this review. Do not silently import it or its dirty source checkout.

## Remaining launch evidence

- Fresh isolated hosted Auth, password recovery and browser-to-database acceptance.
- Real free-model knowledge, approved actions and reviewed learning reuse, including tenant denial and provider failure.
- Hosted uploaded-object restore and bounded ten-user staging exercise.
- Marcin's installation attempt. The founder removed the two-tester requirement; do not restore that requirement or invent a successful human trial.

The selected Supabase organization quotes $10/month for an additional project. None was created under the free-only constraint. GitHub secret scanning and push protection are enabled, with zero open alerts when checked; this is not a complete security audit.

## Deployment handoff

1. Pin the normal merge result and prove its tree matches the final verified PR head. Retain its CI URL and source inclusion receipt.
2. Use a clean release checkout of that commit. Preserve the original branded profile and run the authenticated `deploy:check` against `deployment-target.json`, with the required original-target acknowledgement.
3. Before running the new application against connected data, apply `20260929-shared-rate-limits.sql` through the existing checked migration catalog and verify the schema. Missing limiter schema safely refuses protected requests with 503. Production migration execution belongs to the authorized release, not this preparation.
4. Build using the guarded existing prebuilt workflow on a machine that passes the repository resource gate. The current development machine is below the 5 GiB free-disk requirement; no gate was bypassed and no new deployment artifact is claimed here.
5. After explicit production authorization, upload the verified artifact, record its deployment ID and READY state, verify the canonical alias and run connected smoke checks. Retain the prior verified deployment for application rollback; keep the additive schema and customer data.

See [Deployment](../../DEPLOY.md) and [Backup and recovery](../self-hosting/BACKUP-RECOVERY.md) for the executable commands and recovery sequence. No production migration, upload, alias change or release tag is authorized by this preparation alone.
