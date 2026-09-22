# Completed-agent production release review

The founder authorized integrating completed agent work and deploying the canonical site on September 21, 2026. The release starts from published `346e41ca`, which contains UI PR127 with exact tree parity to verified source `0c1ec925`.

## Included source and reconciliation

- Agent workflow `8da5f4a`: capability defaults, lease-safe verification, safe unfinished-source checkpoints. Canonical card was in review with passing local evidence.
- Command Center PWA `bac91aaf`, including polish `80866371` and installation `df397a01`. Installation `df397a01` has the same Git tree as submitted `1f9d4463`; the latter source checkout is preserved. All three canonical cards had passing local evidence.
- Interaction and release hardening `4cecdd2b`: shared record controls, keyboard interactions, public motion readiness, Next.js proxy and stable production compilation. This branch had no matching current handoff under its branch key, so the release owner reviews and verifies the combined changes rather than treating the clean branch as proof of readiness.
- UI PR125/126 are already included through PR127. The integration retained the compact filters, task metadata, labeled date ranges, shared fields and truthful read recovery when reconciling interaction changes.

The accompanying audit records every worktree and its dirty paths. Historical dirty source and unverified checkpoints are preserved. The draft authority-memory PR81 remains excluded. The unrelated worker-worktree recovery task has no completed source handoff and is preserved.

## Integration repairs

PWA storage now acknowledges committed transactions, refuses canceled writes and reports unavailable or aborted storage truthfully. Snapshot responses are tenant/user checked before persistence; sign-out cancels pending writes and waits for scoped cleanup. Failed cleanup leaves explicit recovery guidance at sign-in. Saved local drafts can be read and reused; failed saves retain the text. The snapshot endpoint refuses incomplete queue reads and sends a private no-store response. Existing authorization and tenant database selection remain in the shared `requireAdmin` owner.

The proxy rename retains the current neutral-distribution, demo, authentication and PWA routing rules. Production compilation retains lockfile-verified native document dependencies while selecting Webpack by default. Updated contract tests use the new proxy path. Shared token checks reject undefined PWA tokens; the repaired component uses existing theme tokens.

The broad Content Security Policy stays in the published reporting mode: the proposed enforced allowlist did not cover custom Supabase or connector origins. Existing frame restrictions remain enforced. Global enforcement is excluded from this release until origin compatibility is verified.

The public Workspace guide, Command Center capabilities/FAQ, product changelog and repository changelog describe the current behavior. Installation remains conditional on a configured dedicated app origin. Live activation must be reported separately from code availability. No new schema or provider effects are introduced.

## Verification and delivery

The final exact-commit checks, browser evidence, GitHub CI, merge tree parity and canonical deployment receipt are recorded in the release PR and canonical work-board delivery. This source review is not itself proof of deployment. Required checks and resource gates remain enforced. The earlier UI integration's first CI attempt had an intermittent unchanged portfolio lightbox failure; its identical rerun passed, with 20 supplemental branded-build keyboard cycles also passing.

Independent installation by Marcin remains unperformed. This release does not claim that installation trial or a complete live-provider acceptance matrix has been completed.

Auth review reference: [Supabase server-side authentication and caching guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs). The existing server-confirmed identity check is retained; browser-supplied identity never authorizes the snapshot.
