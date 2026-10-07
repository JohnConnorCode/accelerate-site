# Owner workspace and guides continuation

Continued the retained `fix/admin-owner-workspace-20261006` checkout at
`82f2af339b37c578502991f24fd4aba94e264a93`. The existing admin and guide work
remains intact. This continuation completes its unfinished CI wiring; it does
not claim a new merge, production release or successful visual review.

## Retained implementation

The branch connects Today’s sourced business review to inquiry replies,
client-onboarding tasks and separately approved invoice creation and sending.
Its public walkthroughs explain the starting screen, saved result and recovery.
Recent checkpoints also fit invoice preparation within the phone viewport and
release temporary entrance transforms after content settles.

Reviewed the current walkthroughs, owner guide, Today guide, owner-workspace
browser journey, Site Studio journey and shared navigation contract. The guide
content and screenshots are inherited from the retained work, not newly captured
or browser-verified during this continuation.

## CI completion

The full browser job now runs `qa-navigation-runtime.mjs` and
`qa-navigation-filmstrip.mjs` sequentially after the competing browser groups.
Each failure contributes to the final job status without preventing the other
navigation check. The existing always-run owner-workspace artifact upload now
retains both navigation evidence directories. Docs-only and public-page-only
jobs keep their existing scope.

## Verification

The following checks passed against the retained application source:

- `npm run verify:agent-contract`.
- `npm run build`, including TypeScript validation and static page generation.
- `npm run lint`.
- `npm run verify:docs -- --strict`: 126 pages, zero errors and warnings.
- `npm run docs:llms:check`: generated index current.
- Resource-gated `test-today-workspace.ts`: review source identities,
  missing Collections, partial/unavailable reads and Today contracts.
- Resource-gated `test-navigation-runtime.ts`, `test-workflow-views.ts` and
  `test-search.ts`.
- Workflow YAML parsing, `bash -n` for its 80 shell steps, syntax checks for
  both navigation browser scripts, Prettier for the workflow and
  `git diff --check`.

The build’s application inputs match the retained checkpoint. This continuation
changes only CI wiring and this verification receipt, so it does not require
another application build.

## Local browser limits and connector recovery

Both initial and full-access browser attempts failed before opening a page:
Chromium’s macOS Mach-port registration returned error 141. Owner, daily-work,
Site Studio, navigation, filmstrip and docs journeys therefore remain unverified
in this continuation. Native browser discovery returned no available browser.
Failure logs are in `/tmp/accelerate-owner-resume-browser.log` and
`/tmp/accelerate-owner-resume-browser-full-access.log`; per-suite failures are
retained in `/tmp/accelerate-owner-resume/`. Owned local servers were stopped.

The local GitHub CLI could not resolve `api.github.com`. The connected GitHub
service subsequently confirmed that [PR #229](https://github.com/JohnConnorCode/accelerate-site/pull/229)
is open and draft at the retained application checkpoint, and that
[run 37568917565](https://github.com/JohnConnorCode/accelerate-site/actions/runs/37568917565)
passed every required job, including production build, browser journeys, source
checks and the final `verify` job. Its test-merge source tree matches
`e2dda82e5f84a34a5b1c2db5739599e667a5d76c`, the retained application tree.

Opened the downloaded desktop onboarding-result capture and desktop/phone
Website & pages captures from that exact run. The Frost result surface visibly
paints its tasks, due dates and completion controls. The private-draft form,
installation editor link and phone navigation render correctly. The Site Studio
guide figure now uses the exact `1440-create.png` capture from that run; its
existing alt text, caption and 1440×1000 dimensions match the replacement.

The build job now allows 60 minutes for the full browser coverage and artifact
uploads, alongside the isolated navigation checks added in the earlier local
checkpoint. Workflow validation also passes all 17
`test:verification-workflow` cases. Fresh CI remains required for this final CI
and image follow-up; the prior successful run proves the retained application,
not these later files. No merge or production action was taken.

## Screenshot cache compatibility follow-up

The concurrent `e906de2d` revision extends the published follow-up with
screenshot-byte cache keys and rendered-figure assertions. Its production build
identified a real Next.js compatibility failure: versioned local screenshot
URLs were rejected by `images.localPatterns` during guide prerendering.

The isolated final-review checkout preserves that revision and allows query
strings specifically under `/images/docs/`. All other local image paths keep
their query-free rule. The existing guide test suite now exercises the actual
Next.js matcher against the application configuration, including refusal of
versioned unrelated paths. Guide content, full-size links and external image
rules retain their existing behavior.

The final-review tree initially matched the remote revision's
`8b092f42de89e7dd9c42ce26c892df142d37f065` tree exactly. Local heavy testing
was refused at 4.3 GiB available disk against the required 5 GiB starting floor;
that refusal is retained separately from the confirmed remote build failure.
The compatibility correction requires a new exact-source remote build and guide
browser checks. It does not reuse the earlier application's build as proof.
