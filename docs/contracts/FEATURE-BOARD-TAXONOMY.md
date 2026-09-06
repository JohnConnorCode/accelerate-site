# Feature Board taxonomy

The Feature Board is an execution queue, not a tag cloud. Managed cards use four
label dimensions only:

| Dimension      | Purpose                            | Values                                                                                                                                  |
| -------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `milestone:*`  | When the work belongs              | `now`, `next`, `later`, `done`                                                                                                          |
| `category:*`   | Which durable product area owns it | `platform`, `operator`, `integrations`, `engagement`, `intelligence`, `governance`, `quality`, `productization`, `marketing`, `runtime` |
| `phase:*`      | Architecture maturity sequence     | `0` through `6`                                                                                                                         |
| `capability:*` | Reusable domain filter             | Controlled in `scripts/feature-backlog-data.mjs`; at most two per card                                                                  |

## Northstar alignment

The platform vision (`docs/NORTHSTAR.md`) defines five product layers and five
implementation phases. The work specification owns explicit `northstar.phase` (A–E), `northstar.layers`
(See, Remember, Notice, Act, Learn) and its business contribution. Numeric phase
labels are retained for legacy filtering; they do not determine architecture
maturity. Historical classifications in dated exports are audit metadata and do
not rewrite frozen acceptance or evidence.

### New categories and capabilities

The `runtime` category covers the durable agent runtime primitives: Work Engine,
Capability Graph, Evidence Ledger, Autonomy Policy Engine. The `coworker`
workstream covers Coworker identities and Agent Activity surfaces.

New capability labels added for northstar primitives:

- `coworkers` — Coworker identities, manifests, and activity surfaces
- `work-engine` — Durable WorkItems, lease-based scheduling
- `autonomy-policy` — Autonomy ladder, safety floors, permission governance
- `evidence-ledger` — Evidence and Claim system for AI-derived facts
- `capability-graph` — Canonical workspace capability resolution
- `mcp` — Model Context Protocol (bidirectional)
- `memory` — Organizational memory architecture
- `learning` — Pattern recognition and policy proposal
- `agent-trace` — Agent run traces and observability
- `tool-registry` — Governed tool registration and invocation

## Rules:

- The board opens on the active horizon (`milestone:now` plus `milestone:next`). Keep Now small enough to scan; Next is the rest of the current circuit. Opening onto Now alone makes the board look empty.
- The live board owns sequencing. Now precedes Next, then urgency and explicit
  order break ties. Prioritize complete business journeys and their shared blockers.
  Independent phases can advance together; readiness does not promote Later work.
- Status describes delivery state. Milestone describes planning horizon. Never
  use one as a substitute for the other.
- Priority describes urgency inside a milestone. It does not move a Later card
  ahead of an unmet dependency.
- Categories are stable ownership areas, not technologies or individual pages.
- Capability labels must be reusable. Do not add ticket names, provider variants,
  step numbers, adjectives, or synonyms as labels.
- Detailed concepts, dependencies, guardrails, and evidence belong in the card
  fields, not in labels.
- Change definitions through revision-checked work operations. Templates and dated
  exports are advisory; never overwrite live edits or archive unlisted cards.
- Initiatives group outcome slices and cannot be claimed. A reviewer may accept an
  initiative only after every declared child prerequisite has accepted verification.
