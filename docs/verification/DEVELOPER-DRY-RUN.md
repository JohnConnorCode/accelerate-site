# Developer dry run

## Fresh published checkout

Cloned `agent/developer-handoff-readiness` from GitHub at
`12a7b710925191ad51cefa45afce809c69330398` into a new temporary repository.
No environment or credential files were copied.

The first doctor run failed specifically for missing dependencies and gave the
`npm ci` instruction. After comparing exact lockfiles, the local check reused
compatible installed dependencies, installed the versioned hooks and passed the
default doctor. Fresh dependency installation and the app build are covered by
[CI 34009176677](https://github.com/JohnConnorCode/accelerate-site/actions/runs/34009176677).
This local check does not claim to have run a second `npm ci`.

Used the dated ready packet `canonical-tools-route-inventory` to prepare its
isolated worktree. The fetched base was exactly
`50f3aa671751619f44af22bb0736618c362d1b6b`. Both referenced files were present at
their declared revisions. No live card was claimed for this preparation check.

## Execution controls

The developer suite now exercises the actual CLI through claim, heartbeat,
progress, release, reclaim, a real Git change/commit and evidence submission.
A stateful HTTP fixture checks revisions and the retained claim token. Submission
includes the exact implementation commit and an acceptance ID/environment. The
result stays `in_review`, and both release and submission preserve the worktree.

This proves the CLI control sequence against a controlled protocol fixture. It
is not a shared-service or independent-review integration receipt. The SQL work
protocol and application have separate tests; do not describe this fixture as
proof that a connected development team has completed a live ticket.

## Instruction fix

The agent entrypoint previously sent every new developer through connected
self-hosting before starting. It now directs local exploration to the
credential-free demo and reserves connected setup for tasks that need it.
