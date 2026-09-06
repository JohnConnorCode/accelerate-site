# Backlog execution quality handoff

The live backlog now describes executable business outcomes and the evidence required to accept them. The implementation extends the universal work board at `50f3aa671751619f44af22bb0736618c362d1b6b` on `agent/backlog-execution-quality`. It does not deploy that branch or approve the underlying board implementation.

## Before and after

| Before                                                                                  | After                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An older checkout contained 209 of 250 live cards and could archive unmatched work.     | Revision-checked, explicitly reviewed updates retain every original card; replay changes no newer definitions.                                                                      |
| Only 29 cards had structured acceptance, scope and verification.                        | 152 unclaimed specifications were improved; 14 focused delivery/proof slices were added. Frozen specifications and execution history were preserved.                                |
| Broad cards mixed coordination with implementation.                                     | Eight initiatives group bounded slices and require verified child prerequisites before reviewer acceptance.                                                                         |
| Phase progress could be inferred from component counts.                                 | Five explicit proof cards require observable business outcomes. Phases may progress in parallel through actual dependencies.                                                        |
| Agents had to reconstruct their task from board prose.                                  | Readable and JSON packets expose current behavior, outcome, scope, exclusions, ordered steps, sources, recovery cases, exact repository base and environment-specific verification. |
| Incomplete specifications could reach pickup; submission environments were not checked. | SQL readiness, service ordering, demo behavior and evidence validation enforce the execution contract.                                                                              |
| Planning and implementation states were harder to find on mobile.                       | Phase/initiative filters and specification, review and integration/proof queues expose the next action. A shared grid fix prevents horizontal overflow.                             |

See [the complete original inventory and dispositions](../planning/BACKLOG-AUDIT.md) and [the dated north star report](../NORTHSTAR-BUILD-PLAN.md). The snapshot has 266 cards because it includes this implementation task and another agent's subsequent task. It is an explicit dated export, not live dispatch authority.

## Preservation and migration evidence

- All 250 original IDs were retained. This task did not change their status, owner, subtask progress or delivery records.
- Historical and submitted specifications remained unchanged. Active specifications were excluded; another agent's concurrent notes update was retained rather than overwritten.
- All 152 definition edits and 14 creations used canonical revision-checked operations. Explicit parent/dependency plans and eight later refinements followed the same path.
- Replaying the original applied plan returned replay receipts and changed no specifications or revisions, including later refinements.
- `20260907-work-packet-quality.sql` was applied and rerun against the verified Accelerate project `skjypuwkceoiunyhhqlm`. It adds packet validation and ordered reads and updates existing canonical functions without rewriting execution states.

## Verification

- `npx tsc --noEmit` passed. `npm run lint` passed with six existing unused-argument warnings in `integration-adapters.ts`.
- `npm run test:work-board` passed controlled database, scoped HTTP/MCP/CLI and claim/review/replay tests against the local app.
- `npm run test:work-packet` passed malformed/complete packet, SQL/demo parity, ordering before pagination, environment-bound evidence, initiative and reviewer checks. Fixtures were isolated and archived.
- `npm run test:admin-demo-contract`, `npm run test:admin-layout` and `npm run test:feature-board-dependencies` passed.
- `npm run verify:agent-contract` and `npm run verify:backlog` passed, including 266 unique cards, acyclic references and truthful readiness.
- `scripts/qa-backlog-packets.mjs` passed specification/phase/initiative/review/integration queues and desktop/mobile, keyboard, reduced-motion and overflow checks. It intercepts GET responses and refuses live platform mutations. Screenshots were opened and inspected in `/tmp/accelerate-backlog-packets-qa/`.
- `scripts/qa-universal-work-board.mjs` passed all five fictional business scenarios through create, claim, progress, submit and review, with desktop/mobile, keyboard, reduced-motion and console checks. The final screenshot was opened and inspected in `/tmp/accelerate-work-board-qa/`.
- The first commit/build attempt was refused before the hook ran because free disk was below the shared 5 GiB startup minimum. Once capacity recovered, the task was explicitly reopened and reclaimed for guarded verification. Its own packet was upgraded while unclaimed; original audited cards were unaffected. Final build and commit evidence belongs in the live task's submission.

## Integration and release boundary

The database definitions and backlog edits are live. The new board UI and HTTP/CLI behavior are verified locally and await integration/release of this branch together with the universal work board foundation. `work_board_settings.enforce_writes` remains false by design until the founder-authorized release deploys the new adapters, enables strict write enforcement and verifies that old mutation paths fail closed. Applying this migration alone does not give the older deployed UI the new protocol.

Preserve active agent worktrees during integration. Review and acceptance, repository merge, production deployment and production proof are separate recorded facts. The fourteen historical prerequisite anomalies remain explicit reconciliation work; this task makes no claim that the five north star phase outcomes are already proven.
