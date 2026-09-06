# Maintaining the Command Center docs

The public docs live in `src/content/docs/`. `manifest.ts` owns section order and
page summaries; `src/lib/docs.ts` loads the MDX. They are not database pages.
The `/docs` routes serve the guides. The shared search index includes their body
text and generated reference catalogs; the docs search filters to this library.

## Write for a reader with a task

Start with the result the reader wants. An operational guide should explain:

1. What the task accomplishes and what access or connection it needs.
2. Where to start, using actual screen and control names.
3. The steps, with a fictional example where it removes ambiguity.
4. How to recognize a successful result.
5. What to inspect when the task fails or its outcome is uncertain.

Explain architecture in the extension reference when it helps a developer make
a decision. Operator guides should not require knowledge of database tables,
HTTP response codes, or internal service names to complete everyday work.
Distinguish manual actions, AI proposals, approvals, execution, and delivery.
Do not describe future behavior or a connected provider as ready without evidence.

## Keep navigation and search accurate

Keep page titles and descriptions identical in frontmatter and the manifest.
The verifier rejects drift. Preserve existing URLs where possible. When changing
a route, review links, section landings, search results, sitemap, and the generated
`public/docs-llms.txt` index together.

The first page in each section remains its overview. Prefer a task name over a
vague label. A short reference page is useful when it answers a distinct question;
do not split one task into several pages merely to increase the page count.

## Use visuals deliberately

`DocsFigure` uses existing public assets with a caption and full-size link. Show
fictional data and label it. Do not present a demo screenshot as live production
proof. Keep screenshots current with the interface they teach. The capability
and tool catalogs stay generated; do not copy their lists into MDX.

## Verify changes

Run `verify:docs`, `docs:llms`, `docs:llms:check`, and `test:search`. The docs browser
check is `qa:docs`, against `DOCS_QA_URL`; it covers desktop/mobile rendering,
search, empty and failure states, retry, navigation, and tool schemas. Inspect its
screenshots as well as its assertions. Run heavy checks through the resource gate
or in CI. Do not launch overlapping local servers or builds.
