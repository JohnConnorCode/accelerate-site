# Radar workspace implementation review

Card: `radar-today-workspace` (`94eb925b-e076-4f12-939e-0caa9c61cbcb`).
PR: https://github.com/JohnConnorCode/accelerate-site/pull/46.
This is an implementing-agent review, not an independent security audit or a
production activation receipt. Final commit and CI evidence belong on the live card.

| Area                 | Before                                                            | After                                                                                                                                               | Source                                                                                 |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Daily selection      | AI tools exposed reviewed selection without a dedicated workspace | Shared Today presents up to ten business recommendations, neutral review, deferred reasons and bounded retained records                             | `src/components/admin/RadarOverview.tsx`                                               |
| Evidence detail      | Source and draft reading required tool calls                      | Bounded text reader, current source versions, canonical contact restriction, draft and reported-outcome history                                     | `src/components/admin/RadarWorkspace.tsx`, `RadarOpportunityDetail.tsx`                |
| Editable work        | Domain proposals existed without dedicated controls               | Source import/review, opportunity editing, citation correction, assessment and manual/optional AI draft controls preview exact changes              | `src/components/admin/RadarEditorDialog.tsx`                                           |
| Approval             | Shared executor required agent/tool entry                         | Same executor receives exact reviewed UI proposals, with stale revision, source and configuration checks                                            | `src/components/admin/RadarReviewDialog.tsx`, `src/lib/revenue-os/radar-workspace.ts`  |
| Disabled state       | Module page notice offered configuration only                     | Optional exact owned history route retains authenticated records; domain writes remain disabled                                                     | `src/components/admin/ModuleDisabledNotice.tsx`, `src/lib/revenue-os/module-routes.ts` |
| Business examples    | Five fictional businesses with no Radar transport                 | Six businesses including fictional SuperDebate use the same admin pages and shared validation, with browser-session approvals and no provider calls | `src/lib/admin/demo/radar-runtime.ts`, `radar-fixtures.ts`, `scenarios.ts`             |
| Dialog keyboard flow | Controlled shared dialogs lacked a Radix Trigger to restore focus | Shared dialog captures and restores the actual opener, including stacked reviews                                                                    | `src/components/admin/AdminDialog.tsx`                                                 |
| Visual language      | No dedicated Radar surface                                        | Shared surfaces, semantic error tokens, tabular estimates, minimum 44px buttons, explicit transitions and reduced-motion override                   | `src/components/admin/RadarUI.tsx`                                                     |

The automated browser journey writes desktop/mobile images and machine-readable
results under `/tmp/accelerate-radar-workspace/` in the CI artifact. Source presence
is not visual evidence; screenshot inspection and final CI are required before
acceptance. Service and simulation tests are `scripts/test-radar-workspace-host.ts`
and `scripts/test-radar-workspace-demo.ts`. Existing native PostgreSQL store and
assessment proofs remain required by CI.

Automated discovery, relationship intelligence, sending, publication and outcome
verification are separate uncompleted program cards. A stored outcome is reported,
not independently verified recognition. Demo source briefs are fictional text
simulation, not a hosted model evaluation. The workspace does not add provider
transports or weaken model spending policy.
