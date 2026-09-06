# Plugin documentation is part of delivery

Every plugin must explain how an operator completes its business task and how a
contributor safely changes it. This applies to bundled modules, isolated reports
and workflows, native workspaces, and runtime/MCP plugin submissions. A plugin
cannot be accepted as complete on implementation evidence alone.

## Required delivery

Keep `plugins/<id>/README.md` beside each bundled plugin and set its manifest's
`docsUrl` to the public guide. The README can link to shared platform references;
it must still give the operator a complete first task. Runtime plugin submissions
must provide an accessible guide in their review packet; their current registry
does not automatically enforce a documentation field.

Cover these reader questions in whatever structure makes the task clearest:

- What useful result does this version produce, for whom, and what is unavailable?
- Where do I start, what access/connections do I need, and how do I enable it?
- Which settings are required, what do defaults mean, and where do secrets go?
- What records can it read or write, and what leaves my workspace? Which steps
  need approval, and how do AI and MCP use the same business operations?
- What incurs cost? Distinguish deterministic operation, model/provider charges,
  hosting and local compute. Explain caps, unavailable providers and fallback.
- Can I follow a concrete fictional example through to its saved result and receipt?
- How do I disable it, and what happens to pending work and existing records?
- How do I recover from missing access, stale data/approval, invalid input,
  provider failure, duplicates, cancellation and version changes where applicable?
- Where are the source contracts, extension points, compatibility limits and tests?
- What was actually verified, in which environment, and what remains unverified?

State when a question does not apply and why. Never describe planned controls as
working, a report as a full business workflow, a simulation as a provider test, or
configuration as enforced automation. Use fictional data; no secrets, private
customer content or fabricated provider receipts in examples.

## Verification and review

`npm run verify:extensions` rejects missing guides, empty guide content, missing
documentation links and unsafe link schemes for bundled extensions. The manifest
schema requires `docsUrl`. This is an offline structural gate; it cannot prove
that instructions are accurate, that an external page is available, or that a
public `/docs/...` route is the right task guide.

Before acceptance, the reviewer follows the documented task against the exact
candidate. Record inputs, result, recovery exercise, commit, commands and evidence
on the live card. Check the public link, settings names, costs and permissions
against the implementation. Exercise the same admin components with fictional
demo data when a demo is claimed. Include disabled and unavailable states.
Use the [documentation writing guide](../contributing/DOCUMENTATION-STYLE.md)
for public MDX and navigation changes. A passing content check cannot replace
this review. An implementing-agent review must disclose that fact.

New settings, tools, effects, provider options or behavior changes update the
guide in the same change. Include upgrade/reapproval steps when existing users
are affected. Missing proof stays on the live board and prevents a full release
claim; do not hide it in a README footnote or a second roadmap.

## Flagship Radar acceptance

Radar's release card must demonstrate one complete evidence-to-outcome journey
for SuperDebate and an unrelated business using the same plugin and admin/demo
code. Evidence must cover inexpensive/offline operation, actual budget reservation
and provider refusal, grounded outputs, relationship history, explicit approvals,
retry without duplicate effects, tenant separation, disable during work, truthful
receipts and independently supported outcome metrics. Public-affairs material
stays in a neutral, cited, unranked review lane.

The operator guide must be followed from a clean install and through AI setup.
All advertised stages must work before calling Radar a flagship release. The
profile and bounded-briefing foundation is only one prerequisite; it has no
discovery worker, sender or publisher. Cost enforcement does not establish the
full evidence-to-outcome journey.
