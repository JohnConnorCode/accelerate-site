# Industry and Chicago release polish

## Scope and ownership

This follow-up starts from submitted expansion `a52709d9e1716d10b80ba0560e1d4d9b95da7f81`, which includes the earlier platform/demos/docs work at `b4a3a3e1aa7585855110b93b4e8ca88e80c9f96a`. Their review and integration remain separate. This task changes public content and shared presentation only; no database, provider, environment or dependency changes are required.

## Content and conversion

| Before                                                                                                 | After                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ten new industry heroes used the same general introduction and long headlines.                         | `verticals.ts` gives each a shorter, distinct headline and an introduction explaining its business situation, service and outcome.                                                                     |
| Twenty industry search summaries mixed generic promises and broad claims.                              | Each summary names the audience and specific work supported. Existing route titles and canonical ownership are preserved.                                                                              |
| Earlier industry examples were labeled as sequential steps although they described separate workflows. | `VerticalPage.tsx` labels the two-example layout as workflows, with concrete titles; the three-step layout uses capture, review and handoff.                                                           |
| Visitors had no industry-specific way to assess a pilot.                                               | Each of twenty pages explains what to measure and what evidence makes its handoff useful. Criteria are explicitly suggestions, not claimed results.                                                    |
| The primary industry CTA gave little preparation guidance.                                             | Supporting copy tells visitors to bring a recent example and their current tools. The cost FAQ explains what determines scope. Existing contact destinations and conversion identifiers remain intact. |
| Chicago explained services but gave little help choosing and scoping a first project.                  | Its hero names Chicago AI consulting; a practical project section covers real examples, deliverables, evaluation, responsibilities and recurring costs.                                                |
| Ten intake recipes ended with a generic result check and unrelated checklist retry advice.             | Each names the actual business decision and evidence to check. Recovery now covers contact matching, response acceptance and the read-only follow-up report.                                           |
| Ten handoff recipes began near the inquiry stage and left ownership implicit.                          | Each starts with the relevant agreement or stored meeting and includes a three-task table with suggested owners and completion evidence. Workspace members and due dates must still be selected.       |
| Public release copy described the expansion only.                                                      | The existing changelog entry also describes pilot measures and practical task responsibilities.                                                                                                        |

## Design and SEO

| Before                                                                                                  | After                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Industry hero columns aligned at the bottom, leaving introductory copy low beside long headlines.       | The shared template uses the existing top-aligned grid variant. Shorter new headlines improve the first-screen hierarchy.                                                                                                                                         |
| Page sections relied mainly on similar cards.                                                           | `product.module.css` adds a lightweight definition-list layout for evaluation and project guidance, with responsive columns, clear rules and readable line lengths. It adds no new client boundary, dependency or image requests.                                 |
| The bespoke nonprofit route retained an old search description and bypassed the shared pilot guidance.  | Its metadata now uses the industry record; a shared `IndustryPilot` server component supplies the same useful evaluation guidance through a server-rendered slot, preserving the bespoke page.                                                                    |
| Learning sitemap dates assumed newest publication meant newest revision.                                | `sitemap.ts` orders articles by their effective publication/update date before deriving hub, category and tag dates.                                                                                                                                              |
| Browser QA relied on registry position to identify new industries and checked sitemap presence only.    | It selects explicit slugs, checks rendered descriptions and pilot content, and verifies hub/category/tag dates against all matching articles. Local navigation timing is recorded as diagnostic evidence.                                                         |
| FAQ keyboard QA assumed a programmatic focus call succeeded after menu dismissal.                       | It follows the real Tab sequence, asserts that the question has focus, then presses Enter and verifies that its answer opens.                                                                                                                                     |
| Industry and Chicago browser checks required a manual local invocation.                                 | The existing CI build job now runs the same matrix and retains its screenshots and report as a downloadable artifact.                                                                                                                                             |
| Open-source statistics and neutral replacement types had drifted after the earlier expansion.           | The measured source line/file counts are current, the open-source sitemap date reflects the edit, and the neutral templates expose the required capability promise and product FAQ exports.                                                                       |
| New handoff tables had not been normalized by the repository formatter.                                 | The changed guides and verification report now use canonical formatting.                                                                                                                                                                                          |
| The earlier redesign bypassed the shared industry heading entrance and left docs QA tied to old labels. | Directory, industry, Chicago and product heroes reuse `PublicHeroEntrance` with ordered heading/copy/action slots. Docs QA follows current audience regions, the actual product-to-docs link and factual revenue wording; heading visibility is checked directly. |

## Factual and release-content review

- Inspected `TaskWorkflowWorkspace.tsx`, `workflow-task-contract.ts` and `workflow-tasks.ts`: source opportunity/meeting, one to ten tasks, actual assignees, review/proposal/approval controls and a won opportunity requirement remain correctly described.
- Reviewed `command-center.ts` and `command-center-faq.ts`: this task changes no product capability, plugin default, permission or demo behavior. Their feature descriptions remain accurate for this scope, so no capability rewrite was needed.
- Reviewed the docs voice and marketing positioning contracts. Agency services remain broader than the optional Command Center. Specialist systems retain authority, and the recipe examples make no customer outcome claims.
- HQ remains the previously verified Ferris address supplied by the founder. No new location, opening hours, visitor arrangement or Ferris affiliation is asserted.
- Generated docs index reviewed with `docs:llms` and `docs:llms:check`; its metadata-only output is unchanged because recipe titles and descriptions did not change.

## Verification

- Production build: `CIRCLE_NODE_TOTAL=3 npm run build -- --webpack` passed, including TypeScript and 532 static pages. Existing Next middleware/Edge deprecation notices remain outside this task.
- `verify:agent-contract`, `lint`, `verify:docs -- --strict`, `docs:llms:check`, `verify:articles`, house-style, positioning, fabricated-claim, search, both demo contracts and `test-chicago-industries.tsx` passed. Strict docs coverage: 123 pages, zero errors or warnings. Articles: 42 passed; existing editorial word-count advisories are not failures.
- Distinct-content audit: 20 unique industry descriptions and introductions, with business-specific pilot criteria on all 20 pages.
- The resource gate deferred verification while another checkout held the heavy slot. A later build was stopped when macOS memory availability fell to 2%; the failed receipt is retained in `/tmp/accelerate-polish-tests/build-memory-paused.log`. Memory subsequently recovered above the required 20%. No resource limits were raised and no unrelated process was stopped.
- Browser matrices exposed an intermittent FAQ test failure after mobile-menu dismissal. Event tracing showed that programmatic focus had failed and Enter was reaching the menu trigger, reopening navigation. Ten isolated runs had passed, so a passing retry alone was insufficient evidence. QA now follows the actual Tab path and asserts focus before Enter; no runtime navigation change was made. Failed-run and diagnostic logs remain in `/tmp/accelerate-polish-tests/`.
- Final browser result and screenshot artifacts follow after the completed rerun.

## Visual review

Opened and inspected the full desktop recipe layout and these representative crops from the production build. The new checklist fits the phone width without horizontal overflow. Hero actions remain visible and the evaluation section has distinct hierarchy across desktop and tablet.

- [Chicago desktop](assets/industry-release-polish/chicago-desktop.png)
- [Chicago mobile](assets/industry-release-polish/chicago-mobile.png)
- [Chicago project scope on tablet](assets/industry-release-polish/chicago-tablet-scope.png)
- [Industry desktop, dark theme](assets/industry-release-polish/industry-desktop.png)
- [Industry evaluation criteria](assets/industry-release-polish/industry-pilot.png)
- [Recipe checklist on mobile](assets/industry-release-polish/recipe-mobile.png)

The supported claim-continuation flow preserved the source in an isolated successor checkout after the lease expired during verification. Initial byte comparison confirmed the same build inputs. The browser metadata check then found the bespoke nonprofit route discrepancy; that fix requires a fresh production build. Local attempts were stopped by the memory gate, so final verification moved to the existing GitHub Actions runner. The predecessor checkout and its evidence are retained.

## Release boundary

This is a local implementation and verification handoff. Review acceptance, integration with the dependent submissions, CI and an explicitly authorized production release remain separate. Browser analytics are stubbed; no production conversion, live provider delivery, Search Console result, organic ranking or field Core Web Vitals result is claimed.
