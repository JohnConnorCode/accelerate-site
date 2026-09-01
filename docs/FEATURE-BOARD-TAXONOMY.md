# Feature Board taxonomy

The Feature Board is an execution queue, not a tag cloud. Managed cards use four
label dimensions only:

| Dimension      | Purpose                            | Values                                                                                                                       |
| -------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `milestone:*`  | When the work belongs              | `now`, `next`, `later`, `done`                                                                                               |
| `category:*`   | Which durable product area owns it | `platform`, `operator`, `integrations`, `engagement`, `intelligence`, `governance`, `quality`, `productization`, `marketing` |
| `phase:*`      | Architecture maturity sequence     | `0` through `6`                                                                                                              |
| `capability:*` | Reusable domain filter             | Controlled in `scripts/feature-backlog-data.mjs`; at most two per card                                                       |

Rules:

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
