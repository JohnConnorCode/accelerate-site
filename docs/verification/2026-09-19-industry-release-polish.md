# Industry and Chicago release polish

## Scope and ownership

This follow-up starts from submitted expansion `a52709d9e1716d10b80ba0560e1d4d9b95da7f81`, which includes the earlier platform/demos/docs work at `b4a3a3e1aa7585855110b93b4e8ca88e80c9f96a`. Their review and integration remain separate. This task changes public content and shared presentation only; no database, provider, environment or dependency changes are required.

## Content and conversion

| Before | After |
| --- | --- |
| Ten new industry heroes used the same general introduction and long headlines. | `verticals.ts` gives each a shorter, distinct headline and an introduction explaining its business situation, service and outcome. |
| Twenty industry search summaries mixed generic promises and broad claims. | Each summary names the audience and specific work supported. Existing route titles and canonical ownership are preserved. |
| Earlier industry examples were labeled as sequential steps although they described separate workflows. | `VerticalPage.tsx` labels the two-example layout as workflows, with concrete titles; the three-step layout uses capture, review and handoff. |
| Visitors had no industry-specific way to assess a pilot. | Each of twenty pages explains what to measure and what evidence makes its handoff useful. Criteria are explicitly suggestions, not claimed results. |
| The primary industry CTA gave little preparation guidance. | Supporting copy tells visitors to bring a recent example and their current tools. The cost FAQ explains what determines scope. Existing contact destinations and conversion identifiers remain intact. |
| Chicago explained services but gave little help choosing and scoping a first project. | Its hero names Chicago AI consulting; a practical project section covers real examples, deliverables, evaluation, responsibilities and recurring costs. |
| Ten intake recipes ended with a generic result check and unrelated checklist retry advice. | Each names the actual business decision and evidence to check. Recovery now covers contact matching, response acceptance and the read-only follow-up report. |
| Ten handoff recipes began near the inquiry stage and left ownership implicit. | Each starts with the relevant agreement or stored meeting and includes a three-task table with suggested owners and completion evidence. Workspace members and due dates must still be selected. |
| Public release copy described the expansion only. | The existing changelog entry also describes pilot measures and practical task responsibilities. |

## Design and SEO

| Before | After |
| --- | --- |
| Industry hero columns aligned at the bottom, leaving introductory copy low beside long headlines. | The shared template uses the existing top-aligned grid variant. Shorter new headlines improve the first-screen hierarchy. |
| Page sections relied mainly on similar cards. | `product.module.css` adds a lightweight definition-list layout for evaluation and project guidance, with responsive columns, clear rules and readable line lengths. It adds no client JavaScript or asset requests. |
| Learning sitemap dates assumed newest publication meant newest revision. | `sitemap.ts` orders articles by their effective publication/update date before deriving hub, category and tag dates. |
| Browser QA relied on registry position to identify new industries and checked sitemap presence only. | It selects explicit slugs, checks rendered descriptions and pilot content, and verifies hub/category/tag dates against all matching articles. Local navigation timing is recorded as diagnostic evidence. |

## Factual and release-content review

- Inspected `TaskWorkflowWorkspace.tsx`, `workflow-task-contract.ts` and `workflow-tasks.ts`: source opportunity/meeting, one to ten tasks, actual assignees, review/proposal/approval controls and a won opportunity requirement remain correctly described.
- Reviewed `command-center.ts` and `command-center-faq.ts`: this task changes no product capability, plugin default, permission or demo behavior. Their feature descriptions remain accurate for this scope, so no capability rewrite was needed.
- Reviewed the docs voice and marketing positioning contracts. Agency services remain broader than the optional Command Center. Specialist systems retain authority, and the recipe examples make no customer outcome claims.
- HQ remains the previously verified Ferris address supplied by the founder. No new location, opening hours, visitor arrangement or Ferris affiliation is asserted.
- Generated docs index reviewed with `docs:llms` and `docs:llms:check`; its metadata-only output is unchanged because recipe titles and descriptions did not change.

## Verification

Final results and inspected screenshots are recorded below after the production build and browser run.

## Release boundary

This is a local implementation and verification handoff. Review acceptance, integration with the dependent submissions, CI and an explicitly authorized production release remain separate. Browser analytics are stubbed; no production conversion, live provider delivery, Search Console result, organic ranking or field Core Web Vitals result is claimed.
