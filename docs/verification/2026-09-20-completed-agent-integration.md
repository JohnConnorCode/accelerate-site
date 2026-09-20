# Completed-agent integration review

The founder authorized merging completed agent work and checking deployment
readiness. Production deployment, live database migration and provider activation
remain separate. Published base: `8baccd279ef2cd5f2bd21b2e401f6f9924642902`.
The integration runs in its own checkout; all existing worktrees, dirty edits,
checkpoint refs and live claims remain untouched.

## Included sources

| Work                                                        | Source                                     | Integration treatment                                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command Center feature copy, contrast and semantics (PR114) | `8b39fd172297611a5f369018a754b690c3715053` | Patch-equivalent commits `e50775c1` and `715e3661` are in PR115 ancestry. Later reviewed product copy refines these changes.                        |
| Plugin/forms hardening and scoped Site Studio MCP (PR115)   | `0f91ff3eb4ba612ec9d7167ffc962e0923e996c0` | Included through PR117 ancestry. Five additive migrations retained unchanged; not applied live.                                                     |
| Complete neutral-default distribution (PR116)               | `5f582b8e30121e3e36b44aaabac6148828a757a1` | Included through PR117 ancestry.                                                                                                                    |
| First-use setup and analytics fixes (PR117)                 | `afda2e3e0d15bdbe5a8b6ef57a02a938b03f0ea3` | Exact submitted source included.                                                                                                                    |
| Product value, guided demos and recipes                     | `b4a3a3e1aa7585855110b93b4e8ca88e80c9f96a` | Included through the industry successor.                                                                                                            |
| Twenty industries and Chicago expansion                     | `a52709d9e1716d10b80ba0560e1d4d9b95da7f81` | Included through the industry successor.                                                                                                            |
| Industry/Chicago release polish                             | `624ad81dd7c6ee367168c58954b46c2b53eafbd1` | Merged with the neutral-default candidate.                                                                                                          |
| Phase B durability and gate proof                           | `681f8abab5a44d494ee9c2c249df193713c47172` | Cherry-picked only its tests and commands, preserving newer core coverage. Corrected its sequential subprocesses before claiming concurrency proof. |

## Exclusions found during acceptance review

Submission is evidence to review, not automatic release approval.

- `brain-source-authority`, source `60539b31`: its migration now enables RLS,
  unlike the old draft PR81, and its schema registration uses the existing client
  wrapper to attach tenant identity. Replay still compares only the system key,
  returns a conflicting insert winner without checking the exact payload, and
  commits the write separately from its audit. An audit failure followed by retry
  therefore returns the saved row without recovering the missing audit. No real
  two-tenant database proof accompanies this handoff. Retained for repair, not merged.
- `roles-and-permissions`: the submitted full SHA does not resolve. The actual
  `cf808a045d07a4b9228682f21fe0ad01a1959ca7` migration creates one row per permission,
  then changes multiple distinct permissions to the same unique read key, which
  conflicts with its own uniqueness constraint. Membership policy also queries
  its own RLS-protected table. It lacks current migration-catalog and authorization
  integration. Retained for repair, not merged.
- `drive-provenance-retrieval`: the submitted zero-padded SHA does not resolve.
  Actual `c0cabcdfa950326c5e069f9c82ac948f0493d512` uses a boolean environment flag
  to advertise semantic retrieval without implementing a semantic request, and
  its no-contact/no-company branch ignores matching Drive records. Citation fields
  alone do not establish the submitted clickable-UI acceptance. Retained for repair.
- `command-center-product-redesign-v2`, tree `0de46e32` (submitted empty checkpoint
  `f2caeda9`): the older Tasks implementation replaces the newer task editor and
  exact action-review dialog with a reduced queue surface. Its report also omits
  subscriptions because they did not exist at its base. Do not overwrite shipped
  functionality with this stale redesign; a current-base reconciliation is needed.
- Draft PR81 includes unresolved decision-memory isolation and atomicity findings.
  The new source-authority submission does not clear those separate findings.
- Dependabot PR107/108 are dependency proposals, not completed agent handoffs.
  This integration leaves package versions and the lockfile unchanged.
- `agent/staleness-gate` has no submitted card-linked acceptance and adds a new
  mandatory submission policy. It is not silently enabled during release work.
- `agent/retained-resources`, `agent/site-studio-ai-parity`, the Social Marketing
  pilot checkpoint, and predecessor dirty worktrees remain unfinished/retained.
  Checkpoint refs, SD Command backlog templates and the preserved Learning Inbox
  template are not independent verified product changes.
- The subscription branch was already integrated by PR102. The historical Site
  Studio branch was reconciled into published Site Studio work; do not replay its
  older admin/theme/task changes over the current owners. The historical
  `agent/docs-first-value-guide` audit receipt is already present in main.

## Conflict and integration decisions

| Before                                                                       | After                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two independently verified public page trees overlap.                        | Keep the industry successor's value-led page, shared hero entrance, accessible native capability disclosure and accurate copy. Keep the fork candidate's shared content types, neutral defaults and scoped MCP descriptions. |
| Each branch prepends its own release entries and route inventory.            | Retain every entry and both route sets; regenerate the documentation index from merged sources.                                                                                                                              |
| Chicago is new to the neutral-default route classifier.                      | Add it to the shared agency roots and assert it is unavailable without owner publication.                                                                                                                                    |
| The new demo chooser requests protected screenshots in a neutral full fork.  | Both chooser and workflow showcase omit bundled screenshots when branding is disabled. Fictional workspace links, instructions and results remain usable.                                                                    |
| Neutral setup QA jumps directly into a scenario.                             | Follow the real setup-to-chooser link using the keyboard, capture both widths, and reject protected screenshot requests.                                                                                                     |
| Two CI branches have different aggregate dependencies/manual modes.          | Preserve all four required jobs and the opt-in public-only mode; verify every failed, cancelled or skipped dependency refuses the aggregate.                                                                                 |
| Phase B claims a race but calls synchronous subprocesses inside promises.    | Use concurrent asynchronous subprocesses with a timeout and rejection on process failure; run its PostgreSQL proof in required CI.                                                                                           |
| Public source counts describe individual candidates.                         | Recompute counts for the combined tree.                                                                                                                                                                                      |
| A custom business name can push mobile header controls outside the viewport. | Let the shared logo shrink within its available width while preserving full-sized menu and close controls. Neutral desktop/mobile QA verifies keyboard opening, closing and control bounds.                                  |

## Verification and release boundaries

Maintainer preflight passes under `JohnConnorCode`: required `verify` CI, strict
updates and administrator enforcement remain enabled. There is no self-approval
requirement. Exact combined-source CI and opened browser evidence are recorded in
the integration PR before merge. Earlier PR117's targeted fork checks passed,
but its full browser job failed a 213ms services long task against a 200ms limit;
that older run is not represented as green and the threshold remains unchanged.

Local work uses focused tests and existing dependencies. Heavy verification runs
on GitHub's clean runners because the user declined closing development apps.
No resource gate is bypassed and no unrelated process is stopped.

The exact Vercel project/team is accessible and `deploy:check` passes in the
existing linked checkout. GitHub's Vercel status separately says “Account is
blocked.” Successful read access does not prove deployment permission.
To retain the existing agency presentation, the original installation must select
`NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded` before its next build. It can also run
neutral on the same hosting project. Fresh forks stay neutral by default. Hosting
acknowledgement now uses `ACCELERATE_ORIGINAL_HOSTING=1` independently of the profile,
with exact authenticated target checks still required. This corrects the earlier
coupling that would have prevented our own installation from turning agency
presentation off. No production environment setting is changed by this merge.
Read-only environment-name inspection confirms the production profile setting is
absent; the four required database/owner variable names are present. Values and
secrets were not printed. Initial integration CI also caught a duplicate profile
import from the overlapping branches; the shared import is now declared once.

Before release, verify the five new migrations against the intended database,
the chosen production profile, hosting eligibility and recovery. Live
ChatGPT consent/refresh/expiry/revocation, connected form/provider receipts and
backup/restore proof remain required for their corresponding production claims.
Source MIT licensing does not override the protected asset terms in `ASSETS.md`.
No merge receipt is claimed until GitHub accepts the exact verified candidate;
the resulting main tree must then match that candidate byte for byte.

The combined run at `b247b624` passed core/database checks, the exported starter,
and 103 industry/Chicago checks. Its broad browser job failed only the Services
performance threshold (202ms against 200ms), repeating the earlier 213ms finding
while unrelated browser groups were active. CI now measures navigation after all
three parallel groups finish; the 200ms limit is unchanged and a regression
asserts this sequencing. The separate full-product build exceeded the existing
3 GiB process-group limit; no resource limit is raised or bypassed. Final CI must
establish both results on the updated source before merge. Shared wordmarks now
use native ellipsis when the available header width cannot fit a business name,
instead of clipping a partial letter beside the protected navigation controls.
