# Public page loading verification — 2026-10-02

Completed the retained performance changes in `accelerate-site` on
`agent/command-center-copy-rewrite`, based on `8b39fd172297611a5f369018a754b690c3715053`.
This is a local implementation and verification receipt. It does not approve a
merge or production release. The unrelated `.tmp-probe/` scratch work is excluded.

## Behavior before and after

| Area                  | Before                                                                                                          | After                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public search         | The header imports the full dialog and search implementation on initial load.                                   | The shortcut remains available immediately; the dialog loads when first opened and remains mounted for subsequent use.                                                                                                              |
| Public chat           | The initial widget imports the conversation panel.                                                              | The panel loads on first open. Focus moves into the loaded panel, Tab stays within the dialog, and Escape returns focus to the trigger.                                                                                             |
| Styles                | Workspace themes and component chrome are imported by the root stylesheet.                                      | Public theme variants and shared fields remain global; admin layouts, the demo launcher, design preview and site preview load workspace chrome.                                                                                     |
| Public fields         | Shared field recipes depend entirely on workspace tokens.                                                       | Shared fields use public fallback tokens, visible borders and a 44 px minimum height while retaining admin overrides.                                                                                                               |
| Homepage gallery      | A below-fold product screenshot is prioritized.                                                                 | Homepage gallery screenshots load normally; other gallery placements retain their existing priority default.                                                                                                                        |
| Route focus           | The destination observer repeats heading queries after unrelated subtree mutations.                             | It skips repeated queries while the focused destination remains connected and still handles a replaced heading.                                                                                                                     |
| Published site        | Connected marketing pages read publication at request time.                                                     | Published selection and marketing output revalidate every 60 seconds. Publish, rollback, unpublish and their replays invalidate both the data tag and marketing layout after a committed write. Draft saves do not invalidate them. |
| Failure receipts      | Cache refresh is separate from the committed website receipt.                                                   | A refresh-context failure logs a safe warning and preserves the committed receipt; periodic revalidation remains the recovery path. Unavailable database selections throw from the cached loader rather than becoming cached data.  |
| Linked dependencies   | Turbopack cannot resolve dependencies symlinked outside its default root.                                       | Only linked installations widen the root to the common ancestor. Normal dependency directories keep the default behavior.                                                                                                           |
| Browser navigation QA | A fixed delay samples metadata before destination focus; reduced-motion checks count unrelated CSS transitions. | QA waits for hydration and destination focus, rejects document reloads, and counts the actual route entrance animation without changing performance budgets.                                                                        |

## Verification

All required local handoff components passed: engineering contracts, guardrails,
full lint, the full core suite, production compilation and TypeScript validation.
The build used the existing compatible dependency installation (Next.js 16.3.5;
the package declares 16.3.4). No dependencies or lockfile were changed.

- `npm run verify:agent-contract`
- `npm run verify:guardrails`
- `npm run resources:run -- npm run lint`
- `npm run resources:run -- npm run test:core`
- `npm run build` (includes TypeScript and the public-prerender verifier)
- `npm run test:site-studio`
- `npm run test:search`
- `npm run test:admin-themes`
- `npm run test:admin-demo-contract`
- `npm run verify:admin-tokens`
- `npm run verify:docs -- --strict`
- `npm run docs:llms` and `npm run docs:llms:check`
- Positioning-copy and work-portfolio checks
- `git diff --check`

The prerender verifier confirmed 42 required public routes, 195 learn pages and
8 work pages, with protected paths excluded. Site Studio tests exercise the
native Next invalidation recorder through the shared writer for publish,
rollback, unpublish, replay, draft save, invalid input, storage failure and refresh
failure. Existing publication, installation-owner and tenant isolation checks
remain in the suite. No production publication command was issued.

### Browser evidence

The production server was checked at `http://localhost:3137`. The new
`qa:public-loading` journey passed at desktop 1440 px, mobile 390 px and reduced
motion. It checks actual initially fetched JavaScript/CSS bodies, search results
and shortcuts, dialog focus and keyboard behavior, changelog field computed
styles, docs rendering, admin chrome, overflow and runtime errors. Search and chat
implementation markers and workspace chrome were absent from initial assets;
the homepage did not preload the below-fold gallery screenshot. Screenshots of
search, chat, changelog, docs and admin were opened and inspected.

Navigation source checks and desktop/mobile/reduced-motion journeys passed.
The persistent admin profile passed 120 navigations across cached, cache-disabled,
re-enabled and fresh profiles without document reloads, stale RSC responses,
service workers or runtime errors.

The final public profile passed unchanged budgets at 4× CPU throttling:

| Profile                  | Drawer p95 | Route commit p95 | Longest task | Runtime errors |
| ------------------------ | ---------: | ---------------: | -----------: | -------------: |
| Persistent, 12 routes    |     134 ms |           312 ms |       137 ms |              0 |
| Fresh, 12 routes         |     150 ms |           366 ms |       153 ms |              0 |
| Reduced motion, 6 routes |     198 ms |           791 ms |       265 ms |              0 |

The preceding public-profile run failed with a 343 ms task and persistent route
p95 of 705 ms versus fresh 330 ms. A CPU trace recorded browser layout and hero
animation work. The final measurement reused the same persistent browser
profile, retained its cache, and kept the 4× throttle and all thresholds intact.
No page, motion or performance-budget change was made between those two runs.
The timings demonstrate local variability, not a proven before/after speedup or
a production load guarantee. The failed report is retained with the passing one.

Local artifacts:

- `/tmp/accelerate-public-loading/`: passing report and inspected screenshots.
- `/tmp/accelerate-navigation-runtime/`: navigation journey evidence.
- `/tmp/accelerate-persistent-profile-qa/`: persistent admin navigation evidence.
- `/tmp/accelerate-public-navigation-profile/`: earlier failed public measurement.
- `/tmp/accelerate-public-navigation-profile-final/`: passing public measurement.
- `/tmp/accelerate-public-cpu-trace.json`: diagnostic CPU trace.
- `/tmp/accelerate-performance-core.log` and `/tmp/accelerate-performance-lint-final.log`.

## Public content review and release boundary

Added a public changelog entry and updated the Site Studio publication guide and
its generated `public/docs-llms.txt` entry. Reviewed Command Center positioning,
FAQ and the plugin overview: their publication ownership, approvals and workflow
claims still match this change, so their product prose does not need revision.

This work adds no schema migration or provider integration change. Real production
publish/rollback/unpublish behavior remains a controlled release check using
approved records; the local tests prove invalidation recording and receipt
behavior. The implementation is locally verified, with merge, remote CI and
production deployment remaining separate release stages.
