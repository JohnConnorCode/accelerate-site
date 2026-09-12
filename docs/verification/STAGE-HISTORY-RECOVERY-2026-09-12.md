# Stage history recovery, 12 September 2026

The founder delegated completion of this original started card. Retained source
`c71736a1b78529661bdc15d09fd753da0293fe7c` was preserved and ported onto published
`a87c79bf` as `c0f7c656`; unrelated PR82 work and its checkout remain intact.

The existing stage-history computation now reports missing or incomplete history,
orders timestamp ties by event ID, refuses invented durations across broken chains,
and excludes invalid/no-movement events from the last valid movement timestamp.
The analytics and Pipeline reads request stable IDs and exact counts so bounded
or unavailable history reads remain explicit. Analytics displays the missing and
incomplete counts. Fictional demo data explicitly states that it has no history.

Current values use the existing pipelineMetrics function in Analytics, Today,
Pipeline overview and the AI snapshot. The AI reads the current tenant's configured
stage roles. Client recurring revenue remains its separate recorded-client domain.
No stage events, production data, authorization rules or migrations are changed.

Local checks passed: typecheck, scoped lint, agent contract, docs, both inventories,
source stats, analytics decision model, AI gates including custom stages, and
stage-history fixtures including the actual capped/unavailable analytics loader.
Final candidate fbfc9e4d passed checks/build/verify in CI34720529393.
Independent source review resolved gap-duration and first-event regression cases.
Desktop1440 and reduced-motion mobile390 Analytics screenshots were opened;
missing history18 and incomplete history0 are readable with keyboard/containment
and no-console-error proof. Normal PR97 merge0ade3457 matches the verified tree;
canonical acceptance and merged-delivery receipts were recorded.
The existing Analytics browser script has a credential-free demo mode; its live
authenticated mode remains available. Fictional UI evidence and pure calculation
proof are identified separately.

| Before                                                   | Verified after                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| History gaps were absent from the Analytics quality rows | Missing and incomplete history appear beside the same current-value screen          |
| AI counted hardcoded stage names                         | Custom terminal stages are excluded through the shared configured-stage calculation |
| Broken history could produce a precise-looking duration  | Disconnected intervals retain unknown duration and an incomplete status             |

Public Pipeline guidance, changelog and Command Center description are updated.
The existing FAQ contains no detailed history formula requiring a change.
Application deployment remains separate from this local acceptance and integration.
