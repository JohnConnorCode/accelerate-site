# Admin spacing and motion refinement — September 12, 2026

Follow-up: `admin-spacing-motion-refinement`, based on the submitted theme polish
commit `251a0d785b6516fb49b125cc7e8788173f3e6d57`. This pass responds to the
founder's request for professional spacing and smooth behavior in every theme.

| Before                                                                                                         | After                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mobile foundation overrides could lose to base/compact selectors                                               | Matching shell and portal specificity gives both densities 18px panel padding and 20px section gaps below 640px             |
| Compact density could defeat coarse-pointer sizing                                                             | Touch controls retain the shared 44px minimum in both densities, including portals                                          |
| Navigation group labels used 10px uppercase monospaced text with wide tracking                                 | Shared label typography uses 12px, natural casing and restrained tracking; Signal retains its intentional label font        |
| Navigation links shifted 2px sideways on hover                                                                 | Links hold their alignment while color and press feedback communicate interaction                                           |
| Shared navigation, cards, help, route transitions, picker and other control recipes mixed fixed timings/easing | Shared transition durations/easing consume each theme's motion tokens and the reduced-motion override                       |
| Today toolbar/module gaps bypassed density and used default easing                                             | Toolbar margins and module gaps use section spacing; controls use shared duration/easing                                    |
| Browser tests covered layout but missed mobile token specificity                                               | Every 390px theme/density combination asserts exact panel/section spacing; compact touch mode asserts 44px controls         |
| Guides described density without the specific small-screen behavior                                            | Settings, product descriptions, changelog and contributor guidance explain consistent mobile spacing and theme-aware motion |

Theme palettes, identities, custom version-1 definitions, business operations and
saved layouts remain compatible. No API or database behavior changed. The reviewed
AdminShell source change only removes presentational label utilities; its route
inventory fingerprint was refreshed and kept in repository formatting.

Verification uses the existing remote CI workflow and fictional demo environment.
The two initial dispatches were canceled promptly for a final inventory-format
correction and Today easing alignment. No failing check was bypassed.

## Rendered verification

[Focused CI 34715326745](https://github.com/JohnConnorCode/accelerate-site/actions/runs/34715326745)
passed on `dbf3d2fe`: 56 theme/density/width combinations, 14 actual workspace
captures, 21 focused axe audits with zero violations, and representative route
checks at 1440px and 390px. The artifact contains 84 screenshots. The new mobile
spacing and compact coarse-pointer assertions pass, along with persistence,
keyboard dismissal/focus return and reduced motion. Material/macOS remain distinct
in computed typography, surface/control radius and elevation.

Opened final screenshots for all seven appearances: Paper/macOS/Signal/Studio on
desktop, Material/Night/Frost on mobile. Navigation labels now read naturally;
content remains aligned and mobile cards preserve a consistent inset. Evidence is
retained at `/tmp/admin-spacing-final-artifacts` and as the workflow's
`admin-design-evidence` artifact (seven-day retention).

## Production verification and handoff

[Production CI 34715328716](https://github.com/JohnConnorCode/accelerate-site/actions/runs/34715328716)
passed the production build/typecheck, repository checks (lint, formatting,
application/test types, documentation and core contracts), and complete
credential-free browser journey suite on `dbf3d2fe`. The suite includes admin
navigation, touch, theme persistence and editor/business workflows. All application,
dependency and test inputs are unchanged in the final handoff; only this evidence
report follows the verified commit.

Local scoped theme, token, core and agent contracts, QA syntax and final diff
checks passed. The branch is committed and pushed for review. No merge or
production deployment is included.
