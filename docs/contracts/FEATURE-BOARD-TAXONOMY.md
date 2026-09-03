# Feature Board taxonomy

The Feature Board is an execution queue, not a tag cloud. Managed cards use four
label dimensions only:

| Dimension      | Purpose                            | Values                                                                                                                       |
| -------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `milestone:*`  | When the work belongs              | `now`, `next`, `later`, `done`                                                                                               |
| `category:*`   | Which durable product area owns it | `platform`, `operator`, `integrations`, `engagement`, `intelligence`, `governance`, `quality`, `productization`, `marketing`, `runtime` |
| `phase:*`      | Architecture maturity sequence     | `0` through `6`                                                                                                              |
| `capability:*` | Reusable domain filter             | Controlled in `scripts/feature-backlog-data.mjs`; at most two per card                                                       |

## Northstar alignment

The platform vision (`docs/NORTHSTAR.md`) defines five product layers and five
implementation phases. Existing board phases map to northstar phases:

| Board phase | Northstar phase | Description                                      |
| ----------- | --------------- | ------------------------------------------------ |
| 0–1         | A               | Complete Loop One — See + Remember foundations   |
| 2–3         | B               | Agent Runtime foundation — Notice + Act primitives |
| 4           | C               | Reference coworker — Sales end-to-end loop       |
| 5           | D               | Plugin SDK + MCP                                 |
| 6           | E               | Additional coworkers/plugins + documentation     |

The five product layers (See → Remember → Notice → Act → Learn) cut across
implementation phases. Every card's notes include its northstar phase reference.

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

- The board opens on `milestone:now`. Keep Now small enough to scan and execute.
- The dependency-ordered circuit in `scripts/feature-backlog-data.mjs` owns Next
  sequencing. A card does not become Now merely because it is important.
- Status describes delivery state. Milestone describes planning horizon. Never
  use one as a substitute for the other.
- Priority describes urgency inside a milestone. It does not move a Later card
  ahead of an unmet dependency.
- Categories are stable ownership areas, not technologies or individual pages.
- Capability labels must be reusable. Do not add ticket names, provider variants,
  step numbers, adjectives, or synonyms as labels.
- Detailed concepts, dependencies, guardrails, and evidence belong in the card
  fields, not in labels.
- Change the taxonomy centrally, run the contract verifier, apply the manifest,
  and verify zero board drift. Never repair managed labels only in the UI.
