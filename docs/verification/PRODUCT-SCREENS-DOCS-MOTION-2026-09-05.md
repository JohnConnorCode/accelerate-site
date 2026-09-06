# Product screens and documentation entrances — 2026-09-05

Scope: public Command Center page, homepage product preview, shared product slider, and all documentation routes. The real `/demo/command-center` application remains the interactive destination.

| Before                                                                           | After                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mock approval queue and embedded simulation compete with the real demo           | Clear product introduction and one large gallery captured from the real demo, with explicit fictional-data labeling                                    |
| Homepage loads a separate simulated workspace                                    | Shared real screenshot gallery and canonical demo link                                                                                                 |
| Repeated screenshot gallery later on the product page                            | Screens lead the page once; the Open Source section focuses on ownership and setup                                                                     |
| Obsolete embedded demo, action modal, and session state remain callable          | Removed unused simulation components; historical QA command uses canonical admin demo coverage                                                         |
| Product nav says Demo for the embedded simulation                                | Product screens link; old #demo anchor lands on the screenshot gallery                                                                                 |
| Slider advances while visitors read, with tiny dots and off-screen focus targets | User-controlled slides, 44px controls, active-slide-only keyboard focus, swipe/click distinction, caption announcements, and shared enlargement viewer |
| Slider uses Framer track motion and transition-all dots                          | Interruptible CSS transform with explicit dot properties and reduced-motion override                                                                   |
| Docs content arrives without an entrance                                         | Shared pathname-keyed, declarative semantic entrances across landing and every guide, with 60ms stagger capped at 180ms                                |
| Potential long chained or nested prose animations                                | Independent content blocks, no moving body ancestor, 420ms duration; reduced motion and absent JS keep content visible                                 |
| Source statistics count removed implementation files                             | Recomputed public statistics: 128K lines across 687 TypeScript files                                                                                   |

Verification: scoped lint, formatting, statistics, agent contract, and diff checks locally. Remote CI covers build/type validation and browser journeys; added desktop/phone, normal/reduced-motion checks for slider controls, full-screen viewer, intermediate docs animation frames, guide navigation, and overflow. Final CI evidence is recorded on PR #32. Local preview remains on port 3025 with the resource gate; no additional local build or QA browser is started. No deployment or production data changes.

## Public entrance consistency follow-through

The founder identified `/work` and `/learn` skipping their heading entrance. The shared word-mask component explicitly used `initialViewport: "immediate"`; the older section/intro wrappers used Framer `initial={false}` without a hidden initial state. Source presence and settled screenshots had failed to detect these missing animations.

| Before                                                       | After                                                                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initially visible shared headings skip animation             | Shared word-mask default animates; pending state is in server markup before paint                                                                                                    |
| Legacy section and intro wrappers arrive already visible     | One shared observer and bounded CSS entrance/stagger recipe, preserving a fade-only option for sticky content                                                                        |
| Nested wrappers/headings can run independent entrances       | Parent ownership context suppresses nested entrances                                                                                                                                 |
| Reused public wrappers retain settled state across routes    | Pathname keys and the shared lifecycle restart committed route entrances                                                                                                             |
| Main navigation exposes Learn and Resources                  | Hidden from desktop/mobile primary navigation at the founder's request; direct pages and footer remain available                                                                     |
| Checks establish markup presence or only settled screenshots | Browser matrix samples actual intermediate frames for twelve public header routes, both widths/motion preferences, plus real Work menu navigation; full Work portfolio QA runs in CI |

The docs timing probe now derives its sample from the animation's actual delay and duration. A fixed 180ms sample could coincide with the capped start delay and incorrectly report no intermediate frame. This changes the probe, not the entrance acceptance requirement.
