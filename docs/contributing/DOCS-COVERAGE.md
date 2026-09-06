# Verify documentation coverage

A documentation change is ready for review when its source checks pass and the
built pages contain the required routes and reference entries. CI runs both.
An author still reviews whether the instructions are correct and useful.

## Choose the check for the work in front of you

| Command                           | Evidence                                                                                                                           | Exit behavior                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run verify:docs`             | Manifest/file bijection, frontmatter, module ownership, relative help URLs, docs links, catalog owners and empty/placeholder prose | Fails on a source issue; does not claim built coverage                           |
| `npm run verify:docs -- --report` | JSON findings, page/route inventory and separate `sourcePassed`, `buildChecked` and `strictPassed` fields                          | Findings do not cause a nonzero exit; incomplete coverage stays explicitly false |
| `npm run verify:docs -- --strict` | Source checks plus every docs route, internal anchor and registered capability/tool entry in the actual build                      | Fails on missing build evidence or any coverage issue                            |
| `npm run verify:public-prerender` | Existing public-route checks followed by the strict docs gate                                                                      | Fails if either contract fails                                                   |
| `npm run test:docs-coverage`      | Fifteen controlled failure and mode-semantics cases                                                                                | Fails when a regression lets broken coverage pass                                |

Use `--prerender <path/to/prerender-manifest.json>` to check an alternate build
folder. The matching HTML must be in that folder's `server/app/` directory.
Source-only inspection cannot certify rendered pages. A report's zero exit code
means the report ran; inspect `strictPassed` before treating it as full coverage.
`--allow-missing` remains a report-mode compatibility option and never establishes
a strict pass.

## Fix a reported gap

1. Start with the named page, module or route. The manifest in
   `src/content/docs/manifest.ts` owns page paths and module-to-section ownership.
   The MDX file owns the prose. Keep its title and description aligned with the
   manifest so search and navigation describe the same page.
2. A first-party module must belong to exactly one guide section and point to
   that section with a site-relative `docsUrl`. Fix the ownership or URL instead
   of creating a placeholder page. Extension URL schema validation remains in
   `verify:extensions` and `verify:module-contract`.
3. A broken docs link names its source and resolved target. Fix the path; a
   fragment also needs its target ID in the built HTML. Code examples and MDX
   comments do not count as rendered catalog ownership.
4. A missing reference entry names the registered capability/tool ID. The
   catalog components read their existing registries. Repair that display path;
   do not paste a second tool list into the prose to satisfy the check.
5. Run the source check and regression suite. For final build evidence, use CI or
   the repository's resource-gated build workflow, then run the strict gate.
   Inspect any content or interaction changes with the required browser checks.

## What the build check establishes

The docs manifest defines the expected landing, section and page routes. The gate
compares that exact set with the build's prerender manifest, reports missing or
orphan routes, and reads built HTML for anchor and reference coverage. Every
registered capability and AI tool must appear exactly once in its reference page.
A section route cannot stand in for an omitted leaf page.

The gate rejects empty pages and explicit placeholder markers. It cannot judge
whether plausible prose is accurate, complete or well written. Use
[the documentation writing standard](DOCUMENTATION-STYLE.md) and verify the
operator's task against the application. Do not mark content work complete from
structural coverage alone.

## Handoff evidence

Attach the exact commit, source and strict command results, regression result,
and real CI/build receipt to the live work card. Report unfinished content on its
existing authoring card. Keep review and acceptance separate from source coverage.
The test suite's synthetic build manifests prove failure behavior; only the
strict check against the actual application build proves that build's coverage.
