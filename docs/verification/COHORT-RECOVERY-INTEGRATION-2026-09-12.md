# Recovery integration, 12 September 2026

This candidate combines accepted work on published `a87c79bf`. It preserves the
existing work board, navigation runtime, domain services and supervisor registry.
Production deployment and supervisor rollout remain separate.

| Accepted work           | Exact source                               | Passing source CI |
| ----------------------- | ------------------------------------------ | ----------------- |
| Admin language          | `5017bb30498f44209fcc99f3e8fc144eecfc59e3` | 34712624544       |
| Navigation parity       | `4bd0bb1c1574f74b7b266ac0770300c6586780ee` | 34717112794       |
| Shared Kanban           | `55e769dc850ba7aedfb1a281d0089b5290289e00` | 34716951604       |
| Services recovery       | `23a71529f0b866b2c04ff9a0d9c9d033f2a91e95` | 34717212152       |
| Supervisor continuation | `e8bf938f1856ca3c1d0f4657a77c04780318b265` | 34717044128       |

Navigation includes the accepted language source. All individual workers, original
source pins and PRs remain intact. Canonical cards contain acceptance evidence;
merge and deployment receipts are separate facts.

## Integration changes

Changelog conflicts retain every accepted entry and the published Social Marketing
entry. The existing CI loop runs all six polish/language suites and retains a
failure from any suite. Services keeps its explicit fictional analytics boundary;
its console check now records every error instead of suppressing failed requests.
Source statistics are recomputed after conflict resolution: 93 migrations,
238 checks and 884 TypeScript source files, rounded to 170K lines.

## Reviewed evidence

Navigation has 336 semantic route cases across live admin, tenant routes and all
six demo businesses. Its 126-case browser matrix covers direct load, keyboard
search, Back and module visibility. Root opened settled desktop/mobile images for
all six businesses after fixing capture during closing overlays.

Kanban has 63 geometry measurements, 441 state measurements, 54 retention assertions,
13 interactions and six existing navigation journeys. Shared loading bars fit the
mobile container; scrolling and Back restoration use the existing bounded cache.
Root reviewed the owning source and representative final mobile/desktop images.

Services has 27 revealed-section checks across desktop, mobile and reduced motion,
with real keyboard focus and anchor navigation. Root opened the final closing
headlines, process and footer images. Word positions are checked before capture;
a visible heading container alone did not prove its masked words were readable.

Supervisor has 20 isolated synthetic tests, including real native process
replacement with a fake provider and competing continuation attempts. Installed
provider help and native paths were inspected. Actual provider authentication,
credits and original transcript availability remain untested. No live agent was
resumed or enrolled by this verification.

The final combined commit still requires its own complete CI. Its PR and canonical
delivery receipts will record that run and the eventual merge tree comparison.
Executor, proposal, neutral distribution and other unfinished cohort cards are
excluded from this candidate and remain open under their original acceptance.
