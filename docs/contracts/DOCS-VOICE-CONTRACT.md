# Public docs voice contract

This is the durable source of truth for prose in `src/content/docs/**/*.mdx`.
It inherits the [marketing positioning contract](./MARKETING-POSITIONING-CONTRACT.md)
and the [documentation style guide](../contributing/DOCUMENTATION-STYLE.md).

## Help the reader do useful work

1. Establish what the product or screen does and why the reader would use it.
   A product introduction may start with a clear definition. A workflow guide
   should start with a recognizable business situation and its practical result.
2. Explain the feature, the action and the saved result. Give a concrete example
   with named fictional records where useful. Avoid promising financial returns,
   time savings or outcomes that have not been measured.
3. Use complete, connected sentences. Choose the length that makes the task easy
   to understand. Do not use a word count or sentence-length target as a substitute
   for useful explanation.
4. Keep adjacent headings and descriptions distinct. Each should add information
   about the purpose, action, example or setup.
5. Put a dependency or limitation beside the decision it affects. Keep deeper
   diagnostics and recovery available in a later section. Do not hide requirements
   at the end merely to make an opening sound more impressive.
6. Describe the actual action policy. Manual edits, proposed AI changes, external
   sends and standing permission have different rules. Verify the relevant runtime
   contract before describing approvals or increasing autonomy.
7. Show the actual shared interface in guides for admin screens. Use `DocsFigure`
   with its captured dimensions, a helpful alt description and a caption identifying
   fictional data. Recapture an affected image after a visible interface change.
8. Use prose and lists for guide choices, tables for structured comparisons and
   reference data, and existing MDX components when they improve comprehension.
   `CTACard` and `ToolRecommendation` remain forbidden in docs.
9. Give business operators and builders useful routes. Operator guides explain the
   business workflow. Builder guides explain how to reuse or extend its owner.
   Start the builder path with a working change and a visible result.

## Positioning and source facts

Command Center is an **open-source AI business platform you can make your own**.
Its business areas are customers and conversations, sales and follow-up, delivery,
billing and collections, marketing and publishing, and custom Apps and AI.
Use [the shared business model](../../src/content/command-center-business.ts) for
discovery, [the capability catalog](../../src/content/command-center.ts) for current
features, and [the docs manifest](../../src/content/docs/manifest.ts) for guides.

The business model is discovery metadata. It cannot grant a module, tool, provider
connection or permission. Check the runtime owner for availability and behavior.
Do not copy capability counts, tool counts, defaults or policy thresholds into this
contract. They change; link to the current reference and verify them in source.

The six fictional demos use the same admin components and browser-session records.
The hosted demo has a bounded real-inference option. External business provider
writes remain unavailable there. Verify current inference limits in the demo
runtime before describing them.

Current custom development uses the repository and an external coding agent.
AI App building inside the workspace is planned. Distinguish available, optional,
provider-dependent, custom development and planned behavior at the point of use.

## Mechanical requirements

- Use plain language and normal prose. No em dashes, inflated claims, invented
  proof, canned contrast slogans or booking calls in product docs.
- Frontmatter titles and descriptions must match the docs manifest exactly.
- Set `updated` to the actual edit date.
- Every internal docs link must resolve. Preserve existing slugs and help anchors.
- `DocsCapabilityCatalog` and `DocsAiToolCatalog` each appear on one page.
- Generate `public/docs-llms.txt` with `npm run docs:llms`; never hand-edit it.
- Run `verify:docs`, `test:docs-coverage`, the copy checks and relevant behavior
  tests. Inspect screenshots separately before declaring visual acceptance.
